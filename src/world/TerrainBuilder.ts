import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { createStreamWaterMaterial, WaterUniforms } from '../graphics/WaterShader';
import { WorldContext } from './WorldContext';
import townMap from '../data/town_map.json';

function createRoundedSlabGeometry(
    w: number,
    d: number,
    h: number,
    radius: number,
    bevel = 0.04
): THREE.ExtrudeGeometry {
    const r = Math.min(radius, w * 0.48, d * 0.48);
    const hw = w / 2;
    const hd = d / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-hw + r, -hd);
    shape.lineTo(hw - r, -hd);
    shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
    shape.lineTo(hw, hd - r);
    shape.quadraticCurveTo(hw, hd, hw - r, hd);
    shape.lineTo(-hw + r, hd);
    shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
    shape.lineTo(-hw, -hd + r);
    shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

    const geo = new THREE.ExtrudeGeometry(shape, {
        depth: h,
        bevelEnabled: bevel > 0,
        bevelThickness: bevel,
        bevelSize: bevel,
        bevelSegments: 2,
        curveSegments: 10,
    });
    geo.rotateX(-Math.PI / 2);

    // Fix UVs so world-space textures tile cleanly across rounded slabs
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vz = pos.getZ(i);
        uv.setXY(i, (vx + hw) / 6.0, (vz + hd) / 6.0);
    }
    uv.needsUpdate = true;
    return geo;
}

