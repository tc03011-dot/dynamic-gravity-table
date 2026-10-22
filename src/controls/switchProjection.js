import { MathUtils, OrthographicCamera, PerspectiveCamera } from 'three'

export function switchProjection(current, target, aspect) {
  const tangent = Math.tan(MathUtils.degToRad(50) / 2)
  let next
  if (current.isPerspectiveCamera) {
    const halfHeight = current.position.distanceTo(target)
      * Math.tan(MathUtils.degToRad(current.fov) / 2) / current.zoom
    next = new OrthographicCamera(-halfHeight * aspect, halfHeight * aspect, halfHeight, -halfHeight, current.near, current.far)
    next.position.copy(current.position)
  } else {
    const distance = (current.top - current.bottom) / (2 * current.zoom * tangent)
    next = new PerspectiveCamera(50, aspect, current.near, current.far)
    next.position.copy(current.position).sub(target).normalize().multiplyScalar(distance).add(target)
  }
  next.up.copy(current.up)
  next.quaternion.copy(current.quaternion)
  next.updateProjectionMatrix()
  next.updateMatrixWorld(true)
  return next
}
