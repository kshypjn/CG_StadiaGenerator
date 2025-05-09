import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Pane } from 'tweakpane';

import { generateAllStands } from './js/stadium_elements/Stands.js'; 

let scene, camera, renderer, controls;
let stadiumGroup;

const PARAMS = {
    pitchLength: 100.6, // meters (110 yards)
    pitchWidth: 64.0,   // meters (70 yards)
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
    // Individual roof params
    individualRoofEnable: true, // Enabled by default
    individualRoofHeightOffset: 2,
    individualRoofDepth: 15,
    individualRoofTilt: Math.PI / 18,
    individualRoofThickness: 0.5,
    individualRoofColor: '#999999'
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
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
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
    // Individual roof controls
    const individualRoofFolder = roofFolder.addFolder({ title: 'Individual Roofs' });
    individualRoofFolder.addBinding(PARAMS, 'individualRoofEnable').on('change', regenerateStadium);
    individualRoofFolder.addBinding(PARAMS, 'individualRoofHeightOffset', { min: -5, max: 10, step: 0.1 }).on('change', regenerateStadium);
    individualRoofFolder.addBinding(PARAMS, 'individualRoofDepth', { min: 1, max: 40, step: 0.5 }).on('change', regenerateStadium);
    individualRoofFolder.addBinding(PARAMS, 'individualRoofTilt', { min: 0, max: Math.PI / 4, step: 0.01 }).on('change', regenerateStadium);
    individualRoofFolder.addBinding(PARAMS, 'individualRoofThickness', { min: 0.1, max: 2, step: 0.05 }).on('change', regenerateStadium);
    individualRoofFolder.addBinding(PARAMS, 'individualRoofColor', { view: 'color' }).on('change', regenerateStadium);

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
    
    console.log('Stadium group children:', stadiumGroup.children.length);
}

// --- PITCH CREATION ---
function createPitch() {
    const pitchMaterial = new THREE.MeshStandardMaterial({ color: 0x008000, side: THREE.DoubleSide }); // Green
    const pitchGeometry = new THREE.PlaneGeometry(PARAMS.pitchLength, PARAMS.pitchWidth);
    const pitchMesh = new THREE.Mesh(pitchGeometry, pitchMaterial);
    pitchMesh.rotation.x = -Math.PI / 2; // Lay it flat
    pitchMesh.receiveShadow = true;
    stadiumGroup.add(pitchMesh);

    const lineMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    function createLine(width, height, depth, x, y, z, rotationY = 0) {
        const lineGeo = new THREE.BoxGeometry(width, height, depth);
        const line = new THREE.Mesh(lineGeo, lineMaterial);
        line.position.set(x, y + 0.01, z);
        line.rotation.y = rotationY;
        line.castShadow = false;
        line.receiveShadow = true;
        stadiumGroup.add(line);
    }
    const halfL = PARAMS.pitchLength / 2;
    const halfW = PARAMS.pitchWidth / 2;
    createLine(PARAMS.pitchLength, PARAMS.lineWidth, PARAMS.lineWidth, 0, 0, halfW);
    createLine(PARAMS.pitchLength, PARAMS.lineWidth, PARAMS.lineWidth, 0, 0, -halfW);
    createLine(PARAMS.lineWidth, PARAMS.lineWidth, PARAMS.pitchWidth, halfL, 0, 0);
    createLine(PARAMS.lineWidth, PARAMS.lineWidth, PARAMS.pitchWidth, -halfL, 0, 0);
    createLine(PARAMS.lineWidth, PARAMS.lineWidth, PARAMS.pitchWidth, 0, 0, 0);
    const centerCircleRadius = 9.15;
    const segments = 32;
    const points = [];
    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector2(Math.cos(theta) * centerCircleRadius, Math.sin(theta) * centerCircleRadius));
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const centerCircleLine = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 }));
    centerCircleLine.position.y = 0.01;
    centerCircleLine.rotation.x = -Math.PI / 2;
    stadiumGroup.add(centerCircleLine);
    const penaltyAreaLength = 16.5;
    const penaltyAreaWidth = 40.32;
    let paX = halfL - penaltyAreaLength / 2;
    createLine(penaltyAreaLength, PARAMS.lineWidth, PARAMS.lineWidth, paX, 0, penaltyAreaWidth/2);
    createLine(penaltyAreaLength, PARAMS.lineWidth, PARAMS.lineWidth, paX, 0, -penaltyAreaWidth/2);
    createLine(PARAMS.lineWidth, PARAMS.lineWidth, penaltyAreaWidth, halfL - penaltyAreaLength, 0, 0);
    paX = -halfL + penaltyAreaLength / 2;
    createLine(penaltyAreaLength, PARAMS.lineWidth, PARAMS.lineWidth, paX, 0, penaltyAreaWidth/2);
    createLine(penaltyAreaLength, PARAMS.lineWidth, PARAMS.lineWidth, paX, 0, -penaltyAreaWidth/2);
    createLine(PARAMS.lineWidth, PARAMS.lineWidth, penaltyAreaWidth, -halfL + penaltyAreaLength, 0, 0);
    const goalDepth = 2;
    const goalWidth = 7.32;
    const goalHeight = 2.44;
    const goalMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    const goal1Geo = new THREE.BoxGeometry(goalDepth, goalHeight, goalWidth);
    const goal1 = new THREE.Mesh(goal1Geo, goalMaterial);
    goal1.position.set(halfL + goalDepth / 2, goalHeight / 2, 0);
    goal1.castShadow = true;
    stadiumGroup.add(goal1);
    const goal2Geo = new THREE.BoxGeometry(goalDepth, goalHeight, goalWidth);
    const goal2 = new THREE.Mesh(goal2Geo, goalMaterial);
    goal2.position.set(-halfL - goalDepth / 2, goalHeight / 2, 0);
    goal2.castShadow = true;
    stadiumGroup.add(goal2);
}

// --- START ---
init();