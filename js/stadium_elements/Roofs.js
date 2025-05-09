import * as THREE from 'three';

// Individual Roof for a Stand
// Parameters:
// - standGroup: The THREE.Group of the stand this roof belongs to. Its world transform is already set.
// - standLength: The length of this stand (and thus the roof).
// - color, heightOffset, depth (roof coverage), tilt, thickness: From PARAMS.individualRoof...
// - standProfileDepth: The maximum X-extent of the stand's 2D profile (how "deep" the stand is).
// - standTopY: The Y-coordinate of the top-back of the stand's solid structure (relative to stand's base).
// - supportColor: Color for the supports.
export function createIndividualRoof(standGroup, standLength, color, heightOffset, depth, tilt, thickness, standProfileDepth, standTopY, supportColor = '#666666') {
    // 1. Create a dedicated group for this roof assembly (slab + supports).
    const roofAssemblyGroup = new THREE.Group();
    roofAssemblyGroup.name = `${standGroup.name.replace('Group', '')}RoofAssembly`;

    // 2. Create the roof slab material
    const roofSlabMaterial = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.7,
        metalness: 0.2,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
    });

    // 3. Create the roof slab geometry
    // BoxGeometry: Local X = depth (coverage), Local Y = thickness, Local Z = standLength
    const roofSlabGeo = new THREE.BoxGeometry(depth, thickness, standLength);
    const roofSlabMesh = new THREE.Mesh(roofSlabGeo, roofSlabMaterial);
    roofSlabMesh.castShadow = true;
    roofSlabMesh.name = "RoofSlab";

    // 4. Position and orient the roof slab LOCALLY within roofAssemblyGroup.
    // The roofAssemblyGroup's origin is conceptually aligned with the standGroup's origin
    // (which is at the start of the stand's extrusion and its profile's (0,0)).

    // slab_X: Center of the roof's coverage.
    // Stand profile X goes from 0 (front) to standProfileDepth (back).
    // Roof covers 'depth' from the back.
    const slab_X_center = standProfileDepth - (depth / 2);

    // slab_Y: Vertical position of the roof slab's center.
    const slab_Y_center = standTopY + heightOffset + (thickness / 2);

    // slab_Z: Center of the roof slab along the stand's length.
    // Stand's extrusion is from local Z=0 to Z=standLength. Box is centered.
    const slab_Z_center = standLength / 2;

    roofSlabMesh.position.set(slab_X_center, slab_Y_center, slab_Z_center);

    roofSlabMesh.rotation.z = tilt; 

    roofAssemblyGroup.add(roofSlabMesh);

    // 5. Add Angled Supports
    const supportMaterial = new THREE.MeshStandardMaterial({
        color: supportColor,
        metalness: 0.4,
        roughness: 0.6
    });
    const supportRadius = 0.3;
    const desiredNumSupports = 2; // Change to 3 for three supports (ends and center)

    for (let i = 0; i < desiredNumSupports; i++) {
        // --- Calculate Z position for this support along the stand's length ---
        let Z_pos_support_in_slab_local_space;
        if (desiredNumSupports === 1) {
            Z_pos_support_in_slab_local_space = 0;
        } else if (desiredNumSupports === 2) {
            // Place at ends, inset by 10%
            const inset = standLength * 0.1;
            Z_pos_support_in_slab_local_space = (i === 0)
                ? -standLength / 2 + inset
                :  standLength / 2 - inset;
        } else {
            // For 3 or more, spread evenly (with insets)
            const inset = standLength * 0.1;
            const Z_start = -standLength / 2 + inset;
            const Z_end = standLength / 2 - inset;
            Z_pos_support_in_slab_local_space = Z_start + i * ((Z_end - Z_start) / (desiredNumSupports - 1));
        }
        // Convert this Z (local to slab) to Z in roofAssemblyGroup space
        const Z_pos_support_in_assembly_space = slab_Z_center + Z_pos_support_in_slab_local_space;

        // --- Base point of the support (on the stand's "ground") ---
        const base_X = standProfileDepth - depth; // At the back edge of roof coverage
        const base_Y = 0;
        const base_Z = Z_pos_support_in_assembly_space;
        const basePoint = new THREE.Vector3(base_X, base_Y, base_Z);

        // --- Attachment point on the UNDERSIDE of the TILTED roof slab ---
        // This point is on the roof slab's back edge (local X = -depth/2 relative to slab's center)
        // and at the calculated Z position along its length.
        const attach_X_relative_to_slab_center = -depth / 2; // Back edge of slab
        const attach_Y_relative_to_slab_center = -thickness / 2; // Underside of slab
        const attach_Z_relative_to_slab_center = Z_pos_support_in_slab_local_space;

        let attachPointOnSlab = new THREE.Vector3(
            attach_X_relative_to_slab_center,
            attach_Y_relative_to_slab_center,
            attach_Z_relative_to_slab_center
        );

        // Transform this point from roofSlabMesh's local space to roofAssemblyGroup's space
        attachPointOnSlab.applyEuler(new THREE.Euler(0, 0, tilt, 'XYZ'));
        attachPointOnSlab.add(roofSlabMesh.position);

        // --- Create the support cylinder ---
        const directionVector = new THREE.Vector3().subVectors(attachPointOnSlab, basePoint);
        const supportActualLength = directionVector.length();
        const midPoint = new THREE.Vector3().addVectors(basePoint, attachPointOnSlab).multiplyScalar(0.5);

        if (supportActualLength < 0.1) continue; // Avoid creating tiny/degenerate supports

        const support = new THREE.Mesh(
            new THREE.CylinderGeometry(supportRadius, supportRadius, supportActualLength, 12),
            supportMaterial
        );
        support.castShadow = true;
        support.position.copy(midPoint);
        support.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), directionVector.clone().normalize());

        roofAssemblyGroup.add(support);
    }

    // 6. Add the entire roofAssemblyGroup to the standGroup.
    // All positions within roofAssemblyGroup are local to it.
    // standGroup's existing world transform will orient everything correctly.
    standGroup.add(roofAssemblyGroup);
}

