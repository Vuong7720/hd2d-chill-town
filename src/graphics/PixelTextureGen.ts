import * as THREE from 'three';
import { HeroAnimations, HeroPalette } from '../types';

export function createPixelCanvas(w: number, h: number, smooth = false): {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
} {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = smooth;
    return { canvas, ctx };
}

export function canvasToPixelTexture(
    canvas: HTMLCanvasElement,
    repeatX = 1,
    repeatY = 1
): THREE.CanvasTexture {
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    if (repeatX > 1 || repeatY > 1) {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repeatX, repeatY);
    }
    return tex;
}

export function canvasToSmoothTexture(
    canvas: HTMLCanvasElement,
    repeatX = 1,
    repeatY = 1
): THREE.CanvasTexture {
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    return tex;
}

export interface PbrTextureSet {
    map: THREE.CanvasTexture;
    normalMap: THREE.CanvasTexture;
    roughnessMap: THREE.CanvasTexture;
}

function createSmoothPbrFromHeight(
    colorCanvas: HTMLCanvasElement,
    heightCanvas: HTMLCanvasElement,
    repeatX: number,
    repeatY: number,
    normalStrength = 2.0,
    roughMin = 110,
    roughMax = 235
): PbrTextureSet {
    const w = heightCanvas.width;
    const h = heightCanvas.height;
    const hCtx = heightCanvas.getContext('2d')!;
    const hData = hCtx.getImageData(0, 0, w, h).data;

    const { canvas: nCan, ctx: nCtx } = createPixelCanvas(w, h, true);
    const nImg = nCtx.createImageData(w, h);

    const { canvas: rCan, ctx: rCtx } = createPixelCanvas(w, h, true);
    const rImg = rCtx.createImageData(w, h);

    const sampleH = (x: number, y: number): number => {
        const wx = ((x % w) + w) % w;
        const wy = ((y % h) + h) % h;
        return hData[(wy * w + wx) * 4] / 255;
    };

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const hL = sampleH(x - 1, y);
            const hR = sampleH(x + 1, y);
            const hU = sampleH(x, y - 1);
            const hD = sampleH(x, y + 1);

            const dx = (hL - hR) * normalStrength;
            const dy = (hU - hD) * normalStrength;
            const dz = 1.0;
            const len = Math.hypot(dx, dy, dz);

            nImg.data[idx] = Math.round(((dx / len) * 0.5 + 0.5) * 255);
            nImg.data[idx + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
            nImg.data[idx + 2] = Math.round(((dz / len) * 0.5 + 0.5) * 255);
            nImg.data[idx + 3] = 255;

            const curH = sampleH(x, y);
            const roughVal = Math.round(roughMax - curH * (roughMax - roughMin));
            rImg.data[idx] = roughVal;
            rImg.data[idx + 1] = roughVal;
            rImg.data[idx + 2] = roughVal;
            rImg.data[idx + 3] = 255;
        }
    }

    nCtx.putImageData(nImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);

    const configureDataTex = (can: HTMLCanvasElement) => {
        const tex = new THREE.CanvasTexture(can);
        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.generateMipmaps = true;
        tex.anisotropy = 8;
        tex.colorSpace = THREE.NoColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repeatX, repeatY);
        return tex;
    };

    return {
        map: canvasToSmoothTexture(colorCanvas, repeatX, repeatY),
        normalMap: configureDataTex(nCan),
        roughnessMap: configureDataTex(rCan),
    };
}

