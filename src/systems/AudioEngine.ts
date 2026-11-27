export type SurfaceType = 'grass' | 'stone' | 'wood';

export class AudioEngine {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private streamGain: GainNode | null = null;
    private rainGain: GainNode | null = null;
    private windGain: GainNode | null = null;
    private noiseBuffer: AudioBuffer | null = null;

    public muted = false;
    public ambientVolume = 0.36;
    private initialized = false;
    private lastBlipTime = 0;

    public unlock(): void {
        if (!this.initialized) {
            const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (!AudioCtx) return;
            this.ctx = new AudioCtx();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this.muted ? 0 : this.ambientVolume;
            this.masterGain.connect(this.ctx.destination);

            this.noiseBuffer = this.createNoiseBuffer(this.ctx, 3);
            this.setupAmbientLoops();
            this.initialized = true;
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
    }

    public setAmbientVolume(vol: number): void {
        this.ambientVolume = Math.max(0, Math.min(1, vol));
        if (this.masterGain && this.ctx && !this.muted) {
            this.masterGain.gain.setTargetAtTime(this.ambientVolume, this.ctx.currentTime, 0.05);
        }
    }

    public setMuted(muted: boolean): void {
        this.muted = muted;
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setTargetAtTime(muted ? 0 : this.ambientVolume, this.ctx.currentTime, 0.05);
        }
    }

    private createNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
        const length = ctx.sampleRate * seconds;
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < length; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99765 * b0 + white * 0.099046;
            b1 = 0.963 * b1 + white * 0.2965164;
            b2 = 0.57 * b2 + white * 1.0526913;
            data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.14;
        }
        return buffer;
    }

    private setupAmbientLoops(): void {
        if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;

        // 1. Stream & Waterfall Spatial Loop
        const streamSrc = this.ctx.createBufferSource();
        streamSrc.buffer = this.noiseBuffer;
        streamSrc.loop = true;
        const streamFilter = this.ctx.createBiquadFilter();
        streamFilter.type = 'bandpass';
        streamFilter.frequency.value = 680;
        streamFilter.Q.value = 0.65;
        this.streamGain = this.ctx.createGain();
        this.streamGain.gain.value = 0;
        streamSrc.connect(streamFilter).connect(this.streamGain).connect(this.masterGain);
        streamSrc.start();

        // 2. Soft Rain Loop
        const rainSrc = this.ctx.createBufferSource();
        rainSrc.buffer = this.noiseBuffer;
        rainSrc.loop = true;
        const rainFilter = this.ctx.createBiquadFilter();
        rainFilter.type = 'bandpass';
        rainFilter.frequency.value = 1050;
        rainFilter.Q.value = 0.55;
        this.rainGain = this.ctx.createGain();
        this.rainGain.gain.value = 0;
        rainSrc.connect(rainFilter).connect(this.rainGain).connect(this.masterGain);
        rainSrc.start();

        // 3. Wind Loop
        const windSrc = this.ctx.createBufferSource();
        windSrc.buffer = this.noiseBuffer;
        windSrc.loop = true;
        const windFilter = this.ctx.createBiquadFilter();
        windFilter.type = 'lowpass';
        windFilter.frequency.value = 320;
        this.windGain = this.ctx.createGain();
        this.windGain.gain.value = 0;
        windSrc.connect(windFilter).connect(this.windGain).connect(this.masterGain);
        windSrc.start();
    }

    public updateAmbient(
        playerX: number,
        playerZ: number,
        rainIntensity: number,
        windSpeed: number
    ): void {
        if (!this.ctx || !this.initialized) return;
        const now = this.ctx.currentTime;

        // Spatial stream loudness: louder near x=0 and near waterfall z=-22
        const distToStream = Math.max(0, Math.abs(playerX) - 1.5);
        const streamVol = Math.max(0.01, 0.14 * Math.exp(-distToStream * 0.22));
        const distToWaterfall = Math.hypot(playerX, playerZ + 21);
        const waterfallBoost = 0.08 * Math.exp(-distToWaterfall * 0.12);

        this.streamGain?.gain.setTargetAtTime(streamVol + waterfallBoost, now, 0.15);
        this.rainGain?.gain.setTargetAtTime(rainIntensity * 0.11, now, 0.2);
        this.windGain?.gain.setTargetAtTime(Math.min(0.08, windSpeed * 0.03), now, 0.2);
    }

    public playFootstep(surface: SurfaceType): void {
        if (!this.ctx || !this.masterGain || this.muted || this.ctx.state !== 'running') return;
        const now = this.ctx.currentTime;

        if (surface === 'wood') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(145 + Math.random() * 25, now);
            osc.frequency.exponentialRampToValueAtTime(65, now + 0.08);
            gain.gain.setValueAtTime(0.14, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
            osc.connect(gain).connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 0.095);
        } else if (surface === 'stone') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(340 + Math.random() * 80, now);
            osc.frequency.exponentialRampToValueAtTime(120, now + 0.045);
            gain.gain.setValueAtTime(0.09, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.connect(gain).connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 0.055);
        } else if (this.noiseBuffer) {
            const src = this.ctx.createBufferSource();
            src.buffer = this.noiseBuffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1100 + Math.random() * 300;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
            src.connect(filter).connect(gain).connect(this.masterGain);
            src.start(now, Math.random() * 1.5, 0.07);
        }
    }

    public playLampToggle(isOn: boolean): void {
        if (!this.ctx || !this.masterGain || this.muted || this.ctx.state !== 'running') return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(isOn ? 520 : 340, now);
        osc.frequency.exponentialRampToValueAtTime(isOn ? 880 : 210, now + 0.08);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain).connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.11);
    }

    public playDialogueBlip(): void {
        if (!this.ctx || !this.masterGain || this.muted || this.ctx.state !== 'running') return;
        const now = this.ctx.currentTime;
        if (now - this.lastBlipTime < 0.045) return;
        this.lastBlipTime = now;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(420 + Math.random() * 90, now);
        gain.gain.setValueAtTime(0.025, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        osc.connect(gain).connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.035);
    }

    public playThunder(): void {
        if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.muted || this.ctx.state !== 'running') return;
        const now = this.ctx.currentTime;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(240, now);
        filter.frequency.exponentialRampToValueAtTime(65, now + 2.2);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.75, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.4);

        src.connect(filter).connect(gain).connect(this.masterGain);
        src.start(now, 0, 2.5);
    }

    public playFireworkBurst(): void {
        if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.muted || this.ctx.state !== 'running') return;
        const now = this.ctx.currentTime;

        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(900, now);
        filter.frequency.exponentialRampToValueAtTime(260, now + 0.45);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        src.connect(filter).connect(gain).connect(this.masterGain);
        src.start(now, Math.random(), 0.55);
    }

    public playChime(isComplete = false): void {
        if (!this.ctx || !this.masterGain || this.muted || this.ctx.state !== 'running') return;
        const now = this.ctx.currentTime;
        const notes = isComplete ? [523.25, 659.25, 783.99, 1046.5] : [659.25, 880];
        notes.forEach((freq, i) => {
            if (!this.ctx || !this.masterGain) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + i * 0.08);
            gain.gain.setValueAtTime(0.14, now + i * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);
            osc.connect(gain).connect(this.masterGain);
            osc.start(now + i * 0.08);
            osc.stop(now + i * 0.08 + 0.28);
        });
    }
}
