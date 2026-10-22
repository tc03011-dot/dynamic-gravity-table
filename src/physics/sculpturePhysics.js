import { Quaternion, Vector3 } from 'three'
import { RAPIER } from './createWorld.js'
import { scaled } from '../utils/dimensions.js'
import { TABLE_THICKNESS } from '../utils/dimensions.js'
import { syncMesh } from '../utils/mathUtils.js'

export function createSculpturePhysics(world, scene) {
  const entries = []
  const floor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.1, 0))
  world.createCollider(RAPIER.ColliderDesc.cuboid(scaled(50), 0.1, scaled(50)).setContactSkin(0.0005).setFriction(0.7).setRestitution(0.05), floor)
  function release(dish) {
    if (dish.released || !dish.root.visible) return null
    dish.root.updateWorldMatrix(true, false)
    const position = dish.root.getWorldPosition(new Vector3())
    const rotation = dish.root.getWorldQuaternion(new Quaternion())
    const parent = dish.root.parent
    const modelPosition = dish.root.position.clone()
    const modelRotation = dish.root.quaternion.clone()
    // Snapshot the currently rendered vertices; one solid convex envelope is used
    // for stable rigid-body dropping, not a hollow or deforming cup collider.
    const vertices = new Float32Array(dish.mesh.geometry.attributes.position.array)
    const shape = RAPIER.ColliderDesc.convexHull(vertices)
    if (!shape) throw new Error('Cannot capture sculpture collision envelope')
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z).setRotation(rotation)
      .setGravityScale(0).setCcdEnabled(true).setSoftCcdPrediction(0.05)
      .setAdditionalSolverIterations(16).setLinearDamping(0.05).setAngularDamping(0.25))
    try {
      world.createCollider(shape.setMass(0.15).setContactSkin(0.001).setFriction(0.6).setRestitution(0.08), body)
    } catch (error) { world.removeRigidBody(body); throw error }
    dish.freezeForPhysics()
    scene.attach(dish.root) // Preserve pose while detaching from the fixed tabletop.
    const entry = { dish, body, parent, modelPosition, modelRotation }
    entries.push(entry)
    return entry
  }
  function step() {
    for (const { body } of entries) {
      // GravityScale=0 disables variable world gravity only for these sculptures.
      // Clear persistent forces, then apply the original 9.81 m/s2 downward force.
      body.resetForces(false)
      body.addForce({ x: 0, y: -9.81 * body.mass(), z: 0 }, false)
    }
  }
  function sync() { for (const { dish, body } of entries) syncMesh(dish.root, body) }
  function advance() {
    const dt = world.timestep
    let speed = 0
    for (const { dish, body } of entries) {
      const linear = body.linvel(), angular = body.angvel()
      speed = Math.max(speed, Math.hypot(linear.x, linear.y, linear.z)
        + Math.hypot(angular.x, angular.y, angular.z) * dish.footprintRadius)
    }
    // Limit travel within each integration interval, including rotating vertices.
    // This supplements nonlinear CCD for a thin tabletop under high-speed impacts.
    const substeps = Math.min(128, Math.max(1, Math.ceil(speed * dt / (Math.min(TABLE_THICKNESS, 0.005) * 0.1))))
    try {
      world.timestep = dt / substeps
      for (let i = 0; i < substeps; i++) { step(); world.step() }
    } finally { world.timestep = dt }
  }
  function restoreAll(gravity) {
    for (const { dish, body, parent, modelPosition, modelRotation } of entries) {
      world.removeRigidBody(body)
      parent.add(dish.root)
      dish.root.position.copy(modelPosition)
      dish.root.quaternion.copy(modelRotation)
      dish.restoreForModeling()
      dish.update(gravity)
    }
    const count = entries.length
    entries.length = 0
    return count
  }
  function reservations() {
    return entries.map(({ dish, modelPosition }) => ({ root: { position: modelPosition }, footprintRadius: dish.footprintRadius }))
  }
  function clear() {
    for (const { dish, body } of entries) { world.removeRigidBody(body); dish.dispose() }
    entries.length = 0
  }
  return { entries, floor, release, step, advance, sync, restoreAll, reservations, clear }
}
