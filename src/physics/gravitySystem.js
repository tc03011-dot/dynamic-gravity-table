import { Quaternion, Vector3 } from 'three'
import { finiteVector } from '../utils/mathUtils.js'

export function createGravitySystem(params) {
  const direction = new Vector3(0, -1, 0)
  const vector = new Vector3(0, -9.81, 0)
  const requested = direction.clone()
  function update(world, dt, mouseDirection) {
    const mouseMode = params.gravityMode === 'Center-to-Mouse' && mouseDirection
    if (mouseMode) requested.copy(mouseDirection)
    else requested.set(params.gravityX, params.gravityY, params.gravityZ)
    if (finiteVector(requested) && requested.lengthSq() > 1e-10) requested.normalize()
    else requested.copy(direction)
    if (mouseMode || params.smoothGravity) {
      const rotation = new Quaternion().setFromUnitVectors(direction, requested)
      const rate = mouseMode ? params.mouseSmoothing : params.transitionSpeed
      const step = new Quaternion().slerp(rotation, 1 - Math.exp(-rate * dt))
      direction.applyQuaternion(step).normalize()
    } else direction.copy(requested)
    vector.copy(direction).multiplyScalar(params.strength)
    world.gravity = { x: vector.x, y: vector.y, z: vector.z }
    if (vector.distanceToSquared(lastVector) > 1e-12) {
      world.forEachRigidBody((body) => { if (body.isDynamic()) body.wakeUp() })
      lastVector.copy(vector)
    }
  }
  const lastVector = vector.clone()
  return { direction, vector, update }
}
