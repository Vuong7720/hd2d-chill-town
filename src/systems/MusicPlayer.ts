export interface LocalTrack {
    name: string;
    url: string;
}

export type PlayerSourceMode = 'local' | 'youtube';

export class MusicPlayer {
    public mode: PlayerSourceMode = 'local';
    public tracks: LocalTrack[] = [];
    public currentIndex = -1;
    public isPlaying = false;
    public shuffle = false;
    public repeatOne = false;
    public musicVolume = 0.7;

    private audioEl: HTMLAudioElement;
    private audioCtx: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private gainNode: GainNode | null = null;
    private freqData: Uint8Array<ArrayBuffer> | null = null;

    private ytIframe: HTMLIFrameElement | null = null;
    private ytLabel = 'YouTube Việt Nam Chill';

    public onStateChange?: () => void;

    constructor() {
        this.audioEl = new Audio();
        this.audioEl.crossOrigin = 'anonymous';

        this.audioEl.addEventListener('ended', () => {
            if (this.repeatOne) {
                this.audioEl.currentTime = 0;
                this.audioEl.play().catch(() => {});
            } else {
                this.next();
            }
        });
        this.audioEl.addEventListener('play', () => {
            this.isPlaying = true;
            this.onStateChange?.();
        });
        this.audioEl.addEventListener('pause', () => {
            if (this.mode === 'local') {
                this.isPlaying = false;
                this.onStateChange?.();
            }
        });
        this.audioEl.addEventListener('timeupdate', () => {
            this.onStateChange?.();
        });
    }

