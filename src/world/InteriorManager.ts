import * as THREE from 'three';

export class InteriorManager {
    public isInside = false;
    public readonly interiorGroup = new THREE.Group();
    public readonly entrancePos = new THREE.Vector3(-6.5, 0.2, -1.0);
    public readonly exitPos = new THREE.Vector3(0, -29.8, 3.3);
    public floorMesh!: THREE.Mesh;

    private savedTownPos = new THREE.Vector3();
    private fadeEl = document.getElementById('scene-fade');
    private fireLight: THREE.PointLight;

    constructor(scene: THREE.Scene, walkableFloors: THREE.Object3D[]) {
        this.buildInnInterior(walkableFloors);
        this.interiorGroup.position.set(0, -30, 0); // Isolated below world
        this.interiorGroup.visible = false;
        scene.add(this.interiorGroup);

        this.fireLight = new THREE.PointLight(0xf97316, 2.4, 11, 1.4);
        this.fireLight.position.set(0, 1.5, -3.2);
        this.interiorGroup.add(this.fireLight);
    }

    private buildInnInterior(walkableFloors: THREE.Object3D[]): void {
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.78 });
        const wallMat = new THREE.MeshStandardMaterial({ color: 0xeadbc0, roughness: 0.85 });
        const timberMat = new THREE.MeshStandardMaterial({ color: 0x452815, roughness: 0.8 });
        const rugMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.9 });

        const floor = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.3, 8.2), floorMat);
        floor.position.set(0, 0.05, 0);
        floor.receiveShadow = true;
        this.interiorGroup.add(floor);
        this.floorMesh = floor;
        walkableFloors.push(floor);

        const rug = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.04, 3.2), rugMat);
        rug.position.set(0, 0.22, 0.2);
        rug.receiveShadow = true;
        this.interiorGroup.add(rug);

        // Back & Side Walls
        const backWall = new THREE.Mesh(new THREE.BoxGeometry(9.5, 4.0, 0.3), wallMat);
        backWall.position.set(0, 2.0, -4.0);
        this.interiorGroup.add(backWall);

        const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.0, 8.2), wallMat);
        leftWall.position.set(-4.6, 2.0, 0);
        this.interiorGroup.add(leftWall);

        const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.0, 8.2), wallMat);
        rightWall.position.set(4.6, 2.0, 0);
        this.interiorGroup.add(rightWall);

        // Stone Fireplace at Back Center
        const hearth = new THREE.Mesh(
            new THREE.BoxGeometry(2.2, 2.2, 0.9),
            new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 })
        );
        hearth.position.set(0, 1.1, -3.6);
        this.interiorGroup.add(hearth);

        const fireGlow = new THREE.Mesh(
            new THREE.BoxGeometry(1.1, 0.7, 0.3),
            new THREE.MeshStandardMaterial({
                color: 0xfdba74,
                emissive: 0xf97316,
                emissiveIntensity: 2.5,
            })
        );
        fireGlow.position.set(0, 0.55, -3.2);
        this.interiorGroup.add(fireGlow);

        // Bar Counter & Stools on Left
        const counter = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.0, 0.9), timberMat);
        counter.position.set(-2.5, 0.7, -2.2);
        this.interiorGroup.add(counter);

        // Round Table & Chairs on Right
        const table = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.12, 14), timberMat);
        table.position.set(2.4, 0.95, -0.8);
        this.interiorGroup.add(table);
        const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.75, 8), timberMat);
        tableLeg.position.set(2.4, 0.55, -0.8);
        this.interiorGroup.add(tableLeg);

        // Exit Mat at Front Door
        const exitMat = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 0.05, 0.9),
            new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85 })
        );
        exitMat.position.set(0, 0.22, 3.4);
        this.interiorGroup.add(exitMat);
    }

    public async toggleInterior(playerPivot: THREE.Group): Promise<void> {
        if (this.fadeEl) this.fadeEl.style.opacity = '1';
        await new Promise((r) => setTimeout(r, 260));

        if (!this.isInside) {
            this.savedTownPos.copy(playerPivot.position);
            this.isInside = true;
            this.interiorGroup.visible = true;
            playerPivot.position.set(0, -29.8, 2.8);
        } else {
            this.isInside = false;
            this.interiorGroup.visible = false;
            playerPivot.position.copy(this.savedTownPos);
        }

        if (this.fadeEl) this.fadeEl.style.opacity = '0';
    }

    public getInteriorWalkableY(x: number, z: number): number | null {
        if (x < -4.1 || x > 4.1 || z < -3.3 || z > 3.7) return null;
        if (x < -1.0 && z < -1.6) return null; // Counter collider
        if (Math.hypot(x - 2.4, z + 0.8) < 1.05) return null; // Table collider
        return -29.8;
    }

    public update(elapsed: number): void {
        if (!this.isInside) return;
        this.fireLight.intensity = 2.2 + Math.sin(elapsed * 12) * 0.35;
    }
}
