import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

let cachedSoftwareGl: boolean | null = null;

export function detectSoftwareWebGL(): boolean {
  if (cachedSoftwareGl !== null) return cachedSoftwareGl;
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      cachedSoftwareGl = true;
      return true;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return cachedSoftwareGl;
  } catch {
    cachedSoftwareGl = true;
    return true;
  }
}

export function isWebGLAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * Sets up procedural RoomEnvironment PMREM reflections + calibrated 3-point warm/cool studio lighting
 * and a soft radial contact shadow plane so the cube is grounded in neutral dark studio space.
 */
export function StudioEnvironment({
  showFloorShadow = true,
  shadowY = -2.35,
}: {
  showFloorShadow?: boolean;
  shadowY?: number;
}) {
  const { gl, scene } = useThree();

  useEffect(() => {
    const pmremGenerator = new THREE.PMREMGenerator(gl);
    const roomEnv = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    return () => {
      scene.environment = null;
      envRT.dispose();
    };
  }, [gl, scene]);

  const shadowTexture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(size / 2, size / 2, 12, size / 2, size / 2, size / 2);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.58)');
      grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.22)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  useEffect(() => {
    return () => {
      shadowTexture.dispose();
    };
  }, [shadowTexture]);

  return (
    <>
      {/* Cool studio sky / dark charcoal ground bounce */}
      <hemisphereLight args={['#DDE8F8', '#14141A', 0.72]} />
      {/* Warm directional key light */}
      <directionalLight position={[6, 8, 7]} intensity={1.85} color="#FFF7ED" />
      {/* Cool subtle fill light */}
      <directionalLight position={[-7, 3, 4]} intensity={0.75} color="#DBEAFE" />
      {/* Crisp back rim light to separate black cubie edges from dark obsidian backdrop */}
      <directionalLight position={[-3, 6, -8]} intensity={1.1} color="#A7F3D0" />

      {showFloorShadow && (
        <mesh position={[0, shadowY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[5.4, 5.4]} />
          <meshBasicMaterial
            map={shadowTexture}
            transparent
            depthWrite={false}
            opacity={0.7}
          />
        </mesh>
      )}
    </>
  );
}
