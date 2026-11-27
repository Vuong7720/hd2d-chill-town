import * as THREE from 'three';
import {
    generateRoofPBR,
    generateStripedAwningTexture,
    generateTimberWallPBR,
} from '../graphics/PixelTextureGen';
import { AssetLoader } from '../core/AssetLoader';
import { WorldContext } from './WorldContext';
import townMap from '../data/town_map.json';

export interface ArchitectureRefs {
    windowGlassMat: THREE.MeshStandardMaterial;
    shrineCrystal: THREE.Mesh;
}

export async function buildArchitecture(
    scene: THREE.Scene,
    ctx: WorldContext,
    _assets: AssetLoader
): Promise<ArchitectureRefs> {
    const wallPbr = generateTimberWallPBR();
    const roofRedPbr = generateRoofPBR('#b94a3e', '#d96b5f', '#7c2d25');
    const roofSlatePbr = generateRoofPBR('#3b526b', '#587594', '#233242');

    const wallMat = new THREE.MeshStandardMaterial({
        map: wallPbr.map,
        normalMap: wallPbr.normalMap,
        normalScale: new THREE.Vector2(0.45, 0.45),
        roughnessMap: wallPbr.roughnessMap,
        roughness: 0.85,
    });
    const roofRedMat = new THREE.MeshStandardMaterial({
        map: roofRedPbr.map,
        normalMap: roofRedPbr.normalMap,
        normalScale: new THREE.Vector2(0.5, 0.5),
        roughnessMap: roofRedPbr.roughnessMap,
        roughness: 0.78,
    });
    const roofSlateMat = new THREE.MeshStandardMaterial({
        map: roofSlatePbr.map,
        normalMap: roofSlatePbr.normalMap,
        normalScale: new THREE.Vector2(0.5, 0.5),
        roughnessMap: roofSlatePbr.roughnessMap,
        roughness: 0.78,
    });

    const windowGlassMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xffa726,
        emissiveIntensity: 0.65,
        roughness: 0.2,
    });

    townMap.houses.forEach((h) => {
        const roofMat = h.roof === 'red' ? roofRedMat : roofSlateMat;
        buildTownHouse(scene, ctx, {
            x: h.x,
            y: h.y ?? 0.2,
            z: h.z,
            w: h.w,
            h: h.h,
            d: h.d,
            rotY: h.rotY,
            roofMat,
            wallMat,
            windowGlassMat,
            hasAwning: h.hasAwning,
        });
    });

    const shrineGroup = new THREE.Group();
    const sy = townMap.shrine.y ?? 0.2;
    shrineGroup.position.set(townMap.shrine.x, sy, townMap.shrine.z);
    const toriiMat = new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        emissive: 0x7f1d1d,
        emissiveIntensity: 0.35,
        roughness: 0.5,
    });
    const pillarL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 3.2, 10), toriiMat);
    pillarL.position.set(-1.1, 1.6, 0);
    pillarL.castShadow = true;
    const pillarR = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 3.2, 10), toriiMat);
    pillarR.position.set(1.1, 1.6, 0);
    pillarR.castShadow = true;
    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.24, 0.34), toriiMat);
    topBeam.position.set(0, 3.15, 0);
    const subBeam = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 0.22), ctx.timberMat);
    subBeam.position.set(0, 2.55, 0);
    shrineGroup.add(pillarL, pillarR, topBeam, subBeam);
    ctx.addCollider(townMap.shrine.x - 1.3, townMap.shrine.x - 0.9, townMap.shrine.z - 0.2, townMap.shrine.z + 0.2);
    ctx.addCollider(townMap.shrine.x + 0.9, townMap.shrine.x + 1.3, townMap.shrine.z - 0.2, townMap.shrine.z + 0.2);

    const crystalMat = new THREE.MeshStandardMaterial({
        color: 0x67e8f9,
        emissive: 0x06b6d4,
        emissiveIntensity: 1.8,
        roughness: 0.1,
    });
    const shrineCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), crystalMat);
    shrineCrystal.position.set(0, 1.45, 0);
    shrineGroup.add(shrineCrystal);
    const shrineLight = new THREE.PointLight(0x22d3ee, 1.8, 9.0, 1.5);
    shrineLight.position.set(0, 1.6, 0);
    shrineGroup.add(shrineLight);
    scene.add(shrineGroup);

    townMap.marketStalls.forEach((s) => {
        buildMarketStall(scene, ctx, s.x, s.y ?? 0.2, s.z, s.color);
    });

    return { windowGlassMat, shrineCrystal };
}

