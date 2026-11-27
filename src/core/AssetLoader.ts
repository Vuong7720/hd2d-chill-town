import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/addons/loaders/GLTFLoader.js';

export class AssetLoader {
    private textureLoader = new THREE.TextureLoader();
    private gltfLoader = new GLTFLoader();
    private textureCache = new Map<string, THREE.Texture>();
    private gltfCache = new Map<string, Promise<GLTF>>();

    async loadTexture(url: string, pixelArt = true): Promise<THREE.Texture> {
        const cached = this.textureCache.get(url);
        if (cached) return cached;

        const tex = await this.textureLoader.loadAsync(url);
        if (pixelArt) {
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        this.textureCache.set(url, tex);
        return tex;
    }

    loadGLTF(url: string): Promise<GLTF> {
        let promise = this.gltfCache.get(url);
        if (!promise) {
            promise = this.gltfLoader.loadAsync(url);
            this.gltfCache.set(url, promise);
        }
        return promise;
    }

    /**
     * Clone a GLB model, enable shadows, scale uniformly to targetHeight,
     * and center its X/Z bounds with Y=0 sitting flush on the ground.
     */
    async instantiateModel(
        url: string,
        targetHeight: number,
        tintFoliageHex?: number
    ): Promise<THREE.Group> {
        const gltf = await this.loadGLTF(url);
        const clone = gltf.scene.clone(true);

        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                if (tintFoliageHex !== undefined && mesh.material) {
                    const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
                    const matName = (mat.name || '').toLowerCase();
                    if (matName.includes('leaf') || matName.includes('leaves') || matName.includes('green') || mat.color.g > mat.color.r * 1.15) {
                        mat.color.setHex(tintFoliageHex);
                    }
                    mesh.material = mat;
                }
            }
        });

        const box = new THREE.Box3().setFromObject(clone);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        const scale = size.y > 0.001 ? targetHeight / size.y : 1;
        clone.scale.setScalar(scale);

        clone.position.set(
            -center.x * scale,
            -box.min.y * scale,
            -center.z * scale
        );

        const wrapper = new THREE.Group();
        wrapper.add(clone);
        return wrapper;
    }
}
