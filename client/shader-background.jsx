// Animated ShaderGradient background, mounted into <div id="shaderBg"> on every page.
// The <ShaderGradient> settings are as exported from shadergradient.co, except
// `animate`, which stays off for people who ask their OS to reduce motion.
// After editing, rebuild with `npm run build:bg`.
import { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useFrame } from '@react-three/fiber';
import { ShaderGradientCanvas, ShaderGradient } from '@shadergradient/react';

// Fades the canvas in over the CSS fallback once the shader has actually drawn
// (it compiles on the first frame, so revealing it earlier shows nothing).
function RevealWhenDrawn({ target }) {
    const frames = useRef(0);

    useFrame(() => {
        frames.current += 1;

        if (frames.current === 3) {
            target.classList.add('is-ready');
        }
    });

    return null;
}

function supportsWebGL() {
    try {
        const canvas = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
    } catch {
        return false;
    }
}

const host = document.getElementById('shaderBg');

if (host && supportsWebGL()) {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    createRoot(host).render(
        <ShaderGradientCanvas pointerEvents="none" pixelDensity={1} fov={45} lazyLoad={false}>
            <ShaderGradient
                animate={reduceMotion ? 'off' : 'on'}
                axesHelper="off"
                brightness={1.2}
                cAzimuthAngle={170}
                cDistance={4.4}
                cPolarAngle={70}
                cameraZoom={1}
                color1="#ff0d11"
                color2="#000010"
                color3="#007bff"
                destination="onCanvas"
                embedMode="off"
                envPreset="city"
                format="gif"
                fov={45}
                frameRate={10}
                gizmoHelper="hide"
                grain="off"
                lightType="3d"
                pixelDensity={1}
                positionX={0}
                positionY={0.9}
                positionZ={-0.3}
                range="disabled"
                rangeEnd={40}
                rangeStart={0}
                reflection={0.1}
                rotationX={45}
                rotationY={0}
                rotationZ={0}
                shader="defaults"
                type="waterPlane"
                uAmplitude={0}
                uDensity={1.2}
                uFrequency={0}
                uSpeed={0.2}
                uStrength={3.4}
                uTime={0}
                wireframe={false}
            />
            <RevealWhenDrawn target={host} />
        </ShaderGradientCanvas>
    );
}
