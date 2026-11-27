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
    const roofMossPbr = generateRoofPBR('#3f6212', '#65a30d', '#1a2e05');
    const roofOchrePbr = generateRoofPBR('#b45309', '#d97706', '#78350f');

    const wallMat = new THREE.MeshStandardMaterial({
        map: wallPbr.map,
        normalMap: wallPbr.normalMap,
        normalScale: new THREE.Vector2(0.45, 0.45),
        roughnessMap: wallPbr.roughnessMap,
        roughness: 0.85,
    });
    const wallWarmMat = wallMat.clone();
    wallWarmMat.color.setHex(0xfde68a);
    const wallSageMat = wallMat.clone();
    wallSageMat.color.setHex(0xd9f99d);
    const wallRoseMat = wallMat.clone();
    wallRoseMat.color.setHex(0xfecdd3);

    const makeRoofMat = (pbr: ReturnType<typeof generateRoofPBR>) =>
        new THREE.MeshStandardMaterial({
            map: pbr.map,
            normalMap: pbr.normalMap,
            normalScale: new THREE.Vector2(0.5, 0.5),
            roughnessMap: pbr.roughnessMap,
            roughness: 0.78,
        });

    const roofMats: Record<string, THREE.MeshStandardMaterial> = {
        red: makeRoofMat(roofRedPbr),
        slate: makeRoofMat(roofSlatePbr),
        moss: makeRoofMat(roofMossPbr),
        ochre: makeRoofMat(roofOchrePbr),
    };

    const windowGlassMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xffa726,
        emissiveIntensity: 0.65,
        roughness: 0.2,
    });

    type HouseEntry = (typeof townMap.houses)[number] & {
        kind?: string;
        wallTint?: string;
        awningColor?: string;
    };

    (townMap.houses as HouseEntry[]).forEach((h) => {
        const roofMat = roofMats[h.roof] ?? roofMats.red;
        const selectedWall =
            h.wallTint === 'warm'
                ? wallWarmMat
                : h.wallTint === 'sage'
                  ? wallSageMat
                  : h.wallTint === 'rose'
                    ? wallRoseMat
                    : wallMat;
        buildTownHouse(scene, ctx, {
            x: h.x,
            y: h.y ?? 0.2,
            z: h.z,
            w: h.w,
            h: h.h,
            d: h.d,
            rotY: h.rotY,
            roofMat,
            wallMat: selectedWall,
            windowGlassMat,
            hasAwning: h.hasAwning,
            kind: h.kind ?? 'cottage',
            awningColor: h.awningColor,
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
        kind: string;
        awningColor?: string;
    }
): void {
    const {
        x,
        y,
        z,
        w,
        h,
        d,
        rotY,
        roofMat,
        wallMat,
        windowGlassMat,
        hasAwning,
        kind,
        awningColor,
    } = opts;
    const house = new THREE.Group();
    house.position.set(x, y, z);
    house.rotation.y = rotY;

    if (kind === 'pagoda' || kind === 'wizard_tower' || kind === 'greenhouse' || kind === 'rotunda') {
        buildUniqueBuilding(house, ctx, { w, h, d, roofMat, wallMat, windowGlassMat, kind });
        house.add(ctx.createContactShadow(w + 1.3, d + 1.3, 0.015));
        scene.add(house);
        const cosR = Math.abs(Math.cos(rotY));
        const sinR = Math.abs(Math.sin(rotY));
        const halfW = (w * cosR + d * sinR) * 0.52;
        const halfD = (w * sinR + d * cosR) * 0.52;
        ctx.addCollider(x - halfW, x + halfW, z - halfD, z + halfD);
        return;
    }

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
        const stripeHex =
            awningColor ??
            (kind === 'inn' ? '#dc2626' : kind === 'shop' ? '#0284c7' : '#d97706');
        const awningMat = new THREE.MeshStandardMaterial({
            map: generateStripedAwningTexture(stripeHex),
            roughness: 0.8,
        });
        const awning = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, 0.08, 0.98), awningMat);
        awning.position.set(0, 0.36 + 1.48, hd + 0.46);
        awning.rotation.x = 0.28;
        awning.castShadow = true;
        house.add(awning);
    }

    // Archetype-specific props & architectural details
    if (kind === 'inn') {
        // Hanging Tavern Signboard
        const signArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.7), ctx.timberMat);
        signArm.position.set(-hw * 0.55, 0.36 + h * 0.62, hd + 0.35);
        house.add(signArm);
        const signBoard = new THREE.Mesh(
            new THREE.BoxGeometry(0.55, 0.42, 0.08),
            new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 })
        );
        signBoard.position.set(-hw * 0.55, 0.36 + h * 0.62 - 0.28, hd + 0.65);
        house.add(signBoard);

        // Outdoor Bistro Tables & Stools
        [-w * 0.28, w * 0.28].forEach((tx) => {
            const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 10), ctx.woodMat);
            tableTop.position.set(tx, 0.52, hd + 0.78);
            tableTop.castShadow = true;
            house.add(tableTop);
            const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.5, 6), ctx.timberMat);
            tableLeg.position.set(tx, 0.26, hd + 0.78);
            house.add(tableLeg);
            const candle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.08), windowGlassMat);
            candle.position.set(tx, 0.6, hd + 0.78);
            house.add(candle);
        });
    } else if (kind === 'shop') {
        // Outdoor Merchandise Display Counter & Crates
        const counter = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, 0.58, 0.46), ctx.woodMat);
        counter.position.set(w * 0.18, 0.29, hd + 0.42);
        counter.castShadow = true;
        house.add(counter);
        const basket = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18, 0.14, 0.18, 8),
            new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 })
        );
        basket.position.set(w * 0.08, 0.66, hd + 0.42);
        house.add(basket);
        const goods = new THREE.Mesh(
            new THREE.BoxGeometry(0.28, 0.2, 0.24),
            new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6 })
        );
        goods.position.set(w * 0.3, 0.68, hd + 0.42);
        house.add(goods);
    } else if (kind === 'blacksmith') {
        // Side Forge Hearth with Glowing Embers & Anvil
        const forgeBase = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.82, 0.85), ctx.stoneWallMat);
        forgeBase.position.set(hw + 0.48, 0.41, 0.1);
        forgeBase.castShadow = true;
        house.add(forgeBase);
        const emberMat = new THREE.MeshStandardMaterial({
            color: 0xf97316,
            emissive: 0xea580c,
            emissiveIntensity: 2.2,
            roughness: 0.4,
        });
        const embers = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.48), emberMat);
        embers.position.set(hw + 0.48, 0.86, 0.1);
        house.add(embers);
        const forgeLight = new THREE.PointLight(0xf97316, 1.4, 5.5, 1.5);
        forgeLight.position.set(hw + 0.48, 1.2, 0.2);
        house.add(forgeLight);
        const anvil = new THREE.Mesh(
            new THREE.BoxGeometry(0.42, 0.28, 0.26),
            new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.35 })
        );
        anvil.position.set(hw + 0.46, 0.46, 0.95);
        house.add(anvil);
    } else if (kind === 'clocktower') {
        // Glowing Clock Dial on Front Gable & Banner Flags
        const bezel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.52, 0.52, 0.14, 16),
            ctx.timberMat
        );
        bezel.rotation.x = Math.PI / 2;
        bezel.position.set(0, 0.36 + h + roofH * 0.42, hd + 0.08);
        house.add(bezel);
        const dial = new THREE.Mesh(
            new THREE.CylinderGeometry(0.42, 0.42, 0.16, 16),
            windowGlassMat
        );
        dial.rotation.x = Math.PI / 2;
        dial.position.set(0, 0.36 + h + roofH * 0.42, hd + 0.09);
        house.add(dial);
        [-hw * 0.65, hw * 0.65].forEach((bx) => {
            const banner = new THREE.Mesh(
                new THREE.BoxGeometry(0.32, 1.05, 0.06),
                new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.8 })
            );
            banner.position.set(bx, 0.36 + h * 0.62, hd + 0.12);
            house.add(banner);
        });
    } else if (kind === 'apothecary') {
        // Arcane / Herbalist Glowing Lantern Sign
        const apothOrb = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.18, 0),
            new THREE.MeshStandardMaterial({
                color: 0x34d399,
                emissive: 0x10b981,
                emissiveIntensity: 1.8,
                roughness: 0.2,
            })
        );
        apothOrb.position.set(-hw * 0.58, 0.36 + h * 0.55, hd + 0.38);
        house.add(apothOrb);
    }

    const contact = ctx.createContactShadow(w + 1.3, d + 1.3, 0.015);
    house.add(contact);

    scene.add(house);
    const cosR = Math.abs(Math.cos(rotY));
    const sinR = Math.abs(Math.sin(rotY));
    const halfW = (w * cosR + d * sinR) * 0.52;
    const halfD = (w * sinR + d * cosR) * 0.52;
    ctx.addCollider(x - halfW, x + halfW, z - halfD, z + halfD);
}

