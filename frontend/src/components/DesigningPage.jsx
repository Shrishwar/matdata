import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

const DesigningPage = () => {
  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      <Canvas>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="orange" />
        </mesh>
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
};

export default DesigningPage;
