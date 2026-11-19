import * as React from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, RoundedBox } from '@react-three/drei';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  CubieState,
  FaceKey,
  MoveDescriptor,
  STICKER_COLORS,
} from '@/lib/cubeEngine';

const isSoftwareGl: boolean = (() => {
  if (typeof document === 'undefined') return false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
})();

const _targetCamPos = new THREE.Vector3();

function StudioEnvironment() {
  const { gl, scene } = useThree();

  React.useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    roomEnv.dispose();
    pmrem.dispose();

    return () => {
      envRT.dispose();
      scene.environment = null;
    };
  }, [gl, scene]);

  return null;
}

function ContactShadowGround({ y = -2.25 }: { y?: number }) {
  const shadowTexture = React.useMemo(() => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(
        size / 2,
        size / 2,
        size * 0.06,
        size / 2,
        size / 2,
        size * 0.48
      );
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
      grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.25)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  React.useEffect(() => {
    return () => {
      shadowTexture.dispose();
    };
  }, [shadowTexture]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <planeGeometry args={[6.2, 6.2]} />
      <meshBasicMaterial
        map={shadowTexture}
        transparent
        depthWrite={false}
        opacity={0.75}
      />
    </mesh>
  );
}

interface CubieMeshProps {
  cubie: CubieState;
  highlighted?: boolean;
  wireframeTwin?: boolean;
}

const FACE_OFFSETS: Record<
  FaceKey,
  { pos: [number, number, number]; rot: [number, number, number] }
> = {
  R: { pos: [0.462, 0, 0], rot: [0, Math.PI / 2, 0] },
  L: { pos: [-0.462, 0, 0], rot: [0, -Math.PI / 2, 0] },
  U: { pos: [0, 0.462, 0], rot: [-Math.PI / 2, 0, 0] },
  D: { pos: [0, -0.462, 0], rot: [Math.PI / 2, 0, 0] },
  F: { pos: [0, 0, 0.462], rot: [0, 0, 0] },
  B: { pos: [0, 0, -0.462], rot: [0, Math.PI, 0] },
};

const CubieMesh = React.memo(function CubieMesh({
  cubie,
  highlighted = false,
  wireframeTwin = false,
}: CubieMeshProps) {
  const spacing = 1.015;
  const position: [number, number, number] = [
    cubie.x * spacing,
    cubie.y * spacing,
    cubie.z * spacing,
  ];

  return (
    <group position={position}>
      <RoundedBox args={[0.94, 0.94, 0.94]} radius={0.095} smoothness={3}>
        <meshStandardMaterial
          color={highlighted ? '#1a2722' : '#121216'}
          roughness={0.56}
          metalness={0.14}
          emissive={highlighted ? '#10b981' : '#000000'}
          emissiveIntensity={highlighted ? 0.16 : 0}
          wireframe={wireframeTwin}
        />
      </RoundedBox>

      {(Object.keys(cubie.stickers) as FaceKey[]).map((faceKey) => {
        const colorCode = cubie.stickers[faceKey];
        if (!colorCode) return null;
        const offset = FACE_OFFSETS[faceKey];
        const hex = STICKER_COLORS[colorCode].threeHex;
        return (
          <mesh key={faceKey} position={offset.pos} rotation={offset.rot}>
            <RoundedBox args={[0.78, 0.78, 0.05]} radius={0.045} smoothness={2}>
              <meshPhysicalMaterial
                color={hex}
                roughness={0.18}
                metalness={0.02}
                clearcoat={0.85}
                clearcoatRoughness={0.14}
                emissive={highlighted ? '#34D399' : '#000000'}
                emissiveIntensity={highlighted ? 0.08 : 0}
                transparent={wireframeTwin}
                opacity={wireframeTwin ? 0.78 : 1}
              />
            </RoundedBox>
          </mesh>
        );
      })}
    </group>
  );
});

