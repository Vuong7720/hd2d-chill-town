import * as THREE from 'three';
import { generateMistTexture } from '../graphics/PixelTextureGen';
import { MoodKey, MoodPreset, WeatherKey, WeatherPreset } from '../types';
import presetsData from '../data/presets.json';
import { Engine } from '../core/Engine';
import { PostProcessing } from '../core/PostProcessing';
import { WaterUniforms } from '../graphics/WaterShader';

const MOODS = presetsData.moods as Record<MoodKey, MoodPreset>;
const WEATHERS = presetsData.weathers as Record<WeatherKey, WeatherPreset>;

interface FestivalLantern {
    mesh: THREE.Mesh;
    mat: THREE.MeshStandardMaterial;
    baseY: number;
    phase: number;
}

export interface EnvironmentRefs {
    engine: Engine;
    post: PostProcessing;
    waterUniforms: WaterUniforms;
    cobbleMat: THREE.MeshStandardMaterial;
    windowGlassMat: THREE.MeshStandardMaterial;
    mountainMeshes: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[];
}

const MOOD_ORDER: MoodKey[] = ['dawn', 'golden', 'calmNight', 'night'];

export class WeatherSystem {
    public autoCycleEnabled = true;
    public currentMoodKey: MoodKey = 'dawn';
    public currentWeatherKey: WeatherKey = 'clear';
    public currentLampBoost = 1.0;
    public windSpeed = 1.0;

    private cycleProgress = 0; // 0..4 across 4 moods (full day ~ 96s)
    private cycleDurationSeconds = 96;
    private weatherTimer = 24;
    private weatherBlend = 1.0;
    private prevWeatherKey: WeatherKey = 'clear';

    private tmpColA = new THREE.Color();
    private tmpColB = new THREE.Color();
    private tmpColC = new THREE.Color();
    private activeLampIntensity = MOODS.dawn.lampIntensity;
    private activeWindowEmissive = MOODS.dawn.windowEmissive;

    private festivalGarlandGroup = new THREE.Group();
    private festivalLanternMeshes: FestivalLantern[] = [];
    private festivalAreaLights: THREE.PointLight[] = [];
    private festivalColors = [0xff2a6d, 0xffbe0b, 0x05d9e8, 0xa855f7, 0x34d399, 0xf97316];

    private fwSparkCount = 90;
    private fwGeo: THREE.BufferGeometry;
    private fwMat: THREE.PointsMaterial;
    private fireworkSystem: THREE.Points;
    private fwState = {
        active: false,
        timer: 1.2,
        life: 0,
        origin: new THREE.Vector3(),
        velocities: [] as THREE.Vector3[],
    };

    private leafCount = 160;
    private leafGeo: THREE.BufferGeometry;
    private leafMat: THREE.PointsMaterial;
    private leafData: { vy: number; phase: number }[] = [];

    private fireflyCount = 260;
    private fireflyGeo: THREE.BufferGeometry;
    private fireflyMat: THREE.PointsMaterial;
    private fireflyData: { bx: number; by: number; bz: number; speed: number; phase: number }[] = [];

    private rainCount = 460;
    private rainGeo: THREE.BufferGeometry;
    private rainMat: THREE.LineBasicMaterial;
    private rainSystem: THREE.LineSegments;
    private rainDrops: { x: number; y: number; z: number; speed: number }[] = [];

    private mistLayers: {
        mesh: THREE.Mesh;
        mat: THREE.MeshBasicMaterial;
        baseX: number;
        speed: number;
        phase: number;
    }[] = [];
    private mistUniforms = {
        uColor: new THREE.Color(0xe2e8f0),
        uTargetOpacity: 0.0,
    };

    private lightningTimer = 4.0;
    private currentRainIntensity = 0;
    public onThunder?: () => void;
    public onFirework?: () => void;

