import { CameraMode, MoodKey, WeatherKey } from '../types';

export interface HudCallbacks {
    onAutoCycleChange: (enabled: boolean) => void;
    onMoodChange: (mood: MoodKey) => void;
    onWeatherChange: (weather: WeatherKey) => void;
    onToggleDof: (enabled: boolean) => void;
    onToggleRays: (enabled: boolean) => void;
    onToggleBloom: (enabled: boolean) => void;
    onWindChange: (speed: number) => void;
    onResetHero: () => void;
    onCameraModeChange: (mode: CameraMode) => void;
}

export class HudController {
    private camFollowBtn = document.getElementById('cam-follow-btn')!;
    private camFreeBtn = document.getElementById('cam-free-btn')!;
    private autoCycleCheckbox = document.getElementById('toggle-auto-cycle') as HTMLInputElement;

    constructor(callbacks: HudCallbacks) {
        const toggleHudBtn = document.getElementById('toggle-hud-btn')!;
        const hudPanel = document.getElementById('hud-panel')!;
        const isMobile =
            window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches;
        if (isMobile) {
            hudPanel.classList.add('hud-collapsed');
        }
        toggleHudBtn.addEventListener('click', () => {
            const willOpen = hudPanel.classList.contains('hud-collapsed');
            if (willOpen && (window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches)) {
                document.getElementById('music-panel')?.classList.add('hud-collapsed');
            }
            hudPanel.classList.toggle('hud-collapsed');
        });
        document.getElementById('close-hud-btn')?.addEventListener('click', () => {
            hudPanel.classList.add('hud-collapsed');
        });

        this.autoCycleCheckbox.addEventListener('change', () => {
            callbacks.onAutoCycleChange(this.autoCycleCheckbox.checked);
        });

        document.querySelectorAll<HTMLButtonElement>('.preset-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.autoCycleCheckbox.checked = false;
                callbacks.onAutoCycleChange(false);
                this.highlightMoodButton(btn.dataset.preset as MoodKey);
                callbacks.onMoodChange(btn.dataset.preset as MoodKey);
            });
        });

        document.querySelectorAll<HTMLButtonElement>('.weather-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.autoCycleCheckbox.checked = false;
                callbacks.onAutoCycleChange(false);
                this.highlightWeatherButton(btn.dataset.weather as WeatherKey);
                callbacks.onWeatherChange(btn.dataset.weather as WeatherKey);
            });
        });

        (document.getElementById('toggle-dof') as HTMLInputElement).addEventListener('change', (e) => {
            callbacks.onToggleDof((e.target as HTMLInputElement).checked);
        });
        (document.getElementById('toggle-rays') as HTMLInputElement).addEventListener('change', (e) => {
            callbacks.onToggleRays((e.target as HTMLInputElement).checked);
        });
        (document.getElementById('toggle-bloom') as HTMLInputElement).addEventListener('change', (e) => {
            callbacks.onToggleBloom((e.target as HTMLInputElement).checked);
        });

        const windSlider = document.getElementById('wind-slider') as HTMLInputElement;
        const windVal = document.getElementById('wind-val')!;
        windSlider.addEventListener('input', () => {
            const val = parseFloat(windSlider.value);
            windVal.textContent = `${val.toFixed(1)}x`;
            callbacks.onWindChange(val);
        });

        document.getElementById('reset-hero-btn')!.addEventListener('click', callbacks.onResetHero);
        this.camFollowBtn.addEventListener('click', () => callbacks.onCameraModeChange('follow'));
        this.camFreeBtn.addEventListener('click', () => callbacks.onCameraModeChange('free'));
    }

    public highlightMoodButton(mood: MoodKey): void {
        document.querySelectorAll<HTMLButtonElement>('.preset-btn').forEach((b) => {
            const isMatch = b.dataset.preset === mood;
            b.classList.toggle('active', isMatch);
            b.classList.toggle('bg-amber-500/30', isMatch);
            b.classList.toggle('border-amber-400/70', isMatch);
            b.classList.toggle('text-amber-200', isMatch);
            b.classList.toggle('bg-white/10', !isMatch);
            b.classList.toggle('border-white/10', !isMatch);
            b.classList.toggle('text-slate-200', !isMatch);
        });
    }

    public highlightWeatherButton(weather: WeatherKey): void {
        document.querySelectorAll<HTMLButtonElement>('.weather-btn').forEach((b) => {
            const isMatch = b.dataset.weather === weather;
            b.classList.toggle('active', isMatch);
            b.classList.toggle('bg-sky-500/30', isMatch);
            b.classList.toggle('border-sky-400/70', isMatch);
            b.classList.toggle('text-sky-200', isMatch);
            b.classList.toggle('bg-white/10', !isMatch);
            b.classList.toggle('border-white/10', !isMatch);
            b.classList.toggle('text-slate-200', !isMatch);
        });
    }

    public setCameraButtons(mode: CameraMode): void {
        if (mode === 'follow') {
            this.camFollowBtn.className =
                'px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-medium bg-amber-500/35 border border-amber-400/70 text-amber-200 transition cursor-pointer';
            this.camFreeBtn.className =
                'px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-medium bg-transparent hover:bg-white/10 border border-transparent text-slate-300 transition cursor-pointer';
        } else {
            this.camFreeBtn.className =
                'px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-medium bg-amber-500/35 border border-amber-400/70 text-amber-200 transition cursor-pointer';
            this.camFollowBtn.className =
                'px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-medium bg-transparent hover:bg-white/10 border border-transparent text-slate-300 transition cursor-pointer';
        }
    }
}