function MoveArrow3D({ move }: { move: MoveDescriptor }) {
  const groupRef = React.useRef<THREE.Group>(null);

  const { tubeGeo, conePos, coneQuat, secondConePos, secondConeQuat, ringRot, ringPos } =
    React.useMemo(() => {
      const radius = 1.62;
      const sweep = move.turns === 2 ? Math.PI * 0.92 : Math.PI * 0.56;
      const dir = move.clockwise ? -1 : 1;
      const startAngle = Math.PI * 0.5 - (dir * sweep) / 2;
      const endAngle = startAngle + dir * sweep;

      const points: THREE.Vector3[] = [];
      const segments = 32;
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const theta = startAngle + (endAngle - startAngle) * t;
        points.push(new THREE.Vector3(Math.cos(theta) * radius, Math.sin(theta) * radius, 0));
      }

      const curve = new THREE.CatmullRomCurve3(points);
      const tGeo = new THREE.TubeGeometry(curve, 32, 0.048, 12, false);

      const makeCone = (atAngle: number) => {
        const pos = new THREE.Vector3(Math.cos(atAngle) * radius, Math.sin(atAngle) * radius, 0);
        const tangent = new THREE.Vector3(
          -Math.sin(atAngle) * dir,
          Math.cos(atAngle) * dir,
          0
        ).normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          tangent
        );
        return { pos, quat };
      };

      const tip1 = makeCone(endAngle);
      const tip2 = move.turns === 2 ? makeCone(startAngle + dir * sweep * 0.52) : null;

      const faceTransform: Record<
        FaceKey,
        { pos: [number, number, number]; rot: [number, number, number] }
      > = {
        F: { pos: [0, 0, 1.64], rot: [0, 0, 0] },
        B: { pos: [0, 0, -1.64], rot: [0, Math.PI, 0] },
        R: { pos: [1.64, 0, 0], rot: [0, Math.PI / 2, 0] },
        L: { pos: [-1.64, 0, 0], rot: [0, -Math.PI / 2, 0] },
        U: { pos: [0, 1.64, 0], rot: [-Math.PI / 2, 0, 0] },
        D: { pos: [0, -1.64, 0], rot: [Math.PI / 2, 0, 0] },
      };

      const ft = faceTransform[move.face];

      return {
        tubeGeo: tGeo,
        conePos: tip1.pos,
        coneQuat: tip1.quat,
        secondConePos: tip2?.pos ?? null,
        secondConeQuat: tip2?.quat ?? null,
        ringPos: ft.pos,
        ringRot: ft.rot,
      };
    }, [move.face, move.clockwise, move.turns]);

  React.useEffect(() => {
    return () => {
      tubeGeo.dispose();
    };
  }, [tubeGeo]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 3.5) * 0.025;
    groupRef.current.scale.set(pulse, pulse, 1);
  });

  return (
    <group position={ringPos} rotation={ringRot}>
      <group ref={groupRef}>
        <mesh position={[0, 0, -0.08]}>
          <ringGeometry args={[1.53, 1.56, 48]} />
          <meshBasicMaterial color="#34D399" transparent opacity={0.28} side={THREE.DoubleSide} />
        </mesh>

        <mesh geometry={tubeGeo}>
          <meshStandardMaterial
            color="#34D399"
            emissive="#34D399"
            emissiveIntensity={0.65}
            roughness={0.25}
          />
        </mesh>

        <mesh position={conePos} quaternion={coneQuat}>
          <coneGeometry args={[0.14, 0.34, 16]} />
          <meshStandardMaterial
            color="#6EE7B7"
            emissive="#34D399"
            emissiveIntensity={0.7}
            roughness={0.2}
          />
        </mesh>

        {secondConePos && secondConeQuat && (
          <mesh position={secondConePos} quaternion={secondConeQuat}>
            <coneGeometry args={[0.12, 0.28, 16]} />
            <meshStandardMaterial
              color="#6EE7B7"
              emissive="#34D399"
              emissiveIntensity={0.65}
              roughness={0.2}
            />
          </mesh>
        )}
      </group>
    </group>
  );
}

interface CubeSceneProps {
  cubies: CubieState[];
  mode: 'hero' | 'interactive' | 'reference' | 'solving' | 'solved';
  activeMove?: MoveDescriptor | null;
  animateMoveTrigger?: number;
  animationDuration?: number;
  onMoveAnimationComplete?: () => void;
  heroTwinWireframe?: boolean;
  referenceRotation?: [number, number, number];
  cameraResetToken?: number;
  autoRepositionCamera?: boolean;
  showMoveArrow?: boolean;
  defaultCameraPosition: [number, number, number];
  lockCameraAngle?: boolean;
}