export function buildTerrain(
    scene: THREE.Scene,
    ctx: WorldContext
): { waterUniforms: WaterUniforms } {
    const { material: waterMat, uniforms: waterUniforms } = createStreamWaterMaterial();

    // West & East Base Grass Terrains
    const leftBank = new THREE.Mesh(new THREE.BoxGeometry(26, 1.4, 44), ctx.grassMat);
    leftBank.position.set(-15.4, -0.5, -3);
    leftBank.receiveShadow = true;
    scene.add(leftBank);

    const rightBank = new THREE.Mesh(new THREE.BoxGeometry(26, 1.4, 44), ctx.grassMat);
    rightBank.position.set(15.4, -0.5, -3);
    rightBank.receiveShadow = true;
    scene.add(rightBank);

    ctx.walkableFloors.push(leftBank, rightBank);

    // Soft Organic Rolling Hills Framing the North & Outer Valley Edges (leaving center gorge open for waterfall)
    const hillSpots: [number, number, number, number, number][] = [
        [-18, -21, 9.5, 3.2, 6.5],
        [-8.2, -22, 6.2, 3.0, 5.8],
        [8.2, -22, 6.2, 3.0, 5.8],
        [18, -21, 9.5, 3.4, 6.5],
        [-23, -8, 6.5, 2.6, 9.0],
        [-23, 4, 6.0, 2.2, 8.5],
        [23, -6, 6.5, 2.8, 9.0],
        [23, 5, 6.0, 2.2, 8.5],
    ];
    hillSpots.forEach(([hx, hz, rx, ry, rz]) => {
        const hillGeo = new THREE.SphereGeometry(1, 18, 12);
        hillGeo.scale(rx, ry, rz);
        const hill = new THREE.Mesh(hillGeo, ctx.grassMat);
        hill.position.set(hx, 0.1, hz);
        hill.receiveShadow = true;
        scene.add(hill);
    });

    // Terraced High Grounds with Soft Rounded Corners
    // 1) East Crystal Shrine Terrace (y = 1.4)
    const eastTerraceWall = new THREE.Mesh(
        createRoundedSlabGeometry(13.0, 11.8, 1.15, 2.6, 0.06),
        ctx.stoneWallMat
    );
    eastTerraceWall.position.set(15.5, 0.18, -6.25);
    eastTerraceWall.castShadow = true;
    eastTerraceWall.receiveShadow = true;
    scene.add(eastTerraceWall);

    const eastTerraceTop = new THREE.Mesh(
        createRoundedSlabGeometry(12.6, 11.4, 0.1, 2.5, 0.03),
        ctx.grassMat
    );
    eastTerraceTop.position.set(15.5, 1.32, -6.25);
    eastTerraceTop.receiveShadow = true;
    scene.add(eastTerraceTop);
    ctx.walkableFloors.push(eastTerraceTop);

    // East Stone Stairs (x: 6.4 -> 9.0, z: -5.6 -> -3.2)
    buildStoneStairs(scene, ctx, 6.4, 9.0, -4.4, 2.4, 0.2, 1.4, 6);

    // 2) Northwest Windmill Hill Terrace (y = 1.2)
    const nwTerraceWall = new THREE.Mesh(
        createRoundedSlabGeometry(13.0, 11.6, 0.95, 2.6, 0.06),
        ctx.stoneWallMat
    );
    nwTerraceWall.position.set(-15.5, 0.18, -12.85);
    nwTerraceWall.castShadow = true;
    nwTerraceWall.receiveShadow = true;
    scene.add(nwTerraceWall);

    const nwTerraceTop = new THREE.Mesh(
        createRoundedSlabGeometry(12.6, 11.2, 0.1, 2.5, 0.03),
        ctx.grassMat
    );
    nwTerraceTop.position.set(-15.5, 1.12, -12.85);
    nwTerraceTop.receiveShadow = true;
    scene.add(nwTerraceTop);
    ctx.walkableFloors.push(nwTerraceTop);

    // NW Stone Stairs (x: -6.4 -> -9.0, z: -11.4 -> -9.0)
    buildStoneStairs(scene, ctx, -6.4, -9.0, -10.2, 2.4, 0.2, 1.2, 5);

    // Stone Embankment Walls (recessed around the middle cove)
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.45, 44), ctx.stoneWallMat);
    leftWall.position.set(-2.4, -0.48, -3);
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.45, 44), ctx.stoneWallMat);
    rightWall.position.set(2.4, -0.48, -3);
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    // Riverbed, Reflector & Water Surface
    const riverBed = new THREE.Mesh(
        new THREE.BoxGeometry(6.4, 0.5, 44),
        new THREE.MeshStandardMaterial({ color: 0x164e63, roughness: 0.9 })
    );
    riverBed.position.set(0, -1.1, -3);
    scene.add(riverBed);

    const reflector = new Reflector(new THREE.PlaneGeometry(5.8, 44), {
        clipBias: 0.003,
        textureWidth: 512,
        textureHeight: 512,
        color: 0x64748b,
    });
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.set(0, -0.44, -3);
    scene.add(reflector);

    const waterSurface = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 44, 1, 1), waterMat);
    waterSurface.rotation.x = -Math.PI / 2;
    waterSurface.position.set(0, -0.42, -3);
    scene.add(waterSurface);

    // Wooden Pier on West Bank Cove
    buildWoodenPier(scene, ctx);

    // Soft Rounded Cobblestone Plazas & Pathways
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.88 });
    townMap.plazas.forEach((p) => {
        const yBase = p.y ?? 0.2;
        const rad = p.radius ?? 1.2;

        const plaza = new THREE.Mesh(
            createRoundedSlabGeometry(p.w, p.d, 0.04, rad, 0.015),
            ctx.cobbleMat
        );
        plaza.position.set(p.x, yBase + 0.005, p.z);
        plaza.receiveShadow = true;
        scene.add(plaza);
        ctx.walkableFloors.push(plaza);

        if (Math.abs(p.x) > 3.0) {
            const curb = new THREE.Mesh(
                createRoundedSlabGeometry(p.w + 0.26, p.d + 0.26, 0.025, rad + 0.13, 0.015),
                curbMat
            );
            curb.position.set(p.x, yBase - 0.005, p.z);
            curb.receiveShadow = true;
            scene.add(curb);
        }
    });

    townMap.bridges.forEach((b) => buildArchedBridge(scene, ctx, b.centerZ));
    buildRiverDetails(scene, ctx);
    buildWaterfallSource(scene, ctx);

    return { waterUniforms };
}

