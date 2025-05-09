// js/stadium_elements/Stands.js
import * as THREE from 'three'; // Or the path from your importmap if 'three' is globally mapped
import { createIndividualRoof, createOverallRoof } from './Roofs.js';

// Helper function to get the active parameters for a specific stand
function _getStandEffectiveParams(globalParams, individualStandParams, useIndividual) {
    if (useIndividual && individualStandParams) {
        return {
            show: individualStandParams.show !== undefined ? individualStandParams.show : globalParams.showStands,
            offsetFromPitch: individualStandParams.offsetFromPitch !== undefined ? individualStandParams.offsetFromPitch : globalParams.standOffsetFromPitch,
            frontWallHeight: individualStandParams.frontWallHeight !== undefined ? individualStandParams.frontWallHeight : globalParams.standFrontWallHeight,
            numRows: individualStandParams.numRows !== undefined ? individualStandParams.numRows : globalParams.standNumRows,
            rowStepHeight: individualStandParams.rowStepHeight !== undefined ? individualStandParams.rowStepHeight : globalParams.standRowStepHeight,
            rowStepDepth: individualStandParams.rowStepDepth !== undefined ? individualStandParams.rowStepDepth : globalParams.standRowStepDepth,
            walkwayAtTopDepth: individualStandParams.walkwayAtTopDepth !== undefined ? individualStandParams.walkwayAtTopDepth : globalParams.standWalkwayAtTopDepth,
            backWallHeight: individualStandParams.backWallHeight !== undefined ? individualStandParams.backWallHeight : globalParams.standBackWallHeight,
            color: individualStandParams.color || globalParams.standColor,
            pitchLength: globalParams.pitchLength, // Needed for context
            pitchWidth: globalParams.pitchWidth,   // Needed for context
        };
    }
    return { // Use global params
        show: globalParams.showStands,
        offsetFromPitch: globalParams.standOffsetFromPitch,
        frontWallHeight: globalParams.standFrontWallHeight,
        numRows: globalParams.standNumRows,
        rowStepHeight: globalParams.standRowStepHeight,
        rowStepDepth: globalParams.standRowStepDepth,
        walkwayAtTopDepth: globalParams.standWalkwayAtTopDepth,
        backWallHeight: globalParams.standBackWallHeight,
        color: globalParams.standColor,
        pitchLength: globalParams.pitchLength,
        pitchWidth: globalParams.pitchWidth,
    };
}

// Helper function to create the 2D shape for the stand's cross-section
function _createStandProfileShape(params) {
    const shape = new THREE.Shape();
    let currentX = 0; // Represents depth away from pitch edge (profile's X-axis)
    let currentY = 0; // Represents height (profile's Y-axis)

    // Start at the base, closest to where the pitch would be
    shape.moveTo(currentX, currentY);

    // 1. Front wall
    currentY += params.frontWallHeight;
    shape.lineTo(currentX, currentY);

    // 2. Seating steps
    for (let i = 0; i < params.numRows; i++) {
        // Horizontal part of the step (tread)
        currentX += params.rowStepDepth;
        shape.lineTo(currentX, currentY);

        // Vertical part of the step (riser)
        currentY += params.rowStepHeight;
        shape.lineTo(currentX, currentY);
    }

    // 3. Top walkway
    currentX += params.walkwayAtTopDepth;
    shape.lineTo(currentX, currentY);

    // 4. Back wall (optional)
    if (params.backWallHeight > 0) {
        currentY += params.backWallHeight;
        shape.lineTo(currentX, currentY);
    }

    // 5. Go down to ground level at the back of the stand
    shape.lineTo(currentX, 0);

    // 6. Close the shape by returning to the origin of the profile
    shape.lineTo(0, 0);

    return shape;
}

