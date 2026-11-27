import * as THREE from 'three';
import questData from '../data/quests.json';

export type QuestState = 'available' | 'active' | 'ready' | 'completed';

export interface CollectibleOrb {
    mesh: THREE.Group;
    x: number;
    y: number;
    z: number;
    collected: boolean;
}

export class QuestManager {
    public state: QuestState = 'available';
    public collectedCount = 0;
    public readonly requiredCount = questData.requiredCount;
    public hasLantern = false;
    public readonly orbs: CollectibleOrb[] = [];

    private questTitleEl = document.getElementById('quest-title');
    private questDescEl = document.getElementById('quest-desc');
    private lanternBadgeEl = document.getElementById('lantern-badge');

    constructor(private scene: THREE.Scene, private onCollect?: () => void, private onComplete?: () => void) {
        this.spawnOrbs();
        this.updateUI();
    }

    private spawnOrbs(): void {
        const orbMat = new THREE.MeshStandardMaterial({
            color: 0x67e8f9,
            emissive: 0x22d3ee,
            emissiveIntensity: 2.2,
            roughness: 0.1,
        });
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xa5f3fc,
            transparent: true,
            opacity: 0.65,
            side: THREE.DoubleSide,
        });

        questData.items.forEach((pos) => {
            const group = new THREE.Group();
            group.position.set(pos.x, pos.y + 0.75, pos.z);

            const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), orbMat);
            group.add(core);

            const halo = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.36, 16), ringMat);
            halo.rotation.x = Math.PI / 2;
            group.add(halo);

            group.visible = false;
            this.scene.add(group);
            this.orbs.push({ mesh: group, x: pos.x, y: pos.y, z: pos.z, collected: false });
        });
    }

    public acceptQuest(): void {
        if (this.state !== 'available') return;
        this.state = 'active';
        this.orbs.forEach((o) => {
            if (!o.collected) o.mesh.visible = true;
        });
        this.updateUI();
    }

    public completeQuest(): void {
        if (this.state !== 'ready') return;
        this.state = 'completed';
        this.hasLantern = true;
        this.onComplete?.();
        this.updateUI();
    }

    public getBarnabyLines(): string[] {
        if (this.state === 'available') return questData.dialogueOffer;
        if (this.state === 'active') {
            return questData.dialogueProgress.map((l) =>
                l.replace('{count}', String(this.collectedCount))
            );
        }
        if (this.state === 'ready') return questData.dialogueComplete;
        return [
            'Chiếc Đèn Lồng Cầm Tay hợp với cậu lắm! Nhớ nhấn [F] để bật đèn khi đi dạo ban đêm nhé.',
        ];
    }

    public update(elapsed: number, playerPos: THREE.Vector3, inInterior: boolean): void {
        if (this.state !== 'active') return;

        this.orbs.forEach((orb, idx) => {
            if (orb.collected) return;
            orb.mesh.visible = !inInterior;
            if (inInterior) return;

            orb.mesh.position.y = orb.y + 0.78 + Math.sin(elapsed * 3.0 + idx) * 0.14;
            orb.mesh.rotation.y = elapsed * 2.2;

            const dist = Math.hypot(playerPos.x - orb.x, playerPos.z - orb.z);
            const dy = Math.abs(playerPos.y - orb.y);
            if (dist < 1.15 && dy < 0.8) {
                orb.collected = true;
                orb.mesh.visible = false;
                this.collectedCount++;
                this.onCollect?.();
                if (this.collectedCount >= this.requiredCount) {
                    this.state = 'ready';
                }
                this.updateUI();
            }
        });
    }

    public updateUI(): void {
        if (!this.questTitleEl || !this.questDescEl) return;
        if (this.state === 'available') {
            this.questTitleEl.textContent = 'Nhiệm vụ mới (!)';
            this.questDescEl.textContent = 'Gặp Lão Ngư Ông Barnaby bên cầu trung tâm.';
        } else if (this.state === 'active') {
            this.questTitleEl.textContent = `${questData.title} (${this.collectedCount}/${this.requiredCount})`;
            this.questDescEl.textContent = 'Tìm Đom Đóm Pha Lê trên Đồi Đền Pha Lê.';
        } else if (this.state === 'ready') {
            this.questTitleEl.textContent = `${questData.title} (Hoàn thành!)`;
            this.questDescEl.textContent = 'Quay lại gặp Barnaby để nhận Đèn Lồng.';
        } else {
            this.questTitleEl.textContent = 'Đã nhận Đèn Lồng Cầm Tay';
            this.questDescEl.textContent = 'Nhấn [F] để bật/tắt đèn soi sáng ban đêm.';
        }

        if (this.lanternBadgeEl) {
            this.lanternBadgeEl.classList.toggle('hidden', !this.hasLantern);
        }
    }
}
