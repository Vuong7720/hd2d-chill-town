import * as THREE from 'three';
import { canvasToPixelTexture, createPixelCanvas } from '../graphics/PixelTextureGen';
import { WorldContext } from '../world/WorldContext';

type Species = 'dog' | 'cat' | 'chicken';

function generateAnimalSpriteFrames(species: Species): THREE.CanvasTexture[] {
    const palettes: Record<Species, Record<string, string>> = {
        dog: { O: '#1e1b18', B: '#d97706', L: '#fef3c7', E: '#1e1b18', N: '#ef4444' },
        cat: { O: '#1e1b18', B: '#f8fafc', L: '#fb923c', E: '#0284c7', N: '#f472b6' },
        chicken: { O: '#1e1b18', B: '#ffffff', L: '#fef08a', R: '#ef4444', Y: '#f59e0b' },
    };
    const pal = palettes[species];

    const templates: Record<Species, string[][]> = {
        dog: [
            [
                '................',
                '................',
                '....OO....OO....',
                '...OBBO..OBBO...',
                '...OBBBBBBBBO...',
                '...OBEBBBBEDO...',
                '...OBBLLLLBBO...',
                '....OOLLLLOO....',
                '..OOOBBBBBBOOO..',
                '.OBBBBBBBBBBBBO.',
                '.OBBBBBBBBBBBBO.',
                '..OOBBBBBBBBOO..',
                '...OBBO..OBBO...',
                '...OBBO..OBBO...',
                '...OOOO..OOOO...',
                '................',
            ],
            [
                '................',
                '................',
                '....OO....OO....',
                '...OBBO..OBBO...',
                '...OBBBBBBBBO...',
                '...OBEBBBBEDO...',
                '...OBBLLLLBBO...',
                '....OOLLLLOO....',
                '.OOOBBBBBBBBOOO.',
                'OBBBBBBBBBBBBBBO',
                '.OOBBBBBBBBBBOO.',
                '..OBBO....OBBO..',
                '.OBBO......OBBO.',
                '.OOOO......OOOO.',
                '................',
                '................',
            ],
        ],
        cat: [
            [
                '................',
                '................',
                '...OO......OO...',
                '...OBO....OBO...',
                '...OBBBBBBBO....',
                '...OBEBBBBEDO...',
                '...OBBBNBBBBO...',
                '....OOOOOOOO....',
                '..OOBBBBBBBBOO..',
                '.OBBLLBBBBLLBBO.',
                '.OBBBBBBBBBBBBO.',
                '..OOBBBBBBBBOO..',
                '...OBBO..OBBO...',
                '...OOOO..OOOO...',
                '................',
                '................',
            ],
            [
                '................',
                '................',
                '...OO......OO...',
                '...OBO....OBO...',
                '...OBBBBBBBO....',
                '...OBEBBBBEDO...',
                '...OBBBNBBBBO...',
                '....OOOOOOOO....',
                '.OOOBBBBBBBBOOO.',
                'OBBLLBBBBLLBBBBO',
                '.OOBBBBBBBBBBOO.',
                '..OBBO....OBBO..',
                '.OOOO......OOOO.',
                '................',
                '................',
                '................',
            ],
        ],
        chicken: [
            [
                '................',
                '......OOOO......',
                '.....ORRRRO.....',
                '.....OBBBBO.....',
                '....OBBEBBBO....',
                '....OBBYYYBO....',
                '.....OBBBBO.....',
                '...OOBBBBBBOO...',
                '..OBBBLLLLBBBO..',
                '..OBBBBBBBBBBO..',
                '...OOBBBBBBBO...',
                '.....OY..YO.....',
                '....OYY..YYO....',
                '................',
                '................',
                '................',
            ],
            [
                '................',
                '......OOOO......',
                '.....ORRRRO.....',
                '.....OBBBBO.....',
                '....OBBEBBBO....',
                '....OBBYYYBO....',
                '.....OBBBBO.....',
                '..OOOBBBBBBOOO..',
                '.OBBBBLLLLBBBBO.',
                '..OOBBBBBBBBOO..',
                '....OY....YO....',
                '...OYY....YYO...',
                '................',
                '................',
                '................',
                '................',
            ],
        ],
    };

    return templates[species].map((rows) => {
        const { canvas, ctx } = createPixelCanvas(16, 16);
        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
                const ch = rows[y][x];
                if (ch && pal[ch]) {
                    ctx.fillStyle = pal[ch];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
        return canvasToPixelTexture(canvas);
    });
}

export class AnimalEntity {
    private frames: THREE.CanvasTexture[];
    private mat: THREE.MeshStandardMaterial;
    private mesh: THREE.Mesh;
    private size: number;
    private targetX: number;
    private targetZ: number;
    private waitTimer = Math.random() * 2.0;
    private animTimer = 0;
    private frameIdx = 0;
    private facing = 1;

    constructor(
        scene: THREE.Scene,
        private world: WorldContext,
        private species: Species,
        private homeX: number,
        private homeZ: number,
        private roamRadius: number,
        private speed: number
    ) {
        this.frames = generateAnimalSpriteFrames(species);
        this.mat = new THREE.MeshStandardMaterial({
            map: this.frames[0],
            transparent: true,
            alphaTest: 0.4,
            roughness: 0.7,
            side: THREE.DoubleSide,
        });
        this.size = species === 'chicken' ? 0.65 : 0.85;
        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(this.size, this.size), this.mat);
        this.mesh.position.set(homeX, 0.2 + this.size * 0.45, homeZ);
        this.mesh.castShadow = true;
        scene.add(this.mesh);
        this.targetX = homeX;
        this.targetZ = homeZ;
    }

    public update(
        dt: number,
        elapsed: number,
        camera: THREE.Camera,
        playerPos?: THREE.Vector3
    ): void {
        this.mesh.quaternion.copy(camera.quaternion);
        this.mesh.scale.x = this.facing;

        // Chickens scatter away when player approaches closely
        if (this.species === 'chicken' && playerPos) {
            const px = this.mesh.position.x - playerPos.x;
            const pz = this.mesh.position.z - playerPos.z;
            const pDist = Math.hypot(px, pz);
            if (pDist < 2.2 && pDist > 0.05) {
                const fleeX = this.mesh.position.x + (px / pDist) * 2.5;
                const fleeZ = this.mesh.position.z + (pz / pDist) * 2.5;
                if (this.world.getWalkableSurfaceY(fleeX, fleeZ) !== null && Math.abs(fleeX) > 2.8) {
                    this.targetX = fleeX;
                    this.targetZ = fleeZ;
                    this.waitTimer = 0;
                }
            }
        }

        const dx = this.targetX - this.mesh.position.x;
        const dz = this.targetZ - this.mesh.position.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 0.12) {
            const vx = (dx / dist) * this.speed * dt;
            const vz = (dz / dist) * this.speed * dt;
            const nextX = this.mesh.position.x + vx;
            const nextZ = this.mesh.position.z + vz;
            const surfY = this.world.getWalkableSurfaceY(nextX, nextZ);
            if (surfY !== null && Math.abs(nextX) > 2.75) {
                this.mesh.position.x = nextX;
                this.mesh.position.z = nextZ;
                this.mesh.position.y =
                    surfY + this.size * 0.45 + Math.abs(Math.sin(elapsed * 12)) * 0.04;
                this.facing = vx < 0 ? -1 : 1;
            } else {
                this.waitTimer = 0.2;
                this.targetX = this.mesh.position.x;
                this.targetZ = this.mesh.position.z;
            }
            this.animTimer += dt;
            if (this.animTimer > 0.18) {
                this.frameIdx = (this.frameIdx + 1) % this.frames.length;
                this.mat.map = this.frames[this.frameIdx];
                this.animTimer = 0;
            }
        } else {
            this.mat.map = this.frames[0];
            this.waitTimer -= dt;
            if (this.waitTimer <= 0) {
                const ang = Math.random() * Math.PI * 2;
                const rad = 0.8 + Math.random() * this.roamRadius;
                const candX = this.homeX + Math.cos(ang) * rad;
                const candZ = this.homeZ + Math.sin(ang) * rad;
                if (this.world.getWalkableSurfaceY(candX, candZ) !== null && Math.abs(candX) > 2.8) {
                    this.targetX = candX;
                    this.targetZ = candZ;
                }
                this.waitTimer = 1.2 + Math.random() * 2.6;
            }
        }
    }
}