function CubeScene({
  cubies,
  mode,
  activeMove = null,
  animateMoveTrigger = 0,
  animationDuration = 0.72,
  onMoveAnimationComplete,
  heroTwinWireframe = false,
  referenceRotation,
  cameraResetToken = 0,
  autoRepositionCamera = false,
  showMoveArrow = false,
  defaultCameraPosition,
  lockCameraAngle = false,
}: CubeSceneProps) {
  const rootGroupRef = React.useRef<THREE.Group>(null);
  const pivotRef = React.useRef<THREE.Group>(null);
  const controlsRef = React.useRef<OrbitControlsImpl | null>(null);
  const { camera } = useThree();

  const animState = React.useRef<{
    active: boolean;
    elapsed: number;
    duration: number;
    move: MoveDescriptor | null;
    completedTrigger: number;
  }>({
    active: false,
    elapsed: 0,
    duration: animationDuration,
    move: null,
    completedTrigger: 0,
  });

  const camDampTarget = React.useRef<[number, number, number] | null>(null);
  const userDraggingRef = React.useRef(false);

  React.useEffect(() => {
    if (
      animateMoveTrigger > 0 &&
      activeMove &&
      animState.current.completedTrigger !== animateMoveTrigger
    ) {
      animState.current = {
        active: true,
        elapsed: 0,
        duration: activeMove.turns === 2 ? animationDuration * 1.25 : animationDuration,
        move: activeMove,
        completedTrigger: animateMoveTrigger,
      };
      if (pivotRef.current) {
        pivotRef.current.rotation.set(0, 0, 0);
      }
    }
  }, [animateMoveTrigger, activeMove, animationDuration]);

  React.useEffect(() => {
    if (pivotRef.current && !animState.current.active) {
      pivotRef.current.rotation.set(0, 0, 0);
    }
  }, [cubies]);

  React.useEffect(() => {
    if (autoRepositionCamera && activeMove) {
      camDampTarget.current = activeMove.cameraPosition;
    }
  }, [activeMove?.face, activeMove?.notation, autoRepositionCamera]);

  React.useEffect(() => {
    if (cameraResetToken > 0 || lockCameraAngle) {
      camDampTarget.current = defaultCameraPosition;
    }
  }, [cameraResetToken, lockCameraAngle, defaultCameraPosition]);

  const onCompleteRef = React.useRef(onMoveAnimationComplete);
  onCompleteRef.current = onMoveAnimationComplete;

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);

    if (rootGroupRef.current) {
      if (mode === 'hero') {
        const t = state.clock.elapsedTime;
        rootGroupRef.current.position.y = Math.sin(t * 1.4) * 0.14;
        if (!userDraggingRef.current) {
          rootGroupRef.current.rotation.y += delta * 0.28;
          rootGroupRef.current.rotation.x = THREE.MathUtils.damp(
            rootGroupRef.current.rotation.x,
            0.34 + Math.sin(t * 0.7) * 0.08,
            3,
            delta
          );
        }
      } else if (mode === 'solved') {
        const t = state.clock.elapsedTime;
        rootGroupRef.current.position.y = Math.sin(t * 1.6) * 0.1;
        if (!userDraggingRef.current) {
          rootGroupRef.current.rotation.y += delta * 0.42;
        }
      } else if (mode === 'reference' && referenceRotation) {
        rootGroupRef.current.rotation.x = THREE.MathUtils.damp(
          rootGroupRef.current.rotation.x,
          referenceRotation[0],
          6,
          delta
        );
        rootGroupRef.current.rotation.y = THREE.MathUtils.damp(
          rootGroupRef.current.rotation.y,
          referenceRotation[1],
          6,
          delta
        );
        rootGroupRef.current.rotation.z = THREE.MathUtils.damp(
          rootGroupRef.current.rotation.z,
          referenceRotation[2],
          6,
          delta
        );
      }
    }

    if (animState.current.active && animState.current.move && pivotRef.current) {
      animState.current.elapsed += delta;
      const progress = Math.min(1, animState.current.elapsed / animState.current.duration);
      const eased =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const currentAngle = animState.current.move.angle * eased;
      pivotRef.current.rotation.set(0, 0, 0);
      pivotRef.current.rotation[animState.current.move.axis] = currentAngle;

      if (progress >= 1) {
        animState.current.active = false;
        pivotRef.current.rotation.set(0, 0, 0);
        onCompleteRef.current?.();
      }
    }

    if (camDampTarget.current && !userDraggingRef.current) {
      _targetCamPos.set(
        camDampTarget.current[0],
        camDampTarget.current[1],
        camDampTarget.current[2]
      );
      camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetCamPos.x, 4.2, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetCamPos.y, 4.2, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetCamPos.z, 4.2, delta);
      camera.lookAt(0, 0, 0);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
      if (camera.position.distanceTo(_targetCamPos) < 0.04) {
        camDampTarget.current = null;
      }
    }
  });

  const { activeCubies, staticCubies } = React.useMemo(() => {
    if (!activeMove) {
      return { activeCubies: [] as CubieState[], staticCubies: cubies };
    }
    const active: CubieState[] = [];
    const rest: CubieState[] = [];
    for (const c of cubies) {
      if (c[activeMove.axis] === activeMove.layer) {
        active.push(c);
      } else {
        rest.push(c);
      }
    }
    return { activeCubies: active, staticCubies: rest };
  }, [cubies, activeMove]);

  return (
    <>
      <StudioEnvironment />
      <hemisphereLight args={['#dbeafe', '#18181b', 0.75]} />
      <directionalLight position={[6, 8, 6]} intensity={1.85} color="#fff7ed" />
      <directionalLight position={[-6, -3, -5]} intensity={0.7} color="#bae6fd" />
      <directionalLight position={[0, 4, -7]} intensity={0.95} color="#34D399" />

      <group ref={rootGroupRef}>
        {staticCubies.map((cubie) => (
          <CubieMesh key={cubie.id} cubie={cubie} wireframeTwin={heroTwinWireframe} />
        ))}

        <group ref={pivotRef}>
          {activeCubies.map((cubie) => (
            <CubieMesh
              key={cubie.id}
              cubie={cubie}
              highlighted={mode === 'solving'}
              wireframeTwin={heroTwinWireframe}
            />
          ))}
        </group>

        {showMoveArrow && activeMove && <MoveArrow3D move={activeMove} />}
      </group>

      {mode !== 'reference' && <ContactShadowGround y={mode === 'hero' ? -2.35 : -2.2} />}

      {mode !== 'reference' && (
        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableRotate={!lockCameraAngle}
          enableZoom={mode !== 'hero'}
          minDistance={5.0}
          maxDistance={15.0}
          enableDamping={!isSoftwareGl}
          dampingFactor={0.07}
          onStart={() => {
            userDraggingRef.current = true;
            camDampTarget.current = null;
          }}
          onEnd={() => {
            userDraggingRef.current = false;
          }}
        />
      )}
    </>
  );
}

