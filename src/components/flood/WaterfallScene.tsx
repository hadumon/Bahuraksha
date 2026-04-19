import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import type { Telemetry } from "@/hooks/useTelemetry";
import { useIsMobile } from "@/hooks/use-mobile";

const RIVER_LEN = 80;
const FALL_DEPTH = 30;
const POOL_LEN = 60;

/* -------------------------------------------------------------------------- */
/*  Procedural normal + roughness textures (no external assets)               */
/* -------------------------------------------------------------------------- */

function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(a, b, u),
    THREE.MathUtils.lerp(c, d, u),
    v,
  );
}
function fbm(x: number, y: number, oct = 5) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * vnoise(x * freq, y * freq);
    norm += amp;
    amp *= 0.5; freq *= 2;
  }
  return sum / norm;
}

function createWaterNormalMap(size = 256) {
  const data = new Uint8Array(size * size * 4);
  const h = (x: number, y: number) =>
    fbm(x * 0.04, y * 0.04, 4) * 0.6 +
    fbm(x * 0.12, y * 0.12, 3) * 0.3 +
    fbm(x * 0.3, y * 0.3, 2) * 0.1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // central differences for tangent-space normal
      const hL = h(x - 1 + size, y);
      const hR = h(x + 1, y);
      const hD = h(x, y - 1 + size);
      const hU = h(x, y + 1);
      const dx = (hR - hL) * 4;
      const dy = (hU - hD) * 4;
      const nx = -dx, ny = -dy, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      data[i + 0] = ((nx / len) * 0.5 + 0.5) * 255;
      data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function createRoughnessMap(size = 256) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = fbm(x * 0.05, y * 0.05, 4);
      const r = Math.floor(THREE.MathUtils.clamp(0.05 + v * 0.45, 0, 1) * 255);
      const i = (y * size + x) * 4;
      data[i] = r; data[i + 1] = r; data[i + 2] = r; data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/* -------------------------------------------------------------------------- */
/*  PBR Water — MeshPhysicalMaterial patched with displacement + flow         */
/* -------------------------------------------------------------------------- */

function PbrWater({
  width,
  length,
  position,
  rotation,
  scrollRef,
  telemetryRef,
  uvRepeatX = 4,
  uvRepeatY = 16,
  segScale = 1,
}: {
  width: number;
  length: number;
  position: [number, number, number];
  rotation: [number, number, number];
  scrollRef: React.MutableRefObject<number>;
  telemetryRef: React.MutableRefObject<{ level: number; flow: number }>;
  uvRepeatX?: number;
  uvRepeatY?: number;
  segScale?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const uniformsRef = useRef<{
    uTime: { value: number };
    uFlow: { value: number };
    uIntensity: { value: number };
  }>({
    uTime: { value: 0 },
    uFlow: { value: 1 },
    uIntensity: { value: 0 },
  });

  const normalMap = useMemo(() => createWaterNormalMap(256), []);
  const normalMap2 = useMemo(() => createWaterNormalMap(256), []);
  const roughnessMap = useMemo(() => createRoughnessMap(256), []);

  useEffect(() => {
    normalMap.repeat.set(uvRepeatX, uvRepeatY);
    normalMap2.repeat.set(uvRepeatX * 1.7, uvRepeatY * 1.3);
    roughnessMap.repeat.set(uvRepeatX, uvRepeatY);
  }, [normalMap, normalMap2, roughnessMap, uvRepeatX, uvRepeatY]);

  const onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uTime = uniformsRef.current.uTime;
    shader.uniforms.uFlow = uniformsRef.current.uFlow;
    shader.uniforms.uIntensity = uniformsRef.current.uIntensity;
    shader.uniforms.uNormalMap2 = { value: normalMap2 };

    // ---- Vertex: gerstner-ish displacement ----
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      /* glsl */ `
        #include <common>
        uniform float uTime;
        uniform float uFlow;
        uniform float uIntensity;
        float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float vnz(vec2 p){vec2 i=floor(p);vec2 f=fract(p);
          float a=h21(i),b=h21(i+vec2(1,0)),c=h21(i+vec2(0,1)),d=h21(i+vec2(1,1));
          vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}
        float fbm2(vec2 p){float a=0.5,s=0.0,n=0.0;
          for(int i=0;i<4;i++){s+=a*vnz(p);n+=a;a*=0.5;p*=2.0;}return s/n;}
      `,
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      /* glsl */ `
        vec3 transformed = vec3(position);
        float t = uTime * uFlow;
        // big swells
        float w1 = sin(position.x * 0.55 + t * 2.2) * 0.18;
        float w2 = cos(position.y * 0.72 + t * 1.7) * 0.14;
        // turbulent fbm
        float n = fbm2(vec2(position.x * 0.35 + t * 0.8, position.y * 0.35 - t * 0.6));
        float wave = (w1 + w2) * (0.4 + uIntensity * 1.6) + n * (0.25 + uIntensity * 1.3);
        transformed.z += wave;
      `,
    );

    // ---- Fragment: dual-layer flowing normals ----
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      /* glsl */ `
        #include <common>
        uniform float uTime;
        uniform float uFlow;
        uniform float uIntensity;
        uniform sampler2D uNormalMap2;
      `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      /* glsl */ `
        float ft = uTime * uFlow * 0.08;
        vec2 uvA = vUv * vec2(${uvRepeatX.toFixed(1)}, ${uvRepeatY.toFixed(1)}) + vec2(0.0, -ft);
        vec2 uvB = vUv * vec2(${(uvRepeatX * 1.7).toFixed(1)}, ${(uvRepeatY * 1.3).toFixed(1)}) + vec2(ft * 0.4, -ft * 1.5);
        vec3 mapN1 = texture2D(normalMap, uvA).xyz * 2.0 - 1.0;
        vec3 mapN2 = texture2D(uNormalMap2, uvB).xyz * 2.0 - 1.0;
        vec3 mapN = normalize(mapN1 + mapN2);
        mapN.xy *= normalScale * (0.6 + uIntensity * 1.2);
        normal = normalize(tbn * mapN);
      `,
    );
  };

  useFrame((_, delta) => {
    const u = uniformsRef.current;
    u.uTime.value += delta;
    const target = scrollRef.current;
    const tel = telemetryRef.current;
    // Combine scroll + telemetry: telemetry contributes the base, scroll dramatizes
    const intensityTarget = THREE.MathUtils.clamp(tel.level * 0.55 + target * 0.55, 0, 1);
    const flowTarget = 0.7 + tel.flow * 1.5 + target * 1.8;
    u.uIntensity.value += (intensityTarget - u.uIntensity.value) * 0.05;
    u.uFlow.value += (flowTarget - u.uFlow.value) * 0.05;
  });

  return (
    <mesh ref={meshRef} position={position} rotation={rotation}>
      <planeGeometry args={[width, length, Math.max(16, Math.round(96 * segScale)), Math.max(48, Math.round(320 * segScale))]} />
      <meshPhysicalMaterial
        ref={matRef}
        color={new THREE.Color("#0d3a5c")}
        roughness={0.18}
        roughnessMap={roughnessMap}
        metalness={0.0}
        normalMap={normalMap}
        normalScale={new THREE.Vector2(1.4, 1.4)}
        transmission={0.55}
        thickness={1.2}
        ior={1.33}
        clearcoat={0.9}
        clearcoatRoughness={0.12}
        envMapIntensity={1.4}
        transparent
        opacity={0.96}
        side={THREE.DoubleSide}
        onBeforeCompile={onBeforeCompile}
      />
    </mesh>
  );
}