    constructor(private scene: THREE.Scene) {
        this.initFestivalGarlands();
        const fw = this.initFireworks();
        this.fwGeo = fw.geo;
        this.fwMat = fw.mat;
        this.fireworkSystem = fw.points;

        const leaves = this.initLeaves();
        this.leafGeo = leaves.geo;
        this.leafMat = leaves.mat;

        const fireflies = this.initFireflies();
        this.fireflyGeo = fireflies.geo;
        this.fireflyMat = fireflies.mat;

        const rain = this.initRain();
        this.rainGeo = rain.geo;
        this.rainMat = rain.mat;
        this.rainSystem = rain.lines;

        this.initMist();
    }

    private initFestivalGarlands(): void {
        const spans = [
            { x1: -5.5, z1: 2.2, x2: 5.5, z2: 2.2, count: 9 },
            { x1: -5.5, z1: -1.2, x2: 5.5, z2: -1.2, count: 9 },
            { x1: -5.5, z1: -8.6, x2: 5.5, z2: -8.6, count: 9 },
            { x1: -13.0, z1: 2.2, x2: -7.5, z2: 6.5, count: 7 },
            { x1: 7.5, z1: -2.0, x2: 14.5, z2: -6.0, count: 7 },
        ];

        spans.forEach((span, sIdx) => {
            for (let i = 0; i < span.count; i++) {
                const t = (i + 0.5) / span.count;
                const gx = THREE.MathUtils.lerp(span.x1, span.x2, t);
                const gz = THREE.MathUtils.lerp(span.z1, span.z2, t);
                const sag = Math.sin(t * Math.PI) * 0.55;
                const gy = 3.55 - sag;
                const col = this.festivalColors[(sIdx * 3 + i) % this.festivalColors.length];

                const fMat = new THREE.MeshStandardMaterial({
                    color: col,
                    emissive: col,
                    emissiveIntensity: 0.25,
                    roughness: 0.3,
                });
                const fLantern = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), fMat);
                fLantern.scale.set(0.95, 1.25, 0.95);
                fLantern.position.set(gx, gy, gz);
                this.festivalGarlandGroup.add(fLantern);
                this.festivalLanternMeshes.push({
                    mesh: fLantern,
                    mat: fMat,
                    baseY: gy,
                    phase: i * 0.8 + sIdx,
                });
            }
        });
        this.scene.add(this.festivalGarlandGroup);

        this.festivalAreaLights = [
            new THREE.PointLight(0xff2a6d, 0, 14, 1.4),
            new THREE.PointLight(0xffbe0b, 0, 15, 1.4),
            new THREE.PointLight(0x05d9e8, 0, 14, 1.4),
            new THREE.PointLight(0xa855f7, 0, 14, 1.4),
        ];
        this.festivalAreaLights[0].position.set(-4.5, 3.6, 1.2);
        this.festivalAreaLights[1].position.set(0, 3.8, -4.5);
        this.festivalAreaLights[2].position.set(4.5, 3.6, -9.8);
        this.festivalAreaLights[3].position.set(-10.5, 3.8, 4.2);
        this.festivalAreaLights.forEach((fl) => this.scene.add(fl));
    }

    private initFireworks() {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.fwSparkCount * 3), 3));
        geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.fwSparkCount * 3), 3));
        const mat = new THREE.PointsMaterial({
            size: 0.24,
            vertexColors: true,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        const points = new THREE.Points(geo, mat);
        points.visible = false;
        this.scene.add(points);
        return { geo, mat, points };
    }

    private launchFirework(): void {
        this.fwState.active = true;
        this.fwState.life = 1.65;
        this.fwState.origin.set((Math.random() - 0.5) * 22, 8.5 + Math.random() * 4.5, -12 - Math.random() * 10);
        this.fwState.velocities = [];
        const baseCol = new THREE.Color(
            this.festivalColors[Math.floor(Math.random() * this.festivalColors.length)]
        );
        const altCol = new THREE.Color(0xffffff);
        const posAttr = this.fwGeo.attributes.position as THREE.BufferAttribute;
        const colAttr = this.fwGeo.attributes.color as THREE.BufferAttribute;

        for (let i = 0; i < this.fwSparkCount; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const spd = 2.2 + Math.random() * 3.4;
            this.fwState.velocities.push(
                new THREE.Vector3(
                    Math.sin(phi) * Math.cos(theta) * spd,
                    Math.cos(phi) * spd,
                    Math.sin(phi) * Math.sin(theta) * spd
                )
            );
            posAttr.setXYZ(i, this.fwState.origin.x, this.fwState.origin.y, this.fwState.origin.z);
            const c = i % 3 === 0 ? altCol : baseCol;
            colAttr.setXYZ(i, c.r, c.g, c.b);
        }
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        this.fireworkSystem.visible = true;
    }

    private initLeaves() {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(this.leafCount * 3);
        for (let i = 0; i < this.leafCount; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 38;
            pos[i * 3 + 1] = 0.6 + Math.random() * 8.5;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 32 - 3;
            this.leafData.push({ vy: 0.28 + Math.random() * 0.35, phase: Math.random() * Math.PI * 2 });
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({ color: 0xfde047, size: 0.14, transparent: true, opacity: 0.85 });
        this.scene.add(new THREE.Points(geo, mat));
        return { geo, mat };
    }

    private initFireflies() {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(this.fireflyCount * 3);
        for (let i = 0; i < this.fireflyCount; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 36;
            pos[i * 3 + 1] = 0.5 + Math.random() * 5.2;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 32 - 3;
            this.fireflyData.push({
                bx: pos[i * 3],
                by: pos[i * 3 + 1],
                bz: pos[i * 3 + 2],
                speed: 0.6 + Math.random() * 0.8,
                phase: Math.random() * Math.PI * 2,
            });
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
            color: 0xfef08a,
            size: 0.19,
            transparent: true,
            opacity: 0.35,
            blending: THREE.AdditiveBlending,
        });
        this.scene.add(new THREE.Points(geo, mat));
        return { geo, mat };
    }

    private initRain() {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(this.rainCount * 6);
        for (let i = 0; i < this.rainCount; i++) {
            const rx = (Math.random() - 0.5) * 38;
            const ry = Math.random() * 16;
            const rz = (Math.random() - 0.5) * 34 - 2;
            this.rainDrops.push({ x: rx, y: ry, z: rz, speed: 15 + Math.random() * 7 });
            pos[i * 6] = rx;
            pos[i * 6 + 1] = ry;
            pos[i * 6 + 2] = rz;
            pos[i * 6 + 3] = rx;
            pos[i * 6 + 4] = ry - 0.55;
            pos[i * 6 + 5] = rz;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.LineBasicMaterial({
            color: 0xbae6fd,
            transparent: true,
            opacity: 0.0,
            depthWrite: false,
        });
        const lines = new THREE.LineSegments(geo, mat);
        lines.visible = false;
        this.scene.add(lines);
        return { geo, mat, lines };
    }

    private initMist(): void {
        const mistTex = generateMistTexture();
        const mistGroup = new THREE.Group();
        for (let i = 0; i < 8; i++) {
            const mMat = new THREE.MeshBasicMaterial({
                map: mistTex,
                transparent: true,
                opacity: 0.0,
                depthWrite: false,
                blending: THREE.NormalBlending,
            });
            const plane = new THREE.Mesh(new THREE.PlaneGeometry(13, 6.5), mMat);
            plane.rotation.x = -Math.PI / 2.3;
            const bx = (Math.random() - 0.5) * 26;
            const by = 0.45 + (i % 2) * 0.25;
            const bz = -15 + i * 3.8;
            plane.position.set(bx, by, bz);
            mistGroup.add(plane);
            this.mistLayers.push({
                mesh: plane,
                mat: mMat,
                baseX: bx,
                speed: 0.35 + (i % 4) * 0.14,
                phase: i * 1.3,
            });
        }
        this.scene.add(mistGroup);
    }

    public getCurrentMood(): MoodPreset {
        return MOODS[this.currentMoodKey];
    }

    public getActiveLampIntensity(): number {
        return this.activeLampIntensity;
    }

    public getActiveWindowEmissive(): number {
        return this.activeWindowEmissive;
    }

    public getRainIntensity(): number {
        return this.currentRainIntensity;
    }

    public setAutoCycle(enabled: boolean): void {
        this.autoCycleEnabled = enabled;
        if (enabled) {
            this.cycleProgress = MOOD_ORDER.indexOf(this.currentMoodKey);
        }
    }

    public applyState(params: EnvironmentRefs): void {
        const m = MOODS[this.currentMoodKey];
        const w = WEATHERS[this.currentWeatherKey];
        this.activeLampIntensity = m.lampIntensity;
        this.activeWindowEmissive = m.windowEmissive;
        this.applyInterpolatedEnvironment(params, m, m, 0, w, w, 0, m.subtitle);
    }

    private applyInterpolatedEnvironment(
        params: EnvironmentRefs,
        mA: MoodPreset,
        mB: MoodPreset,
        tMood: number,
        wA: WeatherPreset,
        wB: WeatherPreset,
        tWeather: number,
        subtitleText: string
    ): void {
        const { engine, post, waterUniforms, cobbleMat, windowGlassMat, mountainMeshes } = params;

        const subtitleEl = document.getElementById('mood-subtitle');
        if (subtitleEl) {
            subtitleEl.textContent = subtitleText;
        }

        const skyDarken = THREE.MathUtils.lerp(wA.skyDarken, wB.skyDarken, tWeather);
        const fogMult = THREE.MathUtils.lerp(wA.fogMult, wB.fogMult, tWeather);
        const sunMult = THREE.MathUtils.lerp(wA.sunMult, wB.sunMult, tWeather);
        const rainOpacity = THREE.MathUtils.lerp(wA.rainOpacity, wB.rainOpacity, tWeather);
        const mistOpacity = THREE.MathUtils.lerp(wA.mistOpacity, wB.mistOpacity, tWeather);
        const cobbleRoughness = THREE.MathUtils.lerp(wA.cobbleRoughness, wB.cobbleRoughness, tWeather);
        const cobbleMetalness = THREE.MathUtils.lerp(wA.cobbleMetalness, wB.cobbleMetalness, tWeather);
        const bloomBoost = THREE.MathUtils.lerp(wA.bloomBoost, wB.bloomBoost, tWeather);

        this.tmpColA.setHex(mA.skyColor).lerp(this.tmpColB.setHex(mB.skyColor), tMood);
        this.tmpColA.lerp(this.tmpColC.setHex(0x0f172a), skyDarken);
        (engine.scene.background as THREE.Color).copy(this.tmpColA);

        this.tmpColA.setHex(mA.fogColor).lerp(this.tmpColB.setHex(mB.fogColor), tMood);
        this.tmpColA.lerp(this.tmpColC.setHex(0x1e293b), skyDarken);
        if (engine.scene.fog instanceof THREE.FogExp2) {
            engine.scene.fog.color.copy(this.tmpColA);
            engine.scene.fog.density = THREE.MathUtils.lerp(mA.fogDensity, mB.fogDensity, tMood) * fogMult;
        }

        engine.hemiLight.color.setHex(mA.hemiSky).lerp(this.tmpColB.setHex(mB.hemiSky), tMood);
        engine.hemiLight.groundColor.setHex(mA.hemiGround).lerp(this.tmpColB.setHex(mB.hemiGround), tMood);
        engine.hemiLight.intensity =
            THREE.MathUtils.lerp(mA.hemiIntensity, mB.hemiIntensity, tMood) * (1.0 - skyDarken * 0.25);

        engine.dirLight.color.setHex(mA.sunColor).lerp(this.tmpColB.setHex(mB.sunColor), tMood);
        engine.dirLight.intensity = THREE.MathUtils.lerp(mA.sunIntensity, mB.sunIntensity, tMood) * sunMult;
        engine.dirLight.position.set(
            THREE.MathUtils.lerp(mA.sunPos[0], mB.sunPos[0], tMood),
            THREE.MathUtils.lerp(mA.sunPos[1], mB.sunPos[1], tMood),
            THREE.MathUtils.lerp(mA.sunPos[2], mB.sunPos[2], tMood)
        );

        this.tmpColA.setHex(mA.mountainColor).lerp(this.tmpColB.setHex(mB.mountainColor), tMood);
        mountainMeshes.forEach((pk) => pk.material.color.copy(this.tmpColA));

        post.rayUniforms.uColor.value.setHex(mA.rayColor).lerp(this.tmpColB.setHex(mB.rayColor), tMood);
        post.rayUniforms.uOpacity.value =
            THREE.MathUtils.lerp(mA.rayOpacity, mB.rayOpacity, tMood) *
            THREE.MathUtils.lerp(1.0, 0.45, rainOpacity / 0.58);

        waterUniforms.uDeepColor.value.setHex(mA.waterDeep).lerp(this.tmpColB.setHex(mB.waterDeep), tMood);
        waterUniforms.uShallowColor.value.setHex(mA.waterShallow).lerp(this.tmpColB.setHex(mB.waterShallow), tMood);
        this.currentRainIntensity = THREE.MathUtils.clamp(rainOpacity / 0.58, 0, 1);
        waterUniforms.uRainIntensity.value = this.currentRainIntensity;
        waterUniforms.uLanternIntensity.value = THREE.MathUtils.lerp(
            mA.waterLanternGlow,
            mB.waterLanternGlow,
            tMood
        );

        cobbleMat.roughness = cobbleRoughness;
        cobbleMat.metalness = cobbleMetalness;
        cobbleMat.color.setHex(wA.cobbleTint).lerp(this.tmpColB.setHex(wB.cobbleTint), tWeather);

        const wetBoost = THREE.MathUtils.lerp(1.0, 1.45, THREE.MathUtils.clamp(rainOpacity / 0.58, 0, 1));
        this.activeWindowEmissive = THREE.MathUtils.lerp(mA.windowEmissive, mB.windowEmissive, tMood);
        this.activeLampIntensity = THREE.MathUtils.lerp(mA.lampIntensity, mB.lampIntensity, tMood);
        windowGlassMat.emissiveIntensity = this.activeWindowEmissive * wetBoost;
        this.currentLampBoost = wetBoost;

        this.fireflyMat.opacity = THREE.MathUtils.lerp(mA.fireflyOpacity, mB.fireflyOpacity, tMood);
        this.leafMat.color.setHex(mA.leafColor).lerp(this.tmpColB.setHex(mB.leafColor), tMood);

        this.rainMat.opacity = rainOpacity;
        this.rainSystem.visible = rainOpacity > 0.01;
        this.mistUniforms.uTargetOpacity = mistOpacity;
        this.mistUniforms.uColor.setHex(mA.mistColor).lerp(this.tmpColB.setHex(mB.mistColor), tMood);

        const festVal = THREE.MathUtils.lerp(mA.festivalGlow || 0, mB.festivalGlow || 0, tMood);
        post.bloomPass.threshold = THREE.MathUtils.lerp(0.94, 0.84, THREE.MathUtils.clamp(festVal + 0.3, 0, 1));
        post.bloomPass.strength = Math.max(bloomBoost, 0.22 + festVal * 0.46);
        post.setMoodGrading(this.currentMoodKey);

        waterUniforms.uFestivalIntensity.value = festVal;
        this.festivalGarlandGroup.visible = festVal > 0.02 || this.currentMoodKey === 'golden';
        this.festivalLanternMeshes.forEach((fl) => {
            fl.mat.emissiveIntensity = 0.25 + festVal * 2.35;
        });
        this.festivalAreaLights.forEach((al) => {
            al.intensity = festVal * 2.4;
        });
        if (festVal <= 0.05) {
            this.fireworkSystem.visible = false;
            this.fwState.active = false;
        }
    }

    public update(
        dt: number,
        elapsed: number,
        lightningLight: THREE.PointLight,
        envRefs?: EnvironmentRefs,
        onCycleUIUpdate?: (mood: MoodKey, weather: WeatherKey) => void
    ): void {
        if (this.autoCycleEnabled && envRefs) {
            this.cycleProgress = (this.cycleProgress + (dt / this.cycleDurationSeconds) * 4) % 4;
            const idxA = Math.floor(this.cycleProgress) % 4;
            const idxB = (idxA + 1) % 4;
            const tMood = this.cycleProgress - Math.floor(this.cycleProgress);

            const moodAKey = MOOD_ORDER[idxA];
            const moodBKey = MOOD_ORDER[idxB];
            const prevMood = this.currentMoodKey;
            this.currentMoodKey = moodAKey;

            this.weatherTimer -= dt;
            if (this.weatherTimer <= 0) {
                this.prevWeatherKey = this.currentWeatherKey;
                const pool: WeatherKey[] =
                    moodAKey === 'dawn'
                        ? ['clear', 'mist', 'clear']
                        : moodAKey === 'night'
                          ? ['clear', 'clear', 'rain']
                          : ['clear', 'mist', 'rain'];
                const nextWeather = pool[Math.floor(Math.random() * pool.length)];
                this.currentWeatherKey = nextWeather;
                this.weatherBlend = 0;
                this.weatherTimer = 22 + Math.random() * 14;
                onCycleUIUpdate?.(this.currentMoodKey, this.currentWeatherKey);
            } else if (prevMood !== this.currentMoodKey) {
                onCycleUIUpdate?.(this.currentMoodKey, this.currentWeatherKey);
            }

            if (this.weatherBlend < 1) {
                this.weatherBlend = Math.min(1, this.weatherBlend + dt * 0.25);
            }

            // Virtual 24h clock starting at 06:00 for dawn
            const hourFloat = (6 + (this.cycleProgress / 4) * 24) % 24;
            const hh = Math.floor(hourFloat).toString().padStart(2, '0');
            const mm = Math.floor((hourFloat % 1) * 60)
                .toString()
                .padStart(2, '0');
            const wLabel =
                this.currentWeatherKey === 'rain'
                    ? ' • Mưa'
                    : this.currentWeatherKey === 'mist'
                      ? ' • Sương Mù'
                      : '';
            const label = `${hh}:${mm} • ${MOODS[moodAKey].subtitle}${wLabel}`;

            this.applyInterpolatedEnvironment(
                envRefs,
                MOODS[moodAKey],
                MOODS[moodBKey],
                tMood,
                WEATHERS[this.prevWeatherKey],
                WEATHERS[this.currentWeatherKey],
                this.weatherBlend,
                label
            );
        }

        this.festivalLanternMeshes.forEach((fl) => {
            fl.mesh.position.y = fl.baseY + Math.sin(elapsed * 2.2 + fl.phase) * 0.04;
            fl.mesh.rotation.z =
                Math.sin(elapsed * (1.8 + this.windSpeed) + fl.phase) * 0.12 * this.windSpeed;
        });

        if (this.currentMoodKey === 'night') {
            this.fwState.timer -= dt;
            if (!this.fwState.active && this.fwState.timer <= 0) {
                this.launchFirework();
                this.onFirework?.();
                this.fwState.timer = 1.4 + Math.random() * 1.8;
            }
            if (this.fwState.active) {
                this.fwState.life -= dt;
                this.fwMat.opacity = Math.max(0, Math.min(1, this.fwState.life * 1.1));
                const fPos = this.fwGeo.attributes.position as THREE.BufferAttribute;
                for (let i = 0; i < this.fwSparkCount; i++) {
                    const v = this.fwState.velocities[i];
                    v.y -= 2.4 * dt;
                    v.multiplyScalar(0.985);
                    fPos.setXYZ(
                        i,
                        fPos.getX(i) + v.x * dt,
                        fPos.getY(i) + v.y * dt,
                        fPos.getZ(i) + v.z * dt
                    );
                }
                fPos.needsUpdate = true;
                if (this.fwState.life <= 0) {
                    this.fwState.active = false;
                    this.fireworkSystem.visible = false;
                }
            }
        }

        const lAttr = this.leafGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < this.leafCount; i++) {
            let lx = lAttr.getX(i);
            let ly = lAttr.getY(i);
            let lz = lAttr.getZ(i);

            ly -= this.leafData[i].vy * (0.4 + this.windSpeed * 0.7) * dt;
            lx +=
                Math.sin(elapsed * 1.4 + this.leafData[i].phase) * 0.35 * this.windSpeed * dt +
                0.14 * this.windSpeed * dt;
            lz += Math.cos(elapsed * 1.1 + this.leafData[i].phase) * 0.2 * this.windSpeed * dt;

            if (ly < 0.25) {
                ly = 7.5 + Math.random() * 2.5;
                lx = (Math.random() - 0.5) * 36;
                lz = (Math.random() - 0.5) * 30 - 3;
            }
            lAttr.setXYZ(i, lx, ly, lz);
        }
        lAttr.needsUpdate = true;

        const fAttr = this.fireflyGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < this.fireflyCount; i++) {
            const d = this.fireflyData[i];
            fAttr.setXYZ(
                i,
                d.bx + Math.sin(elapsed * d.speed + d.phase) * 0.75,
                d.by + Math.cos(elapsed * d.speed * 1.2 + d.phase) * 0.45,
                d.bz + Math.sin(elapsed * d.speed * 0.8 + d.phase) * 0.75
            );
        }
        fAttr.needsUpdate = true;

        if (this.rainSystem.visible) {
            const rAttr = this.rainGeo.attributes.position as THREE.BufferAttribute;
            const windSlantX = 1.6 + this.windSpeed * 2.4;
            for (let i = 0; i < this.rainCount; i++) {
                const drop = this.rainDrops[i];
                drop.y -= drop.speed * dt;
                drop.x += windSlantX * dt;
                if (drop.y < 0.15) {
                    drop.y = 14.5 + Math.random() * 2.5;
                    drop.x = (Math.random() - 0.5) * 38 - windSlantX * 0.4;
                }
                rAttr.setXYZ(i * 2, drop.x, drop.y, drop.z);
                rAttr.setXYZ(i * 2 + 1, drop.x - windSlantX * 0.035, drop.y - 0.52, drop.z);
            }
            rAttr.needsUpdate = true;

            if (this.windSpeed >= 1.6) {
                this.lightningTimer -= dt;
                if (this.lightningTimer <= 0) {
                    lightningLight.intensity = 6.5;
                    this.onThunder?.();
                    this.lightningTimer = 4.5 + Math.random() * 6.0;
                }
            }
        }
        if (lightningLight.intensity > 0.01) {
            lightningLight.intensity *= 0.82;
        } else {
            lightningLight.intensity = 0;
        }

        this.mistLayers.forEach((m) => {
            m.mat.opacity = THREE.MathUtils.lerp(m.mat.opacity, this.mistUniforms.uTargetOpacity, 3.0 * dt);
            m.mat.color.copy(this.mistUniforms.uColor);
            if (m.mat.opacity > 0.01) {
                m.mesh.position.x =
                    m.baseX +
                    Math.sin(elapsed * m.speed * (0.5 + this.windSpeed * 0.5) + m.phase) * 3.8;
            }
        });
    }
}
