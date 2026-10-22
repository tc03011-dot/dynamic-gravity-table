import { ArrowHelper, BufferAttribute, BufferGeometry, CatmullRomCurve3, DoubleSide, Group, Line, LineBasicMaterial, MathUtils, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { TABLE_THICKNESS } from '../utils/dimensions.js'
import { MAX_BREATH_EXPANSION, MIN_INNER_RADIUS } from '../controls/breathSession.js'

export function createCupProfile({ variant = 'smooth', thickness = 0.003, radialOffsets = null } = {}) {
  // A single continuous material cross-section: underside -> outer wall -> rim
  // -> inner wall -> inner floor -> bottom endpoint. The mouth remains open.
  const wall = MathUtils.clamp(thickness, 0.001, 0.008)
  const floor = Math.max(0.004, wall * 1.3)
  const controls = variant === 'bowl' ? [
    [0.032, floor], [0.050, 0.010], [0.073, 0.022],
    [0.091, 0.039], [0.098, 0.052],
  ] : variant === 'wavy' ? [
    [0.044, floor], [0.058, 0.020], [0.045, 0.038],
    [0.061, 0.058], [0.047, 0.078], [0.064, 0.098], [0.059, 0.112],
  ] : [
    [0.015, floor], [0.030, 0.150],
  ]
  const outer = variant === 'smooth'
    ? Array.from({ length: 65 }, (_, i) => {
      const t = i / 64
      return new Vector3(0.015 + 0.015 * t, floor + (0.150 - floor) * t, 0)
    })
    : new CatmullRomCurve3(controls.map(([x, y]) => new Vector3(x, y, 0)), false, 'centripetal').getPoints(64)
  if (radialOffsets && variant === 'smooth') {
    outer.forEach((point, index) => {
      // Smooth adjacent recorded heights; retain the axis-radius safety margin.
      const offset = ((radialOffsets[Math.max(0, index - 1)] ?? 0)
        + 2 * (radialOffsets[index] ?? 0) + (radialOffsets[Math.min(64, index + 1)] ?? 0)) / 4
      point.x = Math.max(MIN_INNER_RADIUS + wall, point.x + Math.min(MAX_BREATH_EXPANSION, offset))
    })
  }
  const inner = outer.map((point) => new Vector3(point.x - wall, point.y, 0)).reverse()
  const baseRadius = variant === 'smooth' ? 0.015 : 0.040
  return [new Vector3(), new Vector3(baseRadius * 0.625, 0, 0), new Vector3(baseRadius, 0, 0),
    ...outer, ...inner, new Vector3(0, floor, 0), new Vector3()]
}

// Rodrigues revolution about an arbitrary unit axis through the profile endpoint.
// Unlike rotating a lathed mesh, changing axis here changes the actual shape.
export function writeRevolvedPositions(profile, axis, sweepRadians, segments, positions) {
  const pivot = profile[0]
  const point = new Vector3(), rotated = new Vector3()
  let cursor = 0
  for (let ring = 0; ring <= segments; ring++) {
    const theta = sweepRadians * ring / segments
    for (const sample of profile) {
      point.subVectors(sample, pivot)
      rotated.copy(point).applyAxisAngle(axis, theta).add(pivot)
      positions[cursor++] = rotated.x
      positions[cursor++] = rotated.y
      positions[cursor++] = rotated.z
    }
  }
  return positions
}

export function createProfileCup(table, params, { variant = 'smooth', storedProfile = null, color = null } = {}) {
  const root = new Group()
  root.name = `gravity-profile-${variant}-cup`
  root.position.set(variant === 'wavy' ? 0.105 : -0.105, TABLE_THICKNESS / 2, -0.19)
  table.plate.add(root)
  let previousThickness = params.cupThickness ?? 3
  let profile = storedProfile ? storedProfile.map((p) => new Vector3(...p)) : createCupProfile({ variant, thickness: previousThickness / 1000 })
  const segments = 80, count = profile.length
  const geometry = new BufferGeometry()
  const positions = new Float32Array((segments + 1) * count * 3)
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  const indices = []
  for (let ring = 0; ring < segments; ring++) {
    for (let point = 0; point < count - 1; point++) {
      const a = ring * count + point, b = a + count
      indices.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  geometry.setIndex(indices)
  const material = new MeshStandardMaterial({ color: variant === 'wavy' ? 0x89bdb9 : 0xe9cda6, roughness: 0.45, metalness: 0, side: DoubleSide })
  if (variant === 'bowl') material.color.setHex(0xc6a3ce)
  material.color.setHSL(
  Math.random(),               // 랜덤 색상
  0.55 + Math.random() * 0.2,   // 채도
  0.5 + Math.random() * 0.15,   // 밝기
)
  const mesh = new Mesh(geometry, material)
  root.add(mesh)
  const profileLine = new Line(new BufferGeometry().setFromPoints(profile), new LineBasicMaterial({ color: 0x5ce8d6, depthTest: false }))
  profileLine.renderOrder = 5
  root.add(profileLine)
  const axisArrow = new ArrowHelper(new Vector3(0, 1, 0), profile[0], 0.16, 0xffa66b, 0.018, 0.01)
  root.add(axisArrow)
  const worldAxis = new Vector3(0, 1, 0), localAxis = worldAxis.clone(), previousAxis = new Vector3()
  let previousSweep = -1
  let lift = 0
  let released = false
  let recording = null, previousRecordingVersion = -1
  function update(gravity) {
    if (released) return
    root.visible = variant === 'bowl' ? params.showBowl : variant === 'wavy' ? params.showWavyCup : params.showProfileCup
    profileLine.visible = params.showCupProfile
    axisArrow.visible = params.showCupAxis
    material.wireframe = params.cupWireframe
    const thicknessChanged = !storedProfile && previousThickness !== params.cupThickness
    const recordingChanged = Boolean(recording && recording.version !== previousRecordingVersion)
    if (thicknessChanged || recordingChanged) {
      previousThickness = params.cupThickness
      profile = createCupProfile({ variant, thickness: previousThickness / 1000, radialOffsets: recording?.offsets })
      previousRecordingVersion = recording?.version ?? -1
      profileLine.geometry.setFromPoints(profile)
      profileLine.geometry.computeBoundingSphere()
    }
    if (gravity.vector.lengthSq() > 1e-10) worldAxis.copy(gravity.direction).negate()
    localAxis.copy(worldAxis).applyQuaternion(table.plate.quaternion.clone().invert()).normalize()
    axisArrow.setDirection(localAxis)
    const sweep = MathUtils.degToRad(params.cupSweep)
    if (thicknessChanged || recordingChanged || previousAxis.distanceToSquared(localAxis) > 1e-12 || previousSweep !== sweep) {
      writeRevolvedPositions(profile, localAxis, sweep, segments, positions)
      geometry.attributes.position.needsUpdate = true
      geometry.computeVertexNormals()
      // Each ring duplicates the endpoint on the axis; a full sweep also duplicates
      // the first meridian. Average the normals across that seam to avoid a stripe.
      if (params.cupSweep === 360) {
        const normals = geometry.attributes.normal
        const normal = new Vector3()
        for (let i = 1; i < count; i++) {
          const end = segments * count + i
          normal.fromBufferAttribute(normals, i).add(new Vector3().fromBufferAttribute(normals, end)).normalize()
          normals.setXYZ(i, normal.x, normal.y, normal.z)
          normals.setXYZ(end, normal.x, normal.y, normal.z)
        }
        normals.needsUpdate = true
      }
      geometry.computeBoundingSphere()
      // Geometry is in tabletop-local coordinates. Move the whole cup (including
      // its profile and axis) only as far up as its lowest vertex requires.
      geometry.computeBoundingBox()
      lift = -geometry.boundingBox.min.y
      root.position.y = TABLE_THICKNESS / 2 + lift
      previousAxis.copy(localAxis)
      previousSweep = sweep
    }
  }
  // Rotation preserves distance to the profile endpoint. Reserve that full radius
  // at both thickness extremes, so deformations cannot overlap neighbouring dishes.
  const footprintRadius = storedProfile ? Math.max(...profile.map((p) => p.length())) + 0.001 : Math.max(...[0.001, 0.008].flatMap((thickness) =>
    createCupProfile({ variant, thickness }).map((point) => Math.hypot(point.x + (variant === 'smooth' ? MAX_BREATH_EXPANSION : 0), point.y)))) + 0.001
  function setRecording(session) { recording = session; previousRecordingVersion = -1 }
  function freezeForPhysics() {
    released = true
    profileLine.visible = false
    axisArrow.visible = false
  }
  function restoreForModeling() {
    released = false
    // Invalidate cached geometry/lift even when the gravity direction is unchanged.
    previousSweep = -1
  }
  function dispose() {
    root.removeFromParent()
    geometry.dispose(); material.dispose()
    profileLine.geometry.dispose(); profileLine.material.dispose()
    axisArrow.dispose()
  }
  return { root, mesh, variant, footprintRadius, setRecording, freezeForPhysics, restoreForModeling, dispose, get released() { return released }, get profile() { return profile }, get lift() { return lift }, worldAxis, localAxis, update }
}
