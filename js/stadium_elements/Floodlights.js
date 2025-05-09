import * as THREE from 'three';

// Store active lights and helpers for easy removal/disposal
let activeFloodlightStructuresGroup = null;
const activeSpotLights = [];
const activeSpotLightHelpers = [];

function clearPreviousFloodlights(stadiumGroup, scene) {
    if (activeFloodlightStructuresGroup) {
        activeFloodlightStructuresGroup.traverse(child => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });
        stadiumGroup.remove(activeFloodlightStructuresGroup);
        activeFloodlightStructuresGroup = null;
    }

    activeSpotLights.forEach(light => {
        if (light.parent) light.parent.remove(light);
        if (light.target && light.target.parent) light.target.parent.remove(light.target);
        if (light.dispose) light.dispose();
    });
    activeSpotLights.length = 0;

    activeSpotLightHelpers.forEach(helper => {
        if (helper.parent) helper.parent.remove(helper);
        if (helper.dispose) helper.dispose();
    });
    activeSpotLightHelpers.length = 0;
}

export function createStadiumFloodlights(allParams, stadiumGroup, scene) {
    clearPreviousFloodlights(stadiumGroup, scene);

    if (!allParams.showFloodlights) {
        console.log("Floodlights are turned off.");
        return;
    }

    activeFloodlightStructuresGroup = new THREE.Group();
    activeFloodlightStructuresGroup.name = 'FloodlightStructuresGroup';

    // Parameters from allParams
    const pitchL = allParams.pitchLength;
    const pitchW = allParams.pitchWidth;
    const standOffset = allParams.standOffsetFromPitch;
    const estimatedStandDepth = allParams.stands[0] ? (allParams.stands[0].numRows * allParams.stands[0].rowStepDepth) + allParams.stands[0].walkwayAtTopDepth : 20;
    const towerHeight = allParams.floodlightTowerHeight;
    const towerColor = new THREE.Color(allParams.floodlightTowerColor);
    const numLightsPerArray = allParams.numLightsPerTower;

    const spotlightColor = new THREE.Color(allParams.spotlightColorPreset);
    const spotlightIntensity = allParams.spotlightIntensity;
    const spotlightAngle = allParams.spotlightAngle;
    const spotlightPenumbra = allParams.spotlightPenumbra;
    const spotlightDistance = allParams.spotlightDistance;
    const showHelpers = allParams.showSpotlightHelpers;

    // --- Tower Positions ---
    const towerOffsetFactor = 1.2;
    const towerXOffset = pitchL / 2 + standOffset + estimatedStandDepth * 0.5 + 10 * towerOffsetFactor;
    const towerZOffset = pitchW / 2 + standOffset + estimatedStandDepth * 0.5 + 10 * towerOffsetFactor;

    const towerPositions = [
        new THREE.Vector3(towerXOffset, 0, towerZOffset),
        new THREE.Vector3(-towerXOffset, 0, towerZOffset),
        new THREE.Vector3(-towerXOffset, 0, -towerZOffset),
        new THREE.Vector3(towerXOffset, 0, -towerZOffset)
    ];

    const pitchCenterTarget = new THREE.Vector3(0, 0, 0);

    towerPositions.forEach((pos, towerIndex) => {
        // --- Floodlight Tower Pole ---
        const poleGeo = new THREE.CylinderGeometry(0.6, 0.9, towerHeight, 12);
        const poleMat = new THREE.MeshStandardMaterial({ color: towerColor, metalness: 0.6, roughness: 0.4 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(pos.x, towerHeight / 2, pos.z);
        pole.castShadow = true;
        activeFloodlightStructuresGroup.add(pole);

        // --- Light Array Structure (at top of pole) ---
        const lightArrayWidth = numLightsPerArray > 1 ? numLightsPerArray * 0.8 : 1.0;
        const lightArrayHeight = 1.0;
        const lightArrayDepth = 0.8;

        const lightArrayGeo = new THREE.BoxGeometry(lightArrayWidth, lightArrayHeight, lightArrayDepth);
        const lightArrayMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.7, roughness: 0.3 });
        const lightArrayMesh = new THREE.Mesh(lightArrayGeo, lightArrayMat);
        lightArrayMesh.position.set(0, towerHeight - lightArrayHeight / 2, 0);

        // Group for the array and its lights to orient them together
        const towerTopGroup = new THREE.Group();
        towerTopGroup.position.set(pos.x, 0, pos.z);
        towerTopGroup.lookAt(pitchCenterTarget);
        towerTopGroup.add(lightArrayMesh);

        // --- Create and Position Spotlights and Lamp Meshes ---
        for (let i = 0; i < numLightsPerArray; i++) {
            // Position lights along the width of the lightArrayMesh (its local X-axis)
            const lightLocalX = (numLightsPerArray === 1) ? 0 : (-lightArrayWidth / 2) + (lightArrayWidth / (numLightsPerArray)) * (i + 0.5);
            const lightLocalY = 0;
            const lightLocalZ = lightArrayDepth / 2 + 0.1;

            const spotLight = new THREE.SpotLight(
                spotlightColor,
                spotlightIntensity,
                spotlightDistance,
                spotlightAngle,
                spotlightPenumbra,
                1
            );

            // Position the spotlight in the light array's local space, then get world position
            const lightPositionInArraySpace = new THREE.Vector3(lightLocalX, lightLocalY, lightLocalZ);
            const worldLightPosition = lightArrayMesh.localToWorld(lightPositionInArraySpace.clone());
            spotLight.position.copy(worldLightPosition);
            spotLight.target.position.copy(pitchCenterTarget);

            scene.add(spotLight);
            scene.add(spotLight.target);
            activeSpotLights.push(spotLight);

            // --- Visible Lamp Mesh ---
            const lampRadius = 0.2;
            const lampLength = 0.4;
            const lampGeo = new THREE.CylinderGeometry(lampRadius, lampRadius * 0.8, lampLength, 8);
            const lampMat = new THREE.MeshStandardMaterial({
                color: 0x222222,
                emissive: spotlightColor,
                emissiveIntensity: spotLight.intensity > 0 ? 0.5 : 0
            });
            const lampMesh = new THREE.Mesh(lampGeo, lampMat);
            lampMesh.position.copy(lightPositionInArraySpace);
            lampMesh.lookAt(new THREE.Vector3(0,0,0));
            lightArrayMesh.add(lampMesh);

            if (showHelpers) {
                const helper = new THREE.SpotLightHelper(spotLight);
                scene.add(helper);
                activeSpotLightHelpers.push(helper);
            }
        }
        activeFloodlightStructuresGroup.add(towerTopGroup);
    });

    stadiumGroup.add(activeFloodlightStructuresGroup);
    console.log("Floodlights generated with", activeSpotLights.length, "spotlights.");
} 