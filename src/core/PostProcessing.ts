import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { MoodKey } from '../types';

const TiltShiftShader = {
    uniforms: {
        tDiffuse: { value: null },
        uFocusY: { value: 0.46 },
        uBlurStrength: { value: 0.0014 },
        uAspect: { value: window.innerWidth / window.innerHeight },
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uFocusY;
        uniform float uBlurStrength;
        uniform float uAspect;
        varying vec2 vUv;

        void main() {
            float dist = abs(vUv.y - uFocusY);
            float blurAmt = smoothstep(0.28, 0.52, dist) * uBlurStrength;

            vec4 sum = vec4(0.0);
            vec2 offX = vec2(blurAmt / uAspect, 0.0);
            vec2 offY = vec2(0.0, blurAmt);

            sum += texture2D(tDiffuse, vUv) * 0.24;
            sum += texture2D(tDiffuse, vUv + offX) * 0.12;
            sum += texture2D(tDiffuse, vUv - offX) * 0.12;
            sum += texture2D(tDiffuse, vUv + offY) * 0.12;
            sum += texture2D(tDiffuse, vUv - offY) * 0.12;
            sum += texture2D(tDiffuse, vUv + offX + offY) * 0.07;
            sum += texture2D(tDiffuse, vUv - offX + offY) * 0.07;
            sum += texture2D(tDiffuse, vUv + offX - offY) * 0.07;
            sum += texture2D(tDiffuse, vUv - offX - offY) * 0.07;

            gl_FragColor = sum;
        }
    `,
};

const ColorGradingShader = {
    uniforms: {
        tDiffuse: { value: null },
        uTint: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
        uContrast: { value: 1.06 },
        uSaturation: { value: 1.08 },
        uVignette: { value: 0.14 },
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec3 uTint;
        uniform float uContrast;
        uniform float uSaturation;
        uniform float uVignette;
        varying vec2 vUv;

        void main() {
            vec4 col = texture2D(tDiffuse, vUv);
            vec3 rgb = col.rgb * uTint;
            rgb = (rgb - 0.5) * uContrast + 0.5;
            float luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
            rgb = mix(vec3(luma), rgb, uSaturation);

            vec2 vigUv = max(vUv * (1.0 - vUv.yx), vec2(0.0001));
            float vig = pow(vigUv.x * vigUv.y * 16.0, uVignette);
            rgb *= mix(0.84, 1.0, vig);

            gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), col.a);
        }
    `,
};

export class PostProcessing {
    public readonly composer: EffectComposer;
    public readonly bloomPass: UnrealBloomPass;
    public readonly bokehPass: ShaderPass;
    public readonly colorGradingPass: ShaderPass;
    public readonly raysGroup: THREE.Group;
    public readonly rayUniforms: {
        uTime: THREE.IUniform<number>;
        uColor: THREE.IUniform<THREE.Color>;
        uOpacity: THREE.IUniform<number>;
    };

    constructor(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
        this.raysGroup = new THREE.Group();
        this.rayUniforms = {
            uTime: { value: 0 },
            uColor: { value: new THREE.Color(0xfff7ed) },
            uOpacity: { value: 0.24 },
        };

        const rayMat = new THREE.ShaderMaterial({
            uniforms: this.rayUniforms,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform vec3 uColor;
                uniform float uOpacity;
                varying vec2 vUv;
                void main() {
                    float edgeFade = max(sin(vUv.x * 3.14159265), 0.0);
                    edgeFade = pow(edgeFade, 1.7);
                    float verticalFade = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.15, 1.0, vUv.y));
                    float shimmer = 0.8 + 0.2 * sin(vUv.x * 16.0 + uTime * 1.1);
                    gl_FragColor = vec4(uColor, edgeFade * verticalFade * shimmer * uOpacity);
                }
            `,
        });

        [
            [-6.5, 6.2, -3.5, 4.5, 16, -0.36],
            [-1.5, 7.0, -2.0, 5.2, 17, -0.34],
            [4.5, 6.5, -3.0, 4.8, 16, -0.38],
            [10.5, 6.8, -5.5, 5.0, 17, -0.35],
        ].forEach(([rx, ry, rz, rw, rh, rotZ]) => {
            const beam = new THREE.Mesh(new THREE.PlaneGeometry(rw, rh), rayMat);
            beam.position.set(rx, ry, rz);
            beam.rotation.z = rotZ;
            beam.rotation.y = 0.18;
            this.raysGroup.add(beam);
        });
        scene.add(this.raysGroup);

        this.composer = new EffectComposer(renderer);
        this.composer.addPass(new RenderPass(scene, camera));

        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.22,
            0.55,
            0.92
        );
        this.composer.addPass(this.bloomPass);

        this.bokehPass = new ShaderPass(TiltShiftShader);
        this.composer.addPass(this.bokehPass);

        this.colorGradingPass = new ShaderPass(ColorGradingShader);
        this.composer.addPass(this.colorGradingPass);
        this.composer.addPass(new OutputPass());
    }

    public setFocusDistance(_distance: number): void {
        // Lightweight Tilt-Shift requires no depth pass
    }

    public setMoodGrading(mood: MoodKey): void {
        const u = this.colorGradingPass.uniforms;
        u['uVignette'].value = 0.22;
        switch (mood) {
            case 'dawn':
                (u['uTint'].value as THREE.Vector3).set(1.02, 1.01, 1.0);
                u['uContrast'].value = 1.09;
                u['uSaturation'].value = 1.06;
                break;
            case 'golden':
                (u['uTint'].value as THREE.Vector3).set(1.1, 1.0, 0.88);
                u['uContrast'].value = 1.13;
                u['uSaturation'].value = 1.16;
                break;
            case 'calmNight':
                (u['uTint'].value as THREE.Vector3).set(0.9, 0.96, 1.12);
                u['uContrast'].value = 1.15;
                u['uSaturation'].value = 1.05;
                break;
            case 'night':
                (u['uTint'].value as THREE.Vector3).set(1.02, 0.96, 1.08);
                u['uContrast'].value = 1.16;
                u['uSaturation'].value = 1.18;
                break;
        }
    }

    public resize(): void {
        this.composer.setSize(window.innerWidth, window.innerHeight);
        this.bokehPass.uniforms['uAspect'].value = window.innerWidth / window.innerHeight;
    }

    public render(): void {
        this.composer.render();
    }
}
