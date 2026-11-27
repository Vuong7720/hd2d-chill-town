import * as THREE from 'three';
import { NpcEntity } from '../entities/NpcEntity';
import { CollectibleOrb } from '../systems/QuestManager';

export class Minimap {
    private canvas: HTMLCanvasElement | null;
    private ctx: CanvasRenderingContext2D | null;

    constructor() {
        this.canvas = document.getElementById('minimap-canvas') as HTMLCanvasElement | null;
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    }

    public render(
        playerPos: THREE.Vector3,
        npcs: NpcEntity[],
        orbs: CollectibleOrb[],
        inInterior: boolean
    ): void {
        if (!this.ctx || !this.canvas) return;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const ctx = this.ctx;

        ctx.clearRect(0, 0, w, h);

        // Circular clip
        ctx.save();
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
        ctx.clip();

        if (inInterior) {
            ctx.fillStyle = '#291d16';
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#d97706';
            ctx.lineWidth = 3;
            ctx.strokeRect(18, 18, w - 36, h - 36);
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(w / 2 + playerPos.x * 7, h / 2 + playerPos.z * 7, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        // Grass background
        ctx.fillStyle = '#2c5e2e';
        ctx.fillRect(0, 0, w, h);

        const toMapX = (wx: number) => w / 2 + (wx / 44) * w;
        const toMapY = (wz: number) => h / 2 + ((wz + 3) / 38) * h;

        // Elevated Terraces
        ctx.fillStyle = '#4d7c4f';
        ctx.fillRect(toMapX(9.0), toMapY(-12.0), (12.5 / 44) * w, (11.5 / 38) * h);
        ctx.fillRect(toMapX(-21.5), toMapY(-18.5), (12.5 / 44) * w, (11.3 / 38) * h);

        // Stream
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(toMapX(-2.5), 0, (5.0 / 44) * w, h);

        // Bridges
        ctx.fillStyle = '#92400e';
        ctx.fillRect(toMapX(-2.7), toMapY(-0.4), (5.4 / 44) * w, 6);
        ctx.fillRect(toMapX(-2.7), toMapY(-11.2), (5.4 / 44) * w, 6);

        // Collectible Orbs
        orbs.forEach((o) => {
            if (o.collected || !o.mesh.visible) return;
            ctx.fillStyle = '#22d3ee';
            ctx.beginPath();
            ctx.arc(toMapX(o.x), toMapY(o.z), 3.2, 0, Math.PI * 2);
            ctx.fill();
        });

        // NPCs
        npcs.forEach((npc) => {
            ctx.fillStyle = '#fde047';
            ctx.beginPath();
            ctx.arc(toMapX(npc.config.x), toMapY(npc.config.z), 3, 0, Math.PI * 2);
            ctx.fill();
        });

        // Player
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(toMapX(playerPos.x), toMapY(playerPos.z), 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(toMapX(playerPos.x), toMapY(playerPos.z), 2.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
