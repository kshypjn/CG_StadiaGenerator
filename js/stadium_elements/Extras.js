import * as THREE from 'three';

// Helper to clear previous extras
function clearExtrasFromGroup(stadiumGroup, groupName) {
    const old = stadiumGroup.getObjectByName(groupName);
    if (old) {
        old.traverse(child => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => {
                            if (m.map) m.map.dispose();
                            m.dispose();
                        });
                    } else {
                        if (child.material.map) child.material.map.dispose();
                        child.material.dispose();
                    }
                }
            }
        });
        stadiumGroup.remove(old);
    }
}

// Create LED screen texture (fallback)
function createLEDScreenTexture(image = null) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const ledSize = 4;
    const ledSpacing = 1;
    const totalLedsX = Math.floor(canvas.width / (ledSize + ledSpacing));
    const totalLedsY = Math.floor(canvas.height / (ledSize + ledSpacing));
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (image) {
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        for (let y = 0; y < totalLedsY; y++) {
            for (let x = 0; x < totalLedsX; x++) {
                const pixelX = x * (ledSize + ledSpacing);
                const pixelY = y * (ledSize + ledSpacing);
                const imageData = ctx.getImageData(pixelX, pixelY, 1, 1).data;
                ctx.fillStyle = `rgba(${imageData[0]}, ${imageData[1]}, ${imageData[2]}, 0.8)`;
                ctx.beginPath();
                ctx.arc(
                    pixelX + ledSize/2,
                    pixelY + ledSize/2,
                    ledSize/2,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            }
        }
    } else {
        for (let y = 0; y < totalLedsY; y++) {
            for (let x = 0; x < totalLedsX; x++) {
                const pixelX = x * (ledSize + ledSpacing);
                const pixelY = y * (ledSize + ledSpacing);
                const hue = (x + y) % 360;
                ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.8)`;
                ctx.beginPath();
                ctx.arc(
                    pixelX + ledSize/2,
                    pixelY + ledSize/2,
                    ledSize/2,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            }
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 1);
    return texture;
}

let defaultAdMaterial = null;

// Cache materials to avoid recreating them constantly
let adMaterialCache = null;
const ribbonDisplayMaterials = {}; // Cache for ribbon displays, one per stand if needed

// Helper to generate canvas texture for ribbon display
function createRibbonDisplayTexture(width, height, params) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = Math.floor(height * 100);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = params.ribbonDisplayColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = params.ribbonDisplayTextColor;
    const fontSize = Math.max(16, Math.floor(canvas.height * 0.6));
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const scoreText = `${params.ribbonDisplayTeamA} ${params.ribbonDisplayScoreA} - ${params.ribbonDisplayScoreB} ${params.ribbonDisplayTeamB}`;
    const gameTimeText = params.ribbonDisplayGameTime;
    const textY = canvas.height / 2;
    ctx.fillText(scoreText, canvas.width / 2, textY);
    ctx.textAlign = 'right';
    ctx.fillText(gameTimeText, canvas.width - 20, textY);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
}

export function createStadiumExtras(allParams, stadiumGroup, standObjects = [], uploadedAdTexture = null) {
    clearExtrasFromGroup(stadiumGroup, 'ExtrasGroup');
    const extrasGroup = new THREE.Group();
    extrasGroup.name = 'ExtrasGroup';

    // --- ADVERTISING HOARDINGS ---
    if (allParams.showAdHoardings) {
        console.log("Creating ad hoardings...");
        const adHeight = allParams.adHoardingHeight;
        const adOffset = allParams.adHoardingOffsetFromPitch;
        const emissiveIntensity = allParams.adHoardingEmissiveIntensity || 1.0;
        let adMaterial;
        if (uploadedAdTexture) {
            adMaterial = new THREE.MeshStandardMaterial({
                map: uploadedAdTexture,
                side: THREE.DoubleSide,
                emissive: 0xffffff,
                emissiveIntensity: emissiveIntensity,
                emissiveMap: uploadedAdTexture
            });
        } else {
            if (!defaultAdMaterial || defaultAdMaterial.color.getHexString() !== allParams.adHoardingColor.substring(1) || defaultAdMaterial.emissiveIntensity !== emissiveIntensity) {
                if (defaultAdMaterial) {
                    if (defaultAdMaterial.map) defaultAdMaterial.map.dispose();
                    defaultAdMaterial.dispose();
                }
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 64;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = allParams.adHoardingColor;
                ctx.fillRect(0, 0, 256, 64);
                ctx.font = 'bold 20px sans-serif';
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                ctx.textAlign = 'center';
                ctx.fillText('STADIUM ADS', 128, 38);
                const defaultTex = new THREE.CanvasTexture(canvas);
                defaultTex.wrapS = THREE.RepeatWrapping;
                defaultTex.wrapT = THREE.RepeatWrapping;
                defaultAdMaterial = new THREE.MeshStandardMaterial({
                    map: defaultTex,
                    side: THREE.DoubleSide,
                    emissive: 0xffffff,
                    emissiveIntensity: emissiveIntensity,
                    emissiveMap: defaultTex
                });
            }
            adMaterial = defaultAdMaterial;
        }
        const l = allParams.pitchLength;
        const w = allParams.pitchWidth;
        const createAdHoarding = (width, height, position, rotationY) => {
            const geometry = new THREE.PlaneGeometry(width, height);
            const hoarding = new THREE.Mesh(geometry, adMaterial);
            hoarding.position.copy(position);
            hoarding.rotation.y = rotationY;
            // Adjust texture repeat for this specific hoarding
            if (adMaterial.map) {
                const clonedMaterial = adMaterial.clone();
                const texture = adMaterial.map.clone();
                texture.needsUpdate = true;
                const imageAspectRatio = texture.image ? texture.image.width / texture.image.height : 4;
                texture.repeat.set(width / (height * imageAspectRatio) * 2 , 1);
                clonedMaterial.map = texture;
                if (clonedMaterial.emissiveMap) {
                    const emissiveTex = clonedMaterial.emissiveMap.clone();
                    emissiveTex.needsUpdate = true;
                    emissiveTex.repeat.copy(texture.repeat);
                    clonedMaterial.emissiveMap = emissiveTex;
                }
                hoarding.material = clonedMaterial;
            }
            extrasGroup.add(hoarding);
            console.log("Added ad hoarding at:", hoarding.position);
        };
        // North
        createAdHoarding(l, adHeight, new THREE.Vector3(0, adHeight / 2 + 0.01, -w / 2 - adOffset), 0);
        // South
        createAdHoarding(l, adHeight, new THREE.Vector3(0, adHeight / 2 + 0.01, w / 2 + adOffset), Math.PI);
        // East
        createAdHoarding(w, adHeight, new THREE.Vector3(l / 2 + adOffset, adHeight / 2 + 0.01, 0), -Math.PI / 2);
        // West
        createAdHoarding(w, adHeight, new THREE.Vector3(-l / 2 - adOffset, adHeight / 2 + 0.01, 0), Math.PI / 2);
    }

    // --- RIBBON LED DISPLAYS ---
    if (allParams.showRibbonDisplays && standObjects.length >= 2) {
        // Find East and West stands by name
        const eastStandData = standObjects.find(s => s.name.toLowerCase().includes('eaststandgroup'));
        const westStandData = standObjects.find(s => s.name.toLowerCase().includes('weststandgroup'));
        const ribbonStands = [eastStandData, westStandData].filter(Boolean);

        ribbonStands.forEach(standData => {
            if (!standData || !standData.group.userData.totalProfileDepth) return;
            console.log('Ribbon standData:', standData);

            const ribbonWidth = standData.standLength;
            const ribbonHeight = allParams.ribbonDisplayHeight;
            const ribbonTexture = createRibbonDisplayTexture(ribbonWidth, ribbonHeight, allParams);
            const ribbonMaterial = new THREE.MeshStandardMaterial({
                map: ribbonTexture,
                side: THREE.DoubleSide,
                emissive: 0xffffff,
                emissiveMap: ribbonTexture,
                emissiveIntensity: allParams.ribbonDisplayEmissiveIntensity,
                metalness: 0.1,
                roughness: 0.8
            });
            const ribbonGeo = new THREE.PlaneGeometry(ribbonWidth, ribbonHeight);
            const ribbonMesh = new THREE.Mesh(ribbonGeo, ribbonMaterial);
            ribbonMesh.name = `RibbonDisplay_${standData.name}`;

            // Debug: force visible position
            let localPosX = standData.totalProfileDepth / 2;
            let localPosY = standData.totalProfileHeightAtBack + 5;
            let localPosZ = standData.standLength / 2;
            ribbonMesh.position.set(localPosX, localPosY, localPosZ);

            // Try different rotations if not visible
            ribbonMesh.rotation.y = Math.PI;

            // Add AxesHelper for debugging
            const ribbonAxesHelper = new THREE.AxesHelper(2);
            ribbonMesh.add(ribbonAxesHelper);

            // If not visible, try a basic material
            // Uncomment the next line to test with a solid color
            // ribbonMesh.material = new THREE.MeshBasicMaterial({ color: 0xff00ff, side: THREE.DoubleSide });

            standData.group.add(ribbonMesh);
            console.log('Ribbon mesh position:', ribbonMesh.position, 'rotation.y:', ribbonMesh.rotation.y);
        });
    }

    if (extrasGroup.children.length > 0 || allParams.showRibbonDisplays) {
        if(extrasGroup.children.length > 0 && extrasGroup.parent !== stadiumGroup) {
            stadiumGroup.add(extrasGroup);
        }
    }
}

// --- PARAMS SUGGESTIONS (add to main.js PARAMS and Tweakpane) ---
// showAdHoardings: true/false
// adHoardingHeight: 1
// adHoardingImage: null
// adHoardingOffsetFromPitch: 2
// adHoardingBrightness: 1.0
// adHoardingGlow: 0.2 