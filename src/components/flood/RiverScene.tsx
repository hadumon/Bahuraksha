import { useRef, useMemo } from "react";
import { Canvas, useFrame, extend } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";

const WaterShaderMaterial = {
  uniforms: {
    uTime: { value: 0 },
    uFlowSpeed: { value: 1 },
    uLevel: { value: 0.3 },
    uCalmColor: { value: new THREE.Color("#1e6fa8") },
    uTurbulentColor: { value: new THREE.Color("#6b3a14") },
  },
  vertexShader: /* glsl */ `
    uniform float uTime;
    uniform float uFlowSpeed;
    uniform float uLevel;
    varying vec2 vUv;
    varying float vWave;

    // Simple hash-based noise
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    void main() {
      vUv = uv;
      vec3 pos = position;
      float t = uTime * uFlowSpeed;
      float wave1 = sin(pos.x * 0.6 + t * 2.0) * 0.15;
      float wave2 = cos(pos.y * 0.8 + t * 1.5) * 0.12;
      float turb = noise(vec2(pos.x * 0.4 + t, pos.y * 0.4 - t * 0.7)) * (0.4 + uLevel * 1.2);
      float wave = (wave1 + wave2) * (0.5 + uLevel * 1.5) + turb * uLevel;
      pos.z += wave;
      vWave = wave;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform float uFlowSpeed;
    uniform float uLevel;
    uniform vec3 uCalmColor;
    uniform vec3 uTurbulentColor;
    varying vec2 vUv;
    varying float vWave;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    void main() {
      float t = uTime * uFlowSpeed;
      vec2 flowUv = vec2(vUv.x * 8.0, vUv.y * 30.0 - t * 1.5);
      float n1 = noise(flowUv);
      float n2 = noise(flowUv * 2.3 + 5.0);
      float foam = smoothstep(0.65, 0.95, n1 * n2 + vWave * 0.6);

      vec3 baseColor = mix(uCalmColor, uTurbulentColor, smoothstep(0.2, 0.85, uLevel));
      vec3 deep = baseColor * 0.55;
      vec3 surface = baseColor + vec3(0.08);
      vec3 col = mix(deep, surface, n1 * 0.7 + 0.3);

      // Foam highlights — more during floods
      vec3 foamColor = mix(vec3(0.95, 0.96, 1.0), vec3(0.85, 0.78, 0.65), uLevel);
      col = mix(col, foamColor, foam * (0.5 + uLevel * 0.5));

      // Edge fade
      float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
      gl_FragColor = vec4(col, 0.92 * edge + 0.08);
    }
  `,
};

function Water({ waterLevel, flowSpeed }: { waterLevel: number; flowSpeed: number }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => THREE.UniformsUtils.clone(WaterShaderMaterial.uniforms),
    [],
  );

  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta;
      // Smooth interpolation toward target values
      const u = matRef.current.uniforms;
      u.uLevel.value += (waterLevel - u.uLevel.value) * 0.05;
      u.uFlowSpeed.value += (flowSpeed - u.uFlowSpeed.value) * 0.05;
    }
    if (meshRef.current) {
      const targetWidth = 6 + waterLevel * 8;
      meshRef.current.scale.x += (targetWidth / 6 - meshRef.current.scale.x) * 0.05;
      meshRef.current.scale.z += (1 + waterLevel * 0.6 - meshRef.current.scale.z) * 0.05;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[6, 60, 128, 512]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={WaterShaderMaterial.vertexShader}
        fragmentShader={WaterShaderMaterial.fragmentShader}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Riverbanks() {
  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 9, -0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[12, 60, 32, 32]} />
          <meshStandardMaterial color="#2a2520" roughness={0.95} />
        </mesh>
      ))}
      {/* Rocks */}
      {Array.from({ length: 18 }).map((_, i) => {
        const side = i % 2 === 0 ? -1 : 1;
        const z = (i / 18) * 50 - 25;
        const x = side * (4.5 + Math.random() * 2);
        return (
          <mesh key={i} position={[x, -0.2 + Math.random() * 0.3, z]}>
            <dodecahedronGeometry args={[0.3 + Math.random() * 0.4, 0]} />
            <meshStandardMaterial color="#3a342d" roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  );
}

export function RiverScene({
  waterLevel,
  flowSpeed,
}: {
  waterLevel: number;
  flowSpeed: number;
}) {
  return (
    <Canvas
      camera={{ position: [8, 6, 10], fov: 50 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
    >
      <color attach="background" args={["#0a1420"]} />
      <fog attach="fog" args={["#0a1420", 25, 55]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 12, 5]} intensity={1.1} color="#fff5e0" />
      <directionalLight position={[-8, 6, -3]} intensity={0.4} color="#7eb0d5" />
      <Water waterLevel={waterLevel} flowSpeed={flowSpeed} />
      <Riverbanks />
      <Environment preset="night" />
      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={28}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.1}
        autoRotate
        autoRotateSpeed={0.3}
      />
    </Canvas>
  );
}