// Helper to calculate stand profile and its total height/depth (useful for roof)
function _createStandProfileShapeAndMetrics(activeStandParams) {
    const shape = new THREE.Shape();
    let currentX = 0; // Profile depth
    let currentY = 0; // Profile height
    let totalProfileDepth = 0;
    let totalProfileHeightAtBack = 0;

    shape.moveTo(currentX, currentY);
    currentY += activeStandParams.frontWallHeight;
    shape.lineTo(currentX, currentY);

    for (let i = 0; i < activeStandParams.numRows; i++) {
        currentX += activeStandParams.rowStepDepth;
        shape.lineTo(currentX, currentY);
        currentY += activeStandParams.rowStepHeight;
        shape.lineTo(currentX, currentY);
    }
    currentX += activeStandParams.walkwayAtTopDepth;
    shape.lineTo(currentX, currentY);
    totalProfileDepth = currentX;
    if (activeStandParams.backWallHeight > 0) {
        currentY += activeStandParams.backWallHeight;
        shape.lineTo(currentX, currentY);
    }
    totalProfileHeightAtBack = currentY;
    shape.lineTo(currentX, 0);
    shape.lineTo(0, 0);
    return {
        shape,
        totalProfileDepth,
        totalProfileHeightAtBack
    };
}

// --- Public function to generate all four stands ---
export function generateAllStands(allParams, groupToAddTo) {
    const standDefinitions = [
        { name: "East", axis: 'z', side: 1, lengthParam: 'pitchLength', rotationY: -Math.PI / 2 },
        { name: "West", axis: 'z', side: -1, lengthParam: 'pitchLength', rotationY: Math.PI / 2 },
        { name: "North", axis: 'x', side: 1, lengthParam: 'pitchWidth', rotationY: 0 },
        { name: "South", axis: 'x', side: -1, lengthParam: 'pitchWidth', rotationY: Math.PI }
    ];

    standDefinitions.forEach((def, index) => {
        const individualSpecificParams = allParams.stands[index];
        const activeStandParams = _getStandEffectiveParams(allParams, individualSpecificParams, allParams.useIndividualStandSettings);
        if (!activeStandParams.show) return;
        const standGroup = new THREE.Group();
        standGroup.name = `${def.name}StandGroup`;
        const { shape, totalProfileDepth, totalProfileHeightAtBack } = _createStandProfileShapeAndMetrics(activeStandParams);
        const standLength = (def.lengthParam === 'pitchLength') ? activeStandParams.pitchLength : activeStandParams.pitchWidth;
        const extrudeSettings = { steps: 1, depth: standLength, bevelEnabled: false };
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const material = new THREE.MeshStandardMaterial({
            color: activeStandParams.color,
            roughness: 0.8,
            metalness: 0.2,
        });
        const standBodyMesh = new THREE.Mesh(geometry, material);
        standBodyMesh.castShadow = true;
        standBodyMesh.receiveShadow = true;
        standBodyMesh.name = `${def.name}StandBody`;
        standGroup.add(standBodyMesh);
        const halfPitchL = activeStandParams.pitchLength / 2;
        const halfPitchW = activeStandParams.pitchWidth / 2;
        standGroup.rotation.y = def.rotationY;
        if (def.axis === 'z') {
            standGroup.position.set(
                def.side * standLength / 2,
                0,
                def.side * (halfPitchW + activeStandParams.offsetFromPitch)
            );
        } else {
            standGroup.position.set(
                def.side * (halfPitchL + activeStandParams.offsetFromPitch),
                0,
                (def.rotationY === Math.PI ? 1 : -1) * standLength / 2
            );
        }
        groupToAddTo.add(standGroup);
        if (allParams.roofType === 'individual' && allParams.individualRoofEnable) {
            createIndividualRoof(
                standGroup,
                standLength,
                allParams.individualRoofColor,
                allParams.individualRoofHeightOffset,
                allParams.individualRoofDepth,
                allParams.individualRoofTilt,
                allParams.individualRoofThickness,
                totalProfileDepth,
                totalProfileHeightAtBack
            );
        }
    });
    if (allParams.roofType === 'overall') {
        createOverallRoof(allParams, groupToAddTo);
    }
}