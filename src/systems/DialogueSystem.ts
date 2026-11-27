import { NpcEntity } from '../entities/NpcEntity';

export interface ActiveDialogue {
    npc: NpcEntity;
    lines: string[];
    lineIdx: number;
    fullText: string;
    charIdx: number;
    timer: number;
    onFinish?: () => void;
}

export class DialogueSystem {
    public activeDialogue: ActiveDialogue | null = null;

    private interactHintEl = document.getElementById('interact-hint')!;
    private dialogueBoxEl = document.getElementById('dialogue-box')!;
    private dialogueSpeakerEl = document.getElementById('dialogue-speaker')!;
    private dialogueRoleEl = document.getElementById('dialogue-role')!;
    private dialogueTextEl = document.getElementById('dialogue-text')!;
    private dialoguePortraitCanvas = document.getElementById('dialogue-portrait') as HTMLCanvasElement;
    private dialogueNextBtn = document.getElementById('dialogue-next-btn')!;

    constructor(onTrigger: () => void, private onTypeChar?: () => void) {
        this.interactHintEl.addEventListener('click', onTrigger);
        this.dialogueNextBtn.addEventListener('click', onTrigger);
    }

    public startNpcDialogue(
        npc: NpcEntity,
        heroX: number,
        customLines?: string[],
        onFinish?: () => void
    ): void {
        const lines = customLines ?? npc.config.lines;
        npc.facing = heroX < npc.config.x ? -1 : 1;
        this.activeDialogue = {
            npc,
            lines,
            lineIdx: 0,
            fullText: lines[0],
            charIdx: 0,
            timer: 0,
            onFinish,
        };
        this.dialogueSpeakerEl.textContent = npc.config.name;
        this.dialogueRoleEl.textContent = npc.config.role;
        this.dialogueTextEl.textContent = '';
        this.renderPortrait(npc);
        this.dialogueBoxEl.classList.remove('hidden');
        this.interactHintEl.classList.add('hidden');
    }

    public advanceDialogue(): void {
        if (!this.activeDialogue) return;
        if (this.activeDialogue.charIdx < this.activeDialogue.fullText.length) {
            this.activeDialogue.charIdx = this.activeDialogue.fullText.length;
            this.dialogueTextEl.textContent = this.activeDialogue.fullText;
            return;
        }
        this.activeDialogue.lineIdx++;
        if (this.activeDialogue.lineIdx < this.activeDialogue.lines.length) {
            this.activeDialogue.fullText =
                this.activeDialogue.lines[this.activeDialogue.lineIdx];
            this.activeDialogue.charIdx = 0;
            this.dialogueTextEl.textContent = '';
        } else {
            const cb = this.activeDialogue.onFinish;
            this.activeDialogue = null;
            this.dialogueBoxEl.classList.add('hidden');
            cb?.();
        }
    }

    public setHint(html: string | null): void {
        if (html && !this.activeDialogue) {
            this.interactHintEl.innerHTML = html;
            this.interactHintEl.classList.remove('hidden');
        } else {
            this.interactHintEl.classList.add('hidden');
        }
    }

    public update(dt: number): void {
        if (this.activeDialogue && this.activeDialogue.charIdx < this.activeDialogue.fullText.length) {
            this.activeDialogue.timer += dt;
            if (this.activeDialogue.timer >= 0.024) {
                this.activeDialogue.charIdx++;
                this.dialogueTextEl.textContent = this.activeDialogue.fullText.slice(
                    0,
                    this.activeDialogue.charIdx
                );
                this.onTypeChar?.();
                this.activeDialogue.timer = 0;
            }
        }
    }

    private renderPortrait(npc: NpcEntity): void {
        const pCtx = this.dialoguePortraitCanvas.getContext('2d')!;
        pCtx.imageSmoothingEnabled = false;
        pCtx.clearRect(0, 0, 48, 48);
        const srcCanvas = npc.anims.idle[0].image as HTMLCanvasElement;
        pCtx.drawImage(srcCanvas, 6, 2, 24, 24, 0, 0, 48, 48);
    }
}
