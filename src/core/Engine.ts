import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CameraMode } from '../types';

export class Engine {
    public readonly scene: THREE.Scene;
    public readonly camera: THREE.PerspectiveCamera;
    public readonly renderer: THREE.WebGLRenderer;
    public readonly controls: OrbitControls;
    public readonly hemiLight: THREE.HemisphereLight;
    public readonly dirLight: THREE.DirectionalLight;
    public readonly fillLight: THREE.DirectionalLight;
    public readonly lightningLight: THREE.PointLight;
    public cameraMode: CameraMode = 'follow';
    private shakeIntensity = 0;

    constructor(container: HTMLElement) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x8bc8f2);
        this.scene.fog = new THREE.FogExp2(0xdbeafe, 0.0012);

        this.camera = new THREE.PerspectiveCamera(
            34,
            window.innerWidth / window.innerHeight,
            0.1,
            150
        );
        this.camera.position.set(0, 9.8, 17.8);

        this.renderer = new THREE.WebGLRenderer({
            antialias: false,
            powerPreference: 'high-performance',
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.18;
        container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0, 1.0, 0.2);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.06;
        this.controls.maxPolarAngle = Math.PI / 2.15;
        this.controls.minPolarAngle = Math.PI / 6;
        this.controls.minDistance = 6.5;
        this.controls.maxDistance = 34;
        this.controls.enabled = false;

        this.hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x65a30d, 1.55);
        this.scene.add(this.hemiLight);

        this.dirLight = new THREE.DirectionalLight(0xfff5e4, 2.75);
        this.dirLight.position.set(-14, 20, 12);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 1024;
        this.dirLight.shadow.mapSize.height = 1024;
        this.dirLight.shadow.camera.near = 2;
        this.dirLight.shadow.camera.far = 65;
        const d = 24;
        this.dirLight.shadow.camera.left = -d;
        this.dirLight.shadow.camera.right = d;
        this.dirLight.shadow.camera.top = d;
        this.dirLight.shadow.camera.bottom = -d;
        this.dirLight.shadow.bias = -0.0005;
        this.scene.add(this.dirLight);

        this.fillLight = new THREE.DirectionalLight(0x93c5fd, 0.85);
        this.fillLight.position.set(14, 10, -10);
        this.scene.add(this.fillLight);

        this.lightningLight = new THREE.PointLight(0xe0f2fe, 0, 80, 1.2);
        this.lightningLight.position.set(0, 22, -12);
        this.scene.add(this.lightningLight);
    }

    public setCameraMode(mode: CameraMode, targetPos?: THREE.Vector3): void {
        this.cameraMode = mode;
        if (mode === 'follow') {
            this.controls.enabled = false;
        } else {
            this.controls.enabled = true;
            if (targetPos) {
                this.controls.target.set(targetPos.x, targetPos.y + 0.8, targetPos.z);
            }
        }
    }

    public triggerShake(intensity: number): void {
        this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    }

    public applyCameraShake(dt: number): void {
        if (this.shakeIntensity > 0.002) {
            this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
            this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeIntensity *= Math.pow(0.05, dt);
        } else {
            this.shakeIntensity = 0;
        }
    }

    public resize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