/* -------------------------------------------------------------------------- */

function Banks() {
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={`u${s}`} position={[s * 9, -0.6, -RIVER_LEN / 2 + 5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[12, RIVER_LEN]} />
          <meshStandardMaterial color="#2a221b" roughness={0.95} />
        </mesh>
      ))}
      <mesh position={[0, -FALL_DEPTH / 2 - 0.4, RIVER_LEN / 2 - 25]}>
        <boxGeometry args={[28, FALL_DEPTH, 1]} />
        <meshStandardMaterial color="#1e1814" roughness={1} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={`l${s}`} position={[s * 12, -FALL_DEPTH - 0.6, RIVER_LEN / 2 - 25 + POOL_LEN / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[16, POOL_LEN]} />
          <meshStandardMaterial color="#221a14" roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

function Mist({ scrollRef }: { scrollRef: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Points>(null);
  const count = 600;
  const positions = useMemo(() => {
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      a[i * 3] = (Math.random() - 0.5) * 18;
      a[i * 3 + 1] = -FALL_DEPTH + Math.random() * FALL_DEPTH;
      a[i * 3 + 2] = RIVER_LEN / 2 - 26 + Math.random() * 6;
    }
    return a;
  }, []);
  useFrame((_, delta) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const intensity = 0.3 + scrollRef.current * 1.5;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += delta * (0.5 + Math.random()) * intensity;
      if (arr[i * 3 + 1] > 4) arr[i * 3 + 1] = -FALL_DEPTH;
    }
    pos.needsUpdate = true;
    (ref.current.material as THREE.PointsMaterial).opacity = 0.18 + scrollRef.current * 0.5;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.32} color="#dbeaf2" transparent opacity={0.22} depthWrite={false} />
    </points>
  );
}

