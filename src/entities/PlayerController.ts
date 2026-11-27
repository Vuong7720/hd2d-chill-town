import * as THREE from 'three';
import { generateHeroAnimations } from '../graphics/PixelTextureGen';
import { HeroAnimations } from '../types';
import { WorldContext } from '../world/WorldContext';
import { SurfaceType } from '../systems/AudioEngine';

interface DustParticle {
    mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
    life: number;
    vx: number;
    vy: number;
    vz: number;
}

export class PlayerController {
    public readonly pivot: THREE.Group;
    public readonly mesh: THREE.Mesh;
    public readonly targetRing: THREE.Mesh;
    public clickTarget: THREE.Vector3 | null = null;

    private anims: HeroAnimations;
    private mat: THREE.MeshStandardMaterial;
    private facing = 1;
    private animFrame = 0;
    private animTimer = 0;
    private stepDustTimer = 0;
    private dustPool: DustParticle[] = [];
    private dustIdx = 0;

    public lanternOn = false;
    private handLanternLight: THREE.PointLight;
    private handLanternMesh: THREE.Mesh;
    public customWalkableCheck?: (x: number, z: number) => number | null;

    constructor(
        private scene: THREE.Scene,
        private world: WorldContext,
        private onStep?: (surface: SurfaceType) => void
    ) {
        this.anims = generateHeroAnimations();
        this.mat = new THREE.MeshStandardMaterial({
            map: this.anims.idle[0],
            transparent: true,
            alphaTest: 0.4,
            roughness: 0.65,
            side: THREE.DoubleSide,
        });

        this.pivot = new THREE.Group();
        this.pivot.position.set(0, 0.7, 0.6);

        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 1.45), this.mat);
        this.mesh.position.set(0, 0.72, 0);
        this.mesh.castShadow = true;
        this.pivot.add(this.mesh);

        const shadow = new THREE.Mesh(
            new THREE.CircleGeometry(0.32, 16),
            new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.38 })
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.set(0, 0.04, 0);
        this.pivot.add(shadow);

        this.handLanternLight = new THREE.PointLight(0xffb347, 0, 10.5, 1.4);
        this.handLanternLight.position.set(0.45, 0.9, 0.25);
        this.pivot.add(this.handLanternLight);

        this.handLanternMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.11, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xfef08a })
        );
        this.handLanternMesh.position.set(0.42, 0.68, 0.15);
        this.handLanternMesh.visible = false;
        this.pivot.add(this.handLanternMesh);

        this.scene.add(this.pivot);

        this.targetRing = new THREE.Mesh(
            new THREE.RingGeometry(0.18, 0.3, 20),
            new THREE.MeshBasicMaterial({
                color: 0xfbbf24,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.85,
            })
        );
        this.targetRing.rotation.x = -Math.PI / 2;
        this.targetRing.visible = false;
        this.scene.add(this.targetRing);

        for (let i = 0; i < 18; i++) {
            const p = new THREE.Mesh(
                new THREE.BoxGeometry(0.1, 0.1, 0.1),
                new THREE.MeshBasicMaterial({ color: 0xfef3c7, transparent: true, opacity: 0 })
            );
            p.visible = false;
            this.scene.add(p);
            this.dustPool.push({ mesh: p, life: 0, vx: 0, vy: 0, vz: 0 });
        }
    }

    public spawnDust(x: number, y: number, z: number): void {
        const d = this.dustPool[this.dustIdx];
        this.dustIdx = (this.dustIdx + 1) % this.dustPool.length;
        d.mesh.position.set(x + (Math.random() - 0.5) * 0.2, y + 0.08, z + (Math.random() - 0.5) * 0.2);
        d.vx = (Math.random() - 0.5) * 0.6;
        d.vy = 0.5 + Math.random() * 0.5;
        d.vz = (Math.random() - 0.5) * 0.6;
        d.life = 0.45;
        d.mesh.visible = true;
        d.mesh.material.opacity = 0.85;
    }

    public toggleHandLantern(hasLantern: boolean): boolean {
        if (!hasLantern) return false;
        this.lanternOn = !this.lanternOn;
        this.handLanternMesh.visible = this.lanternOn;
        this.handLanternLight.intensity = this.lanternOn ? 2.6 : 0;
        return true;
    }

    public setClickTarget(pt: THREE.Vector3): void {
        const checker = this.customWalkableCheck ?? ((x: number, z: number) => this.world.getWalkableSurfaceY(x, z));
        const validY = checker(pt.x, pt.z);
        if (validY !== null) {
            this.clickTarget = new THREE.Vector3(pt.x, validY, pt.z);
            this.targetRing.position.set(pt.x, validY + 0.03, pt.z);
            this.targetRing.visible = true;
        }
    }

    public clearClickTarget(): void {
        this.clickTarget = null;
        this.targetRing.visible = false;
    }

    public resetPosition(): void {
        this.pivot.position.set(0, 0.7, 0.6);
        this.clearClickTarget();
    }

    public update(
        dt: number,
        elapsed: number,
        camera: THREE.Camera,
        keysPressed: Record<string, boolean>,
        joystickInput: { x: number; z: number },
        isBlocked: boolean
    ): void {
        let moveX = isBlocked ? 0 : joystickInput.x;
        let moveZ = isBlocked ? 0 : joystickInput.z;
        if (!isBlocked) {
            if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) moveX -= 1;
            if (keysPressed['KeyD'] || keysPressed['ArrowRight']) moveX += 1;
            if (keysPressed['KeyW'] || keysPressed['ArrowUp']) moveZ -= 1;
            if (keysPressed['KeyS'] || keysPressed['ArrowDown']) moveZ += 1;
        }

        let isMoving = false;
        const isSprinting = Boolean(keysPressed['ShiftLeft'] || keysPressed['ShiftRight']);
        const moveSpeed = isSprinting ? 6.2 : 3.8;

        if (Math.hypot(moveX, moveZ) > 0.08) {
            const len = Math.hypot(moveX, moveZ);
            moveX /= len;
            moveZ /= len;
            isMoving = true;
        } else if (this.clickTarget) {
            const dx = this.clickTarget.x - this.pivot.position.x;
            const dz = this.clickTarget.z - this.pivot.position.z;
            const dist = Math.hypot(dx, dz);
            if (dist > 0.14) {
                moveX = dx / dist;
                moveZ = dz / dist;
                isMoving = true;
            } else {
                this.clearClickTarget();
            }
        }

        if (isMoving) {
            if (moveX < -0.05) this.facing = -1;
            if (moveX > 0.05) this.facing = 1;

            const stepX = moveX * moveSpeed * dt;
            const stepZ = moveZ * moveSpeed * dt;
            const checker = this.customWalkableCheck ?? ((x: number, z: number) => this.world.getWalkableSurfaceY(x, z));

            const tryBothY = checker(
                this.pivot.position.x + stepX,
                this.pivot.position.z + stepZ
            );
            if (tryBothY !== null) {
                this.pivot.position.x += stepX;
                this.pivot.position.z += stepZ;
                this.pivot.position.y = tryBothY;
            } else {
                const tryXY = checker(
                    this.pivot.position.x + stepX,
                    this.pivot.position.z
                );
                if (tryXY !== null) {
                    this.pivot.position.x += stepX;
                    this.pivot.position.y = tryXY;
                } else {
                    const tryZY = checker(
                        this.pivot.position.x,
                        this.pivot.position.z + stepZ
                    );
                    if (tryZY !== null) {
                        this.pivot.position.z += stepZ;
                        this.pivot.position.y = tryZY;
                    } else {
                        this.clearClickTarget();
                    }
                }
            }

            this.stepDustTimer += dt;
            const dustInterval = isSprinting ? 0.12 : 0.22;
            if (this.stepDustTimer > dustInterval) {
                this.spawnDust(this.pivot.position.x, this.pivot.position.y, this.pivot.position.z);
                this.onStep?.(this.world.getSurfaceType(this.pivot.position.x, this.pivot.position.z));
                this.stepDustTimer = 0;
            }
        }

        this.animTimer += dt;
        if (isMoving) {
            const frameInterval = isSprinting ? 0.08 : 0.13;
            if (this.animTimer > frameInterval) {
                this.animFrame = (this.animFrame + 1) % this.anims.walk.length;
                this.mat.map = this.anims.walk[this.animFrame];
                this.animTimer = 0;
            }
        } else {
            if (this.animTimer > 0.45) {
                this.animFrame = (this.animFrame + 1) % this.anims.idle.length;
                this.mat.map = this.anims.idle[this.animFrame];
                this.animTimer = 0;
            }
        }
        this.mesh.quaternion.copy(camera.quaternion);
        this.mesh.scale.x = this.facing;

        if (this.targetRing.visible) {
            this.targetRing.rotation.z = elapsed * 2.5;
            const s = 0.85 + Math.sin(elapsed * 6.0) * 0.15;
            this.targetRing.scale.set(s, s, 1);
        }

        this.dustPool.forEach((d) => {
            if (d.life > 0) {
                d.life -= dt;
                d.mesh.position.x += d.vx * dt;
                d.mesh.position.y += d.vy * dt;
                d.mesh.position.z += d.vz * dt;
                d.mesh.material.opacity = Math.max(0, d.life * 1.8);
                if (d.life <= 0) d.mesh.visible = false;
            }
        });
    }
}
