import * as THREE from 'three';
import { AssetLoader } from '../core/AssetLoader';
import { generateRoofPBR } from '../graphics/PixelTextureGen';
import { InteractiveLamp } from '../types';
import { WorldContext } from './WorldContext';
import townMap from '../data/town_map.json';

export interface PropRefs {
    waterWheelGroup: THREE.Group;
    interactiveLamps: InteractiveLamp[];
}

export async function buildProps(
    scene: THREE.Scene,
    ctx: WorldContext,
    assets: AssetLoader
): Promise<PropRefs> {
    // Rotating Wooden Waterwheel mounted neatly on the West Stone Embankment
    const waterWheelGroup = new THREE.Group();
    waterWheelGroup.position.set(townMap.waterWheel.x, townMap.waterWheel.y, townMap.waterWheel.z);
    const wheelRim1 = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.07, 8, 18), ctx.timberMat);
    wheelRim1.rotation.y = Math.PI / 2;
    wheelRim1.position.x = -0.2;
    const wheelRim2 = wheelRim1.clone();
    wheelRim2.position.x = 0.2;
    waterWheelGroup.add(wheelRim1, wheelRim2);

    const wheelAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.85, 10), ctx.timberMat);
    wheelAxle.rotation.z = Math.PI / 2;
    waterWheelGroup.add(wheelAxle);

    for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * Math.PI * 2;
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.05, 0.07), ctx.woodMat);
        spoke.rotation.x = ang;
        waterWheelGroup.add(spoke);

        const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.06, 0.24), ctx.woodMat);
        paddle.position.set(0, Math.cos(ang) * 1.05, Math.sin(ang) * 1.05);
        paddle.rotation.x = ang;
        paddle.castShadow = true;
        waterWheelGroup.add(paddle);
    }
    scene.add(waterWheelGroup);

    // Decorative Windmill on Northwest Hill
    try {
        const windmill = await assets.instantiateModel('./assets/models/windmill.glb', 6.2);
        const wm = townMap.windmill;
        windmill.position.set(wm.x, wm.y, wm.z);
        windmill.rotation.y = 0.45;
        windmill.add(ctx.createContactShadow(3.6, 3.6, 0.015));
        scene.add(windmill);
        ctx.addCollider(wm.x - 1.4, wm.x + 1.4, wm.z - 1.4, wm.z + 1.4);
    } catch {
        // Optional landmark
    }

    // Compact Stone Wells matching HD-2D scale
    const roofRedPbr = generateRoofPBR('#b94a3e', '#d96b5f', '#7c2d25');
    const wellRoofMat = new THREE.MeshStandardMaterial({
        map: roofRedPbr.map,
        normalMap: roofRedPbr.normalMap,
        normalScale: new THREE.Vector2(0.45, 0.45),
        roughnessMap: roofRedPbr.roughnessMap,
        roughness: 0.78,
    });
    townMap.wells.forEach((w) => {
        const well = new THREE.Group();
        well.position.set(w.x, w.y ?? 0.2, w.z);
        well.add(ctx.createContactShadow(2.4, 2.4, 0.015));

        const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.78, 12), ctx.stoneWallMat);
        baseRing.position.y = 0.39;
        baseRing.castShadow = true;
        baseRing.receiveShadow = true;
        well.add(baseRing);

        const waterDisk = new THREE.Mesh(
            new THREE.CircleGeometry(0.78, 12),
            new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.15, metalness: 0.4 })
        );
        waterDisk.rotation.x = -Math.PI / 2;
        waterDisk.position.y = 0.68;
        well.add(waterDisk);

        [-0.82, 0.82].forEach((px) => {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.85, 0.14), ctx.timberMat);
            post.position.set(px, 1.25, 0);
            post.castShadow = true;
            well.add(post);
        });

        const roofGeo = new THREE.ConeGeometry(1.38, 0.92, 4);
        roofGeo.rotateY(Math.PI / 4);
        const roof = new THREE.Mesh(roofGeo, wellRoofMat);
        roof.position.y = 2.45;
        roof.castShadow = true;
        well.add(roof);

        const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.24, 8), ctx.woodMat);
        bucket.position.set(0.15, 1.35, 0);
        well.add(bucket);

        scene.add(well);
        ctx.addCollider(w.x - 1.1, w.x + 1.1, w.z - 1.1, w.z + 1.1);
    });

    // 3D Wooden Carts
    await Promise.all(
        townMap.carts.map(async (c, idx) => {
            const cartUrl = idx % 2 === 0 ? './assets/models/cartHigh.glb' : './assets/models/cart.glb';
            const cart = await assets.instantiateModel(cartUrl, 1.45);
            cart.position.set(c.x, c.y ?? 0.2, c.z);
            cart.rotation.y = c.rotY;
            cart.add(ctx.createContactShadow(2.1, 1.4, 0.015));
            scene.add(cart);
            ctx.addCollider(c.x - 0.95, c.x + 0.95, c.z - 0.75, c.z + 0.75);
        })
    );

    // Barrel Clusters
    townMap.barrels.forEach((b) => {
        const group = new THREE.Group();
        group.position.set(b.x, b.y ?? 0.2, b.z);
        [
            [0, 0.34, 0, 0.26, 0.68],
            [0.52, 0.3, 0.18, 0.23, 0.6],
            [0.24, 0.28, -0.44, 0.24, 0.56],
        ].forEach(([ox, oy, oz, r, h]) => {
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.88, r, h, 10), ctx.woodMat);
            barrel.position.set(ox, oy, oz);
            barrel.castShadow = true;
            barrel.receiveShadow = true;
            group.add(barrel);
        });
        scene.add(group);
        ctx.addCollider(b.x - 0.45, b.x + 0.75, b.z - 0.65, b.z + 0.45);
    });

    // 3D Park Benches
    await Promise.all(
        townMap.benches.map(async (b) => {
            const bench = await assets.instantiateModel('./assets/models/stallBench.glb', 0.85);
            bench.position.set(b.x, b.y ?? 0.2, b.z);
            bench.rotation.y = b.rotY;
            scene.add(bench);
            ctx.addCollider(b.x - 0.75, b.x + 0.75, b.z - 0.35, b.z + 0.35);
        })
    );

    // Wooden Fences
    townMap.fences.forEach((f) => {
        for (let i = 0; i <= f.segments; i++) {
            const t = i / f.segments;
            const fx = THREE.MathUtils.lerp(f.startX, f.endX, t);
            const fz = THREE.MathUtils.lerp(f.startZ, f.endZ, t);
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.76, 0.14), ctx.timberMat);
            post.position.set(fx, 0.58, fz);
            post.castShadow = true;
            scene.add(post);
        }
        const dx = f.endX - f.startX;
        const dz = f.endZ - f.startZ;
        const len = Math.hypot(dx, dz);
        const angle = Math.atan2(dx, dz);
        [0.44, 0.74].forEach((ry) => {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, len), ctx.woodMat);
            rail.position.set((f.startX + f.endX) / 2, ry, (f.startZ + f.endZ) / 2);
            rail.rotation.y = angle;
            rail.castShadow = true;
            scene.add(rail);
        });
        ctx.addCollider(
            Math.min(f.startX, f.endX) - 0.15,
            Math.max(f.startX, f.endX) + 0.15,
            Math.min(f.startZ, f.endZ) - 0.15,
            Math.max(f.startZ, f.endZ) + 0.15
        );
    });

    // Interactive Street Lanterns using 3D Kenney Lantern
    const interactiveLamps: InteractiveLamp[] = [];
    await Promise.all(
        townMap.streetLamps.map(async (l, idx) => {
            const lampGroup = new THREE.Group();
            lampGroup.position.set(l.x, l.y ?? 0.2, l.z);

            const pole = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.35, 0.14), ctx.timberMat);
            pole.position.y = 1.18;
            pole.castShadow = true;
            lampGroup.add(pole);

            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.1), ctx.timberMat);
            arm.position.set(l.x < 0 ? 0.22 : -0.22, 2.3, 0);
            lampGroup.add(arm);

            const lanternModel = await assets.instantiateModel('./assets/models/lantern.glb', 0.42);
            lanternModel.position.set(l.x < 0 ? 0.42 : -0.42, 1.9, 0);
            lampGroup.add(lanternModel);

            const bulbMat = new THREE.MeshStandardMaterial({
                color: 0xffedd5,
                emissive: 0xff9e00,
                emissiveIntensity: 1.5,
            });
            const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), bulbMat);
            bulb.position.set(l.x < 0 ? 0.42 : -0.42, 2.08, 0);
            lampGroup.add(bulb);

            const pointLight = new THREE.PointLight(0xffa938, 1.2, 6.8, 1.6);
            pointLight.position.set(l.x < 0 ? 0.42 : -0.42, 2.0, 0);
            lampGroup.add(pointLight);

            interactiveLamps.push({
                x: l.x,
                z: l.z,
                isOn: true,
                light: pointLight,
                bulbMat,
                name: `Đèn Lồng Thị Trấn #${idx + 1}`,
            });

            scene.add(lampGroup);
            ctx.addCollider(l.x - 0.2, l.x + 0.2, l.z - 0.2, l.z + 0.2);
        })
    );

    return { waterWheelGroup, interactiveLamps };
}
