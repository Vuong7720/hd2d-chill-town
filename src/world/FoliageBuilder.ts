import * as THREE from 'three';
import { AssetLoader } from '../core/AssetLoader';
import { loadEdgeKeyedTexture } from '../graphics/SpriteKeying';
import { WorldContext } from './WorldContext';
import townMap from '../data/town_map.json';

export interface SwaySprite {
    mesh: THREE.Object3D;
    baseX: number;
    phase: number;
}

export interface FoliageRefs {
    foliageSprites: SwaySprite[];
    swayingBushes: SwaySprite[];
    mountainMeshes: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[];
}

export async function buildFoliage(
    scene: THREE.Scene,
    ctx: WorldContext,
    assets: AssetLoader
): Promise<FoliageRefs> {
    const oakMat = new THREE.MeshStandardMaterial({
        map: loadEdgeKeyedTexture('./assets/canopy_oak.jpg', 26),
        transparent: true,
        alphaTest: 0.45,
        roughness: 0.85,
        side: THREE.DoubleSide,
    });
    const sakuraMat = new THREE.MeshStandardMaterial({
        map: loadEdgeKeyedTexture('./assets/canopy_sakura.jpg', 26),
        transparent: true,
        alphaTest: 0.45,
        roughness: 0.85,
        side: THREE.DoubleSide,
    });

    const foliageSprites: SwaySprite[] = [];

    // Stationary 3D Wooden Trunks + Lush Swaying HD-2D Leaf/Blossom Canopies
    townMap.trees.forEach((t) => {
        const tree = new THREE.Group();
        tree.position.set(t.x, t.y ?? 0.2, t.z);

        const trunkH = 2.2 * t.scale;
        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18 * t.scale, 0.3 * t.scale, trunkH, 7),
            new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 })
        );
        trunk.position.y = trunkH / 2;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        tree.add(trunk);

        const fMat = t.type === 'sakura' ? sakuraMat : oakMat;
        const clusters: [number, number, number, number][] = [
            [0, trunkH + 0.9 * t.scale, 0, 2.75 * t.scale],
            [-0.85 * t.scale, trunkH + 0.45 * t.scale, 0.35 * t.scale, 2.15 * t.scale],
            [0.85 * t.scale, trunkH + 0.5 * t.scale, 0.3 * t.scale, 2.2 * t.scale],
            [0, trunkH + 0.55 * t.scale, -0.75 * t.scale, 2.25 * t.scale],
            [0, trunkH + 1.55 * t.scale, 0.1 * t.scale, 2.0 * t.scale],
        ];

        clusters.forEach(([cx, cy, cz, size], idx) => {
            const card = new THREE.Mesh(new THREE.PlaneGeometry(size, size), fMat);
            card.position.set(cx, cy, cz);
            if (idx % 2 === 1) card.scale.x = -1;
            card.castShadow = true;
            tree.add(card);
            foliageSprites.push({ mesh: card, baseX: cx, phase: t.x + t.z + idx });
        });

        tree.add(ctx.createContactShadow(2.4 * t.scale, 2.4 * t.scale, 0.015));
        scene.add(tree);
        ctx.addCollider(
            t.x - 0.35 * t.scale,
            t.x + 0.35 * t.scale,
            t.z - 0.35 * t.scale,
            t.z + 0.35 * t.scale
        );
    });

    // 3D Rocks from Kenney Fantasy Town Kit
    await Promise.all(
        townMap.rocks.map(async (r, idx) => {
            const rockUrl = idx % 2 === 0 ? './assets/models/rockLarge.glb' : './assets/models/rockWide.glb';
            const rock = await assets.instantiateModel(rockUrl, r.r * 1.9);
            rock.position.set(r.x, r.y ?? 0.2, r.z);
            rock.rotation.y = r.x + r.z;
            scene.add(rock);
        })
    );

    // Detailed HD-2D Flowering Shrubs & Bushes
    const bushTex = loadEdgeKeyedTexture('./assets/bush_flower.jpg', 24);
    const flowerBushMat = new THREE.MeshStandardMaterial({
        map: bushTex,
        transparent: true,
        alphaTest: 0.45,
        roughness: 0.88,
        side: THREE.DoubleSide,
    });
    const greenBushMat = new THREE.MeshStandardMaterial({
        map: bushTex,
        color: 0xa7f3d0,
        transparent: true,
        alphaTest: 0.45,
        roughness: 0.9,
        side: THREE.DoubleSide,
    });
    const swayingBushes: SwaySprite[] = [];

    townMap.bushes.forEach((b, i) => {
        const mat = b.flowers ? flowerBushMat : greenBushMat;
        const bushGeo = new THREE.PlaneGeometry(1.75, 1.65);
        bushGeo.translate(0, 0.52, 0);
        const bush = new THREE.Mesh(bushGeo, mat);
        bush.position.set(b.x, b.y ?? 0.2, b.z);
        if (i % 2 === 1) bush.scale.x = -1;
        bush.castShadow = true;
        scene.add(bush);
        swayingBushes.push({ mesh: bush, baseX: b.x, phase: i * 1.1 });
    });

    // Distant Layered Rolling Mountain Ridges (replacing sharp pyramid cones)
    const mountainMeshes: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = [];
    const ridgeConfigs = [
        { width: 96, height: 11.5, z: -33, seed: 0.8, color: 0x5c8ab5 },
        { width: 120, height: 15.5, z: -43, seed: 2.4, color: 0x7aa4cc },
    ];
    ridgeConfigs.forEach((cfg) => {
        const segX = 64;
        const segY = 6;
        const geo = new THREE.PlaneGeometry(cfg.width, 1, segX, segY);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const vx = pos.getX(i);
            const vy = pos.getY(i); // -0.5 to +0.5
            const tY = vy + 0.5; // 0 (bottom) -> 1 (ridge crest)
            const ridgeH =
                cfg.height *
                (0.55 +
                    0.22 * Math.sin(vx * 0.11 + cfg.seed) +
                    0.15 * Math.cos(vx * 0.24 - cfg.seed * 1.3) +
                    0.08 * Math.sin(vx * 0.47 + cfg.seed * 2.1));
            pos.setY(i, tY * ridgeH - 1.5);
            // Slight curve wrapping around the valley
            const curveZ = -Math.pow(vx / (cfg.width * 0.5), 2) * 5.0;
            pos.setZ(i, curveZ + Math.sin(vx * 0.15 + cfg.seed) * 1.4 * tY);
        }
        geo.computeVertexNormals();
        const mat = new THREE.MeshStandardMaterial({
            color: cfg.color,
            roughness: 0.96,
            metalness: 0.0,
        });
        const ridge = new THREE.Mesh(geo, mat);
        ridge.position.set(0, 0, cfg.z);
        scene.add(ridge);
        mountainMeshes.push(ridge);
    });

    return { foliageSprites, swayingBushes, mountainMeshes };
}
