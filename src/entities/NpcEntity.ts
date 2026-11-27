import * as THREE from 'three';
import {
    canvasToPixelTexture,
    createPixelCanvas,
    generateHeroAnimations,
} from '../graphics/PixelTextureGen';
import { HeroAnimations, NpcConfig } from '../types';
import { WorldContext } from '../world/WorldContext';

export class NpcEntity {
    public readonly anims: HeroAnimations;
    public readonly mat: THREE.MeshStandardMaterial;
    public readonly pivot: THREE.Group;
    public readonly mesh: THREE.Mesh;
    public readonly bubbleMesh: THREE.Mesh;
    public facing: number;
    private frame = 0;
    private timer = Math.random() * 0.4;

    constructor(scene: THREE.Scene, world: WorldContext, public readonly config: NpcConfig) {
        this.facing = config.facing;
        this.anims = generateHeroAnimations(config.palette);
        this.mat = new THREE.MeshStandardMaterial({
            map: this.anims.idle[0],
            transparent: true,
            alphaTest: 0.4,
            roughness: 0.65,
            side: THREE.DoubleSide,
        });

        this.pivot = new THREE.Group();
        this.pivot.position.set(config.x, config.y ?? 0.2, config.z);

        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 1.42), this.mat);
        this.mesh.position.y = 0.7;
        this.mesh.castShadow = true;
        this.pivot.add(this.mesh);

        const shadow = new THREE.Mesh(
            new THREE.CircleGeometry(0.3, 16),
            new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.35 })
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.04;
        this.pivot.add(shadow);

        const { canvas: bCan, ctx: bCtx } = createPixelCanvas(16, 16);
        bCtx.fillStyle = '#1e1b18';
        bCtx.fillRect(3, 1, 10, 12);
        bCtx.fillStyle = '#fbbf24';
        bCtx.fillRect(4, 2, 8, 10);
        bCtx.fillStyle = '#1e1b18';
        bCtx.fillRect(7, 3, 2, 5);
        bCtx.fillRect(7, 9, 2, 2);
        const bubbleTex = canvasToPixelTexture(bCan);
        this.bubbleMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(0.45, 0.45),
            new THREE.MeshBasicMaterial({ map: bubbleTex, transparent: true, side: THREE.DoubleSide })
        );
        this.bubbleMesh.position.y = 1.52;
        this.pivot.add(this.bubbleMesh);

        scene.add(this.pivot);
        world.addCollider(config.x - 0.32, config.x + 0.32, config.z - 0.32, config.z + 0.32);
    }

    public update(dt: number, elapsed: number, camera: THREE.Camera): void {
        this.timer += dt;
        if (this.timer > 0.52) {
            this.frame = (this.frame + 1) % this.anims.idle.length;
            this.mat.map = this.anims.idle[this.frame];
            this.timer = 0;
        }
        this.mesh.quaternion.copy(camera.quaternion);
        this.mesh.scale.x = this.facing;
        this.bubbleMesh.quaternion.copy(camera.quaternion);
        this.bubbleMesh.position.y = 1.52 + Math.sin(elapsed * 4.0 + this.config.x) * 0.06;
    }
}
