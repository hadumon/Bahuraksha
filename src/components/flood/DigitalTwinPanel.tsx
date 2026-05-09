import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Sparkles, MeshTransmissionMaterial, Html, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { createNoise2D } from "simplex-noise";

// A high-fidelity procedural terrain
function Terrain({ waterLevel }: { waterLevel: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(30, 30, 128, 128);
    const noise2D = createNoise2D();
    
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      
      // Carve a realistic meandering river channel
      const meander = Math.sin(y * 0.3) * 2.0;
      const distFromCenter = Math.abs(x - meander);
      const riverProfile = Math.max(0, 1 - Math.exp(-distFromCenter * 1.5));
      
      // Add multiple octaves of noise to the banks for organic realism
      const noise1 = noise2D(x * 0.1, y * 0.1) * 2.0;
      const noise2 = noise2D(x * 0.4, y * 0.4) * 0.5;
      
      // Compute final height Z
      const z = (riverProfile * 4 + (noise1 + noise2) * riverProfile) - 2.0; 
      pos.setZ(i, z);
    }
    
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
      <meshStandardMaterial 
        color="#1b2a1c" 
        roughness={0.9}
        metalness={0.1}
        bumpScale={0.2}
      />
    </mesh>
  );
}

// Cinematic refractive water component
function RiverWater({ targetLevel }: { targetLevel: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Base water level + normalized dynamic level
  const baseZ = -0.8;
  const normalizedLevel = (targetLevel / 5) * 2.0; 
  
  useFrame((state) => {
    if (meshRef.current) {
      // Smoothly animate water level
      meshRef.current.position.y = THREE.MathUtils.lerp(
        meshRef.current.position.y,
        baseZ + normalizedLevel,
        0.02
      );
    }
  });

  return (
    <mesh ref={meshRef} position={[0, baseZ, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[30, 30, 1, 1]} />
      {/* High-fidelity physically based water transmission shader */}
      <MeshTransmissionMaterial 
        backside
        color="#1ca3ec"
        thickness={2}
        roughness={0.1}
        transmission={0.9}
        ior={1.33}
        chromaticAberration={0.05}
        distortionScale={0.5}
        temporalDistortion={0.2}
      />
    </mesh>
  );
}

// Hyper-realistic station markers with HTML UI overlays
function StationMarker({ position, data }: { position: [number, number, number], data: any }) {
  const isEvacuate = data.riskLevel === "evacuate";
  const isWarning = data.riskLevel === "warning";
  const color = isEvacuate ? "#ef4444" : isWarning ? "#f59e0b" : "#10b981";
  
  return (
    <group position={position}>
      {/* Mooring Pillar */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.08, 0.15, 3]} />
        <meshStandardMaterial color="#333" metalness={0.9} roughness={0.4} />
      </mesh>
      
      {/* Sensor Head with Glow */}
      <mesh position={[0, 2, 0]}>
        <sphereGeometry args={[0.25, 32, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
      </mesh>
      
      {/* Cinematic HTML UI Overlay */}
      <Html position={[0, 2.5, 0]} center zIndexRange={[100, 0]} distanceFactor={15}>
        <div className="bg-black/80 backdrop-blur-md border border-white/10 px-3 py-2 rounded-lg pointer-events-none w-max shadow-xl transition-all">
          <div className="flex items-center gap-2 mb-1">
            <div className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isEvacuate ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isEvacuate ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
            </div>
            <span className="text-white font-bold text-xs uppercase tracking-wider">{data.name}</span>
          </div>
          <div className="text-white/80 text-xs flex justify-between gap-4">
            <span>Level: <strong className="text-white">{data.currentLevel}m</strong></span>
            <span className="text-gray-400 capitalize">{data.trend}</span>
          </div>
        </div>
      </Html>
    </group>
  );
}

// Gentle auto-rotation and camera movement
function CinematicCamera() {
  useFrame((state) => {
    // Very subtle camera floating
    state.camera.position.y += Math.sin(state.clock.elapsedTime * 0.5) * 0.005;
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function DigitalTwinPanel({ stations }: { stations: any[] }) {
  const avgLevel = stations.length > 0 
    ? stations.reduce((acc, st) => acc + st.currentLevel, 0) / stations.length 
    : 2.5;

  return (
    <div className="gradient-card rounded-xl border border-border overflow-hidden relative shadow-2xl">
      <div className="absolute top-4 left-4 z-10 p-4 bg-black/50 backdrop-blur-xl rounded-xl border border-white/10 pointer-events-none">
        <h3 className="text-white font-bold text-lg flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_#3b82f6]"></span>
          Cinematic Digital Twin
        </h3>
        <p className="text-xs text-blue-200/70 mt-1">Real-time PBR Visualization • Bagmati Basin</p>
      </div>

      <div className="h-[550px] w-full bg-[#050914]">
        <Canvas shadows camera={{ position: [12, 10, 15], fov: 40 }}>
          {/* Atmospheric Fog */}
          <fog attach="fog" args={['#050914', 10, 40]} />
          
          <ambientLight intensity={0.2} />
          <directionalLight 
            castShadow 
            position={[10, 15, 10]} 
            intensity={1.5} 
            color="#e0f2fe"
            shadow-mapSize={[1024, 1024]}
            shadow-bias={-0.0001}
          />
          <spotLight position={[-10, 10, -10]} intensity={2} color="#3b82f6" distance={50} angle={0.5} penumbra={1} />
          
          <Terrain waterLevel={avgLevel} />
          <RiverWater targetLevel={avgLevel} />
          
          {/* Scatter station markers along the river meander */}
          {stations.map((station, i) => {
            const zPos = (i - stations.length / 2) * 5; 
            const xPos = Math.sin(zPos * 0.3) * 2.0; // Follow the river meander
            return (
              <StationMarker 
                key={station.id} 
                position={[xPos, 0, zPos]} 
                data={station} 
              />
            );
          })}
          
          {/* Cinematic details */}
          <Sparkles count={150} scale={30} size={3} speed={0.2} opacity={0.4} color="#60a5fa" />
          <ContactShadows position={[0, -2, 0]} opacity={0.5} scale={40} blur={2} far={10} />
          
          <CinematicCamera />
          <OrbitControls 
            enablePan={false} 
            maxPolarAngle={Math.PI / 2 - 0.2} 
            minDistance={8}
            maxDistance={30}
            autoRotate
            autoRotateSpeed={0.5}
            enableDamping
            dampingFactor={0.05}
          />
        </Canvas>
      </div>
      
      <div className="p-3 bg-background border-t border-border flex justify-between items-center text-xs">
        <span className="text-muted-foreground tracking-wide">PBR SCENE RENDERED</span>
        <span className="font-mono text-blue-400 bg-blue-400/10 px-2 py-1 rounded border border-blue-400/20 shadow-[0_0_10px_rgba(59,130,246,0.2)]">LIVE TELEMETRY ACTIVE</span>
      </div>
    </div>
  );
}