function buildTownHouse(
    scene: THREE.Scene,
    ctx: WorldContext,
    opts: {
        x: number;
        y: number;
        z: number;
        w: number;
        h: number;
        d: number;
        rotY: number;
        roofMat: THREE.MeshStandardMaterial;
        wallMat: THREE.MeshStandardMaterial;
        windowGlassMat: THREE.MeshStandardMaterial;
        hasAwning: boolean;
    }
): void {
    const { x, y, z, w, h, d, rotY, roofMat, wallMat, windowGlassMat, hasAwning } = opts;
    const house = new THREE.Group();
    house.position.set(x, y, z);
    house.rotation.y = rotY;

    // Stone foundation + front stone step
    const foundation = new THREE.Mesh(new THREE.BoxGeometry(w + 0.24, 0.36, d + 0.24), ctx.stoneWallMat);
    foundation.position.y = 0.18;
    foundation.castShadow = true;
    foundation.receiveShadow = true;
    house.add(foundation);

    const doorStep = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.2, 0.55), ctx.stoneWallMat);
    doorStep.position.set(0, 0.1, d / 2 + 0.26);
    doorStep.castShadow = true;
    doorStep.receiveShadow = true;
    house.add(doorStep);

    // Main wall body
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    body.position.y = 0.36 + h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    house.add(body);

    // 3D Corner Timber Pillars & Horizontal Mid-Beam
    const hw = w / 2;
    const hd = d / 2;
    [
        [-hw, -hd],
        [hw, -hd],
        [-hw, hd],
        [hw, hd],
    ].forEach(([cx, cz]) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, h + 0.04, 0.18), ctx.timberMat);
        post.position.set(cx, 0.36 + h / 2, cz);
        post.castShadow = true;
        house.add(post);
    });

    const midBeam = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.14, d + 0.08), ctx.timberMat);
    midBeam.position.y = 0.36 + h * 0.52;
    midBeam.castShadow = true;
    house.add(midBeam);

    // Gabled Roof with Overhang & Ridge Beam
    const roofH = h * 0.62;
    const overhangX = 0.42;
    const overhangZ = 0.46;

    const gableShape = new THREE.Shape();
    gableShape.moveTo(-hw, 0);
    gableShape.lineTo(hw, 0);
    gableShape.lineTo(0, roofH);
    gableShape.closePath();

    const gableGeo = new THREE.ExtrudeGeometry(gableShape, {
        depth: d,
        bevelEnabled: false,
    });
    gableGeo.translate(0, 0, -hd);
    const gableMesh = new THREE.Mesh(gableGeo, wallMat);
    gableMesh.position.y = 0.36 + h;
    gableMesh.castShadow = true;
    gableMesh.receiveShadow = true;
    house.add(gableMesh);

    const slopeLen = Math.hypot(hw + overhangX, roofH);
    const slopeAngle = Math.atan2(roofH, hw + overhangX);
    const roofDepth = d + overhangZ * 2;

    [-1, 1].forEach((side) => {
        const slope = new THREE.Mesh(
            new THREE.BoxGeometry(slopeLen, 0.15, roofDepth),
            roofMat
        );
        slope.position.set(
            side * ((hw + overhangX) * 0.5 - 0.02),
            0.36 + h + roofH * 0.5 - 0.04,
            0
        );
        slope.rotation.z = -side * slopeAngle;
        slope.castShadow = true;
        slope.receiveShadow = true;
        house.add(slope);
    });

    const ridgeBeam = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.2, roofDepth + 0.08),
        ctx.timberMat
    );
    ridgeBeam.position.set(0, 0.36 + h + roofH + 0.02, 0);
    ridgeBeam.castShadow = true;
    house.add(ridgeBeam);

    // Stone Chimney with Cap
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.48, roofH * 1.15, 0.48), ctx.stoneWallMat);
    chimney.position.set(w * 0.24, 0.36 + h + roofH * 0.68, -d * 0.22);
    chimney.castShadow = true;
    house.add(chimney);

    const chimneyCap = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.62), ctx.timberMat);
    chimneyCap.position.set(w * 0.24, 0.36 + h + roofH * 1.25, -d * 0.22);
    house.add(chimneyCap);

    // Door with Frame & Porch Lantern
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.84, 1.38, 0.14), ctx.timberMat);
    doorFrame.position.set(0, 0.36 + 0.69, hd + 0.03);
    house.add(doorFrame);

    const door = new THREE.Mesh(new THREE.BoxGeometry(0.66, 1.24, 0.16), ctx.woodMat);
    door.position.set(0, 0.36 + 0.62, hd + 0.04);
    house.add(door);

    const porchLantern = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.18), windowGlassMat);
    porchLantern.position.set(0.62, 0.36 + 1.25, hd + 0.14);
    house.add(porchLantern);

    // Windows with Deep Frames & Flower Planters
    [-w * 0.28, w * 0.28].forEach((wx) => {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.7, 0.14), ctx.timberMat);
        frame.position.set(wx, 0.36 + h * 0.66, hd + 0.03);
        house.add(frame);

        const glass = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.52, 0.16), windowGlassMat);
        glass.position.set(wx, 0.36 + h * 0.66, hd + 0.04);
        house.add(glass);

        const planter = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.16, 0.24), ctx.woodMat);
        planter.position.set(wx, 0.36 + h * 0.66 - 0.4, hd + 0.1);
        house.add(planter);

        const blooms = new THREE.Mesh(
            new THREE.BoxGeometry(0.58, 0.14, 0.18),
            new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.9 })
        );
        blooms.position.set(wx, 0.36 + h * 0.66 - 0.28, hd + 0.1);
        house.add(blooms);
    });

    if (hasAwning) {
        const awningMat = new THREE.MeshStandardMaterial({
            map: generateStripedAwningTexture('#d97706'),
            roughness: 0.8,
        });
        const awning = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, 0.08, 0.95), awningMat);
        awning.position.set(0, 0.36 + 1.48, hd + 0.44);
        awning.rotation.x = 0.28;
        awning.castShadow = true;
        house.add(awning);
    }

    const contact = ctx.createContactShadow(w + 1.3, d + 1.3, 0.015);
    house.add(contact);

    scene.add(house);
    ctx.addCollider(x - w * 0.52, x + w * 0.52, z - d * 0.52, z + d * 0.52);
}

