import assert from 'node:assert/strict'
import { Scene, Vector3 } from 'three'
import { createWorld, initializePhysics, FIXED_DT } from '../src/physics/createWorld.js'
import { createSculpturePhysics } from '../src/physics/sculpturePhysics.js'
import { createProfileCup } from '../src/objects/createProfileCup.js'
import { createTable } from '../src/objects/createTable.js'
import { defaults } from '../src/controls/createGUI.js'

await initializePhysics()
const world = createWorld(), scene = new Scene(), table = createTable(world, scene)
const simulation = createSculpturePhysics(world, scene)
const params = { ...defaults }
const gravity = { direction: new Vector3(0.6, -0.8, 0).normalize(), vector: new Vector3(6, -8, 0) }
const dish = createProfileCup(table, params)
dish.update(gravity)
const original = new Float32Array(dish.mesh.geometry.attributes.position.array)
scene.updateMatrixWorld(true)
const position = dish.root.getWorldPosition(new Vector3())
const entry = simulation.release(dish)
assert(entry && dish.released && dish.root.parent === scene)
assert(new Vector3().copy(entry.body.translation()).distanceTo(position) < 1e-6, 'capture does not teleport')
assert(simulation.release(dish) === null, 'release is idempotent')
gravity.direction.set(0, 1, 0); gravity.vector.set(0, 9.81, 0)
params.cupThickness = 8; params.cupSweep = 90
dish.update(gravity)
assert.deepEqual(dish.mesh.geometry.attributes.position.array, original, 'captured shape never deforms after release')

// Spawn a second snapshot beyond the table edge to test a genuine drop onto floor.
const falling = createProfileCup(table, { ...defaults })
falling.root.position.x = 1
falling.root.position.z = 0
falling.update({ direction: new Vector3(0, -1, 0), vector: new Vector3(0, -9.81, 0) })
falling.root.position.y += 0.3
const drop = simulation.release(falling)
world.gravity = { x: 50, y: 30, z: -20 }
const initialY = drop.body.translation().y
const initialX = drop.body.translation().x
for (let i = 0; i < 96; i++) { simulation.advance(); simulation.sync() }
assert(drop.body.translation().y < initialY - 0.03, 'falls downward even under upward world gravity')
assert(Math.abs(drop.body.translation().x - initialX) < 1e-5, 'variable horizontal gravity is disabled for sculpture')
assert(Math.abs(drop.body.linvel().y + 9.81 * 96 * FIXED_DT) < 0.02, 'downward acceleration is 9.81')
for (let i = 0; i < 2784; i++) {
  simulation.advance(); simulation.sync()
  assert(Number.isFinite(drop.body.translation().y) && drop.body.translation().y > -0.01)
}
const positions = falling.mesh.geometry.attributes.position
falling.root.updateMatrixWorld(true)
let lowest = Infinity
for (let i = 0; i < positions.count; i++) lowest = Math.min(lowest, falling.root.localToWorld(new Vector3().fromBufferAttribute(positions, i)).y)
assert(lowest > -0.002 && lowest < 0.005, 'lands on solid y=0 floor')
assert(Math.abs(drop.body.linvel().y) < 0.02)
assert(table.body.isFixed() && table.body.rotation().w === 1)
assert.deepEqual(dish.mesh.geometry.attributes.position.array, original)
const restored = simulation.restoreAll({ direction: new Vector3(0, -1, 0), vector: new Vector3(0, -9.81, 0) })
assert(restored === 2 && simulation.entries.length === 0)
assert(!dish.released && !falling.released && dish.root.parent === table.plate)
assert(dish.root.position.x === -0.105 && dish.root.position.z === -0.19, 'restore original tabletop location')
assert(dish.localAxis.y > 0.999, 'resume tracking current gravity axis')
assert(dish.mesh.geometry.attributes.position.array.some((value, index) => value !== original[index]), 'shape responds again after restore')
const secondRelease = simulation.release(dish)
assert(secondRelease && dish.released, 'can release again after double-click restore')
simulation.clear()
assert(simulation.entries.length === 0 && dish.root.parent === null)
falling.dispose()
world.free()
console.log('PASS: capture current mesh/pose, freeze shape, independent downward gravity, real drop and floor collision, fixed table, duplicate protection and cleanup')