function buildWaterfallSource(scene: THREE.Scene, ctx: WorldContext): void {
    const wfGroup = new THREE.Group();
    wfGroup.position.set(0, 0, -22.2);

    // Rocky cliff behind the waterfall
    const cliff = new THREE.Mesh(new THREE.BoxGeometry(7.2, 4.6, 2.4), ctx.stoneWallMat);
    cliff.position.set(0, 1.5, -1.2);
    cliff.castShadow = true;
    cliff.receiveShadow = true;
    wfGroup.add(cliff);

    // Flanking boulders
    [
        [-3.0, 0.8, 0.2, 1.25],
        [3.0, 0.8, 0.2, 1.3],
        [-2.2, 1.8, -0.3, 1.0],
        [2.2, 1.8, -0.3, 1.05],
    ].forEach(([bx, by, bz, br]) => {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(br, 0), ctx.stoneWallMat);
        rock.position.set(bx, by, bz);
        rock.rotation.set(bx, bz, 0.3);
        rock.castShadow = true;
        wfGroup.add(rock);
    });

    // Cascading water sheet
    const fallMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.35,
        roughness: 0.15,
        transparent: true,
        opacity: 0.86,
    });
    const fallSheet = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.8), fallMat);
    fallSheet.position.set(0, 1.35, 0.08);
    wfGroup.add(fallSheet);

    // White foam streaks & splash pool at the base
    const foamMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.8 });
    [-0.9, 0, 0.9].forEach((fx) => {
        const streak = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 3.5), foamMat);
        streak.position.set(fx, 1.35, 0.12);
        wfGroup.add(streak);
    });

    const splashFoam = new THREE.Mesh(new THREE.CircleGeometry(1.9, 16), foamMat);
    splashFoam.rotation.x = -Math.PI / 2;
    splashFoam.scale.set(1.2, 0.65, 1);
    splashFoam.position.set(0, -0.39, 0.55);
    wfGroup.add(splashFoam);

    scene.add(wfGroup);
}

function buildStoneStairs(
    scene: THREE.Scene,
    ctx: WorldContext,
    startX: number,
    endX: number,
    centerZ: number,
    widthZ: number,
    startY: number,
    endY: number,
    steps: number
): void {
    const stepW = Math.abs(endX - startX) / steps;
    const dir = endX > startX ? 1 : -1;
    const stepH = (endY - startY) / steps;

    for (let i = 0; i < steps; i++) {
        const sx = startX + dir * (i + 0.5) * stepW;
        const topY = startY + (i + 1) * stepH;
        const mesh = new THREE.Mesh(
            createRoundedSlabGeometry(stepW + 0.08, widthZ, topY, 0.12, 0.02),
            ctx.stoneWallMat
        );
        mesh.position.set(sx, 0, centerZ);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        ctx.walkableFloors.push(mesh);
    }

    // Low side curbs on stairs
    [-widthZ / 2 - 0.12, widthZ / 2 + 0.12].forEach((sz) => {
        const rail = new THREE.Mesh(
            new THREE.BoxGeometry(Math.abs(endX - startX) + 0.2, 0.35, 0.2),
            ctx.stoneWallMat
        );
        rail.position.set((startX + endX) / 2, (startY + endY) / 2 + 0.1, centerZ + sz);
        rail.rotation.z = dir * Math.atan2(endY - startY, Math.abs(endX - startX));
        rail.castShadow = true;
        scene.add(rail);
    });
}

function buildWoodenPier(scene: THREE.Scene, ctx: WorldContext): void {
    const pier = new THREE.Group();
    pier.position.set(-1.7, 0.24, -4.4);

    const deck = new THREE.Mesh(
        createRoundedSlabGeometry(1.9, 1.8, 0.08, 0.18, 0.02),
        ctx.woodMat
    );
    deck.castShadow = true;
    deck.receiveShadow = true;
    pier.add(deck);
    ctx.walkableFloors.push(deck);

    [
        [-0.8, -0.75],
        [-0.8, 0.75],
        [0.8, -0.75],
        [0.8, 0.75],
    ].forEach(([px, pz]) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.95, 8), ctx.timberMat);
        post.position.set(px, -0.25, pz);
        post.castShadow = true;
        pier.add(post);
    });

    scene.add(pier);
}

function buildArchedBridge(scene: THREE.Scene, ctx: WorldContext, centerZ: number): void {
    const bridgeGroup = new THREE.Group();
    const plankCount = 14;
    for (let i = 0; i < plankCount; i++) {
        const t = i / (plankCount - 1);
        const px = -2.6 + t * 5.2;
        const archY = Math.sin(t * Math.PI) * 0.45;
        const plank = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 2.5), ctx.woodMat);
        plank.position.set(px, 0.25 + archY, centerZ);
        plank.castShadow = true;
        plank.receiveShadow = true;
        bridgeGroup.add(plank);
        ctx.walkableFloors.push(plank);
    }

    [centerZ - 1.1, centerZ + 1.1].forEach((zPos) => {
        [-2.4, -1.2, 0, 1.2, 2.4].forEach((xPos) => {
            const t = (xPos + 2.6) / 5.2;
            const archY = Math.sin(t * Math.PI) * 0.45;
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.72, 0.16), ctx.timberMat);
            post.position.set(xPos, 0.58 + archY, zPos);
            post.castShadow = true;
            bridgeGroup.add(post);
        });
        const rail = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.12, 0.14), ctx.woodMat);
        rail.position.set(0, 0.96, zPos);
        rail.castShadow = true;
        bridgeGroup.add(rail);
    });

    scene.add(bridgeGroup);
}

