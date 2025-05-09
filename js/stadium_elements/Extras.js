import * as THREE from 'three';

// Helper to clear previous extras
function clearExtrasFromGroup(stadiumGroup, groupName) {
    const old = stadiumGroup.getObjectByName(groupName);
    if (old) stadiumGroup.remove(old);
}

// Main function to create extras
export function createStadiumExtras(allParams, stadiumGroup, standObjects = []) {
    // --- Clear previous extras ---
    clearExtrasFromGroup(stadiumGroup, 'ExtrasGroup');
    const extrasGroup = new THREE.Group();
    extrasGroup.name = 'ExtrasGroup';

    // --- SCOREBOARD ---
    if (allParams.showScoreboard) {
        let scoreboardPos, scoreboardRotY = 0;
        const scoreboardWidth = allParams.scoreboardWidth;
        const scoreboardHeight = allParams.scoreboardHeight;
        let scoreboardStand = standObjects && standObjects[allParams.scoreboardStandIndex];

        if (scoreboardStand) {
            console.log("Placing scoreboard relative to stand:", scoreboardStand.name);
            const stand = scoreboardStand;

            // Position relative to the stand's BACK-CENTER-TOP
            // The standGroup's origin is at its extrusion start & profile (0,0).
            // Its length is along its local Z (before world rotation). Its depth is local X.

            // Calculate local position in stand's space
            const localScoreboardPos = new THREE.Vector3(
                stand.totalProfileDepth + allParams.scoreboardOffsetFromStandBack, // X: At the back of stand profile + offset
                stand.totalProfileHeightAtBack + allParams.scoreboardHeightOffset + (scoreboardHeight / 2), // Y: Top of stand + offset + half height
                stand.standLength / 2 // Z: Middle of the stand's length
            );

            // Transform local position to world space using stand's world matrix
            const standWorldMatrix = stand.group.matrixWorld.clone();
            scoreboardPos = localScoreboardPos.applyMatrix4(standWorldMatrix);

            // Scoreboard should face the pitch center
            scoreboardRotY = stand.rotationY + Math.PI; // Rotate 180° from stand's orientation to face pitch

            console.log("Scoreboard position:", scoreboardPos, "Rotation Y:", scoreboardRotY);
        } else {
            console.warn("Scoreboard stand not found or standObjects empty. Placing at default.");
            // Fallback: place at one end of the pitch, facing inwards
            scoreboardPos = new THREE.Vector3(0, 5 + scoreboardHeight / 2, -PARAMS.pitchWidth / 2 - (PARAMS.standOffsetFromPitch + 5));
            scoreboardRotY = 0;
        }

        // Create scoreboard material
        let scoreboardMaterial;
        if (allParams.scoreboardTexturePath) {
            scoreboardMaterial = new THREE.MeshStandardMaterial({ color: 0x222244, side: THREE.DoubleSide });
        } else {
            const canvas = document.createElement('canvas');
            canvas.width = 512; canvas.height = 256;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#222244'; ctx.fillRect(0, 0, 512, 256);
            ctx.font = 'bold 60px Arial'; ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('SCORE', 256, 100);
            ctx.font = '40px Arial';
            ctx.fillText('0 - 0', 256, 180);
            const tex = new THREE.CanvasTexture(canvas);
            scoreboardMaterial = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide });
        }

        const scoreboardGeo = new THREE.PlaneGeometry(scoreboardWidth, scoreboardHeight);
        const scoreboardMesh = new THREE.Mesh(scoreboardGeo, scoreboardMaterial);
        scoreboardMesh.position.copy(scoreboardPos);
        scoreboardMesh.rotation.y = scoreboardRotY;
        scoreboardMesh.castShadow = true;
        extrasGroup.add(scoreboardMesh);
        console.log("Scoreboard added to extrasGroup.");
    }

    // --- ADVERTISING HOARDINGS ---
    if (allParams.showAdHoardings) {
        const adHeight = allParams.adHoardingHeight;
        const adOffset = allParams.adHoardingOffsetFromPitch;
        const adMaterial = (() => {
            if (allParams.adHoardingTexturePath) {
                // const texLoader = new THREE.TextureLoader();
                // const tex = texLoader.load(allParams.adHoardingTexturePath);
                // tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
                // tex.repeat.set(4, 1); // Repeat texture
                // return new THREE.MeshBasicMaterial({ map: tex });
                return new THREE.MeshBasicMaterial({ color: 0x00aaff });
            } else {
                // Placeholder: blue with white stripes
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 32;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#00aaff'; ctx.fillRect(0, 0, 256, 32);
                ctx.strokeStyle = '#fff';
                for (let i = 0; i < 8; i++) ctx.strokeRect(i*32, 0, 16, 32);
                const tex = new THREE.CanvasTexture(canvas);
                tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
                tex.repeat.set(4, 1);
                return new THREE.MeshBasicMaterial({ map: tex });
            }
        })();
        // Four sides
        const l = allParams.pitchLength, w = allParams.pitchWidth;
        const adThickness = 0.1;
        // North (behind top goal)
        const northAd = new THREE.Mesh(new THREE.PlaneGeometry(l, adHeight), adMaterial);
        northAd.position.set(0, adHeight / 2, -w / 2 - adOffset);
        northAd.rotation.y = 0;
        extrasGroup.add(northAd);
        // South (behind bottom goal)
        const southAd = new THREE.Mesh(new THREE.PlaneGeometry(l, adHeight), adMaterial);
        southAd.position.set(0, adHeight / 2, w / 2 + adOffset);
        southAd.rotation.y = Math.PI;
        extrasGroup.add(southAd);
        // East (right touchline)
        const eastAd = new THREE.Mesh(new THREE.PlaneGeometry(w, adHeight), adMaterial);
        eastAd.position.set(l / 2 + adOffset, adHeight / 2, 0);
        eastAd.rotation.y = -Math.PI / 2;
        extrasGroup.add(eastAd);
        // West (left touchline)
        const westAd = new THREE.Mesh(new THREE.PlaneGeometry(w, adHeight), adMaterial);
        westAd.position.set(-l / 2 - adOffset, adHeight / 2, 0);
        westAd.rotation.y = Math.PI / 2;
        extrasGroup.add(westAd);
    }

    stadiumGroup.add(extrasGroup);
}

// --- PARAMS SUGGESTIONS (add to main.js PARAMS and Tweakpane) ---
// showScoreboard: true/false
// scoreboardWidth: 6
// scoreboardHeight: 2.5
// scoreboardTexturePath: ''
// scoreboardHeightOffset: 2
// scoreboardStandIndex: 2 (0=East, 1=West, 2=North, 3=South)
// scoreboardOffsetFromStandBack: 1
// showAdHoardings: true/false
// adHoardingHeight: 1
// adHoardingTexturePath: ''
// adHoardingOffsetFromPitch: 2 