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

            float vnoise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(
                    mix(hash21(i + vec2(0.0, 0.0)), hash21(i + vec2(1.0, 0.0)), u.x),
                    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
                    u.y
                );
            }

            void main() {
                float bankProximity = clamp(abs(vUv.x - 0.5) * 2.0, 0.0001, 1.0);
                vec3 waterCol = mix(uDeepColor, uShallowColor, pow(bankProximity, 1.35));

                float n1 = vnoise(vec2(vWorldPos.x * 1.1, (vWorldPos.z - uTime * 0.9) * 0.85));
                float n2 = vnoise(vec2(vWorldPos.x * 2.2 + 3.1, (vWorldPos.z - uTime * 1.35) * 1.6));
                float organicRipple = n1 * 0.65 + n2 * 0.35;

                waterCol = mix(waterCol, uShallowColor * 1.12, smoothstep(0.45, 0.85, organicRipple) * 0.16);

                float edgeFoam = smoothstep(0.87, 0.99, bankProximity + (organicRipple - 0.5) * 0.04);
                waterCol = mix(waterCol, vec3(0.92, 0.97, 1.0), edgeFoam * 0.5);

                float bridgeShadow1 = exp(-pow((vWorldPos.z - 0.6) * 1.15, 2.0));
                float bridgeShadow2 = exp(-pow((vWorldPos.z + 10.2) * 1.15, 2.0));
                waterCol *= (1.0 - max(bridgeShadow1, bridgeShadow2) * 0.36);

                if (uRainIntensity > 0.01) {
                    float drops = rainRipples(vWorldPos.xz, uTime);
                    waterCol += mix(vec3(0.75, 0.9, 1.0), uLanternColor, 0.3) * drops * uRainIntensity * 0.75;
                }

                float lampGlow1 = exp(-length(vec2((vWorldPos.x + 2.3) * 1.3, (vWorldPos.z - 2.3) * 0.55)));
                float lampGlow2 = exp(-length(vec2((vWorldPos.x - 2.3) * 1.3, (vWorldPos.z - 2.3) * 0.55)));
                float lampGlow3 = exp(-length(vec2((vWorldPos.x + 2.3) * 1.3, (vWorldPos.z + 2.2) * 0.55)));
                float lampGlow4 = exp(-length(vec2((vWorldPos.x - 2.3) * 1.3, (vWorldPos.z + 10.2) * 0.55)));
                float rainBoost = 1.0 + uRainIntensity * 0.35;
                waterCol += uLanternColor * (lampGlow1 + lampGlow2 + lampGlow3 + lampGlow4) * uLanternIntensity * rainBoost * 0.55;

                if (uFestivalIntensity > 0.01) {
                    vec3 festColor = mix(vec3(1.0, 0.32, 0.48), vec3(0.25, 0.88, 0.82), n1);
                    float festWash = exp(-pow(vWorldPos.x * 0.55, 2.0)) * 0.45;
                    waterCol += festColor * festWash * uFestivalIntensity * 0.16;
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

export function createWaterfallMaterial(uniforms: WaterUniforms): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        side: THREE.DoubleSide,
        vertexShader: `
            uniform float uTime;
            varying vec2 vUv;
            void main() {
                vUv = uv;
                vec3 pos = position;
                // Gentle water-curtain curve: spills forward at the top lip and ripples slightly
                float curve = sin(uv.y * 3.14159) * 0.28 + (1.0 - uv.y) * 0.25;
                pos.z += curve + sin(uv.y * 10.0 + uTime * 6.0) * 0.03;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform vec3 uDeepColor;
            uniform vec3 uShallowColor;
            uniform vec3 uSunColor;
            varying vec2 vUv;

            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }

            float vnoise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(
                    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
                    u.y
                );
            }

            void main() {
                // Soften left/right edges so waterfall blends into flanking rocks
                float edgeMask = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);

                // Two scrolling turbulent water layers
                vec2 uv1 = vec2(vUv.x * 5.5, vUv.y * 3.5 + uTime * 1.65);
                vec2 uv2 = vec2(vUv.x * 11.0 + sin(vUv.y * 6.0 + uTime * 2.0) * 0.35, vUv.y * 6.5 + uTime * 2.4);
                float n1 = vnoise(uv1);
                float n2 = vnoise(uv2);
                float stream = n1 * 0.6 + n2 * 0.4;

                // Base water gradient from deep to shallow + sunlight sheen
                vec3 baseCol = mix(uDeepColor, uShallowColor * 1.25, 0.45 + stream * 0.55);
                baseCol += uSunColor * smoothstep(0.68, 0.95, stream) * 0.18;

                // Organic white foam ribbons (wavy, broken streaks instead of straight lines)
                float foamRibbon = smoothstep(0.56, 0.84, stream);
                // Top spill-over crest foam + bottom churning splash foam
                float topCrest = smoothstep(0.78, 0.98, vUv.y + n2 * 0.12);
                float bottomChurn = smoothstep(0.32, 0.0, vUv.y - n1 * 0.12);
                float totalFoam = clamp(foamRibbon * 0.72 + topCrest * 0.85 + bottomChurn * 0.9, 0.0, 1.0);

                vec3 foamCol = mix(vec3(0.86, 0.95, 1.0), vec3(1.0), 0.75);
                vec3 finalCol = mix(baseCol, foamCol, totalFoam);

                float alpha = edgeMask * mix(0.76, 0.96, totalFoam);
                gl_FragColor = vec4(finalCol, alpha);
            }
        `,
    });
}

export function createWaterfallSplashMaterial(uniforms: WaterUniforms): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform vec3 uShallowColor;
            varying vec2 vUv;
            void main() {
                vec2 p = (vUv - 0.5) * 2.0;
                float d = length(p);
                float ang = atan(p.y, p.x);
                float ripple = 0.5 + 0.5 * sin(d * 18.0 - uTime * 6.5 + sin(ang * 5.0) * 1.2);
                float radial = pow(clamp(1.0 - d, 0.0, 1.0), 1.6);
                float foam = smoothstep(0.35, 0.85, ripple * 0.55 + radial * 0.65);
                vec3 col = mix(uShallowColor * 1.3, vec3(0.96, 0.99, 1.0), foam);
                float alpha = radial * (0.35 + foam * 0.6);
                gl_FragColor = vec4(col, alpha);
            }
        `,
    });
}
