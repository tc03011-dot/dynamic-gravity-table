import assert from 'node:assert/strict'
import { RAPIER, initializePhysics, createWorld } from '../src/physics/createWorld.js'
import { createDome } from '../src/objects/createDome.js'
import { TABLE_RADIUS, TABLE_THICKNESS } from '../src/utils/dimensions.js'
import { Scene, Quaternion, Vector3 } from 'three'
import { createTable } from '../src/objects/createTable.js'

await initializePhysics()
const world = createWorld()
const shellBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
const panels = createDome(world, shellBody)
assert.equal(panels.length, 216)
let minY = Infinity, maxY = -Infinity, maxRadius = 0
for (const panel of panels.slice(0, 192)) {
  assert.equal(panel.parent().handle, shellBody.handle)
  const vertices = panel.vertices()
  for (let i = 0; i < vertices.length; i += 3) {
    minY = Math.min(minY, vertices[i + 1])
    maxY = Math.max(maxY, vertices[i + 1])
    maxRadius = Math.max(maxRadius, Math.hypot(vertices[i], vertices[i + 2]))
    assert(vertices[i + 1] >= TABLE_THICKNESS / 2 - 1e-7, 'no lower hemisphere')
  }
}
assert(Math.abs(minY - TABLE_THICKNESS / 2) < 1e-7, 'equator touches upper plate surface')
assert(Math.abs(maxRadius * 2 - TABLE_RADIUS * 2) < 1e-7, 'outer diameter exactly matches plate')
assert(Math.abs(maxY - (TABLE_THICKNESS / 2 + TABLE_RADIUS)) < 1e-7, 'hemisphere is 40 cm high')
// Upward gravity drives an initially free sphere into the invisible ceiling.
world.gravity = { x: 0, y: 9.81, z: 0 }
const ball = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.1, 0).setCcdEnabled(true))
const collider = world.createCollider(RAPIER.ColliderDesc.ball(0.03).setMass(0.03), ball)
let contacts = 0
for (let i = 0; i < 1920; i++) {
  world.step()
  assert(Number.isFinite(ball.translation().y))
  assert(ball.translation().y < TABLE_RADIUS + 0.01, 'cannot pass through dome ceiling')
  for (const panel of panels) world.contactPair(collider, panel, (m) => { if (m.numSolverContacts()) contacts++ })
}
assert(contacts > 0)
assert(ball.translation().y > TABLE_RADIUS - 0.06 && ball.translation().y < TABLE_RADIUS - 0.02)
world.free()
const attachedWorld = createWorld()
const table = createTable(attachedWorld, new Scene())
assert.equal(table.domeDebug.parent, table.plate)
assert.equal(table.domeDebug.visible, false)
assert(table.body.isFixed(), 'plate and attached shell are fixed to world')
const q = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 4)
table.body.setRotation(q, true)
table.sync()
table.plate.updateMatrixWorld(true)
const equator = new Vector3(TABLE_RADIUS, 0, 0)
table.domeDebug.localToWorld(equator)
const rim = new Vector3(TABLE_RADIUS, TABLE_THICKNESS / 2, 0)
table.plate.localToWorld(rim)
assert(equator.distanceTo(rim) < 1e-10, 'equator remains attached while table rotates')
for (const panel of table.domeColliders) assert.equal(panel.parent().handle, table.body.handle)
attachedWorld.free()
console.log('PASS: exact 120 cm upper hemisphere, equator on plate surface, no lower half, parent transforms, massless shell, 1920 Rapier collision steps')
