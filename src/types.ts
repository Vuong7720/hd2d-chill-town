import * as THREE from 'three';

export interface ColliderBox {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
}

export interface HeroAnimations {
    idle: THREE.CanvasTexture[];
    walk: THREE.CanvasTexture[];
}

export interface HeroPalette {
    O?: string;
    H?: string;
    h?: string;
    d?: string;
    S?: string;
    s?: string;
    W?: string;
    R?: string;
    r?: string;
    B?: string;
    b?: string;
    G?: string;
    L?: string;
    l?: string;
}

export interface NpcConfig {
    id: string;
    name: string;
    role: string;
    x: number;
    y?: number;
    z: number;
    facing: number;
    palette: HeroPalette;
    lines: string[];
}

export interface InteractiveLamp {
    x: number;
    z: number;
    isOn: boolean;
    light: THREE.PointLight;
    bulbMat: THREE.MeshStandardMaterial;
    name: string;
}

export type MoodKey = 'dawn' | 'golden' | 'calmNight' | 'night';
export type WeatherKey = 'clear' | 'mist' | 'rain';
export type CameraMode = 'follow' | 'free';

export interface MoodPreset {
    subtitle: string;
    skyColor: number;
    fogColor: number;
    fogDensity: number;
    hemiSky: number;
    hemiGround: number;
    hemiIntensity: number;
    sunColor: number;
    sunIntensity: number;
    sunPos: [number, number, number];
    mountainColor: number;
    rayColor: number;
    rayOpacity: number;
    waterDeep: number;
    waterShallow: number;
    waterLanternGlow: number;
    windowEmissive: number;
    lampIntensity: number;
    fireflyOpacity: number;
    leafColor: number;
    mistColor: number;
    festivalGlow: number;
}

export interface WeatherPreset {
    rainOpacity: number;
    mistOpacity: number;
    cobbleRoughness: number;
    cobbleMetalness: number;
    cobbleTint: number;
    fogMult: number;
    sunMult: number;
    skyDarken: number;
    bloomBoost: number;
}
