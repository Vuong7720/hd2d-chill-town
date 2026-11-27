import * as THREE from 'three';
import './style.css';
import { Engine } from './core/Engine';
import { PostProcessing } from './core/PostProcessing';
import { InputManager } from './core/InputManager';
import { AssetLoader } from './core/AssetLoader';
import { WorldContext } from './world/WorldContext';
import { buildTerrain } from './world/TerrainBuilder';
import { buildArchitecture } from './world/ArchitectureBuilder';
import { buildProps } from './world/PropBuilder';
import { buildFoliage } from './world/FoliageBuilder';
import { WeatherSystem } from './systems/WeatherSystem';
import { DialogueSystem } from './systems/DialogueSystem';
import { AudioEngine } from './systems/AudioEngine';
import { MusicPlayer } from './systems/MusicPlayer';
import { QuestManager } from './systems/QuestManager';
import { InteriorManager } from './world/InteriorManager';
import { Minimap } from './ui/Minimap';
import { MusicPlayerUI } from './ui/MusicPlayerUI';
import { PlayerController } from './entities/PlayerController';
import { NpcEntity } from './entities/NpcEntity';
import { AnimalEntity } from './entities/AnimalEntity';
import { HudController } from './ui/HudController';
import { InteractiveLamp, NpcConfig } from './types';
import npcsData from './data/npcs.json';
import townMap from './data/town_map.json';

function hideLoadingOverlay(): void {
    const bar = document.getElementById('loading-bar');
    const overlay = document.getElementById('loading-overlay');
    if (bar) bar.style.width = '100%';
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
    }
}

