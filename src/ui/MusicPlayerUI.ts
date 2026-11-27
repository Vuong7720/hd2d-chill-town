import { MusicPlayer } from '../systems/MusicPlayer';
import { AudioEngine } from '../systems/AudioEngine';

function formatTime(sec: number): string {
    if (!Number.isFinite(sec) || sec <= 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60)
        .toString()
        .padStart(2, '0');
    return `${m}:${s}`;
}

export class MusicPlayerUI {
    private panelEl = document.getElementById('music-panel')!;
    private toggleBtn = document.getElementById('toggle-music-btn')!;
    private titleEl = document.getElementById('music-title')!;
    private playBtn = document.getElementById('music-play-btn')!;
    private prevBtn = document.getElementById('music-prev-btn')!;
    private nextBtn = document.getElementById('music-next-btn')!;
    private shuffleBtn = document.getElementById('music-shuffle-btn')!;
    private repeatBtn = document.getElementById('music-repeat-btn')!;
    private seekSlider = document.getElementById('music-seek') as HTMLInputElement;
    private timeCurEl = document.getElementById('music-time-cur')!;
    private timeDurEl = document.getElementById('music-time-dur')!;
    private musicVolSlider = document.getElementById('music-vol-slider') as HTMLInputElement;
    private ambientVolSlider = document.getElementById('ambient-vol-slider') as HTMLInputElement;

    private tabLocalBtn = document.getElementById('tab-local-music')!;
    private tabYtBtn = document.getElementById('tab-yt-music')!;
    private localPane = document.getElementById('music-local-pane')!;
    private ytPane = document.getElementById('music-yt-pane')!;

    private fileInput = document.getElementById('music-file-input') as HTMLInputElement;
    private pickFilesBtn = document.getElementById('pick-music-btn')!;
    private playlistEl = document.getElementById('music-playlist')!;
    private ytInput = document.getElementById('yt-url-input') as HTMLInputElement;
    private ytLoadBtn = document.getElementById('yt-load-btn')!;
    private ytErrorEl = document.getElementById('yt-error')!;

    private isSeeking = false;

    constructor(private player: MusicPlayer, private audio: AudioEngine) {
        this.toggleBtn.addEventListener('click', () => {
            this.panelEl.classList.toggle('hud-collapsed');
        });

        this.playBtn.addEventListener('click', () => this.player.togglePlay());
        this.prevBtn.addEventListener('click', () => this.player.prev());
        this.nextBtn.addEventListener('click', () => this.player.next());

        this.shuffleBtn.addEventListener('click', () => {
            this.player.shuffle = !this.player.shuffle;
            this.shuffleBtn.classList.toggle('text-amber-300', this.player.shuffle);
            this.shuffleBtn.classList.toggle('text-slate-400', !this.player.shuffle);
        });

        this.repeatBtn.addEventListener('click', () => {
            this.player.repeatOne = !this.player.repeatOne;
            this.repeatBtn.classList.toggle('text-amber-300', this.player.repeatOne);
            this.repeatBtn.classList.toggle('text-slate-400', !this.player.repeatOne);
        });

        this.seekSlider.addEventListener('pointerdown', () => {
            this.isSeeking = true;
        });
        this.seekSlider.addEventListener('change', () => {
            this.player.seekPercent(parseFloat(this.seekSlider.value) / 100);
            this.isSeeking = false;
        });

        this.musicVolSlider.addEventListener('input', () => {
            this.player.setVolume(parseFloat(this.musicVolSlider.value));
        });

        this.ambientVolSlider.addEventListener('input', () => {
            this.audio.unlock();
            this.audio.setAmbientVolume(parseFloat(this.ambientVolSlider.value));
        });

        this.tabLocalBtn.addEventListener('click', () => this.switchTab('local'));
        this.tabYtBtn.addEventListener('click', () => this.switchTab('youtube'));

        this.pickFilesBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', () => {
            if (this.fileInput.files) {
                this.player.addLocalFiles(this.fileInput.files);
                this.renderPlaylist();
            }
        });

        // Drag & Drop audio files anywhere on the screen
        window.addEventListener('dragover', (e) => e.preventDefault());
        window.addEventListener('drop', (e) => {
            e.preventDefault();
            if (e.dataTransfer?.files?.length) {
                this.player.addLocalFiles(e.dataTransfer.files);
                this.switchTab('local');
                this.renderPlaylist();
            }
        });

        this.ytLoadBtn.addEventListener('click', () => {
            const ok = this.player.loadYouTubeUrl(this.ytInput.value);
            this.ytErrorEl.classList.toggle('hidden', ok);
        });

        this.player.onStateChange = () => this.refreshUI();
        this.refreshUI();
    }

    private switchTab(tab: 'local' | 'youtube'): void {
        const isLocal = tab === 'local';
        this.localPane.classList.toggle('hidden', !isLocal);
        this.ytPane.classList.toggle('hidden', isLocal);

        this.tabLocalBtn.className = isLocal
            ? 'flex-1 py-1.5 rounded-lg text-[11px] font-medium bg-amber-500/30 text-amber-200 border border-amber-400/50 cursor-pointer'
            : 'flex-1 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 text-slate-300 border border-transparent cursor-pointer';
        this.tabYtBtn.className = !isLocal
            ? 'flex-1 py-1.5 rounded-lg text-[11px] font-medium bg-rose-500/30 text-rose-200 border border-rose-400/50 cursor-pointer'
            : 'flex-1 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 text-slate-300 border border-transparent cursor-pointer';
    }

    private renderPlaylist(): void {
        if (this.player.tracks.length === 0) {
            this.playlistEl.innerHTML =
                '<div class="text-[11px] text-slate-400 text-center py-3">Kéo thả file .mp3 / .flac vào đây hoặc bấm "Chọn nhạc"</div>';
            return;
        }
        this.playlistEl.innerHTML = '';
        this.player.tracks.forEach((track, idx) => {
            const btn = document.createElement('button');
            const active = idx === this.player.currentIndex && this.player.mode === 'local';
            btn.className = `w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] truncate transition cursor-pointer ${
                active
                    ? 'bg-amber-500/25 text-amber-200 border border-amber-400/40 font-medium'
                    : 'hover:bg-white/10 text-slate-300'
            }`;
            btn.textContent = `${active && this.player.isPlaying ? '▶ ' : `${idx + 1}. `}${track.name}`;
            btn.addEventListener('click', () => this.player.playIndex(idx));
            this.playlistEl.appendChild(btn);
        });
    }

    private refreshUI(): void {
        this.titleEl.textContent = this.player.getCurrentTitle();
        this.playBtn.textContent = this.player.isPlaying ? '⏸' : '▶';

        const { current, duration } = this.player.getProgress();
        this.timeCurEl.textContent = formatTime(current);
        this.timeDurEl.textContent = formatTime(duration);
        if (!this.isSeeking) {
            this.seekSlider.value = duration > 0 ? String((current / duration) * 100) : '0';
        }
        this.renderPlaylist();
    }
}
