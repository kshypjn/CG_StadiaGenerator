import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Pane } from 'tweakpane';

import { generateAllStands } from './js/stadium_elements/Stands.js'; 
import { createStadiumExtras } from './js/stadium_elements/Extras.js';
import { createStadiumFloodlights } from './js/stadium_elements/Floodlights.js';

let scene, camera, renderer, controls;
let stadiumGroup;
let customAdHoardingTexture = null; // To store the uploaded texture

const PARAMS = {
    pitchLength: 100.6,
    pitchWidth: 64.0,   
    lineWidth: 0.15,
    showPitch: true,
    stadiumType: 'football',
    // --- Global Stand Settings ---
    showStands: true,
    standOffsetFromPitch: 5,
    standFrontWallHeight: 1,
    standNumRows: 20,
    standRowStepHeight: 0.4,
    standRowStepDepth: 0.8,
    standWalkwayAtTopDepth: 2,
    standBackWallHeight: 3,
    standColor: '#888888',
    // --- Individual Stand Control ---
    useIndividualStandSettings: false,
    stands: [
        { name: 'East Stand', show: true, offsetFromPitch: 1, frontWallHeight: 1, numRows: 20, rowStepHeight: 0.4, rowStepDepth: 0.8, walkwayAtTopDepth: 2, backWallHeight: 3, color: '#888888' },
        { name: 'West Stand', show: true, offsetFromPitch: 1, frontWallHeight: 1, numRows: 20, rowStepHeight: 0.4, rowStepDepth: 0.8, walkwayAtTopDepth: 2, backWallHeight: 3, color: '#888888' },
        { name: 'North Stand', show: true, offsetFromPitch: 1, frontWallHeight: 1, numRows: 20, rowStepHeight: 0.4, rowStepDepth: 0.8, walkwayAtTopDepth: 2, backWallHeight: 3, color: '#888888' },
        { name: 'South Stand', show: true, offsetFromPitch: 1, frontWallHeight: 1, numRows: 20, rowStepHeight: 0.4, rowStepDepth: 0.8, walkwayAtTopDepth: 2, backWallHeight: 3, color: '#888888' }
    ],
    // --- Roof Settings ---
    roofType: 'individual', // 'none', 'overall', 'individual' (default: individual)
    // Overall roof params
    overallRoofHeight: 35,
    overallRoofOverhang: 5,
    overallRoofColor: '#777777',
    overallRoofOpacity: 0.9,
    // Individual roof params
    individualRoofEnable: true,
    individualRoofHeightOffset: 2,
    individualRoofCoverageFactor: 0.75, // Roof covers 75% of the stand's profile depth
    individualRoofMinCoverage: 5,    // Minimum physical depth the roof will cover
    individualRoofMaxCoverage: 40,   // Maximum physical depth the roof will cover
    individualRoofTilt: Math.PI / 18,
    individualRoofThickness: 0.5,
    individualRoofColor: '#999999',
    supportColor: '#555555',
    // --- Extras (Ad Hoardings) ---
    showAdHoardings: true,
    adHoardingHeight: 1,
    adHoardingOffsetFromPitch: 2,
    adHoardingColor: '#00aaff', // Default color if no texture
    adHoardingEmissiveIntensity: 0.5, // For LED glow effect
    // --- Floodlights ---
    showFloodlights: true,
    floodlightTowerHeight: 38,
    floodlightTowerColor: '#cccccc',
    numLightsPerTower: 3, // Lowered for performance
    spotlightColorPreset: 0xfff8e1, // default: Warm White
    spotlightIntensity: 2.5,
    spotlightAngle: Math.PI / 7,
    spotlightPenumbra: 0.3,
    spotlightDistance: 250,
    showSpotlightHelpers: false, // Default off for performance
    // --- Ribbon Display / LED Strip Scoreboard Settings ---
    showRibbonDisplays: true,
    ribbonDisplayHeight: 0.8, // Height of the LED strip
    ribbonDisplayTier: 'lower_back', // 'lower_back', 'upper_front'
    ribbonDisplayOffsetY: 0.2, // Fine-tune Y position
    ribbonDisplayColor: '#101028',
    ribbonDisplayTextColor: '#FFFFFF',
    ribbonDisplayTeamA: 'HOME',
    ribbonDisplayScoreA: 0,
    ribbonDisplayTeamB: 'AWAY',
    ribbonDisplayScoreB: 0,
    ribbonDisplayGameTime: "00:00",
    ribbonDisplayEmissiveIntensity: 0.7,
};

