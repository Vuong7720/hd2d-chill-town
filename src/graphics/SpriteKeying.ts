import * as THREE from 'three';

/**
 * Loads an image on a solid dark background and removes ONLY the exterior
 * connected background via BFS flood-fill from the image border, preserving
 * all dark interior details (tree bark, leaf shadows, marble folds).
 */
export function loadEdgeKeyedTexture(url: string, bgThreshold = 26): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    const img = new Image();
    img.src = url;
    img.onload = () => {
        const w = img.width;
        const h = img.height;
        canvas.width = w;
        canvas.height = h;
        const c2d = canvas.getContext('2d')!;
        c2d.drawImage(img, 0, 0);

        const imgData = c2d.getImageData(0, 0, w, h);
        const d = imgData.data;
        const total = w * h;
        const visited = new Uint8Array(total);
        const queue = new Int32Array(total);
        let head = 0;
        let tail = 0;

        const isBg = (idx: number): boolean => {
            const p = idx * 4;
            return Math.max(d[p], d[p + 1], d[p + 2]) <= bgThreshold;
        };

        const enqueue = (idx: number) => {
            if (!visited[idx] && isBg(idx)) {
                visited[idx] = 1;
                queue[tail++] = idx;
            }
        };

        // Seed from all 4 borders
        for (let x = 0; x < w; x++) {
            enqueue(x);
            enqueue((h - 1) * w + x);
        }
        for (let y = 1; y < h - 1; y++) {
            enqueue(y * w);
            enqueue(y * w + (w - 1));
        }

        // Flood-fill exterior black pixels
        while (head < tail) {
            const idx = queue[head++];
            d[idx * 4 + 3] = 0;
            const x = idx % w;
            const y = (idx / w) | 0;
            if (x > 0) enqueue(idx - 1);
            if (x < w - 1) enqueue(idx + 1);
            if (y > 0) enqueue(idx - w);
            if (y < h - 1) enqueue(idx + w);
        }

        // Soften 1px fringe adjacent to transparent background
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const idx = y * w + x;
                if (visited[idx]) continue;
                if (visited[idx - 1] || visited[idx + 1] || visited[idx - w] || visited[idx + w]) {
                    const p = idx * 4;
                    const lum = Math.max(d[p], d[p + 1], d[p + 2]);
                    if (lum < bgThreshold + 24) {
                        d[p + 3] = Math.round(((lum - bgThreshold) / 24) * 255);
                    }
                }
            }
        }

        c2d.putImageData(imgData, 0, 0);
        tex.needsUpdate = true;
    };

    return tex;
}