async function bootstrap(): Promise<void> {
    const loadingBar = document.getElementById('loading-bar');
    const loadingText = document.getElementById('loading-text');
    if (loadingBar) loadingBar.style.width = '30%';
    if (loadingText) loadingText.textContent = 'Đang nạp model 3D thị trấn...';

    const container = document.getElementById('canvas-container')!;
    const engine = new Engine(container);
    const post = new PostProcessing(engine.scene, engine.camera, engine.renderer);
    const world = new WorldContext();
    const assets = new AssetLoader();

    const { waterUniforms } = buildTerrain(engine.scene, world);
    const [{ windowGlassMat, shrineCrystal }, { waterWheelGroup, interactiveLamps }, { foliageSprites, swayingBushes, mountainMeshes }] =
        await Promise.all([
            buildArchitecture(engine.scene, world, assets),
            buildProps(engine.scene, world, assets),
            buildFoliage(engine.scene, world, assets),
        ]);

    if (loadingBar) loadingBar.style.width = '85%';

    const audio = new AudioEngine();
    const musicPlayer = new MusicPlayer();
    new MusicPlayerUI(musicPlayer, audio);
    const unlockAudio = () => audio.unlock();
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    const audioBtn = document.getElementById('toggle-audio-btn');
    const audioIcon = document.getElementById('audio-icon');
    const audioLabel = document.getElementById('audio-label');
    audioBtn?.addEventListener('click', () => {
        audio.unlock();
        audio.setMuted(!audio.muted);
        if (audioIcon) audioIcon.textContent = audio.muted ? '🔇' : '🔊';
        if (audioLabel) audioLabel.textContent = audio.muted ? 'Đã tắt' : 'Âm thanh';
    });

    const weather = new WeatherSystem(engine.scene);
    weather.onThunder = () => {
        audio.playThunder();
        engine.triggerShake(0.28);
    };
    weather.onFirework = () => {
        audio.playFireworkBurst();
        engine.triggerShake(0.08);
    };

    const player = new PlayerController(engine.scene, world, (surface) => {
        audio.playFootstep(interior.isInside ? 'wood' : surface);
    });

    const quest = new QuestManager(
        engine.scene,
        () => audio.playChime(false),
        () => {
            audio.playChime(true);
            player.toggleHandLantern(true);
        }
    );
    const interior = new InteriorManager(engine.scene, world.walkableFloors);
    const minimap = new Minimap();

    const toggleLantern = () => {
        if (player.toggleHandLantern(quest.hasLantern)) {
            audio.playLampToggle(player.lanternOn);
        }
    };
    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyF') toggleLantern();
    });
    document.getElementById('lantern-badge')?.addEventListener('click', toggleLantern);

    const npcList = (npcsData as NpcConfig[]).map((cfg) => new NpcEntity(engine.scene, world, cfg));
    const animalList = townMap.animals.map(
        (a) =>
            new AnimalEntity(
                engine.scene,
                world,
                a.species as 'dog' | 'cat' | 'chicken',
                a.homeX,
                a.homeZ,
                a.roamRadius,
                a.speed
            )
    );

    type Interactable =
        | { type: 'npc'; target: NpcEntity }
        | { type: 'lamp'; target: InteractiveLamp }
        | { type: 'door' };

    let nearestInteractable: Interactable | null = null;

    const handleInteraction = () => {
        if (dialogue.activeDialogue) {
            dialogue.advanceDialogue();
            return;
        }
        if (!nearestInteractable) return;
        if (nearestInteractable.type === 'npc') {
            const npc = nearestInteractable.target;
            if (npc.config.id === 'barnaby') {
                const lines = quest.getBarnabyLines();
                dialogue.startNpcDialogue(npc, player.pivot.position.x, lines, () => {
                    if (quest.state === 'available') quest.acceptQuest();
                    else if (quest.state === 'ready') quest.completeQuest();
                });
            } else {
                dialogue.startNpcDialogue(npc, player.pivot.position.x);
            }
        } else if (nearestInteractable.type === 'door') {
            player.clearClickTarget();
            interior.toggleInterior(player.pivot).then(() => {
                player.customWalkableCheck = interior.isInside
                    ? (x, z) => interior.getInteriorWalkableY(x, z)
                    : undefined;
                audio.playLampToggle(interior.isInside);
            });
        } else {
            const lamp = nearestInteractable.target;
            lamp.isOn = !lamp.isOn;
            audio.playLampToggle(lamp.isOn);
            player.spawnDust(lamp.x, 1.8, lamp.z);
        }
    };

    const dialogue = new DialogueSystem(handleInteraction, () => audio.playDialogueBlip());

    const input = new InputManager(
        engine.renderer.domElement,
        engine.camera,
        world.walkableFloors,
        () => dialogue.activeDialogue !== null
    );
    input.onMoveKeyStart = () => player.clearClickTarget();
    input.onGroundClick = (pt) => player.setClickTarget(pt);
    input.onInteractKey = handleInteraction;

    const envRefs = {
        engine,
        post,
        waterUniforms,
        cobbleMat: world.cobbleMat,
        windowGlassMat,
        mountainMeshes,
    };

    const applyEnv = () => {
        weather.applyState(envRefs);
    };

    const hud = new HudController({
        onAutoCycleChange: (enabled) => {
            weather.setAutoCycle(enabled);
            if (!enabled) applyEnv();
        },
        onMoodChange: (mood) => {
            weather.currentMoodKey = mood;
            applyEnv();
        },
        onWeatherChange: (w) => {
            weather.currentWeatherKey = w;
            applyEnv();
        },
        onToggleDof: (enabled) => {
            post.bokehPass.enabled = enabled;
        },
        onToggleRays: (enabled) => {
            post.raysGroup.visible = enabled;
        },
        onToggleBloom: (enabled) => {
            post.bloomPass.enabled = enabled;
        },
        onWindChange: (speed) => {
            weather.windSpeed = speed;
        },
        onResetHero: () => {
            if (interior.isInside) {
                interior.isInside = false;
                interior.interiorGroup.visible = false;
                player.customWalkableCheck = undefined;
            }
            player.resetPosition();
            engine.setCameraMode('follow');
            hud.setCameraButtons('follow');
        },
        onCameraModeChange: (mode) => {
            engine.setCameraMode(mode, player.pivot.position);
            hud.setCameraButtons(mode);
        },
    });

    window.addEventListener('resize', () => {
        engine.resize();
        post.resize();
    });

    applyEnv();
    hideLoadingOverlay();

    const clock = new THREE.Clock();
    const desiredCamPos = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();

    function animate(): void {
        requestAnimationFrame(animate);
        const dt = Math.min(clock.getDelta(), 0.05);
        const elapsed = clock.getElapsedTime();

        waterUniforms.uTime.value = elapsed;
        post.rayUniforms.uTime.value = elapsed;
        waterWheelGroup.rotation.x = elapsed * 1.15;

        const baseLampInt = weather.getActiveLampIntensity() * weather.currentLampBoost;
        const winEmissive = weather.getActiveWindowEmissive();
        interactiveLamps.forEach((lamp, idx) => {
            if (!lamp.isOn) {
                lamp.light.intensity = 0;
                lamp.bulbMat.emissiveIntensity = 0.05;
                return;
            }
            const flicker =
                Math.sin(elapsed * (7.0 + weather.windSpeed * 6.0) + idx * 2.1) * 0.14 * weather.windSpeed;
            lamp.light.intensity = Math.max(0.2, baseLampInt + flicker);
            lamp.bulbMat.emissiveIntensity = winEmissive * 1.15;
        });

        const bass = musicPlayer.getBassEnergy();
        shrineCrystal.rotation.y = elapsed * (1.4 + bass * 2.5);
        shrineCrystal.position.y = 1.45 + Math.sin(elapsed * 2.6) * 0.12 + bass * 0.14;
        const crystalScale = 1.0 + bass * 0.25;
        shrineCrystal.scale.setScalar(crystalScale);

        weather.update(dt, elapsed, engine.lightningLight, envRefs, (mKey, wKey) => {
            hud.highlightMoodButton(mKey);
            hud.highlightWeatherButton(wKey);
        });
        audio.updateAmbient(
            player.pivot.position.x,
            player.pivot.position.z,
            weather.getRainIntensity(),
            weather.windSpeed
        );

        let foundTarget: Interactable | null = null;
        let bestDist = 2.1;

        if (!interior.isInside) {
            npcList.forEach((npc) => {
                npc.update(dt, elapsed, engine.camera);
                if (npc.config.id === 'barnaby') {
                    npc.bubbleMesh.visible = quest.state !== 'completed';
                }
                const d = Math.hypot(
                    player.pivot.position.x - npc.config.x,
                    player.pivot.position.z - npc.config.z
                );
                if (d < bestDist) {
                    bestDist = d;
                    foundTarget = { type: 'npc', target: npc };
                }
            });

            if (!foundTarget) {
                const doorDist = Math.hypot(
                    player.pivot.position.x - interior.entrancePos.x,
                    player.pivot.position.z - interior.entrancePos.z
                );
                if (doorDist < 1.6) {
                    foundTarget = { type: 'door' };
                }
            }

            if (!foundTarget) {
                interactiveLamps.forEach((lamp) => {
                    const d = Math.hypot(player.pivot.position.x - lamp.x, player.pivot.position.z - lamp.z);
                    if (d < 1.75 && d < bestDist) {
                        bestDist = d;
                        foundTarget = { type: 'lamp', target: lamp };
                    }
                });
            }
        } else {
            const exitDist = Math.hypot(
                player.pivot.position.x - interior.exitPos.x,
                player.pivot.position.z - interior.exitPos.z
            );
            if (exitDist < 1.35) {
                foundTarget = { type: 'door' };
            }
        }

        nearestInteractable = foundTarget;
        if (nearestInteractable) {
            const t = nearestInteractable as Interactable;
            if (t.type === 'npc') {
                dialogue.setHint(
                    `Nhấn <span class="pixel-font text-amber-400 font-bold">[E]</span> hoặc chạm để trò chuyện với <b>${t.target.config.name}</b>`
                );
            } else if (t.type === 'door') {
                const label = interior.isInside ? 'Ra ngoài thị trấn' : 'Vào Quán Trọ Suối Bạc';
                dialogue.setHint(
                    `Nhấn <span class="pixel-font text-amber-400 font-bold">[E]</span> hoặc chạm để <b>${label}</b>`
                );
            } else {
                const stateTxt = t.target.isOn ? 'Tắt' : 'Bật';
                dialogue.setHint(
                    `Nhấn <span class="pixel-font text-amber-400 font-bold">[E]</span> hoặc chạm để <b>${stateTxt} ${t.target.name}</b>`
                );
            }
        } else {
            dialogue.setHint(null);
        }

        quest.update(elapsed, player.pivot.position, interior.isInside);
        interior.update(elapsed);
        minimap.render(player.pivot.position, npcList, quest.orbs, interior.isInside);

        dialogue.update(dt);
        animalList.forEach((a) => a.update(dt, elapsed, engine.camera, player.pivot.position));
        player.update(
            dt,
            elapsed,
            engine.camera,
            input.keysPressed,
            input.joystickInput,
            dialogue.activeDialogue !== null
        );

        if (engine.cameraMode === 'follow') {
            desiredCamPos.set(
                player.pivot.position.x * 0.82,
                player.pivot.position.y + 8.8,
                player.pivot.position.z + 15.2
            );
            engine.camera.position.lerp(desiredCamPos, 4.5 * dt);
            lookTarget.set(
                player.pivot.position.x,
                player.pivot.position.y + 0.85,
                player.pivot.position.z - 0.5
            );
            engine.camera.lookAt(lookTarget);
        } else {
            engine.controls.update();
        }
        engine.applyCameraShake(dt);

        const focusDist = engine.camera.position.distanceTo(player.pivot.position);
        post.setFocusDistance(focusDist);

        foliageSprites.forEach((item) => {
            item.mesh.quaternion.copy(engine.camera.quaternion);
            item.mesh.position.x =
                item.baseX +
                Math.sin(elapsed * (1.8 + weather.windSpeed * 1.1) + item.phase) * 0.08 * weather.windSpeed;
        });

        swayingBushes.forEach((b) => {
            b.mesh.quaternion.copy(engine.camera.quaternion);
            const distToPlayer = Math.hypot(
                player.pivot.position.x - b.baseX,
                player.pivot.position.z - b.mesh.position.z
            );
            const rustle = distToPlayer < 1.2 ? Math.sin(elapsed * 22.0 + b.phase) * 0.12 : 0;
            if (distToPlayer < 1.0 && Math.random() < dt * 8.0) {
                player.spawnDust(b.baseX, 0.75, b.mesh.position.z);
            }
            b.mesh.position.x =
                b.baseX +
                rustle +
                Math.sin(elapsed * (2.2 + weather.windSpeed * 1.2) + b.phase) * 0.06 * weather.windSpeed;
        });

        post.render();
    }

    animate();
}

bootstrap();