// --- INITIALIZATION ---
function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Sky blue

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 100, 200); // Adjusted position to see more of the stadium
    camera.lookAt(0, 0, 0);

    // Renderer
    const container = document.getElementById('container');
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Lower pixel ratio for performance
    renderer.shadowMap.enabled = false; // Disable shadows for performance
    container.appendChild(renderer.domElement);

    // Add debug logging
    console.log('Initializing scene...');
    console.log('Container element:', container);
    console.log('Renderer canvas:', renderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 20;
    controls.maxDistance = 500;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 75);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -150;
    directionalLight.shadow.camera.right = 150;
    directionalLight.shadow.camera.top = 150;
    directionalLight.shadow.camera.bottom = -150;
    scene.add(directionalLight);

    // Stadium Group
    stadiumGroup = new THREE.Group();
    scene.add(stadiumGroup);

    // --- TWEAKPANE UI ---
    const pane = new Pane({ title: 'Stadium Controls' });
    const pitchFolder = pane.addFolder({ title: 'Pitch' });
    pitchFolder.addBinding(PARAMS, 'showPitch').on('change', regenerateStadium);
    // --- Stands Global ---
    const standsFolder = pane.addFolder({ title: 'Stands Global Settings' });
    standsFolder.addBinding(PARAMS, 'showStands').on('change', regenerateStadium);
    standsFolder.addBinding(PARAMS, 'standOffsetFromPitch', { min: 1, max: 20, step: 0.5 }).on('change', regenerateStadium);
    standsFolder.addBinding(PARAMS, 'standFrontWallHeight', { min: 0.2, max: 3, step: 0.1 }).on('change', regenerateStadium);
    standsFolder.addBinding(PARAMS, 'standNumRows', { min: 5, max: 60, step: 1 }).on('change', regenerateStadium);
    standsFolder.addBinding(PARAMS, 'standRowStepHeight', { min: 0.2, max: 1, step: 0.05 }).on('change', regenerateStadium);
    standsFolder.addBinding(PARAMS, 'standRowStepDepth', { min: 0.5, max: 1.5, step: 0.05 }).on('change', regenerateStadium);
    standsFolder.addBinding(PARAMS, 'standWalkwayAtTopDepth', { min: 0, max: 10, step: 0.5 }).on('change', regenerateStadium);
    standsFolder.addBinding(PARAMS, 'standBackWallHeight', { min: 0, max: 10, step: 0.5 }).on('change', regenerateStadium);
    standsFolder.addBinding(PARAMS, 'standColor', { view: 'color' }).on('change', regenerateStadium);

    // --- Individual Stand Settings (nested under Stands) ---
    const individualToggle = standsFolder.addBinding(PARAMS, 'useIndividualStandSettings', { label: 'Enable Individual Stands' });
    const individualStandFolders = [];
    PARAMS.stands.forEach((standParams, index) => {
        const individualStandFolder = standsFolder.addFolder({
            title: `${standParams.name} Settings`,
            expanded: false
        });
        individualStandFolder.addBinding(standParams, 'show').on('change', regenerateStadium);
        individualStandFolder.addBinding(standParams, 'offsetFromPitch', { min: 1, max: 20, step: 0.5 }).on('change', regenerateStadium);
        individualStandFolder.addBinding(standParams, 'frontWallHeight', { min: 0.2, max: 3, step: 0.1 }).on('change', regenerateStadium);
        individualStandFolder.addBinding(standParams, 'numRows', { min: 5, max: 60, step: 1 }).on('change', regenerateStadium);
        individualStandFolder.addBinding(standParams, 'rowStepHeight', { min: 0.2, max: 1, step: 0.05 }).on('change', regenerateStadium);
        individualStandFolder.addBinding(standParams, 'rowStepDepth', { min: 0.5, max: 1.5, step: 0.05 }).on('change', regenerateStadium);
        individualStandFolder.addBinding(standParams, 'walkwayAtTopDepth', { min: 0, max: 10, step: 0.5 }).on('change', regenerateStadium);
        individualStandFolder.addBinding(standParams, 'backWallHeight', { min: 0, max: 10, step: 0.5 }).on('change', regenerateStadium);
        individualStandFolder.addBinding(standParams, 'color', { view: 'color' }).on('change', regenerateStadium);
        individualStandFolders.push(individualStandFolder);
    });
    // Show/hide individual stand folders based on toggle
    function updateIndividualFoldersVisibility() {
        individualStandFolders.forEach(folder => {
            folder.hidden = !PARAMS.useIndividualStandSettings;
        });
    }
    updateIndividualFoldersVisibility();
    individualToggle.on('change', updateIndividualFoldersVisibility);

    // --- Roof Controls ---
    const roofFolder = pane.addFolder({ title: 'Roof Settings' });
    roofFolder.addBinding(PARAMS, 'roofType', {
        options: { None: 'none', Overall: 'overall', Individual: 'individual' }
    }).on('change', regenerateStadium);
    // Overall roof controls
    const overallRoofFolder = roofFolder.addFolder({ title: 'Overall Roof' });
    overallRoofFolder.addBinding(PARAMS, 'overallRoofHeight', { min: 10, max: 70, step: 1 }).on('change', regenerateStadium);
    overallRoofFolder.addBinding(PARAMS, 'overallRoofOverhang', { min: 0, max: 20, step: 0.5 }).on('change', regenerateStadium);
    overallRoofFolder.addBinding(PARAMS, 'overallRoofColor', { view: 'color' }).on('change', regenerateStadium);
    overallRoofFolder.addBinding(PARAMS, 'overallRoofOpacity', { min: 0.1, max: 1.0, step: 0.05 }).on('change', regenerateStadium);
    // Individual roof controls
    const individualRoofFolder = roofFolder.addFolder({ title: 'Individual Roofs' });
    individualRoofFolder.addBinding(PARAMS, 'individualRoofEnable').on('change', regenerateStadium);
    individualRoofFolder.addBinding(PARAMS, 'individualRoofHeightOffset', { min: -5, max: 10, step: 0.1 }).on('change', regenerateStadium);
    individualRoofFolder.addBinding(PARAMS, 'individualRoofCoverageFactor', { min: 0.1, max: 1.2, step: 0.05, label: 'Coverage Factor' }).on('change', regenerateStadium);
    individualRoofFolder.addBinding(PARAMS, 'individualRoofMinCoverage', { min: 1, max: 20, step: 0.5, label: 'Min Coverage (m)' }).on('change', regenerateStadium);
    individualRoofFolder.addBinding(PARAMS, 'individualRoofMaxCoverage', { min: 5, max: 60, step: 0.5, label: 'Max Coverage (m)' }).on('change', regenerateStadium);
    individualRoofFolder.addBinding(PARAMS, 'individualRoofTilt', { min: 0, max: Math.PI / 4, step: 0.01 }).on('change', regenerateStadium);
    individualRoofFolder.addBinding(PARAMS, 'individualRoofThickness', { min: 0.1, max: 2, step: 0.05 }).on('change', regenerateStadium);
    individualRoofFolder.addBinding(PARAMS, 'individualRoofColor', { view: 'color' }).on('change', regenerateStadium);
    individualRoofFolder.addBinding(PARAMS, 'supportColor', { view: 'color', label: 'Support Color' }).on('change', regenerateStadium);

    // --- Extras Controls ---
    const extrasFolder = pane.addFolder({ title: 'Extras' });
    const adFolder = extrasFolder.addFolder({ title: 'Ad Hoardings' });
    adFolder.addBinding(PARAMS, 'showAdHoardings').on('change', regenerateStadium);
    adFolder.addBinding(PARAMS, 'adHoardingHeight', { min: 0.5, max: 3, step: 0.05 }).on('change', regenerateStadium);
    adFolder.addBinding(PARAMS, 'adHoardingOffsetFromPitch', { min: 0.5, max: 10, step: 0.1 }).on('change', regenerateStadium);
    adFolder.addBinding(PARAMS, 'adHoardingColor', { view: 'color', label: 'Default Color' }).on('change', regenerateStadium);
    adFolder.addBinding(PARAMS, 'adHoardingEmissiveIntensity', { min: 0, max: 2, step: 0.05, label: 'LED Glow' }).on('change', regenerateStadium);

    // --- Ribbon LED Displays Controls ---
    const ribbonFolder = extrasFolder.addFolder({ title: 'Ribbon LED Displays' });
    ribbonFolder.addBinding(PARAMS, 'showRibbonDisplays').on('change', regenerateStadium);
    ribbonFolder.addBinding(PARAMS, 'ribbonDisplayHeight', { min: 0.3, max: 2.0, step: 0.05 }).on('change', regenerateStadium);
    ribbonFolder.addBinding(PARAMS, 'ribbonDisplayTier', { options: { 'Lower Tier Back': 'lower_back', 'Upper Tier Front': 'upper_front'} }).on('change', regenerateStadium);
    ribbonFolder.addBinding(PARAMS, 'ribbonDisplayOffsetY', { min: -1, max: 2, step: 0.05 }).on('change', regenerateStadium);
    ribbonFolder.addBinding(PARAMS, 'ribbonDisplayColor', { view: 'color' }).on('change', regenerateStadium);
    ribbonFolder.addBinding(PARAMS, 'ribbonDisplayTextColor', { view: 'color' }).on('change', regenerateStadium);
    ribbonFolder.addBinding(PARAMS, 'ribbonDisplayTeamA', {label: 'Team A Name'}).on('change', regenerateStadium);
    ribbonFolder.addBinding(PARAMS, 'ribbonDisplayScoreA', { min: 0, max: 99, step: 1, label: 'Team A Score' }).on('change', regenerateStadium);
    ribbonFolder.addBinding(PARAMS, 'ribbonDisplayTeamB', {label: 'Team B Name'}).on('change', regenerateStadium);
    ribbonFolder.addBinding(PARAMS, 'ribbonDisplayScoreB', { min: 0, max: 99, step: 1, label: 'Team B Score' }).on('change', regenerateStadium);
    ribbonFolder.addBinding(PARAMS, 'ribbonDisplayGameTime', {label: 'Game Time/Msg'}).on('change', regenerateStadium);
    ribbonFolder.addBinding(PARAMS, 'ribbonDisplayEmissiveIntensity', { min: 0, max: 2, step: 0.05 }).on('change', regenerateStadium);

    // --- Floodlights Controls ---
    const floodFolder = pane.addFolder({ title: 'Floodlights' });
    floodFolder.addBinding(PARAMS, 'showFloodlights').on('change', regenerateStadium);
    floodFolder.addBinding(PARAMS, 'floodlightTowerHeight', { min: 20, max: 60, step: 1 }).on('change', regenerateStadium);
    floodFolder.addBinding(PARAMS, 'floodlightTowerColor', { view: 'color' }).on('change', regenerateStadium);
    floodFolder.addBinding(PARAMS, 'numLightsPerTower', { min: 1, max: 12, step: 1 }).on('change', regenerateStadium);
    floodFolder.addBinding(PARAMS, 'spotlightColorPreset', {
        options: {
            'Warm White': 0xfff8e1,
            'Cool White': 0xe0f0ff,
            'Stadium Yellow': 0xfffeca
        }
    }).on('change', regenerateStadium);
    floodFolder.addBinding(PARAMS, 'spotlightIntensity', { min: 0.1, max: 10, step: 0.1 }).on('change', regenerateStadium);
    floodFolder.addBinding(PARAMS, 'spotlightAngle', { min: Math.PI/16, max: Math.PI/3, step: 0.01 }).on('change', regenerateStadium);
    floodFolder.addBinding(PARAMS, 'spotlightPenumbra', { min: 0, max: 1, step: 0.01 }).on('change', regenerateStadium);
    floodFolder.addBinding(PARAMS, 'spotlightDistance', { min: 50, max: 500, step: 1 }).on('change', regenerateStadium);
    floodFolder.addBinding(PARAMS, 'showSpotlightHelpers').on('change', regenerateStadium);

    // --- Tweakpane Image Upload Button ---
    // Create a hidden file input for image upload
    const hiddenAdInput = document.createElement('input');
    hiddenAdInput.type = 'file';
    hiddenAdInput.accept = 'image/png, image/jpeg, image/jpg';
    hiddenAdInput.style.display = 'none';
    document.body.appendChild(hiddenAdInput);

    // Add upload button to Tweakpane
    const uploadBtn = adFolder.addButton({ title: 'Upload Ad Image' });
    uploadBtn.on('click', () => {
        hiddenAdInput.click();
    });

    hiddenAdInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const textureLoader = new THREE.TextureLoader();
                textureLoader.load(e.target.result, (texture) => {
                    if (customAdHoardingTexture) {
                        customAdHoardingTexture.dispose();
                    }
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.needsUpdate = true;
                    customAdHoardingTexture = texture;
                    PARAMS.adHoardingImage = null;
                    regenerateStadium();
                });
            };
            reader.readAsDataURL(file);
        }
    });

    // Add clear button to Tweakpane
    const clearBtn = adFolder.addButton({ title: 'Clear Ad Image' });
    clearBtn.on('click', () => {
        if (customAdHoardingTexture) {
            customAdHoardingTexture.dispose();
            customAdHoardingTexture = null;
        }
        hiddenAdInput.value = '';
        regenerateStadium();
    });

    // Initial generation
    regenerateStadium();

    window.addEventListener('resize', onWindowResize, false);
    animate();
}