export function generateContactShadowTexture(): THREE.CanvasTexture {
    const { canvas, ctx } = createPixelCanvas(64, 64, true);
    const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
    grad.addColorStop(0, 'rgba(8, 12, 24, 0.58)');
    grad.addColorStop(0.55, 'rgba(8, 12, 24, 0.28)');
    grad.addColorStop(1, 'rgba(8, 12, 24, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

// 256x256 Smooth Lush Meadow Grass Texture
export function generateGrassTexture(): THREE.CanvasTexture {
    const size = 256;
    const { canvas, ctx } = createPixelCanvas(size, size, true);
    ctx.fillStyle = '#3f7a2c';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 2400; i++) {
        const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
        const y = (Math.sin(i * 78.233) * 43758.5453) % 1;
        const px = Math.abs(x) * size;
        const py = Math.abs(y) * size;
        const r = 3 + (i % 7);
        ctx.fillStyle = i % 3 === 0 ? 'rgba(42, 88, 30, 0.35)' : i % 3 === 1 ? 'rgba(95, 158, 52, 0.32)' : 'rgba(132, 204, 22, 0.18)';
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
    }

    // Fine grass blades
    for (let i = 0; i < 900; i++) {
        const px = Math.abs((Math.sin(i * 45.164) * 19283.4) % 1) * size;
        const py = Math.abs((Math.sin(i * 91.732) * 38192.1) % 1) * size;
        ctx.strokeStyle = i % 2 === 0 ? 'rgba(163, 230, 53, 0.38)' : 'rgba(34, 84, 24, 0.42)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + ((i % 3) - 1) * 2, py - 5);
        ctx.stroke();
    }

    // Subtle wildflowers
    for (let i = 0; i < 24; i++) {
        const fx = Math.abs((Math.sin(i * 31.7) * 9182.3) % 1) * size;
        const fy = Math.abs((Math.sin(i * 67.3) * 4712.9) % 1) * size;
        ctx.fillStyle = i % 3 === 0 ? '#fef08a' : i % 3 === 1 ? '#ffffff' : '#fbcfe8';
        ctx.beginPath();
        ctx.arc(fx, fy, 1.8, 0, Math.PI * 2);
        ctx.fill();
    }

    return canvasToSmoothTexture(canvas, 14, 14);
}

// 256x256 Smooth HD-2D Cobblestone Pathway PBR
export function generateCobblestonePBR(): PbrTextureSet {
    const size = 256;
    const { canvas, ctx } = createPixelCanvas(size, size, true);
    const { canvas: hCan, ctx: hCtx } = createPixelCanvas(size, size, true);

    ctx.fillStyle = '#3b4252';
    ctx.fillRect(0, 0, size, size);
    hCtx.fillStyle = '#181818';
    hCtx.fillRect(0, 0, size, size);

    const rows = 8;
    const rowH = size / rows;

    for (let r = 0; r < rows; r++) {
        let xCursor = (r % 2) * -18;
        let colIdx = 0;
        while (xCursor < size) {
            const w = 28 + ((r * 7 + colIdx * 13) % 18);
            const h = rowH - 5;
            const px = xCursor + 2;
            const py = r * rowH + 2;

            const shade = ((r * 11 + colIdx * 17) % 30) - 15;
            const baseR = 148 + shade;
            const baseG = 152 + shade;
            const baseB = 160 + shade;

            const grad = ctx.createLinearGradient(px, py, px, py + h);
            grad.addColorStop(0, `rgb(${baseR + 24}, ${baseG + 22}, ${baseB + 18})`);
            grad.addColorStop(0.7, `rgb(${baseR}, ${baseG}, ${baseB})`);
            grad.addColorStop(1, `rgb(${baseR - 25}, ${baseG - 25}, ${baseB - 22})`);

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(px, py, w - 4, h, 6);
            ctx.fill();

            // Subtle stone highlight edge
            ctx.strokeStyle = 'rgba(255, 250, 240, 0.22)';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // Height map
            const hGrad = hCtx.createRadialGradient(
                px + (w - 4) * 0.5,
                py + h * 0.45,
                2,
                px + (w - 4) * 0.5,
                py + h * 0.5,
                w * 0.6
            );
            hGrad.addColorStop(0, '#f0f0f0');
            hGrad.addColorStop(0.75, '#b0b0b0');
            hGrad.addColorStop(1, '#454545');
            hCtx.fillStyle = hGrad;
            hCtx.beginPath();
            hCtx.roundRect(px, py, w - 4, h, 6);
            hCtx.fill();

            xCursor += w;
            colIdx++;
        }
    }

    return createSmoothPbrFromHeight(canvas, hCan, 10, 3, 2.2, 125, 235);
}

export function generateCobblestoneTexture(): THREE.CanvasTexture {
    return generateCobblestonePBR().map;
}

// 256x256 Smooth Roof Tile PBR
export function generateRoofPBR(
    baseHex: string,
    highlightHex: string,
    shadowHex: string
): PbrTextureSet {
    const size = 256;
    const { canvas, ctx } = createPixelCanvas(size, size, true);
    const { canvas: hCan, ctx: hCtx } = createPixelCanvas(size, size, true);

    ctx.fillStyle = shadowHex;
    ctx.fillRect(0, 0, size, size);
    hCtx.fillStyle = '#303030';
    hCtx.fillRect(0, 0, size, size);

    const rows = 10;
    const cols = 10;
    const cellW = size / cols;
    const cellH = size / rows;

    for (let r = 0; r < rows; r++) {
        const shift = (r % 2) * (cellW * 0.5);
        for (let c = -1; c <= cols; c++) {
            const x = c * cellW + shift;
            const y = r * cellH;

            const grad = ctx.createLinearGradient(x, y, x, y + cellH);
            grad.addColorStop(0, highlightHex);
            grad.addColorStop(0.45, baseHex);
            grad.addColorStop(1, shadowHex);

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(x + 1, y + 1, cellW - 2, cellH - 2, [2, 2, 8, 8]);
            ctx.fill();

            const hGrad = hCtx.createLinearGradient(x, y, x, y + cellH);
            hGrad.addColorStop(0, '#eaeaea');
            hGrad.addColorStop(0.7, '#999999');
            hGrad.addColorStop(1, '#383838');
            hCtx.fillStyle = hGrad;
            hCtx.beginPath();
            hCtx.roundRect(x + 1, y + 1, cellW - 2, cellH - 2, [2, 2, 8, 8]);
            hCtx.fill();
        }
    }

    return createSmoothPbrFromHeight(canvas, hCan, 2, 2, 2.0, 150, 225);
}

export function generateRoofTexture(
    baseHex: string,
    highlightHex: string,
    shadowHex: string
): THREE.CanvasTexture {
    return generateRoofPBR(baseHex, highlightHex, shadowHex).map;
}

// 256x256 Smooth Half-Timbered Cottage Wall PBR
export function generateTimberWallPBR(): PbrTextureSet {
    const size = 256;
    const { canvas, ctx } = createPixelCanvas(size, size, true);
    const { canvas: hCan, ctx: hCtx } = createPixelCanvas(size, size, true);

    ctx.fillStyle = '#efe2c8';
    ctx.fillRect(0, 0, size, size);
    hCtx.fillStyle = '#808080';
    hCtx.fillRect(0, 0, size, size);

    // Subtle plaster texture
    for (let i = 0; i < 600; i++) {
        const px = Math.abs((Math.sin(i * 19.3) * 19384.2) % 1) * size;
        const py = Math.abs((Math.sin(i * 53.7) * 41293.5) % 1) * size;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(214, 194, 160, 0.25)' : 'rgba(255, 250, 240, 0.25)';
        ctx.beginPath();
        ctx.arc(px, py, 4 + (i % 5), 0, Math.PI * 2);
        ctx.fill();
    }

    // Timber beams
    const drawBeam = (x: number, y: number, w: number, h: number) => {
        const g = ctx.createLinearGradient(x, y, x + w, y + h);
        g.addColorStop(0, '#6e4728');
        g.addColorStop(0.5, '#523219');
        g.addColorStop(1, '#3b220f');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, w, h);

        hCtx.fillStyle = '#e5e5e5';
        hCtx.fillRect(x, y, w, h);
    };

    drawBeam(0, 0, size, 18);
    drawBeam(0, size - 18, size, 18);
    drawBeam(0, 0, 18, size);
    drawBeam(size - 18, 0, 18, size);
    drawBeam(size / 2 - 8, 0, 16, size);

    return createSmoothPbrFromHeight(canvas, hCan, 1, 1, 1.8, 175, 240);
}

