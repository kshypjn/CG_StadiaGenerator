import * as THREE from 'three';

// Individual Roof for a Stand
export function createIndividualRoof(standGroup, standLength, color, heightOffset, depth, tilt, thickness, standProfileDepth, standTopY) {
    // 1. Create the roof slab (BoxGeometry: X=depth, Y=thickness, Z=length)
    const roofMaterial = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.6,
        metalness: 0.1,
        side: THREE.DoubleSide
    });
    const roofGeo = new THREE.BoxGeometry(depth, thickness, standLength);
    const roofMesh = new THREE.Mesh(roofGeo, roofMaterial);
    roofMesh.castShadow = true;

    // 2. Position the roof slab in its local group
    // Place the roof so its back edge aligns with the back of the stand
    // and it covers 'depth' into the stand from the back
    // The stand profile's max X is totalProfileDepth
    // The roof's local X=0 is at its center, so we want its back edge at totalProfileDepth
    // So, center is at totalProfileDepth - depth/2
    roofMesh.position.set(
        standProfileDepth - (depth / 2),
        standTopY + heightOffset + (thickness / 2),
        standLength / 2 // Centered along the stand's length
    );
    roofMesh.rotation.x = tilt;
    roofMesh.name = `${standGroup.name.replace('Group', '')}Roof`;

    // 3. Create a group for this roof and supports
    const roofGroup = new THREE.Group();
    roofGroup.add(roofMesh);

    // 4. Add simple supports (columns at each end)
    const supportMaterial = new THREE.MeshStandardMaterial({ color: '#666666' });
    const supportHeight = standTopY + heightOffset;
    const supportRadius = 0.25;
    [ -standLength/2, standLength/2 ].forEach(z => {
        const support = new THREE.Mesh(
            new THREE.CylinderGeometry(supportRadius, supportRadius, supportHeight, 12),
            supportMaterial
        );
        support.position.set(
            standProfileDepth - depth, // At the back edge of the roof
            supportHeight / 2,
            z + standLength / 2 // Match roofMesh local Z
        );
        roofGroup.add(support);
    });

    // 5. Add the roofGroup to the standGroup (no extra rotation/position needed)
    standGroup.add(roofGroup);
}

// Overall Roof for the Stadium
export function createOverallRoof(allParams, groupToAddTo) {
    const material = new THREE.MeshStandardMaterial({
        color: allParams.overallRoofColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
    });
    // Determine max stand depth
    let maxStandDepth = 0;
    if (allParams.useIndividualStandSettings) {
        allParams.stands.forEach(sp => {
            if (sp.show) {
                const currentStandDepth = (sp.numRows * sp.rowStepDepth) + sp.walkwayAtTopDepth;
                if (currentStandDepth > maxStandDepth) maxStandDepth = currentStandDepth;
            }
        });
    } else {
        maxStandDepth = (allParams.standNumRows * allParams.standRowStepDepth) + allParams.standWalkwayAtTopDepth;
    }
    if(maxStandDepth === 0 && allParams.showStands) maxStandDepth = 20;
    const outerRoofLength = allParams.pitchLength + 2 * (allParams.standOffsetFromPitch + maxStandDepth + allParams.overallRoofOverhang);
    const outerRoofWidth = allParams.pitchWidth + 2 * (allParams.standOffsetFromPitch + maxStandDepth + allParams.overallRoofOverhang);
    const innerHoleLength = allParams.pitchLength;
    const innerHoleWidth = allParams.pitchWidth;
    const roofShape = new THREE.Shape();
    const halfOuterL = outerRoofLength / 2;
    const halfOuterW = outerRoofWidth / 2;
    roofShape.moveTo(-halfOuterL, -halfOuterW);
    roofShape.lineTo( halfOuterL, -halfOuterW);
    roofShape.lineTo( halfOuterL,  halfOuterW);
    roofShape.lineTo(-halfOuterL,  halfOuterW);
    roofShape.lineTo(-halfOuterL, -halfOuterW);
    const holePath = new THREE.Path();
    const halfInnerL = innerHoleLength / 2;
    const halfInnerW = innerHoleWidth / 2;
    holePath.moveTo(-halfInnerL, -halfInnerW);
    holePath.lineTo(-halfInnerL,  halfInnerW);
    holePath.lineTo( halfInnerL,  halfInnerW);
    holePath.lineTo( halfInnerL, -halfInnerW);
    holePath.lineTo(-halfInnerL, -halfInnerW);
    roofShape.holes.push(holePath);
    const roofThickness = 2;
    const extrudeSettings = {
        steps: 1,
        depth: roofThickness,
        bevelEnabled: false
    };
    const overallRoofGeometry = new THREE.ExtrudeGeometry(roofShape, extrudeSettings);
    overallRoofGeometry.rotateX(-Math.PI / 2);
    overallRoofGeometry.translate(0, roofThickness / 2, 0);
    const overallRoofMesh = new THREE.Mesh(overallRoofGeometry, material);
    overallRoofMesh.position.set(
        0,
        allParams.overallRoofHeight - (roofThickness / 2),
        0
    );
    overallRoofMesh.castShadow = true;
    overallRoofMesh.name = "OverallStadiumRoof";
    groupToAddTo.add(overallRoofMesh);
} 