// --- WINDOW RESIZE ---
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    // If you want to update helpers, do it only if showSpotlightHelpers is true and only for visible helpers
    // (No per-frame helper updates for performance)
    renderer.render(scene, camera);
}

// --- STADIUM GENERATION LOGIC ---
function regenerateStadium() {
    console.log('Regenerating stadium...');
    // Clear previous stadium
    while (stadiumGroup.children.length > 0) {
        const child = stadiumGroup.children[0];
        stadiumGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
            } else {
                child.material.dispose();
            }
        }
    }

    if (PARAMS.showPitch) {
        console.log('Creating pitch...');
        createPitch();
    }

    // Use the imported function to generate stands
    if (PARAMS.showStands) {
        console.log('Generating stands...');
        generateAllStands(PARAMS, stadiumGroup);
    }
    
    // --- Collect standObjects for Extras.js ---
    let standObjects = [];
    console.log("Collecting stand objects for extras...");
    stadiumGroup.children.forEach(child => {
        if (child.isGroup && child.name && child.name.endsWith('StandGroup')) {
            if (child.userData && child.userData.standLength !== undefined) {
                standObjects.push({
                    name: child.name,
                    group: child,
                    position: child.position.clone(),
                    rotationY: child.rotation.y,
                    standLength: child.userData.standLength,
                    totalProfileDepth: child.userData.totalProfileDepth,
                    totalProfileHeightAtBack: child.userData.totalProfileHeightAtBack
                });
                console.log(`Collected stand object: ${child.name}`, {
                    position: child.position,
                    rotationY: child.rotation.y,
                    userData: child.userData
                });
            } else {
                console.warn(`StandGroup ${child.name} is missing expected userData properties:`, child.userData);
            }
        }
    });
    console.log("Stand objects collected for extras:", standObjects);
    console.log("Extras parameters:", {
        showAdHoardings: PARAMS.showAdHoardings,
        adHoardingHeight: PARAMS.adHoardingHeight,
        adHoardingOffsetFromPitch: PARAMS.adHoardingOffsetFromPitch
    });
    createStadiumExtras(PARAMS, stadiumGroup, standObjects, customAdHoardingTexture);
    createStadiumFloodlights(PARAMS, stadiumGroup, scene);
    
    console.log('Stadium group children:', stadiumGroup.children.length);
}