export function generateTimberWallTexture(): THREE.CanvasTexture {
    return generateTimberWallPBR().map;
}

// 256x256 Smooth River Embankment Stone Wall PBR (with moss & mortar)
export function generateStoneWallPBR(): PbrTextureSet {
    const size = 256;
    const { canvas, ctx } = createPixelCanvas(size, size, true);
    const { canvas: hCan, ctx: hCtx } = createPixelCanvas(size, size, true);

    ctx.fillStyle = '#2d3748';
    ctx.fillRect(0, 0, size, size);
    hCtx.fillStyle = '#1a1a1a';
    hCtx.fillRect(0, 0, size, size);

    const rows = 6;
    const rowH = size / rows;
    for (let r = 0; r < rows; r++) {
        let xCursor = (r % 2) * -24;
        let c = 0;
        while (xCursor < size) {
            const w = 42 + ((r * 13 + c * 19) % 26);
            const h = rowH - 5;
            const px = xCursor + 2;
            const py = r * rowH + 2;

            const tone = ((r * 7 + c * 11) % 28) - 14;
            const grad = ctx.createLinearGradient(px, py, px, py + h);
            grad.addColorStop(0, `rgb(${135 + tone}, ${142 + tone}, ${152 + tone})`);
            grad.addColorStop(1, `rgb(${88 + tone}, ${95 + tone}, ${105 + tone})`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(px, py, w - 4, h, 7);
            ctx.fill();

            // Subtle green moss near bottom/crevices
            if ((r + c) % 3 === 0) {
                ctx.fillStyle = 'rgba(74, 140, 62, 0.35)';
                ctx.beginPath();
                ctx.arc(px + 8, py + h - 4, 8, 0, Math.PI * 2);
                ctx.fill();
            }

            const hGrad = hCtx.createLinearGradient(px, py, px, py + h);
            hGrad.addColorStop(0, '#e0e0e0');
            hGrad.addColorStop(1, '#707070');
            hCtx.fillStyle = hGrad;
            hCtx.beginPath();
            hCtx.roundRect(px, py, w - 4, h, 7);
            hCtx.fill();

            xCursor += w;
            c++;
        }
    }

    return createSmoothPbrFromHeight(canvas, hCan, 1, 10, 2.2, 150, 235);
}

export function generateStoneWallTexture(): THREE.CanvasTexture {
    return generateStoneWallPBR().map;
}

// 256x256 Smooth Wood Plank Texture (for bridges, benches, carts)
export function generateWoodPlankTexture(baseHex = '#8a5a36', darkHex = '#523219'): THREE.CanvasTexture {
    const size = 256;
    const { canvas, ctx } = createPixelCanvas(size, size, true);
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, size, size);

    const planks = 6;
    const pH = size / planks;
    for (let i = 0; i < planks; i++) {
        const y = i * pH;
        const grad = ctx.createLinearGradient(0, y, 0, y + pH);
        grad.addColorStop(0, baseHex);
        grad.addColorStop(0.85, baseHex);
        grad.addColorStop(1, darkHex);
        ctx.fillStyle = grad;
        ctx.fillRect(0, y, size, pH - 2);

        // Wood grain lines
        ctx.strokeStyle = 'rgba(40, 20, 8, 0.18)';
        ctx.lineWidth = 1.4;
        for (let g = 0; g < 4; g++) {
            const gy = y + 6 + g * 8;
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.bezierCurveTo(size * 0.33, gy + (g % 2 === 0 ? 3 : -3), size * 0.66, gy - 2, size, gy);
            ctx.stroke();
        }
    }
    return canvasToSmoothTexture(canvas, 2, 2);
}

