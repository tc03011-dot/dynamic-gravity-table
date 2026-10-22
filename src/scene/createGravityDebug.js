import { scaled as s } from '../utils/dimensions.js'
import { ArrowHelper, Group, Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three'

export function createGravityDebug(scene, input) {
  const group = new Group()
  scene.add(group)
  const center = new Mesh(new SphereGeometry(s(0.07), 16, 12), new MeshBasicMaterial({ color: 0xffffff, depthTest: false }))
  const target = new Mesh(new SphereGeometry(s(0.1), 16, 12), new MeshBasicMaterial({ color: 0xee88dd, depthTest: false }))
  center.renderOrder = target.renderOrder = 20
  const axis = new ArrowHelper(new Vector3(0, -1, 0), input.target, 10, 0xee88dd)
  const ray = new ArrowHelper(new Vector3(0, 0, -1), new Vector3(), 1, 0xf6ed85)
  group.add(center, target, axis, ray)
  function update(params) {
    const active = params.gravityMode === 'Center-to-Mouse'
    center.visible = params.showCenter
    target.visible = active && params.showTarget
    axis.visible = active && params.showGravityAxis
    ray.visible = active && params.showTarget && input.hasRay
    center.position.copy(input.center)
    target.position.copy(input.target)
    axis.position.copy(input.target)
    axis.setDirection(input.direction)
    axis.setLength(2 * input.sphere.radius)
    if (input.hasRay) {
      ray.position.copy(input.raycaster.ray.origin)
      ray.setDirection(input.raycaster.ray.direction)
      ray.setLength(input.lastHit ? ray.position.distanceTo(input.target) : ray.position.distanceTo(input.center) + input.sphere.radius)
    }
  }
  return { update }
}