/* -------------------------------------------------------------------------- */
/*  Foam — additive sprite particles at the lip + plunge pool                 */
/* -------------------------------------------------------------------------- */

function createFoamTexture(size = 128) {
  const data = new Uint8Array(size * size * 4);
  const cx = size / 2, cy = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - cx) / cx, dy = (y - cy) / cy;
      const d = Math.hypot(dx, dy);
      const noise = fbm(x * 0.08, y * 0.08, 4);
      const a = Math.max(0, 1 - d) * (0.4 + noise * 0.9);
      const i = (y * size + x) * 4;
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
      data[i + 3] = Math.min(255, a * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

function Foam({
  count,
  origin,
  spread,
  rise,
  scrollRef,
}: {
  count: number;
  origin: [number, number, number];
  spread: [number, number, number];
  rise: number;
  scrollRef: React.MutableRefObject<number>;
}) {
  const ref = useRef<THREE.Points>(null);
  const tex = useMemo(() => createFoamTexture(128), []);
  const positions = useMemo(() => {
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      a[i * 3] = origin[0] + (Math.random() - 0.5) * spread[0];
      a[i * 3 + 1] = origin[1] + (Math.random() - 0.5) * spread[1];
      a[i * 3 + 2] = origin[2] + (Math.random() - 0.5) * spread[2];
    }
    return a;
  }, [count, origin, spread]);
  useFrame((_, delta) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const intensity = 0.4 + scrollRef.current * 1.4;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += delta * (0.4 + Math.random() * 0.8) * intensity * rise;
      arr[i * 3] += delta * (Math.random() - 0.5) * 0.3 * intensity;
      if (arr[i * 3 + 1] > origin[1] + spread[1] / 2 + 2) {
        arr[i * 3] = origin[0] + (Math.random() - 0.5) * spread[0];
        arr[i * 3 + 1] = origin[1] - spread[1] / 2;
        arr[i * 3 + 2] = origin[2] + (Math.random() - 0.5) * spread[2];
      }
    }
    pos.needsUpdate = true;
    (ref.current.material as THREE.PointsMaterial).opacity = 0.5 + scrollRef.current * 0.4;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={tex}
        size={1.2}
        color="#f2f8ff"
        transparent
        opacity={0.7}
        depthWrite={false}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* -------------------------------------------------------------------------- */
/*  God Rays — additive light shafts above the waterfall lip                  */
/* -------------------------------------------------------------------------- */

function GodRays({ scrollRef }: { scrollRef: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const rays = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        x: (i - 2.5) * 1.6 + (Math.random() - 0.5) * 0.6,
        rotZ: (Math.random() - 0.5) * 0.25,
        scale: 0.7 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
      })),
    [],
  );
  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.children.forEach((child, i) => {
      const r = rays[i];
      const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      mat.opacity = (0.05 + 0.05 * Math.sin(t * 0.6 + r.phase)) * (0.5 + scrollRef.current * 0.8);
    });
  });
  return (
    <group ref={group} position={[0, 4, RIVER_LEN / 2 - 26]}>
      {rays.map((r, i) => (
        <mesh key={i} position={[r.x, -6, 0]} rotation={[0, 0, r.rotZ]} scale={[r.scale, 1, 1]}>
          <planeGeometry args={[1.2, 18]} />
          <meshBasicMaterial
            color="#ffe6b8"
            transparent
            opacity={0.08}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

function CameraRig({ scrollRef }: { scrollRef: React.MutableRefObject<number> }) {
  const path = useMemo(
    () => [
      { p: new THREE.Vector3(0, 6, -RIVER_LEN / 2 + 4), l: new THREE.Vector3(0, 2, 0) },
      { p: new THREE.Vector3(2, 5, -8), l: new THREE.Vector3(0, 0, RIVER_LEN / 2 - 25) },
      { p: new THREE.Vector3(0, 4, RIVER_LEN / 2 - 30), l: new THREE.Vector3(0, -10, RIVER_LEN / 2 - 24) },
      { p: new THREE.Vector3(0, -6, RIVER_LEN / 2 - 18), l: new THREE.Vector3(0, -FALL_DEPTH + 2, RIVER_LEN / 2 - 24) },
      { p: new THREE.Vector3(4, -FALL_DEPTH + 4, RIVER_LEN / 2 - 8), l: new THREE.Vector3(0, -FALL_DEPTH + 2, RIVER_LEN / 2 - 24) },
    ],
    [],
  );

  // Eased scroll value so movement feels smooth without lagging behind the user
  const smoothScroll = useRef(0);
  const lookTarget = useRef(path[0].l.clone());

  useFrame((state) => {
    smoothScroll.current += (scrollRef.current - smoothScroll.current) * 0.12;
    const t = THREE.MathUtils.clamp(smoothScroll.current, 0, 1);
    const seg = t * (path.length - 1);
    const i = Math.min(Math.floor(seg), path.length - 2);
    const f = seg - i;
    const a = path[i], b = path[i + 1];
    state.camera.position.lerp(a.p.clone().lerp(b.p, f), 0.18);
    lookTarget.current.lerp(a.l.clone().lerp(b.l, f), 0.18);
    state.camera.lookAt(lookTarget.current);
  });

  return null;
}

export function WaterfallScene({ telemetry }: { telemetry?: Pick<Telemetry, "level" | "flow"> }) {
  const scrollRef = useRef(0);
  const telemetryRef = useRef({ level: telemetry?.level ?? 0.3, flow: telemetry?.flow ?? 0.4 });
  const isMobile = useIsMobile();

  useEffect(() => {
    if (telemetry) telemetryRef.current = { level: telemetry.level, flow: telemetry.flow };
  }, [telemetry]);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollRef.current = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    const ro = new ResizeObserver(onScroll);
    ro.observe(document.body);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      ro.disconnect();
    };
  }, []);

  // Mobile: cap pixel ratio + reduce particle counts. Avoid environment HDRI cost.
  const dpr: [number, number] = isMobile ? [1, 1.5] : [1, 2];
  const foamLipCount = isMobile ? 80 : 220;
  const foamPoolCount = isMobile ? 120 : 320;

  return (
    <Canvas
      camera={{ position: [0, 6, -RIVER_LEN / 2 + 4], fov: 55 }}
      gl={{
        antialias: !isMobile,
        alpha: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
        powerPreference: "high-performance",
      }}
      dpr={dpr}
    >
      <color attach="background" args={["#0a1420"]} />
      <fog attach="fog" args={["#0a1420", 24, 95]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[10, 14, 5]} intensity={1.4} color="#fff5e0" />
      <directionalLight position={[-8, 6, -3]} intensity={0.5} color="#7eb0d5" />
      <hemisphereLight args={["#a8c8e0", "#1a1410", 0.4]} />

      <PbrWater width={6} length={RIVER_LEN} position={[0, 0, -5]} rotation={[-Math.PI / 2, 0, 0]} scrollRef={scrollRef} telemetryRef={telemetryRef} uvRepeatX={3} uvRepeatY={20} segScale={isMobile ? 0.4 : 1} />
      <PbrWater width={6} length={FALL_DEPTH} position={[0, -FALL_DEPTH / 2, RIVER_LEN / 2 - 25]} rotation={[0, 0, 0]} scrollRef={scrollRef} telemetryRef={telemetryRef} uvRepeatX={3} uvRepeatY={10} segScale={isMobile ? 0.4 : 1} />
      <PbrWater width={10} length={POOL_LEN} position={[0, -FALL_DEPTH, RIVER_LEN / 2 - 25 + POOL_LEN / 2]} rotation={[-Math.PI / 2, 0, 0]} scrollRef={scrollRef} telemetryRef={telemetryRef} uvRepeatX={5} uvRepeatY={18} segScale={isMobile ? 0.4 : 1} />

      <Banks />
      <Mist scrollRef={scrollRef} />
      {/* Foam at the waterfall lip */}
      <Foam
        count={foamLipCount}
        origin={[0, 0.2, RIVER_LEN / 2 - 25]}
        spread={[6, 1, 1.5]}
        rise={0.6}
        scrollRef={scrollRef}
      />
      {/* Foam at plunge pool base */}
      <Foam
        count={foamPoolCount}
        origin={[0, -FALL_DEPTH + 0.5, RIVER_LEN / 2 - 24]}
        spread={[8, 3, 4]}
        rise={1.2}
        scrollRef={scrollRef}
      />
      <GodRays scrollRef={scrollRef} />
      <CameraRig scrollRef={scrollRef} />
      {!isMobile && <Environment preset="sunset" background={false} />}
    </Canvas>
  );
}
