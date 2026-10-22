import assert from 'node:assert/strict'
import { scaled as s, PLATE_HEIGHT, PLATE_OFFSET, TABLE_RADIUS, TABLE_THICKNESS, JOINT_RADIUS, PIVOT_HEIGHT } from '../src/utils/dimensions.js'
import { Scene, Vector3 } from 'three'
import { createWorld, FIXED_DT, initializePhysics } from '../src/physics/createWorld.js'
import { createGravitySystem } from '../src/physics/gravitySystem.js'
import { createTable } from '../src/objects/createTable.js'
import { createObjects } from '../src/objects/createObjects.js'
import { defaults } from '../src/controls/createGUI.js'
import { finiteVector, PIVOT } from '../src/utils/mathUtils.js'

await initializePhysics()
function fixture() {
  const world = createWorld(), scene = new Scene(), params = { ...defaults }
  const table = createTable(world, scene)
  const gravity = createGravitySystem(params)
  const objects = createObjects(world, scene, table)
  return { world, table, gravity, objects, params }
}
let f = fixture()
let maxError = 0, maxPenetration = 0, contacts = 0
function step(count) {
  count *= 4
  for (let i = 0; i < count; i++) {
    f.gravity.update(f.world, FIXED_DT)
    f.world.step()
    f.table.sync()
    const anchor = new Vector3(0, -PLATE_OFFSET, 0).applyQuaternion(f.table.plate.quaternion).add(f.table.plate.position)
    maxError = Math.max(maxError, anchor.distanceTo(PIVOT))
    for (const obstacle of [f.table.legCollider, f.table.baseCollider]) f.world.contactPair(f.table.collider, obstacle, (manifold) => {
      contacts += manifold.numSolverContacts() > 0 ? 1 : 0
      // Query current transforms, since manifold points precede solver correction.
      const currentContact = f.table.collider.contactCollider(obstacle, 0.01)
      if (currentContact) maxPenetration = Math.max(maxPenetration, -currentContact.distance)
    })
    for (const body of [f.table.body, ...f.objects.entries.map((e) => e.body)]) {
      assert(finiteVector(body.translation()) && finiteVector(body.linvel()) && finiteVector(body.angvel()))
      assert(Number.isFinite(body.rotation().w))
    }
    assert.deepEqual({ ...f.table.fixed.translation() }, { x: 0, y: 0, z: 0 })
    assert.deepEqual({ ...f.table.fixed.rotation() }, { x: 0, y: 0, z: 0, w: 1 })
    assert.deepEqual({ ...f.table.body.rotation() }, { x: 0, y: 0, z: 0, w: 1 }, 'plate orientation fixed')
    assert(Math.abs(f.table.body.translation().y - PLATE_HEIGHT) < 1e-7, 'plate height fixed')
  }
}
assert(f.table.body.isFixed())
assert.equal(f.table.plate.geometry.parameters.radiusTop * 2, 1.2)
assert.equal(f.table.plate.geometry.parameters.height, 0.01)
assert(Math.abs(f.table.plate.position.y + TABLE_THICKNESS / 2 - 0.9) < 1e-10, '900 mm tabletop height')
assert.equal(f.table.ball.geometry.parameters.radius, 0.035)
assert(Math.abs(PIVOT_HEIGHT + JOINT_RADIUS - (PLATE_HEIGHT - TABLE_THICKNESS / 2)) < 1e-10, 'ball touches underside without overlap')
const plateVertices = f.table.collider.vertices()
let maxPlateRadius = 0, maxPlateY = 0
for (let i = 0; i < plateVertices.length; i += 3) {
  maxPlateRadius = Math.max(maxPlateRadius, Math.hypot(plateVertices[i], plateVertices[i + 2]))
  maxPlateY = Math.max(maxPlateY, Math.abs(plateVertices[i + 1]))
}
assert(Math.abs(maxPlateY - TABLE_THICKNESS / 2) < 1e-7)
assert(Math.abs(maxPlateRadius - TABLE_RADIUS) < 1e-7)
const initialContact = f.table.collider.contactCollider(f.table.legCollider, 1)
assert(!initialContact || initialContact.distance > 0, 'no initial plate/leg overlap')
assert(Math.abs(f.table.plate.position.y - PLATE_HEIGHT) < 1e-8)
step(1200)
assert(f.table.actualNormal.y > 0.999, 'default table must be level')
f.objects.reset()
step(720)
for (const entry of f.objects.entries) {
  const local = new Vector3().copy(entry.body.translation()).sub(f.table.plate.position).applyQuaternion(f.table.plate.quaternion.clone().invert())
  assert(local.y > 0.03 && local.y < 0.06, `objects settle on plate: ${JSON.stringify(local)}`)
}
f.params.gravityX = 1; f.params.gravityY = -0.3
step(1200)
assert(f.table.actualNormal.y === 1, 'table ignores changing gravity')
f.params.smoothGravity = false
f.params.gravityX = 0; f.params.gravityY = 1
step(1200)
assert(contacts === 0, 'fixed plate never moves into supports')
assert(f.table.actualNormal.y > -0.5, 'plate must not invert through leg')
for (const { body } of f.objects.entries) {
  const local = new Vector3().copy(body.translation()).sub(f.table.plate.position).applyQuaternion(f.table.plate.quaternion.clone().invert())
  assert(local.length() < TABLE_RADIUS + 0.02, 'hemisphere contains objects during reversal')
}
const held = f.table.targetNormal.clone()
f.params.strength = 0
f.params.gravityX = 0; f.params.gravityY = 0; f.params.gravityZ = 0
step(120)
assert(f.table.targetNormal.distanceTo(held) < 1e-10, 'zero gravity preserves target')
f.params.strength = 30
for (let n = 0; n < 16; n++) {
  f.params.gravityX = Math.sin(n * 1.7)
  f.params.gravityY = Math.cos(n * 1.7)
  f.params.gravityZ = Math.sin(n * 0.8)
  step(120)
}
assert(maxError < 0.002, `joint error ${maxError}`)
assert(maxPenetration < 0.001, `penetration ${maxPenetration}`)
f.objects.removeLast()
assert.equal(f.objects.entries.length, 2)
f.objects.clear(); f.world.free()
f = fixture()
f.objects.reset()
step(480)
assert(f.table.actualNormal.y > 0.99, `loaded reset normal ${f.table.actualNormal.y}`)
assert.equal(f.objects.entries.length, 3)
console.log(JSON.stringify({ result: 'PASS', maxJointErrorMetres: maxError, maxSupportPenetrationMetres: maxPenetration, supportContactSteps: contacts, resetObjectCount: f.objects.entries.length }, null, 2))
f.objects.clear(); f.world.free()
