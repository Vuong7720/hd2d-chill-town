import * as THREE from 'three';
import { ColliderBox } from '../types';
import {
    generateCobblestonePBR,
    generateContactShadowTexture,
    generateGrassTexture,
    generateStoneWallPBR,
    generateWoodPlankTexture,
} from '../graphics/PixelTextureGen';

export class WorldContext {
    public readonly solidColliders: ColliderBox[] = [];
    public readonly walkableFloors: THREE.Object3D[] = [];

    public readonly grassMat: THREE.MeshStandardMaterial;
    public readonly cobbleMat: THREE.MeshStandardMaterial;
    public readonly stoneWallMat: THREE.MeshStandardMaterial;
    public readonly woodMat: THREE.MeshStandardMaterial;
    public readonly timberMat: THREE.MeshStandardMaterial;
    public readonly contactShadowMat: THREE.MeshBasicMaterial;

    constructor() {
        const grassTex = generateGrassTexture();
        const cobblePbr = generateCobblestonePBR();
        const stonePbr = generateStoneWallPBR();

        this.grassMat = new THREE.MeshStandardMaterial({
            map: grassTex,
            roughness: 0.88,
            metalness: 0.02,
        });
        this.cobbleMat = new THREE.MeshStandardMaterial({
            map: cobblePbr.map,
            normalMap: cobblePbr.normalMap,
            normalScale: new THREE.Vector2(0.38, 0.38),
            roughnessMap: cobblePbr.roughnessMap,
            roughness: 0.82,
            metalness: 0.06,
        });
        this.stoneWallMat = new THREE.MeshStandardMaterial({
            map: stonePbr.map,
            normalMap: stonePbr.normalMap,
            normalScale: new THREE.Vector2(0.45, 0.45),
            roughnessMap: stonePbr.roughnessMap,
            roughness: 0.8,
        });
        this.woodMat = new THREE.MeshStandardMaterial({
            map: generateWoodPlankTexture('#8a5a36', '#5c3a21'),
            roughness: 0.78,
        });
        this.timberMat = new THREE.MeshStandardMaterial({
            map: generateWoodPlankTexture('#54351c', '#36200f'),
            roughness: 0.82,
        });
        this.contactShadowMat = new THREE.MeshBasicMaterial({
            map: generateContactShadowTexture(),
            transparent: true,
            depthWrite: false,
            opacity: 0.78,
        });
    }

    public createContactShadow(width: number, depth: number, y = 0.015): THREE.Mesh {
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), this.contactShadowMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = y;
        return mesh;
    }

    public addCollider(minX: number, maxX: number, minZ: number, maxZ: number): void {
        this.solidColliders.push({ minX, maxX, minZ, maxZ });
    }

    public getSurfaceType(x: number, z: number): 'wood' | 'stone' | 'grass' {
        if (Math.abs(x) <= 2.7 && z >= -0.45 && z <= 1.65) return 'wood';
        if (Math.abs(x) <= 2.7 && z >= -11.25 && z <= -9.15) return 'wood';
        if (x >= -2.6 && x <= -0.8 && z >= -5.3 && z <= -3.5) return 'wood';

        // Stairs & main plazas / paths
        if (x >= 6.4 && x <= 9.0 && z >= -5.6 && z <= -3.2) return 'stone';
        if (x >= -9.0 && x <= -6.4 && z >= -11.4 && z <= -9.0) return 'stone';
        if (Math.abs(x) <= 5.2 && z >= -14.5 && z <= 5.5) return 'stone';
        if (x >= -16.5 && x <= -6.0 && z >= -0.4 && z <= 8.8) return 'stone';
        if (x >= 9.7 && x <= 19.3 && z >= -10.8 && z <= -1.6) return 'stone';

        return 'grass';
    }

    public getTerrainHeight(x: number, z: number): number {
        // East Temple Terrace (y = 1.4): x >= 9.0, z in [-12.0, -0.5]
        // East Stairs connecting y=0.2 -> y=1.4: x in [6.4, 9.0], z in [-5.6, -3.2]
        if (x >= 6.4 && x <= 9.0 && z >= -5.6 && z <= -3.2) {
            const t = (x - 6.4) / (9.0 - 6.4);
            return 0.2 + t * 1.2;
        }
        if (x >= 9.0 && x <= 21.5 && z >= -12.0 && z <= -0.5) {
            return 1.4;
        }

        // Northwest Windmill Hill Terrace (y = 1.2): x <= -9.0, z in [-18.5, -7.2]
        // NW Stairs connecting y=0.2 -> y=1.2: x in [-9.0, -6.4], z in [-11.4, -9.0]
        if (x >= -9.0 && x <= -6.4 && z >= -11.4 && z <= -9.0) {
            const t = (-6.4 - x) / (9.0 - 6.4);
            return 0.2 + t * 1.0;
        }
        if (x <= -9.0 && x >= -21.5 && z >= -18.5 && z <= -7.2) {
            return 1.2;
        }

        return 0.2;
    }

    public getWalkableSurfaceY(x: number, z: number): number | null {
        if (x < -21.0 || x > 21.0 || z < -18.0 || z > 13.5) return null;

        // South Bridge (z = 0.6)
        if (Math.abs(x) <= 2.7 && z >= -0.45 && z <= 1.65) {
            const progress = (x + 2.7) / 5.4;
            return 0.25 + Math.sin(progress * Math.PI) * 0.45;
        }

        // North Festival Bridge (z = -10.2)
        if (Math.abs(x) <= 2.7 && z >= -11.25 && z <= -9.15) {
            const progress = (x + 2.7) / 5.4;
            return 0.25 + Math.sin(progress * Math.PI) * 0.45;
        }

        // Wooden Pier on West Bank Cove (z in [-5.4, -3.4], x in [-2.6, -0.8])
        if (x >= -2.6 && x <= -0.8 && z >= -5.3 && z <= -3.5) {
            return 0.26;
        }

        // Stream channel (wider in the middle cove)
        const streamHalfW = z >= -7.2 && z <= -1.8 ? 3.05 : 2.45;
        if (Math.abs(x) < streamHalfW) {
            return null;
        }

        const radius = 0.28;
        for (let i = 0; i < this.solidColliders.length; i++) {
            const c = this.solidColliders[i];
            if (x + radius > c.minX && x - radius < c.maxX && z + radius > c.minZ && z - radius < c.maxZ) {
                return null;
            }
        }

        return this.getTerrainHeight(x, z);
    }
}