// --- PITCH CREATION ---
function createPitch() {
    const pitchMaterial = new THREE.MeshStandardMaterial({ color: 0x008000, side: THREE.DoubleSide });
    const pitchGeometry = new THREE.PlaneGeometry(PARAMS.pitchLength, PARAMS.pitchWidth);
    const pitchMesh = new THREE.Mesh(pitchGeometry, pitchMaterial);
    pitchMesh.rotation.x = -Math.PI / 2;
    pitchMesh.receiveShadow = true;
    stadiumGroup.add(pitchMesh);

    const lineMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    function createLine(width, height, depth, x, y, z, rotationY = 0) {
        const lineGeo = new THREE.BoxGeometry(width, height, depth);
        const line = new THREE.Mesh(lineGeo, lineMaterial);
        line.position.set(x, y + PARAMS.lineWidth / 2 + 0.001, z);
        line.rotation.y = rotationY;
        line.castShadow = false;
        stadiumGroup.add(line);
    }
    const halfL = PARAMS.pitchLength / 2;
    const halfW = PARAMS.pitchWidth / 2;

    // Boundary lines
    createLine(PARAMS.pitchLength, PARAMS.lineWidth, PARAMS.lineWidth, 0, 0, halfW);
    createLine(PARAMS.pitchLength, PARAMS.lineWidth, PARAMS.lineWidth, 0, 0, -halfW);
    createLine(PARAMS.lineWidth, PARAMS.lineWidth, PARAMS.pitchWidth, halfL, 0, 0);
    createLine(PARAMS.lineWidth, PARAMS.lineWidth, PARAMS.pitchWidth, -halfL, 0, 0);
    createLine(PARAMS.lineWidth, PARAMS.lineWidth, PARAMS.pitchWidth, 0, 0, 0);

    // Center circle
    const centerCircleRadius = 9.15;
    const segments = 32;
    const points = [];
    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(theta) * centerCircleRadius, 0.01 + PARAMS.lineWidth/2, Math.sin(theta) * centerCircleRadius));
    }
    const circleLineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const circleLineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    const centerCircleLine = new THREE.LineLoop(circleLineGeometry, circleLineMaterial);
    stadiumGroup.add(centerCircleLine);

    // Penalty Areas
    const penaltyAreaLength = 16.5;
    const penaltyAreaWidth = 40.32;
    const goalAreaLength = 5.5;
    const goalAreaWidth = 18.32;
    let paX = halfL - penaltyAreaLength;
    createLine(penaltyAreaLength, PARAMS.lineWidth, PARAMS.lineWidth, halfL - penaltyAreaLength / 2, 0, penaltyAreaWidth / 2);
    createLine(penaltyAreaLength, PARAMS.lineWidth, PARAMS.lineWidth, halfL - penaltyAreaLength / 2, 0, -penaltyAreaWidth / 2);
    createLine(PARAMS.lineWidth, PARAMS.lineWidth, penaltyAreaWidth, paX, 0, 0);
    paX = -halfL + penaltyAreaLength;
    createLine(penaltyAreaLength, PARAMS.lineWidth, PARAMS.lineWidth, -halfL + penaltyAreaLength / 2, 0, penaltyAreaWidth / 2);
    createLine(penaltyAreaLength, PARAMS.lineWidth, PARAMS.lineWidth, -halfL + penaltyAreaLength / 2, 0, -penaltyAreaWidth / 2);
    createLine(PARAMS.lineWidth, PARAMS.lineWidth, penaltyAreaWidth, paX, 0, 0);

    // Goals (cylindrical posts and crossbar)
    const goalDepth = 2;
    const goalWidth = 7.32;
    const goalHeight = 2.44;
    const goalPostRadius = 0.06;
    const goalMaterial = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
    function createGoal(xOffset) {
        const goalGroup = new THREE.Group();
        const postGeo = new THREE.CylinderGeometry(goalPostRadius, goalPostRadius, goalHeight, 12);
        const leftPost = new THREE.Mesh(postGeo, goalMaterial);
        leftPost.position.set(xOffset, goalHeight / 2, goalWidth / 2);
        leftPost.castShadow = true;
        goalGroup.add(leftPost);
        const rightPost = new THREE.Mesh(postGeo, goalMaterial);
        rightPost.position.set(xOffset, goalHeight / 2, -goalWidth / 2);
        rightPost.castShadow = true;
        goalGroup.add(rightPost);
        const crossbarGeo = new THREE.CylinderGeometry(goalPostRadius, goalPostRadius, goalWidth, 12);
        const crossbar = new THREE.Mesh(crossbarGeo, goalMaterial);
        crossbar.position.set(xOffset, goalHeight, 0);
        crossbar.rotation.x = Math.PI / 2;
        crossbar.castShadow = true;
        goalGroup.add(crossbar);
        stadiumGroup.add(goalGroup);
    }
    createGoal(halfL + goalPostRadius);
    createGoal(-halfL - goalPostRadius);

    // --- CORNER FLAGS ---
    const flagPoleHeight = 1.5;
    const flagPoleRadius = 0.05;
    const flagHeight = 0.4;
    const flagWidth = 0.5;
    const flagPoleMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const cornerFlagMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000, side: THREE.DoubleSide });
    const cornerFlagPositions = [
        { x: halfL, z:  halfW, poleRotationOffset: 0 },
        { x: halfL, z: -halfW, poleRotationOffset: Math.PI / 2 },
        { x: -halfL, z: -halfW, poleRotationOffset: Math.PI },
        { x: -halfL, z:  halfW, poleRotationOffset: -Math.PI / 2 }
    ];
    cornerFlagPositions.forEach(pos => {
        const flagPole = new THREE.Mesh(
            new THREE.CylinderGeometry(flagPoleRadius, flagPoleRadius, flagPoleHeight, 8),
            flagPoleMaterial
        );
        flagPole.position.set(pos.x, flagPoleHeight / 2 + 0.01, pos.z);
        flagPole.castShadow = true;
        stadiumGroup.add(flagPole);

        const flagShape = new THREE.Shape();
        flagShape.moveTo(0, 0);
        flagShape.lineTo(flagWidth, flagHeight / 2);
        flagShape.lineTo(0, flagHeight);
        flagShape.lineTo(0, 0);
        const flagGeometry = new THREE.ShapeGeometry(flagShape);
        const flagMesh = new THREE.Mesh(flagGeometry, cornerFlagMaterial);
        flagMesh.position.set(
            pos.x,
            flagPoleHeight - (flagHeight / 2) + 0.01,
            pos.z
        );
        flagMesh.rotation.y = pos.poleRotationOffset;
        flagMesh.castShadow = true;
        stadiumGroup.add(flagMesh);
    });

    // --- CORNER ARCS ---
    const arcRadius = 1.0;
    const arcSegments = 16;
    const arcLineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    function createCornerArc(centerX, centerZ, startAngle, endAngle) {
        const arcPoints = [];
        for (let i = 0; i <= arcSegments; i++) {
            const angle = startAngle + (endAngle - startAngle) * (i / arcSegments);
            arcPoints.push(new THREE.Vector3(
                centerX + Math.cos(angle) * arcRadius,
                0.01 + PARAMS.lineWidth/2,
                centerZ + Math.sin(angle) * arcRadius
            ));
        }
        const arcGeometry = new THREE.BufferGeometry().setFromPoints(arcPoints);
        const arc = new THREE.Line(arcGeometry, arcLineMaterial);
        stadiumGroup.add(arc);
    }
    // Top-Right
    createCornerArc(halfL, halfW, Math.PI, 3 * Math.PI / 2);
    // Bottom-Right
    createCornerArc(halfL, -halfW, Math.PI / 2, Math.PI);
    // Bottom-Left
    createCornerArc(-halfL, -halfW, 0, Math.PI / 2);
    // Top-Left
    createCornerArc(-halfL, halfW, 3 * Math.PI / 2, 2 * Math.PI);
}

// --- START ---
init();