// Overall Roof for the Stadium
export function createOverallRoof(allParams, groupToAddTo) {
    const material = new THREE.MeshStandardMaterial({
        color: allParams.overallRoofColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: allParams.overallRoofOpacity || 0.9
    });

    let maxStandDepth = 0;
    let maxStandHeight = 0;

    if (allParams.useIndividualStandSettings) {
        allParams.stands.forEach(sp => {
            if (sp.show) {
                const depth = (sp.numRows * sp.rowStepDepth) + sp.walkwayAtTopDepth;
                if (depth > maxStandDepth) maxStandDepth = depth;
                const height = sp.frontWallHeight + (sp.numRows * sp.rowStepHeight) + sp.backWallHeight;
                if (height > maxStandHeight) maxStandHeight = height;
            }
        });
    } else {
        maxStandDepth = (allParams.standNumRows * allParams.standRowStepDepth) + allParams.standWalkwayAtTopDepth;
        maxStandHeight = allParams.standFrontWallHeight + (allParams.standNumRows * allParams.standRowStepHeight) + allParams.standBackWallHeight;
    }

    if (maxStandDepth === 0 && allParams.showStands) maxStandDepth = 20;
    if (maxStandHeight === 0 && allParams.showStands) maxStandHeight = allParams.standBackWallHeight > 0 ? allParams.standBackWallHeight : 15;

    const outerRoofLength = allParams.pitchLength + 2 * (allParams.standOffsetFromPitch + maxStandDepth + allParams.overallRoofOverhang);
    const outerRoofWidth = allParams.pitchWidth + 2 * (allParams.standOffsetFromPitch + maxStandDepth + allParams.overallRoofOverhang);
    const innerHoleLength = allParams.pitchLength;
    const innerHoleWidth = allParams.pitchWidth;
    const roofThickness = allParams.individualRoofThickness || 0.5;

    const roofShape = new THREE.Shape();
    const halfOuterL = outerRoofLength / 2;
    const halfOuterW = outerRoofWidth / 2;
    roofShape.moveTo(-halfOuterL, -halfOuterW);
    roofShape.lineTo(halfOuterL, -halfOuterW);
    roofShape.lineTo(halfOuterL, halfOuterW);
    roofShape.lineTo(-halfOuterL, halfOuterW);
    roofShape.closePath();

    const holePath = new THREE.Path();
    const halfInnerL = innerHoleLength / 2;
    const halfInnerW = innerHoleWidth / 2;
    holePath.moveTo(-halfInnerL, -halfInnerW);
    holePath.lineTo(-halfInnerL, halfInnerW);
    holePath.lineTo(halfInnerL, halfInnerW);
    holePath.lineTo(halfInnerL, -halfInnerW);
    holePath.closePath();
    roofShape.holes.push(holePath);

    const extrudeSettings = { steps: 1, depth: roofThickness, bevelEnabled: false };
    const overallRoofGeometry = new THREE.ExtrudeGeometry(roofShape, extrudeSettings);
    overallRoofGeometry.rotateX(-Math.PI / 2);
    overallRoofGeometry.translate(0, roofThickness / 2, 0);

    const overallRoofMesh = new THREE.Mesh(overallRoofGeometry, material);
    overallRoofMesh.position.set(
        0,
        maxStandHeight + (roofThickness/2),
        0
    );
    overallRoofMesh.castShadow = true;
    overallRoofMesh.name = "OverallStadiumRoof";
    groupToAddTo.add(overallRoofMesh);

    // Add supports for the overall roof
    const supportMaterial = new THREE.MeshStandardMaterial({ color: allParams.supportColor || '#555555' });
    const supportRadius = 0.5;
    const supportActualHeight = maxStandHeight;

    const supportPositions = [
        { x: halfOuterL - allParams.overallRoofOverhang, z: halfOuterW - allParams.overallRoofOverhang },
        { x: -halfOuterL + allParams.overallRoofOverhang, z: halfOuterW - allParams.overallRoofOverhang },
        { x: halfOuterL - allParams.overallRoofOverhang, z: -halfOuterW + allParams.overallRoofOverhang },
        { x: -halfOuterL + allParams.overallRoofOverhang, z: -halfOuterW + allParams.overallRoofOverhang }
    ];

    supportPositions.forEach(pos => {
        const support = new THREE.Mesh(
            new THREE.CylinderGeometry(supportRadius, supportRadius, supportActualHeight, 16),
            supportMaterial
        );
        support.castShadow = true;
        support.position.set(pos.x, supportActualHeight / 2, pos.z);
        groupToAddTo.add(support);
    });
} 