import { useRef, useEffect, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { Telemetry } from "@/hooks/useTelemetry";
import { useIsMobile } from "@/hooks/use-mobile";

/* ─────────────────────────────────────────────────────────────────────────────
 * Animated Water Plane
 *
 * Uses TWO normal map layers scrolling at different speeds & directions
 * to create convincing water ripples. The material is a dark, highly
 * reflective MeshPhysicalMaterial — NOT transmissive (which made it
 * invisible last time).
 * ───────────────────────────────────────────────────────────────────────────── */

function WaterPlane({ flowSpeed }: { flowSpeed: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geomRef = useRef<THREE.PlaneGeometry>(null);

  // Load the photographic water normal map
  const normalTex1 = useTexture("/waternormals.jpg");
  const normalTex2 = useTexture("/waternormals.jpg");

  useEffect(() => {
    [normalTex1, normalTex2].forEach((tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    });
    normalTex1.repeat.set(4, 4);
    normalTex2.repeat.set(6, 6);
  }, [normalTex1, normalTex2]);

  // Store the original Y positions so waves are additive, not cumulative
  const basePositions = useRef<Float32Array | null>(null);
  useEffect(() => {
    if (geomRef.current) {
      basePositions.current = new Float32Array(
        geomRef.current.attributes.position.array,
      );
    }
  }, []);

  useFrame((state, delta) => {
    // Scroll the two normal maps in different directions for realism
    normalTex1.offset.x += delta * flowSpeed * 0.03;
    normalTex1.offset.y -= delta * flowSpeed * 0.08;
    normalTex2.offset.x -= delta * flowSpeed * 0.02;
    normalTex2.offset.y -= delta * flowSpeed * 0.12;

    // Animate vertex positions for real geometric waves
    const geom = geomRef.current;
    const base = basePositions.current;
    if (!geom || !base) return;

    const pos = geom.attributes.position;
    const t = state.clock.elapsedTime * flowSpeed * 0.5;

    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3];     // original x
      const by = base[i * 3 + 1]; // original y (z in world since plane is rotated)

      // Layered sine waves for organic swells
      const w1 = Math.sin(bx * 0.15 + t * 1.2) * 0.4;
      const w2 = Math.cos(by * 0.08 + t * 0.8) * 0.3;
      const w3 = Math.sin(bx * 0.3 + by * 0.2 + t * 1.5) * 0.15;
      const w4 = Math.cos(bx * 0.05 - t * 0.6) * 0.5; // big slow swell

      // z in the plane's local space = height when rotated to horizontal
      pos.setZ(i, w1 + w2 + w3 + w4);
    }

    pos.needsUpdate = true;
    geom.computeVertexNormals();
  });

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      receiveShadow
    >
      <planeGeometry ref={geomRef} args={[60, 120, 64, 128]} />
      <meshPhysicalMaterial
        color="#0d5a7a"
        emissive="#072d42"
        emissiveIntensity={0.35}
        roughness={0.14}
        metalness={0.45}
        normalMap={normalTex1}
        normalScale={new THREE.Vector2(1.15, 1.15)}
        clearcoat={1.0}
        clearcoatRoughness={0.08}
        clearcoatNormalMap={normalTex2}
        clearcoatNormalScale={new THREE.Vector2(0.6, 0.6)}
        envMapIntensity={3.8}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Riverbanks — organic terrain on both sides that hides the water edges
 * ───────────────────────────────────────────────────────────────────────────── */

function Riverbanks() {
  const leftRef = useRef<THREE.PlaneGeometry>(null);
  const rightRef = useRef<THREE.PlaneGeometry>(null);

  useEffect(() => {
    [leftRef, rightRef].forEach((ref, side) => {
      const geom = ref.current;
      if (!geom) return;
      const pos = geom.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const lx = pos.getX(i); // local x within the plane
        const ly = pos.getY(i); // local y (maps to z in world)
        // The inner edge (closest to river) gets irregular displacement
        // The outer edge blends flat into the background
        const innerEdge = side === 0 ? lx / 20 + 0.5 : 0.5 - lx / 20;
        const edgeFactor = Math.max(0, Math.min(1, innerEdge));

        // Organic noise displacement — bigger bumps near the river edge
        const n1 = Math.sin(lx * 0.8 + ly * 0.3) * Math.cos(ly * 0.15) * 1.8;
        const n2 = Math.sin(lx * 1.5 + ly * 0.7 + 2.1) * 0.6;
        const n3 = Math.cos(lx * 0.3 - ly * 0.5) * Math.sin(ly * 0.2 + 1.3) * 1.2;
        const height = (n1 + n2 + n3) * edgeFactor * 0.8;

        pos.setZ(i, height);
      }
      geom.computeVertexNormals();
    });
  }, []);

  // Vegetation tufts along the shoreline
  const tufts = useMemo(() => {
    const items: { x: number; y: number; z: number; s: number }[] = [];
    for (let i = 0; i < 80; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const z = (Math.random() - 0.5) * 110;
      const x = side * (26 + Math.random() * 6);
      items.push({ x, y: 0.2 + Math.random() * 0.5, z, s: 0.3 + Math.random() * 0.6 });
    }
    return items;
  }, []);

  return (
    <group>
      {/* Left bank */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-38, -0.1, 0]}>
        <planeGeometry ref={leftRef} args={[40, 120, 40, 80]} />
        <meshStandardMaterial
          color="#111d23"
          roughness={0.95}
          flatShading
        />
      </mesh>

      {/* Right bank */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[38, -0.1, 0]}>
        <planeGeometry ref={rightRef} args={[40, 120, 40, 80]} />
        <meshStandardMaterial
          color="#111d23"
          roughness={0.95}
          flatShading
        />
      </mesh>

      {/* Vegetation tufts */}
      {tufts.map((t, i) => (
        <mesh key={i} position={[t.x, t.y, t.z]} scale={t.s}>
          <coneGeometry args={[0.6, 1.5, 5]} />
          <meshStandardMaterial color="#0d1a12" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Fireflies — soft glowing dots that drift organically
 * ───────────────────────────────────────────────────────────────────────────── */

function createGlowTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2,
  );
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.15, "rgba(255, 240, 180, 0.8)");
  gradient.addColorStop(0.4, "rgba(200, 255, 100, 0.3)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function Fireflies({ count = 80 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const glowTex = useMemo(() => createGlowTexture(), []);

  // Each firefly gets a random phase + speed for organic movement
  const phases = useMemo(
    () => Float32Array.from({ length: count * 3 }, () => Math.random() * Math.PI * 2),
    [count],
  );
  const speeds = useMemo(
    () => Float32Array.from({ length: count }, () => 0.3 + Math.random() * 0.7),
    [count],
  );

  const positions = useRef(
    Float32Array.from({ length: count * 3 }, (_, i) => {
      const axis = i % 3;
      if (axis === 0) return (Math.random() - 0.5) * 40; // x
      if (axis === 1) return 0.5 + Math.random() * 5;     // y — above water
      return (Math.random() - 0.5) * 80;                   // z
    }),
  ).current;

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const pos = ref.current.geometry.attributes.position;
    const arr = pos.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const sp = speeds[i];
      // Organic sine-wave wandering
      arr[i * 3]     += Math.sin(t * sp + phases[i * 3])     * 0.012;
      arr[i * 3 + 1] += Math.sin(t * sp * 0.7 + phases[i * 3 + 1]) * 0.006;
      arr[i * 3 + 2] += Math.cos(t * sp * 0.5 + phases[i * 3 + 2]) * 0.01;

      // Keep them within bounds
      if (arr[i * 3 + 1] < 0.3) arr[i * 3 + 1] = 0.3;
      if (arr[i * 3 + 1] > 7) arr[i * 3 + 1] = 5;
    }
    pos.needsUpdate = true;

    // Pulsing glow
    const mat = ref.current.material as THREE.PointsMaterial;
    mat.opacity = 0.35 + Math.sin(t * 1.5) * 0.15;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={glowTex}
        size={1.2}
        color="#ccff66"
        transparent
        opacity={0.4}
        depthWrite={false}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Camera Controller — gentle sway + scroll-driven descent
 * ───────────────────────────────────────────────────────────────────────────── */

function CameraController({
  scrollRef,
}: {
  scrollRef: React.MutableRefObject<number>;
}) {
  const smoothScroll = useRef(0);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    smoothScroll.current += (scrollRef.current - smoothScroll.current) * 0.06;
    const s = smoothScroll.current;

    // Camera path: starts looking down the river, slowly descends
    const camY = 6.4 - s * 3.8;
    const camZ = -14 + s * 24;
    const lookZ = 8 + s * 18;

    // Gentle breathing sway
    const swayX = Math.sin(t * 0.3) * 0.4;
    const swayY = Math.cos(t * 0.2) * 0.15;

    state.camera.position.lerp(
      new THREE.Vector3(swayX, camY + swayY, camZ),
      0.08,
    );
    state.camera.lookAt(0, 0, lookZ);
  });

  return null;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Environment Light — provides the reflections the water needs
 * ───────────────────────────────────────────────────────────────────────────── */

function SceneLighting() {
  const { scene } = useThree();

  useEffect(() => {
    scene.background = new THREE.Color("#050b14");
    scene.fog = new THREE.FogExp2("#050b14", 0.008);
  }, [scene]);

  return (
    <>
      <ambientLight intensity={0.4} color="#65b6d9" />
      <directionalLight
        position={[5, 10, -15]}
        intensity={2.6}
        color="#c4dff0"
        castShadow
      />
      <directionalLight
        position={[-8, 6, 10]}
        intensity={1.1}
        color="#3ca4db"
      />
      <pointLight
        position={[0, 10, 8]}
        intensity={80}
        color="#78d9ff"
        distance={90}
        decay={2}
      />
      <pointLight
        position={[0, 2, -8]}
        intensity={26}
        color="#1fb9ff"
        distance={45}
        decay={2}
      />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Scene Content — everything inside the Canvas
 * ───────────────────────────────────────────────────────────────────────────── */

function SceneContent({
  scrollRef,
  isMobile,
  flowSpeed,
}: {
  scrollRef: React.MutableRefObject<number>;
  isMobile: boolean;
  flowSpeed: number;
}) {
  return (
    <>
      <SceneLighting />
      <WaterPlane flowSpeed={flowSpeed} />
      <Riverbanks />
      {!isMobile && <Fireflies count={80} />}
      <CameraController scrollRef={scrollRef} />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * WaterfallScene — exported component
 * ───────────────────────────────────────────────────────────────────────────── */

export function WaterfallScene({
  telemetry,
}: {
  telemetry?: Pick<Telemetry, "level" | "flow">;
}) {
  const scrollRef = useRef(0);
  const isMobile = useIsMobile();
  const flowSpeed = 1.0 + (telemetry?.flow ?? 0.4) * 2;

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollRef.current = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full">
      <Canvas
        camera={{ position: [0, 6.4, -14], fov: 46, near: 0.1, far: 200 }}
        gl={{
          antialias: !isMobile,
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
          powerPreference: "high-performance",
        }}
        dpr={isMobile ? [1, 1.5] : [1, 2]}
      >
        <Suspense fallback={null}>
          <SceneContent
            scrollRef={scrollRef}
            isMobile={isMobile}
            flowSpeed={flowSpeed}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