export function generateStripedAwningTexture(stripeHex: string): THREE.CanvasTexture {
    const size = 128;
    const { canvas, ctx } = createPixelCanvas(size, size, true);
    const stripes = 8;
    const sw = size / stripes;
    for (let i = 0; i < stripes; i++) {
        ctx.fillStyle = i % 2 === 0 ? stripeHex : '#fef3c7';
        ctx.fillRect(i * sw, 0, sw, size);
    }
    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, 'rgba(255,255,255,0.1)');
    grad.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return canvasToSmoothTexture(canvas, 1, 1);
}

// Crisp HD-2D 48x64 Pixel Art Traveler & NPC Sprite Generator (Sleeker proportions!)
export function generateHeroAnimations(customPalette: HeroPalette | null = null): HeroAnimations {
    const pal: Record<string, string | undefined> = {
        O: '#18141c', // Deep outline
        H: '#9a4312', // Hair base
        h: '#e08b36', // Hair highlight
        d: '#5c2408', // Hair shadow
        S: '#fce0b6', // Skin tone
        s: '#e5a97c', // Skin shadow
        W: '#ffffff', // Eye white
        E: '#1e293b', // Eye pupil
        R: '#b91c1c', // Scarf / cape
        r: '#7f1d1d', // Cape shadow
        B: '#1d4ed8', // Tunic
        b: '#1e3a8a', // Tunic shadow
        G: '#f59e0b', // Gold trim / belt
        L: '#4a2e18', // Boots
        l: '#784b2a', // Boot highlight
        ...(customPalette || {}),
    };

    const headRows = [
        '.............OOOOOOOOOO.............',
        '...........OOHHHHHHHHHHOO...........',
        '..........OHHhhhhhhhhhhHHO..........',
        '.........OHhhHHHHHHHHHHhhHO.........',
        '........OHhHHHHHHHHHHHHHHhHO........',
        '........OHHHHHHHHHHHHHHHHHHO........',
        '.......OHHdHHHHHHHHHHHHHHdHHO.......',
        '.......OHdHSSSSSSSSSSSSSSHdHO.......',
        '.......OHdSSSSSSSSSSSSSSSSdHO.......',
        '........OSSSSSSSSSSSSSSSSSSO........',
        '........OSSSSOOSSSSSSOOSSSSO........',
        '........OSSSSWOSSSSSSWOSSSSO........',
        '........OSSSSOOSSSSSSOOSSSSO........',
        '........OSSsSSSSSSSSSSSSsSSO........',
        '.........OSSSSSSSSSSSSSSSSO.........',
        '..........OOSSSSSSSSSSSSOO..........',
    ];

    const torsoRows = [
        '..........OORRRRRRRRRRRROO..........',
        '.........ORRrRRRRRRRRRRrRRO.........',
        '........OORRRRRRRRRRRRRRRROO........',
        '.......OSSOOBBBBBBBBBBBBOOSSO.......',
        '.......OSSOOBBBBGGBBBBBBOOSSO.......',
        '.......OSSOOBBBBBBBBBBBBOOSSO.......',
        '.......OSSOOBBbbBBBBbbBBOOSSO.......',
        '........OO.OOBBBBBBBBBBBOO.OO.......',
        '...........OOGGGGGGGGGGOO...........',
        '...........OObBBBBBBBBbOO...........',
    ];

    const legsIdle = [
        '...........OObBBBBBBBbbOO...........',
        '...........OObBBBOOBBbbOO...........',
        '...........OOLLLO..OLLLOO...........',
        '...........OLllLO..OLllLO...........',
        '...........OOLLLO..OLLLOO...........',
        '..........OOLLLLO..OLLLLOO..........',
        '..........OOOOOOO..OOOOOOO..........',
    ];

    const legsWalk1 = [
        '..........OObBBBB..BBBBbOO..........',
        '.........OObBBBOO..OOBBBbOO.........',
        '........OOLLLOO......OOLLLOO........',
        '.......OLllLO..........OLllLO.......',
        '.......OOOOOO..........OOOOOO.......',
        '....................................',
        '....................................',
    ];

    const legsWalk2 = [
        '...........OObBBBBBBBbbOO...........',
        '...........OObBBBOOBBbbOO...........',
        '............OOLLLOOLLLOO............',
        '............OLllLOOLllLO............',
        '............OOOOOOOOOOOO............',
        '....................................',
        '....................................',
    ];

    const legsWalk3 = [
        '..........OObBBBB..BBBBbOO..........',
        '.........OObBBBOO..OOBBBbOO.........',
        '........OOLLLOO......OOLLLOO........',
        '........OLllLO........OLllLO........',
        '........OOOOOO........OOOOOO........',
        '....................................',
        '....................................',
    ];

    function buildFrame(headOffsetY: number, legRows: string[]): THREE.CanvasTexture {
        const { canvas, ctx } = createPixelCanvas(36, 42);
        const rows: string[] = [];
        for (let i = 0; i < headOffsetY; i++) rows.push('....................................');
        rows.push(...headRows, ...torsoRows, ...legRows);
        while (rows.length < 42) rows.push('....................................');

        for (let y = 0; y < 42; y++) {
            const row = rows[y] || '';
            for (let x = 0; x < 36; x++) {
                const ch = row[x];
                if (ch && pal[ch]) {
                    ctx.fillStyle = pal[ch]!;
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
        return canvasToPixelTexture(canvas);
    }

    return {
        idle: [buildFrame(2, legsIdle), buildFrame(3, legsIdle)],
        walk: [
            buildFrame(2, legsWalk1),
            buildFrame(3, legsWalk2),
            buildFrame(2, legsWalk3),
            buildFrame(3, legsWalk2),
        ],
    };
}

export function generateFoliageTexture(isSakura = false): THREE.CanvasTexture {
    const size = 128;
    const { canvas, ctx } = createPixelCanvas(size, size, true);
    const cOut = isSakura ? '#6b1440' : '#123c22';
    const cDeep = isSakura ? '#9d174d' : '#166534';
    const cMid = isSakura ? '#db2777' : '#22a853';
    const cBright = isSakura ? '#f472b6' : '#4ade80';
    const cTip = isSakura ? '#fbcfe8' : '#bbf7d0';

    const blobs: [number, number, number][] = [
        [64, 68, 36],
        [40, 76, 26],
        [88, 76, 26],
        [48, 48, 28],
        [80, 50, 28],
        [64, 36, 24],
        [30, 60, 18],
        [98, 60, 18],
    ];

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            let inside = false;
            let edgeDist = 99;
            for (const [bx, by, br] of blobs) {
                const n =
                    Math.sin(x * 0.35 + y * 0.25) * 2.5 + Math.cos(x * 0.65 - y * 0.55) * 1.5;
                const d = Math.hypot(x - bx, y - by) + n - br;
                if (d < 0) {
                    inside = true;
                    edgeDist = Math.min(edgeDist, -d);
                }
            }
            if (!inside) continue;
            const j = Math.sin(x * 1.1 + y * 0.9) * Math.cos(x * 0.45 - y * 1.1);
            if (edgeDist < 2.2) {
                ctx.fillStyle = cOut;
            } else if (y > 82 || (y > 70 && j < -0.25)) {
                ctx.fillStyle = cDeep;
            } else if (y < 44 && j > 0.2) {
                ctx.fillStyle = cTip;
            } else if (y < 60 && j > -0.15) {
                ctx.fillStyle = cBright;
            } else if (j < -0.35) {
                ctx.fillStyle = cDeep;
            } else {
                ctx.fillStyle = cMid;
            }
            ctx.fillRect(x, y, 1, 1);
        }
    }
    return canvasToSmoothTexture(canvas, 1, 1);
}

export function generateBushSpriteTexture(hasFlowers = true): THREE.CanvasTexture {
    const size = 96;
    const { canvas, ctx } = createPixelCanvas(size, size, true);
    const blobs: [number, number, number][] = [
        [48, 60, 26],
        [30, 66, 18],
        [66, 66, 18],
        [40, 46, 18],
        [56, 48, 18],
    ];

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            let inside = false;
            let edgeDist = 99;
            for (const [bx, by, br] of blobs) {
                const n = Math.sin(x * 0.4 + y * 0.3) * 2.0;
                const d = Math.hypot(x - bx, y - by) + n - br;
                if (d < 0) {
                    inside = true;
                    edgeDist = Math.min(edgeDist, -d);
                }
            }
            if (!inside) continue;
            const j = Math.sin(x * 1.2 + y * 0.9);
            if (edgeDist < 2.0) {
                ctx.fillStyle = '#123c22';
            } else if (y > 68 || j < -0.45) {
                ctx.fillStyle = '#166534';
            } else if (y < 46 && j > 0.1) {
                ctx.fillStyle = '#4ade80';
            } else {
                ctx.fillStyle = '#22a853';
            }
            ctx.fillRect(x, y, 1, 1);
        }
    }

    if (hasFlowers) {
        const spots: [number, number, string][] = [
            [28, 48, '#fef08a'],
            [52, 40, '#f472b6'],
            [62, 58, '#ffffff'],
            [36, 64, '#fef08a'],
            [48, 56, '#f472b6'],
            [70, 62, '#fef08a'],
        ];
        spots.forEach(([fx, fy, col]) => {
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(fx, fy, 3.2, 0, Math.PI * 2);
            ctx.fill();
        });
    }
    return canvasToSmoothTexture(canvas, 1, 1);
}

export function generateMistTexture(): THREE.CanvasTexture {
    const { canvas, ctx } = createPixelCanvas(64, 64, true);
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.32)');
    grad.addColorStop(0.5, 'rgba(226, 232, 240, 0.14)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}