function buildRiverDetails(scene: THREE.Scene, ctx: WorldContext): void {
    const ironMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.5,
        metalness: 0.6,
    });
    const vineMat = new THREE.MeshStandardMaterial({ color: 0x3f8f29, roughness: 0.85 });
    const lilyMat = new THREE.MeshStandardMaterial({
        color: 0x4ade80,
        roughness: 0.65,
        side: THREE.DoubleSide,
    });
    const lotusPinkMat = new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.5 });
    const lotusWhiteMat = new THREE.MeshStandardMaterial({ color: 0xfff1f2, roughness: 0.5 });

    [-7.0, -2.2, 4.2].forEach((gz) => {
        [-2.18, 2.18].forEach((gx) => {
            const archGroup = new THREE.Group();
            archGroup.position.set(gx, -0.18, gz);
            archGroup.rotation.y = gx < 0 ? Math.PI / 2 : -Math.PI / 2;

            const frame = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 0.14), ctx.stoneWallMat);
            archGroup.add(frame);

            const recess = new THREE.Mesh(
                new THREE.BoxGeometry(0.68, 0.66, 0.16),
                new THREE.MeshBasicMaterial({ color: 0x090d16 })
            );
            recess.position.y = -0.05;
            archGroup.add(recess);

            for (let b = -2; b <= 2; b++) {
                const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.66, 6), ironMat);
                bar.position.set(b * 0.13, -0.05, 0.06);
                archGroup.add(bar);
            }
            scene.add(archGroup);
        });
    });

    [-13.5, -8.2, -5.5, -1.5, 2.8, 6.2].forEach((vz, idx) => {
        const vx = idx % 2 === 0 ? -2.16 : 2.16;
        const vine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55 + (idx % 3) * 0.18, 0.42), vineMat);
        vine.position.set(vx, 0.05, vz);
        scene.add(vine);
    });

    const lilySpots: [number, number, number][] = [
        [-1.55, 3.2, 0.34],
        [-1.78, 3.65, 0.25],
        [-1.35, 3.85, 0.28],
        [1.52, 2.9, 0.36],
        [1.75, 3.45, 0.24],
        [1.48, -2.1, 0.32],
        [1.72, -2.55, 0.26],
        [-1.58, -6.4, 0.35],
        [-1.32, -6.85, 0.26],
        [1.55, -7.8, 0.33],
        [1.78, -8.2, 0.24],
    ];
    lilySpots.forEach(([lx, lz, r], i) => {
        const pad = new THREE.Mesh(new THREE.CircleGeometry(r, 12, 0, Math.PI * 1.82), lilyMat);
        pad.rotation.x = -Math.PI / 2;
        pad.rotation.z = i * 1.1;
        pad.position.set(lx, -0.395, lz);
        scene.add(pad);

        if (i % 2 === 0) {
            const flower = new THREE.Mesh(
                new THREE.ConeGeometry(r * 0.42, 0.14, 6),
                i % 4 === 0 ? lotusPinkMat : lotusWhiteMat
            );
            flower.rotation.x = Math.PI;
            flower.position.set(lx, -0.33, lz);
            scene.add(flower);
        }
    });

    const wallSegments: [number, number][] = [
        [-18.0, -11.8],
        [-8.6, -1.0],
        [2.2, 12.0],
    ];
    wallSegments.forEach(([zStart, zEnd]) => {
        const len = zEnd - zStart;
        const midZ = (zStart + zEnd) / 2;
        [-2.42, 2.42].forEach((wx) => {
            const lowWall = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.38, len), ctx.stoneWallMat);
            lowWall.position.set(wx, 0.39, midZ);
            lowWall.castShadow = true;
            lowWall.receiveShadow = true;
            scene.add(lowWall);

            for (let pz = zStart + 0.5; pz <= zEnd - 0.3; pz += 3.2) {
                const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.56, 0.36), ctx.stoneWallMat);
                pillar.position.set(wx, 0.48, pz);
                pillar.castShadow = true;
                scene.add(pillar);
            }
        });
    });
}