function buildMarketStall(
    scene: THREE.Scene,
    ctx: WorldContext,
    sx: number,
    sy: number,
    sz: number,
    canopyHex: string
): void {
    const stall = new THREE.Group();
    stall.position.set(sx, sy, sz);
    stall.add(ctx.createContactShadow(2.7, 1.6, 0.015));

    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.82, 0.9), ctx.woodMat);
    counter.position.y = 0.41;
    counter.castShadow = true;
    counter.receiveShadow = true;
    stall.add(counter);

    const counterTrim = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.08, 0.98), ctx.timberMat);
    counterTrim.position.y = 0.82;
    stall.add(counterTrim);

    [-0.9, 0.9].forEach((px) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.95, 0.11), ctx.timberMat);
        post.position.set(px, 0.97, -0.35);
        post.castShadow = true;
        stall.add(post);

        const frontPost = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.65, 0.09), ctx.timberMat);
        frontPost.position.set(px, 0.82, 0.4);
        stall.add(frontPost);
    });

    const awningMat = new THREE.MeshStandardMaterial({
        map: generateStripedAwningTexture(canopyHex),
        roughness: 0.78,
    });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.1, 1.32), awningMat);
    roof.position.set(0, 1.88, 0.05);
    roof.rotation.x = 0.22;
    roof.castShadow = true;
    stall.add(roof);

    // Market Goods on Counter (Crates, Fruit Baskets & Ceramic Pots)
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.18, 8), ctx.timberMat);
    basket.position.set(-0.52, 0.94, 0.05);
    stall.add(basket);

    const fruitMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.65 });
    [
        [-0.58, 1.05, 0.02],
        [-0.46, 1.05, 0.08],
        [-0.52, 1.09, 0.04],
    ].forEach(([fx, fy, fz]) => {
        const apple = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), fruitMat);
        apple.position.set(fx, fy, fz);
        stall.add(apple);
    });

    const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 0.28, 8),
        new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.55 })
    );
    pot.position.set(0.15, 0.98, -0.05);
    stall.add(pot);

    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.34), ctx.woodMat);
    crate.position.set(0.62, 0.96, 0.05);
    stall.add(crate);

    scene.add(stall);
    ctx.addCollider(sx - 1.05, sx + 1.05, sz - 0.5, sz + 0.5);
}