    private ensureAudioGraph(): void {
        if (this.audioCtx) {
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume().catch(() => {});
            return;
        }
        const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;

        this.audioCtx = new AudioCtx();
        const src = this.audioCtx.createMediaElementSource(this.audioEl);
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 64;
        this.freqData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));

        this.gainNode = this.audioCtx.createGain();
        this.gainNode.gain.value = this.musicVolume;

        src.connect(this.analyser);
        this.analyser.connect(this.gainNode);
        this.gainNode.connect(this.audioCtx.destination);
    }

    public addLocalFiles(files: FileList | File[]): void {
        const audioFiles = Array.from(files).filter(
            (f) => f.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(f.name)
        );
        if (audioFiles.length === 0) return;

        const wasEmpty = this.tracks.length === 0;
        audioFiles.forEach((file) => {
            const cleanName = file.name.replace(/\.[^/.]+$/, '');
            const url = URL.createObjectURL(file);
            this.tracks.push({ name: cleanName, url });
        });

        this.mode = 'local';
        if (wasEmpty) {
            this.playIndex(0);
        } else {
            this.onStateChange?.();
        }
    }

    public playIndex(idx: number): void {
        if (idx < 0 || idx >= this.tracks.length) return;
        this.postYtCommand('pauseVideo');
        this.mode = 'local';
        this.currentIndex = idx;
        this.ensureAudioGraph();
        this.audioEl.src = this.tracks[idx].url;
        this.audioEl.play().catch(() => {});
        this.isPlaying = true;
        this.onStateChange?.();
    }

    public togglePlay(): void {
        if (this.mode === 'youtube') {
            if (!this.ytIframe) return;
            if (this.isPlaying) {
                this.postYtCommand('pauseVideo');
                this.isPlaying = false;
            } else {
                this.postYtCommand('playVideo');
                this.isPlaying = true;
            }
            this.onStateChange?.();
            return;
        }

        if (this.tracks.length === 0) return;
        this.ensureAudioGraph();
        if (this.currentIndex === -1) {
            this.playIndex(0);
            return;
        }
        if (this.audioEl.paused) {
            this.audioEl.play().catch(() => {});
        } else {
            this.audioEl.pause();
        }
    }

    public next(): void {
        if (this.mode === 'youtube') {
            this.postYtCommand('nextVideo');
            return;
        }
        if (this.tracks.length === 0) return;
        if (this.shuffle && this.tracks.length > 1) {
            let nextIdx = this.currentIndex;
            while (nextIdx === this.currentIndex) {
                nextIdx = Math.floor(Math.random() * this.tracks.length);
            }
            this.playIndex(nextIdx);
        } else {
            this.playIndex((this.currentIndex + 1) % this.tracks.length);
        }
    }

    public prev(): void {
        if (this.mode === 'youtube') {
            this.postYtCommand('previousVideo');
            return;
        }
        if (this.tracks.length === 0) return;
        const prevIdx = (this.currentIndex - 1 + this.tracks.length) % this.tracks.length;
        this.playIndex(prevIdx);
    }

    public seekPercent(pct: number): void {
        if (this.mode !== 'local' || !this.audioEl.duration) return;
        this.audioEl.currentTime = Math.max(0, Math.min(1, pct)) * this.audioEl.duration;
    }

    public setVolume(vol: number): void {
        this.musicVolume = Math.max(0, Math.min(1, vol));
        if (this.gainNode && this.audioCtx) {
            this.gainNode.gain.setTargetAtTime(this.musicVolume, this.audioCtx.currentTime, 0.04);
        }
        this.postYtCommand('setVolume', [Math.round(this.musicVolume * 100)]);
    }

    public getProgress(): { current: number; duration: number } {
        if (this.mode !== 'local') return { current: 0, duration: 0 };
        return {
            current: this.audioEl.currentTime || 0,
            duration: Number.isFinite(this.audioEl.duration) ? this.audioEl.duration : 0,
        };
    }

    public getCurrentTitle(): string {
        if (this.mode === 'youtube') {
            return this.ytLabel;
        }
        if (this.currentIndex >= 0 && this.tracks[this.currentIndex]) {
            return this.tracks[this.currentIndex].name;
        }
        return 'Chưa có bài hát (Chọn hoặc kéo thả file)';
    }

    public getBassEnergy(): number {
        if (this.mode !== 'local' || !this.isPlaying || !this.analyser || !this.freqData) {
            return 0;
        }
        this.analyser.getByteFrequencyData(this.freqData);
        let sum = 0;
        for (let i = 0; i < 6; i++) sum += this.freqData[i];
        return sum / (6 * 255);
    }

    public loadYouTubeUrl(rawUrl: string): boolean {
        const parsed = this.parseYouTubeUrl(rawUrl.trim());
        if (!parsed) return false;

        this.audioEl.pause();
        this.mode = 'youtube';

        const container = document.getElementById('yt-player-frame');
        if (!container) return false;

        const origin = encodeURIComponent(window.location.origin);
        const embedSrc =
            parsed.type === 'playlist'
                ? `https://www.youtube.com/embed/videoseries?list=${parsed.id}&autoplay=1&enablejsapi=1&rel=0&origin=${origin}`
                : `https://www.youtube.com/embed/${parsed.id}?autoplay=1&enablejsapi=1&rel=0&origin=${origin}`;

        container.innerHTML = '';
        const iframe = document.createElement('iframe');
        iframe.src = embedSrc;
        iframe.width = '100%';
        iframe.height = '150';
        iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
        iframe.allowFullscreen = true;
        iframe.className = 'w-full rounded-lg border-0';
        iframe.addEventListener('load', () => {
            this.postYtCommand('setVolume', [Math.round(this.musicVolume * 100)]);
        });
        container.appendChild(iframe);
        this.ytIframe = iframe;
        this.ytLabel = parsed.type === 'playlist' ? 'YouTube Playlist đang phát' : `YouTube (${parsed.id})`;
        this.isPlaying = true;
        this.onStateChange?.();
        return true;
    }

    private postYtCommand(func: string, args: unknown[] = []): void {
        if (!this.ytIframe?.contentWindow) return;
        this.ytIframe.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func, args }),
            '*'
        );
    }

    private parseYouTubeUrl(url: string): { type: 'video' | 'playlist'; id: string } | null {
        try {
            const u = new URL(url);
            const listId = u.searchParams.get('list');
            if (listId) return { type: 'playlist', id: listId };
            const vId = u.searchParams.get('v');
            if (vId) return { type: 'video', id: vId };
            if (u.hostname.includes('youtu.be')) {
                const seg = u.pathname.replace('/', '');
                if (seg) return { type: 'video', id: seg };
            }
            if (u.pathname.includes('/shorts/')) {
                const seg = u.pathname.split('/shorts/')[1]?.split('/')[0];
                if (seg) return { type: 'video', id: seg };
            }
        } catch {
            if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return { type: 'video', id: url };
            if (/^(PL|OL|RD|UU)[a-zA-Z0-9_-]+$/.test(url)) return { type: 'playlist', id: url };
        }
        return null;
    }
}
