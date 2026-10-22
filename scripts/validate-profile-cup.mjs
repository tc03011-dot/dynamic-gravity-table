import assert from 'node:assert/strict'
import { Mesh, Scene, Vector3 } from 'three'
import { createCupProfile, createProfileCup, writeRevolvedPositions } from '../src/objects/createProfileCup.js'
import { defaults } from '../src/controls/createGUI.js'

const profile = createCupProfile(), segments = 80
assert(Math.abs(Math.max(...profile.filter((p) => p.y === 0).map((p) => p.x)) - 0.015) < 1e-10, '15 mm base radius')
assert(Math.abs(profile[67].x - 0.030) < 1e-10, '30 mm outer rim radius')
assert(Math.abs(Math.max(...profile.map((p) => p.y)) - 0.150) < 1e-10, '150 mm total height')
for (const point of profile.slice(3, 68)) {
  assert(Math.abs((point.x - 0.015) / 0.015 - (point.y - 0.004) / 0.146) < 1e-10, 'base profile wall must be a straight line')
}
for (const variant of ['smooth', 'wavy', 'bowl']) {
  for (const thickness of [0.001, 0.003, 0.008]) {
    const section = createCupProfile({ variant, thickness })
    assert(section[0].distanceTo(section.at(-1)) === 0, 'closed material cross-section')
    assert(section.every((point) => point.toArray().every(Number.isFinite)))
    for (let i = 0; i <= 64; i++) {
      const outer = section[3 + i], inner = section[3 + 65 + (64 - i)]
      assert(Math.abs(outer.x - inner.x - thickness) < 1e-10, 'specified radial wall thickness')
      assert(outer.y === inner.y && inner.x > 0)
    }
    assert(section.at(-2).y >= 0.004, 'solid bottom thickness')
  }
}
const wavyProfile = createCupProfile({ variant: 'wavy' })
let extrema = 0
for (let i = 4; i < 67; i++) {
  const before = wavyProfile[i].x - wavyProfile[i - 1].x
  const after = wavyProfile[i + 1].x - wavyProfile[i].x
  if (before * after < 0) extrema++
}
assert(extrema >= 4, 'multiple curved bulges')
const size = (segments + 1) * profile.length * 3
const axisY = new Vector3(0, 1, 0)
const initial = writeRevolvedPositions(profile, axisY, Math.PI * 2, segments, new Float32Array(size))
for (const axis of [axisY, new Vector3(0.4, 1, 0.2).normalize(), new Vector3(0, -1, 0)]) {
  const data = writeRevolvedPositions(profile, axis, Math.PI * 2, segments, new Float32Array(size))
  assert(data.every(Number.isFinite))
  for (let ring = 0; ring <= segments; ring++) {
    for (let i = 0; i < profile.length; i++) {
      const position = new Vector3().fromArray(data, (ring * profile.length + i) * 3)
      assert(Math.abs(position.length() - profile[i].length()) < 1e-7, 'preserve distance to endpoint')
      assert(Math.abs(position.dot(axis) - profile[i].dot(axis)) < 1e-7, 'preserve axial projection')
      if (i === 0) assert(position.length() === 0, 'endpoint remains on axis')
    }
  }
  for (let i = 0; i < profile.length * 3; i++) assert(Math.abs(data[i] - data[segments * profile.length * 3 + i]) < 1e-7, 'closed full revolution')
}
const tilted = writeRevolvedPositions(profile, new Vector3(0.4, 1, 0).normalize(), Math.PI * 2, segments, new Float32Array(size))
const index = (20 * profile.length + 30) * 3
assert(new Vector3().fromArray(initial, index).distanceTo(new Vector3().fromArray(tilted, index)) > 0.01, 'axis change deforms vertices')
const plate = new Mesh()
new Scene().add(plate)
const params = { ...defaults }
const cup = createProfileCup({ plate }, params)
const gravity = { vector: new Vector3(0, -9.81, 0), direction: new Vector3(0, -1, 0) }
cup.update(gravity)
const buffer = cup.mesh.geometry.attributes.position.array
plate.rotation.z = 0.4
cup.update(gravity)
assert(cup.mesh.geometry.attributes.position.array === buffer, 'reuse geometry buffers')
assert(cup.localAxis.clone().applyQuaternion(plate.quaternion).distanceTo(axisY) < 1e-10, 'world revolution axis follows gravity')
assert(cup.mesh.geometry.attributes.normal.array.every(Number.isFinite))
gravity.vector.set(0, 0, 0)
gravity.direction.set(1, 0, 0)
cup.update(gravity)
assert(cup.worldAxis.distanceTo(axisY) < 1e-10, 'zero gravity keeps last axis')
params.cupSweep = 90
cup.update(gravity)
assert(cup.mesh.geometry.attributes.position.array.every(Number.isFinite))
assert(cup.root.parent === plate)
const oldProfile = cup.profile
params.cupThickness = 6
cup.update(gravity)
assert(cup.profile !== oldProfile && cup.mesh.geometry.attributes.position.array === buffer, 'live thickness update without replacing mesh')
const wavyCup = createProfileCup({ plate }, params, { variant: 'wavy' })
wavyCup.update(gravity)
assert(wavyCup.root.position.x > cup.root.position.x, 'place the second object alongside the first')
assert(wavyCup.mesh.geometry.attributes.position.array.every(Number.isFinite))
// A deformed cup must touch the tabletop without any vertex falling below it.
plate.quaternion.identity()
params.cupSweep = 360
gravity.vector.set(9.81, 0, 0)
gravity.direction.set(1, 0, 0)
for (const object of [cup, wavyCup]) {
  gravity.vector.set(9.81, 0, 0)
  gravity.direction.set(1, 0, 0)
  object.update(gravity)
  assert(object.lift > 0.03, 'sideways axis requires upward compensation')
  for (const axis of [new Vector3(1, 0, 0), new Vector3(0.3, -0.7, 0.6).normalize(), new Vector3(0, 1, 0)]) {
    gravity.direction.copy(axis); gravity.vector.copy(axis).multiplyScalar(9.81)
    object.update(gravity)
    const positions = object.mesh.geometry.attributes.position
    let lowest = Infinity
    for (let i = 0; i < positions.count; i++) lowest = Math.min(lowest, positions.getY(i) + object.root.position.y)
    assert(Math.abs(lowest - 0.005) < 1e-8, 'lowest point touches the top face, no penetration')
  }
  gravity.direction.set(0, -1, 0); gravity.vector.set(0, -9.81, 0)
  object.update(gravity)
  assert(Math.abs(object.lift) < 1e-8, 'return to original height when upright')
}
console.log('PASS: single profile, 360-degree closure, endpoint pivot, live vertex deformation, table/world transforms, buffer reuse, zero gravity and 90-degree inspection')
