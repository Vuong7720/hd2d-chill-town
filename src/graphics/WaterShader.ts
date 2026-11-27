import * as THREE from 'three';

export interface WaterUniforms {
    [uniform: string]: THREE.IUniform;
    uTime: THREE.IUniform<number>;
    uDeepColor: THREE.IUniform<THREE.Color>;
    uShallowColor: THREE.IUniform<THREE.Color>;
    uSunColor: THREE.IUniform<THREE.Color>;
    uLanternColor: THREE.IUniform<THREE.Color>;
    uLanternIntensity: THREE.IUniform<number>;
    uRainIntensity: THREE.IUniform<number>;
    uFestivalIntensity: THREE.IUniform<number>;
}

export function createStreamWaterMaterial(): {
    material: THREE.ShaderMaterial;
    uniforms: WaterUniforms;
} {
    const uniforms: WaterUniforms = {
        uTime: { value: 0 },
        uDeepColor: { value: new THREE.Color(0x0f4c68) },
        uShallowColor: { value: new THREE.Color(0x2a859e) },
        uSunColor: { value: new THREE.Color(0xfff3c4) },
        uLanternColor: { value: new THREE.Color(0xffa938) },
        uLanternIntensity: { value: 0.45 },
        uRainIntensity: { value: 0.0 },
        uFestivalIntensity: { value: 0.0 },
    };

    const material = new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vWorldPos;
            void main() {
                vUv = uv;
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPos = worldPosition.xyz;
                gl_Position = projectionMatrix * viewMatrix * worldPosition;
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform vec3 uDeepColor;
            uniform vec3 uShallowColor;
            uniform vec3 uSunColor;
            uniform vec3 uLanternColor;
            uniform float uLanternIntensity;
            uniform float uRainIntensity;
            uniform float uFestivalIntensity;
            varying vec2 vUv;
            varying vec3 vWorldPos;

            float hash21(vec2 p) {
                p = fract(p * vec2(123.34, 456.21));
                p += dot(p, p + 45.32);
                return fract(p.x * p.y);
            }

            float rainRipples(vec2 uv, float t) {
                vec2 grid = uv * 2.6;
                vec2 id = floor(grid);
                vec2 f = fract(grid) - 0.5;
                float h = hash21(id);
                float cycle = fract(t * 1.15 + h * 7.0);
                float dist = length(f - (vec2(h, fract(h * 13.7)) - 0.5) * 0.45);
                float ring = 1.0 - smoothstep(0.0, 0.035, abs(dist - cycle * 0.42));
                return ring * (1.0 - cycle) * step(0.35, h);
            }

            void main() {
                float bankProximity = clamp(abs(vUv.x - 0.5) * 2.0, 0.0001, 1.0);
                vec3 waterCol = mix(uDeepColor, uShallowColor, pow(bankProximity, 1.35));

                float flowZ = vWorldPos.z - uTime * 1.35;
                float waveA = sin(flowZ * 4.2 + sin(vWorldPos.x * 1.8 + uTime * 0.8) * 1.4);
                float waveB = sin(flowZ * 9.5 - vWorldPos.x * 2.4 + uTime * 1.1) * 0.5;
                float waveC = cos(flowZ * 16.0 + vWorldPos.x * 3.2) * 0.25;
                float combinedWave = waveA * 0.55 + waveB * 0.3 + waveC * 0.15;

                float causticBand = smoothstep(0.25, 0.85, combinedWave);
                waterCol = mix(waterCol, uShallowColor * 1.28 + vec3(0.08, 0.15, 0.18), causticBand * 0.55);

                float edgeFoam = smoothstep(0.84, 0.99, bankProximity + combinedWave * 0.035);
                waterCol = mix(waterCol, vec3(0.92, 0.97, 1.0), edgeFoam * 0.65);

                float bridgeShadow1 = exp(-pow((vWorldPos.z - 0.6) * 1.15, 2.0));
                float bridgeShadow2 = exp(-pow((vWorldPos.z + 10.2) * 1.15, 2.0));
                waterCol *= (1.0 - max(bridgeShadow1, bridgeShadow2) * 0.36);

                vec2 glintCell = floor(vec2(vWorldPos.x * 9.0, (vWorldPos.z - uTime * 0.85) * 22.0));
                float glintNoise = hash21(glintCell);
                float glintPulse = sin(uTime * 3.8 + glintNoise * 31.0) * 0.5 + 0.5;
                float centerBand = exp(-pow(vWorldPos.x * 0.68, 2.0));
                float sparkle = step(0.935, glintNoise) * smoothstep(0.55, 0.95, glintPulse) * centerBand * (1.0 - uRainIntensity * 0.7);
                waterCol += uSunColor * sparkle * 1.1;

                if (uRainIntensity > 0.01) {
                    float drops = rainRipples(vWorldPos.xz, uTime);
                    waterCol += mix(vec3(0.75, 0.9, 1.0), uLanternColor, 0.3) * drops * uRainIntensity * 0.85;
                }

                float lampGlow1 = exp(-length(vec2((vWorldPos.x + 2.3) * 1.3, (vWorldPos.z - 2.3) * 0.45)));
                float lampGlow2 = exp(-length(vec2((vWorldPos.x - 2.3) * 1.3, (vWorldPos.z - 2.3) * 0.45)));
                float lampGlow3 = exp(-length(vec2((vWorldPos.x + 2.3) * 1.3, (vWorldPos.z + 2.2) * 0.45)));
                float lampGlow4 = exp(-length(vec2((vWorldPos.x - 2.3) * 1.3, (vWorldPos.z + 10.2) * 0.45)));
                float rippleMod = 0.75 + 0.25 * sin(vWorldPos.z * 12.0 - uTime * 3.5);
                float rainBoost = 1.0 + uRainIntensity * 0.55;
                waterCol += uLanternColor * (lampGlow1 + lampGlow2 + lampGlow3 + lampGlow4) * rippleMod * uLanternIntensity * rainBoost;

                if (uFestivalIntensity > 0.01) {
                    float festWave = sin(vWorldPos.z * 2.2 + uTime * 2.5) * 0.5 + 0.5;
                    vec3 festColor = mix(vec3(1.0, 0.28, 0.45), vec3(0.25, 0.95, 0.85), festWave);
                    festColor = mix(festColor, vec3(1.0, 0.82, 0.22), sin(vWorldPos.x * 3.0 - uTime * 3.0) * 0.5 + 0.5);
                    float festBand = exp(-pow(vWorldPos.x * 0.55, 2.0)) * (0.55 + 0.45 * sin(vWorldPos.z * 9.0 - uTime * 5.0));
                    waterCol += festColor * festBand * uFestivalIntensity * 0.75;
                }

                // Waterwheel foam splash at x=-2.25, z=-6.6
                float wheelDist = length(vec2((vWorldPos.x + 2.25) * 1.4, (vWorldPos.z + 6.6) * 1.1));
                float wheelFoam = exp(-wheelDist * wheelDist * 2.2) * (0.5 + 0.5 * sin(uTime * 11.0 - wheelDist * 14.0));
                waterCol = mix(waterCol, vec3(0.95, 0.98, 1.0), clamp(wheelFoam * 0.85, 0.0, 0.85));

                float alpha = mix(0.64, 0.88, edgeFoam * 0.6 + wheelFoam * 0.4);
                gl_FragColor = vec4(waterCol, alpha);
            }
        `,
    });

    return { material, uniforms };
}
