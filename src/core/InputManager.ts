import * as THREE from 'three';

export class InputManager {
    public readonly keysPressed: Record<string, boolean> = {};
    public joystickInput = { x: 0, z: 0 };
    public onGroundClick?: (point: THREE.Vector3) => void;
    public onInteractKey?: () => void;
    public onMoveKeyStart?: () => void;

    private raycaster = new THREE.Raycaster();
    private pointerNDC = new THREE.Vector2();
    private pointerDownPos = { x: 0, y: 0 };
    private joystickActive = false;

    constructor(
        domElement: HTMLElement,
        camera: THREE.Camera,
        walkableFloors: THREE.Object3D[],
        isBlocked: () => boolean
    ) {
        window.addEventListener('keydown', (e) => {
            this.keysPressed[e.code] = true;
            if (
                ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
                    e.code
                )
            ) {
                this.onMoveKeyStart?.();
            }
            if (e.code === 'KeyE' || e.code === 'Space') {
                this.onInteractKey?.();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keysPressed[e.code] = false;
        });

        domElement.addEventListener('pointerdown', (e) => {
            this.pointerDownPos = { x: e.clientX, y: e.clientY };
        });

        domElement.addEventListener('pointerup', (e) => {
            if (isBlocked()) return;
            const moveDist = Math.hypot(
                e.clientX - this.pointerDownPos.x,
                e.clientY - this.pointerDownPos.y
            );
            if (moveDist > 6) return;

            this.pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
            this.raycaster.setFromCamera(this.pointerNDC, camera);

            const hits = this.raycaster.intersectObjects(walkableFloors, false);
            if (hits.length > 0) {
                this.onGroundClick?.(hits[0].point);
            }
        });

        this.bindJoystick();
    }

    private bindJoystick(): void {
        const joystickZone = document.getElementById('joystick-zone')!;
        const joystickKnob = document.getElementById('joystick-knob')!;

        const updateJoystick = (clientX: number, clientY: number) => {
            const rect = joystickZone.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const maxR = rect.width * 0.36;
            let dx = clientX - centerX;
            let dy = clientY - centerY;
            const dist = Math.hypot(dx, dy);
            if (dist > maxR) {
                dx = (dx / dist) * maxR;
                dy = (dy / dist) * maxR;
            }
            joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
            this.joystickInput.x = dx / maxR;
            this.joystickInput.z = dy / maxR;
            if (dist > 4) {
                this.onMoveKeyStart?.();
            }
        };

        const resetJoystick = () => {
            this.joystickActive = false;
            this.joystickInput = { x: 0, z: 0 };
            joystickKnob.style.transform = 'translate(0px, 0px)';
        };

        joystickZone.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            this.joystickActive = true;
            joystickZone.setPointerCapture(e.pointerId);
            updateJoystick(e.clientX, e.clientY);
        });
        joystickZone.addEventListener('pointermove', (e) => {
            if (!this.joystickActive) return;
            e.stopPropagation();
            updateJoystick(e.clientX, e.clientY);
        });
        joystickZone.addEventListener('pointerup', resetJoystick);
        joystickZone.addEventListener('pointercancel', resetJoystick);
    }
}