function buildUniqueBuilding(
    house: THREE.Group,
    ctx: WorldContext,
    opts: {
        w: number;
        h: number;
        d: number;
        roofMat: THREE.MeshStandardMaterial;
        wallMat: THREE.MeshStandardMaterial;
        windowGlassMat: THREE.MeshStandardMaterial;
        kind: 'pagoda' | 'wizard_tower' | 'greenhouse' | 'rotunda';
    }
): void {
    const { w, h, d, roofMat, wallMat, windowGlassMat, kind } = opts;

    if (kind === 'pagoda') {
        // 2-tier Eastern Pagoda / Tea Pavilion with flared roofs, red pillars & paper lanterns
        const lacquerMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.55 });
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.6, roughness: 0.3 });

        const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.34, d + 0.3), ctx.stoneWallMat);
        base.position.y = 0.17;
        base.castShadow = true;
        base.receiveShadow = true;
        house.add(base);

        const body1 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, h * 0.52, d * 0.88), wallMat);
        body1.position.y = 0.34 + h * 0.26;
        body1.castShadow = true;
        house.add(body1);

        // Red corner pillars
        [-w * 0.46, w * 0.46].forEach((px) => {
            [-d * 0.46, d * 0.46].forEach((pz) => {
                const p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, h * 0.56, 8), lacquerMat);
                p.position.set(px, 0.34 + h * 0.28, pz);
                p.castShadow = true;
                house.add(p);
            });
        });

        // Tier 1 Flared Roof
        const roof1 = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.85, 0.85, 4), roofMat);
        roof1.rotation.y = Math.PI / 4;
        roof1.position.y = 0.34 + h * 0.52 + 0.35;
        roof1.castShadow = true;
        house.add(roof1);

        // Tier 2 Upper Chamber & Spire
        const body2 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.62, h * 0.38, d * 0.62), wallMat);
        body2.position.y = 0.34 + h * 0.72;
        body2.castShadow = true;
        house.add(body2);

        const win2 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.32, 0.42, d * 0.65), windowGlassMat);
        win2.position.y = 0.34 + h * 0.72;
        house.add(win2);

        const roof2 = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.64, 1.05, 4), roofMat);
        roof2.rotation.y = Math.PI / 4;
        roof2.position.y = 0.34 + h * 0.92 + 0.45;
        roof2.castShadow = true;
        house.add(roof2);

        const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 0.65, 8), goldMat);
        finial.position.y = 0.34 + h * 0.92 + 1.15;
        house.add(finial);

        // Front door & hanging red lanterns
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.25, 0.12), lacquerMat);
        door.position.set(0, 0.34 + 0.62, d * 0.45);
        house.add(door);

        [-w * 0.42, w * 0.42].forEach((lx) => {
            const lantern = new THREE.Mesh(
                new THREE.SphereGeometry(0.18, 10, 10),
                new THREE.MeshStandardMaterial({
                    color: 0xef4444,
                    emissive: 0xf97316,
                    emissiveIntensity: 1.6,
                })
            );
            lantern.scale.set(0.9, 1.25, 0.9);
            lantern.position.set(lx, 0.34 + h * 0.45, d * 0.56);
            house.add(lantern);
        });
    } else if (kind === 'wizard_tower') {
        // Cylindrical Stone Wizard Tower with Spiral Balcony, Conical Roof & Floating Crystal
        const r = Math.min(w, d) * 0.46;
        const base = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.18, r + 0.28, 0.4, 14), ctx.stoneWallMat);
        base.position.y = 0.2;
        base.castShadow = true;
        house.add(base);

        const tower = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, h, 14), ctx.stoneWallMat);
        tower.position.y = 0.4 + h / 2;
        tower.castShadow = true;
        tower.receiveShadow = true;
        house.add(tower);

        // Wooden balcony ring
        const balcony = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.34, r + 0.25, 0.18, 14), ctx.timberMat);
        balcony.position.y = 0.4 + h * 0.62;
        balcony.castShadow = true;
        house.add(balcony);

        // Conical Wizard Hat Roof
        const cone = new THREE.Mesh(new THREE.ConeGeometry(r + 0.45, h * 0.72, 14), roofMat);
        cone.position.y = 0.4 + h + h * 0.34;
        cone.castShadow = true;
        house.add(cone);

        // Glowing Arcane Orb on Spire
        const orb = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.28, 0),
            new THREE.MeshStandardMaterial({
                color: 0xc084fc,
                emissive: 0xa855f7,
                emissiveIntensity: 2.2,
            })
        );
        orb.position.y = 0.4 + h + h * 0.74;
        house.add(orb);

        // Glowing arched windows & wooden door
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.25, 0.2), ctx.woodMat);
        door.position.set(0, 0.4 + 0.62, r - 0.04);
        house.add(door);

        [0, Math.PI * 0.5, -Math.PI * 0.5].forEach((ang) => {
            const win = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.18), windowGlassMat);
            win.position.set(Math.sin(ang) * (r * 0.93), 0.4 + h * 0.78, Math.cos(ang) * (r * 0.93));
            win.rotation.y = ang;
            house.add(win);
        });
    } else if (kind === 'greenhouse') {
        // Glass & Timber Conservatory filled with lush glowing plants
        const glassMat = new THREE.MeshStandardMaterial({
            color: 0xa5f3fc,
            emissive: 0x0ea5e9,
            emissiveIntensity: 0.22,
            transparent: true,
            opacity: 0.52,
            roughness: 0.1,
            metalness: 0.15,
        });
        const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.46, d + 0.16), ctx.stoneWallMat);
        base.position.y = 0.23;
        base.castShadow = true;
        house.add(base);

        const glassBody = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.74, d), glassMat);
        glassBody.position.y = 0.46 + h * 0.37;
        house.add(glassBody);

        // Timber frame ribs
        [-w / 2, 0, w / 2].forEach((fx) => {
            [-d / 2, d / 2].forEach((fz) => {
                const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, h * 0.76, 0.12), ctx.timberMat);
                post.position.set(fx, 0.46 + h * 0.38, fz);
                house.add(post);
            });
        });

        // Curved/pitched glass roof
        const roof = new THREE.Mesh(
            new THREE.CylinderGeometry(w * 0.52, w * 0.52, d + 0.2, 8, 1, false, 0, Math.PI),
            glassMat
        );
        roof.rotation.z = Math.PI / 2;
        roof.rotation.y = Math.PI / 2;
        roof.position.y = 0.46 + h * 0.74;
        house.add(roof);

        // Indoor glowing flowers & foliage visible through glass
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.8 });
        const bloomMat = new THREE.MeshStandardMaterial({
            color: 0xf472b6,
            emissive: 0xec4899,
            emissiveIntensity: 0.65,
        });
        [-w * 0.26, 0, w * 0.26].forEach((px, idx) => {
            const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), leafMat);
            bush.position.set(px, 0.78, (idx % 2 === 0 ? -0.3 : 0.3));
            house.add(bush);
            const flower = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), bloomMat);
            flower.position.set(px, 1.15, (idx % 2 === 0 ? -0.3 : 0.3));
            house.add(flower);
        });
    } else if (kind === 'rotunda') {
        // Octagonal Guild Hall / Round Tavern with Domed Roof & Wrap-Around Columns
        const r = Math.min(w, d) * 0.48;
        const base = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.24, r + 0.32, 0.36, 8), ctx.stoneWallMat);
        base.position.y = 0.18;
        base.castShadow = true;
        house.add(base);

        const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.88, r * 0.9, h * 0.85, 8), wallMat);
        body.position.y = 0.36 + h * 0.425;
        body.castShadow = true;
        house.add(body);

        // Wrap-around porch columns
        for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2 + Math.PI / 8;
            const col = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, h * 0.85, 8), ctx.timberMat);
            col.position.set(Math.cos(ang) * (r + 0.05), 0.36 + h * 0.425, Math.sin(ang) * (r + 0.05));
            col.castShadow = true;
            house.add(col);
        }

        // Domed Roof + Cupola Lantern
        const dome = new THREE.Mesh(new THREE.SphereGeometry(r + 0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), roofMat);
        dome.position.y = 0.36 + h * 0.84;
        dome.castShadow = true;
        house.add(dome);

        const cupola = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.48, 8), windowGlassMat);
        cupola.position.y = 0.36 + h * 0.84 + (r + 0.22) * 0.88;
        house.add(cupola);

        const door = new THREE.Mesh(new THREE.BoxGeometry(0.84, 1.32, 0.18), ctx.woodMat);
        door.position.set(0, 0.36 + 0.66, r * 0.88);
        house.add(door);
    }
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