export interface RubiksCube3DProps {
  cubies: CubieState[];
  mode?: 'hero' | 'interactive' | 'reference' | 'solving' | 'solved';
  activeMove?: MoveDescriptor | null;
  animateMoveTrigger?: number;
  animationDuration?: number;
  onMoveAnimationComplete?: () => void;
  heroTwinWireframe?: boolean;
  referenceRotation?: [number, number, number];
  cameraResetToken?: number;
  autoRepositionCamera?: boolean;
  lockCameraAngle?: boolean;
  showMoveArrow?: boolean;
  cameraPosition?: [number, number, number];
  fov?: number;
  className?: string;
}

export function RubiksCube3D({
  cubies,
  mode = 'interactive',
  activeMove = null,
  animateMoveTrigger = 0,
  animationDuration = 0.72,
  onMoveAnimationComplete,
  heroTwinWireframe = false,
  referenceRotation,
  cameraResetToken = 0,
  autoRepositionCamera = false,
  lockCameraAngle = false,
  showMoveArrow = false,
  cameraPosition,
  fov = 38,
  className = 'w-full h-full',
}: RubiksCube3DProps) {
  const [contextLost, setContextLost] = React.useState(false);

  const defaultCam = React.useMemo<[number, number, number]>(
    () =>
      cameraPosition ??
      (mode === 'reference'
        ? [0, 0.25, 6.1]
        : mode === 'hero'
          ? [4.6, 3.4, 5.1]
          : mode === 'solving'
            ? [5.2, 4.3, 7.6]
            : [4.5, 3.3, 5.0]),
    [cameraPosition, mode]
  );

  if (contextLost) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-xl bg-[#111113] border border-zinc-800 p-6 text-center ${className}`}
      >
        <p className="text-sm font-medium text-zinc-200">3D Viewport Paused</p>
        <p className="mt-1 text-xs text-zinc-400">
          WebGL context was interrupted. Click below to restore the interactive cube.
        </p>
        <button
          type="button"
          onClick={() => setContextLost(false)}
          className="mt-3 px-3.5 py-1.5 rounded-lg bg-emerald-400 text-zinc-950 text-xs font-semibold cursor-pointer"
        >
          Restore 3D View
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      <Canvas
        dpr={isSoftwareGl ? 1 : [1, 2]}
        camera={{ position: defaultCam, fov, near: 0.1, far: 100 }}
        gl={{
          antialias: !isSoftwareGl,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.08,
          alpha: true,
        }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            setContextLost(true);
          });
          gl.domElement.addEventListener('webglcontextrestored', () => {
            setContextLost(false);
          });
        }}
      >
        <CubeScene
          cubies={cubies}
          mode={mode}
          activeMove={activeMove}
          animateMoveTrigger={animateMoveTrigger}
          animationDuration={animationDuration}
          onMoveAnimationComplete={onMoveAnimationComplete}
          heroTwinWireframe={heroTwinWireframe}
          referenceRotation={referenceRotation}
          cameraResetToken={cameraResetToken}
          autoRepositionCamera={autoRepositionCamera}
          lockCameraAngle={lockCameraAngle}
          defaultCameraPosition={defaultCam}
          showMoveArrow={showMoveArrow}
        />
      </Canvas>
    </div>
  );
}
