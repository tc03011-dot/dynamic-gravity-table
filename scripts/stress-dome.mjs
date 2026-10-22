import assert from 'node:assert/strict'
import { Scene, Vector3 } from 'three'
import { initializePhysics, createWorld, RAPIER } from '../src/physics/createWorld.js'
import { createTable } from '../src/objects/createTable.js'
import { createGravitySystem } from '../src/physics/gravitySystem.js'
import { defaults } from '../src/controls/createGUI.js'
import { TABLE_THICKNESS, TABLE_RADIUS } from '../src/utils/dimensions.js'
import { createObjects } from '../src/objects/createObjects.js'

await initializePhysics()
let escapes = 0
// Aim directly at azimuth/elevation seams, near the plate seam and dome pole.
for (let test = 0; test < 24; test++) {
  const world = createWorld(), table = createTable(world, new Scene())
  const params = { ...defaults, gravityMode: 'Manual', smoothGravity: false }
  const gravity = createGravitySystem(params)
  const azimuth = test * Math.PI / 12
  const elevation = [0.025, Math.PI / 16, Math.PI / 4, Math.PI / 2][test % 4]
  const direction = new Vector3(Math.cos(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.sin(azimuth) * Math.cos(elevation))
  const origin = table.plate.position.clone().add(new Vector3(0, 0.1, 0))
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(...origin.toArray()).setCcdEnabled(true))
  const shape = test % 3 === 0 ? RAPIER.ColliderDesc.ball(0.03) : test % 3 === 1 ? RAPIER.ColliderDesc.cuboid(0.03, 0.03, 0.03) : RAPIER.ColliderDesc.cylinder(0.035, 0.03)
  world.createCollider(shape.setMass(0.03).setRestitution(0.3), body)
  body.setLinvel(direction.multiplyScalar(12), true)
  for (let step = 0; step < 960; step++) {
    const angle = step / 100 + test
    params.gravityX = Math.sin(angle); params.gravityY = -Math.cos(angle); params.gravityZ = Math.sin(angle * 0.7)
    gravity.update(world, world.timestep); world.step(); table.sync()
    const local = new Vector3().copy(body.translation()).sub(table.plate.position).applyQuaternion(table.plate.quaternion.clone().invert())
    if (!local.toArray().every(Number.isFinite) || local.clone().sub(new Vector3(0, TABLE_THICKNESS / 2, 0)).length() > TABLE_RADIUS + 0.03 || local.y < -0.04) { escapes++; break }
  }
  world.free()
}
console.log(JSON.stringify({ cases: 24, speedMetresPerSecond: 12, escapes }))
assert.equal(escapes, 0, 'high-speed objects must stay inside rotating dome')
const world = createWorld(), scene = new Scene(), table = createTable(world, scene)
const objects = createObjects(world, scene, table)
assert.equal(objects.add('sphere', new Vector3(0, 1.4, 0)), true)
assert.equal(objects.add('sphere', new Vector3(0, 1.4, 0)), false, 'reject identical overlapping spawn')
assert.equal(objects.add('cube', new Vector3(10, 10, 10)), false, 'reject spawn outside shell')
assert.equal(objects.entries.length, 1)
objects.clear(); world.free()
console.log('PASS: duplicate/outside spawns rejected without adding bodies')
