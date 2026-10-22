import assert from 'node:assert/strict'
import { PerspectiveCamera, Vector3, Raycaster, Vector2, Sphere } from 'three'
import { alignView, orbitView } from '../src/controls/createViewGizmo.js'
import { switchProjection } from '../src/controls/switchProjection.js'

const camera = new PerspectiveCamera()
const controls = { target: new Vector3(0, 2.5, 0) }
camera.position.set(9, 7, 10)
camera.lookAt(controls.target)
const target = controls.target.clone(), radius = camera.position.distanceTo(target)
for (const axis of [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)]) {
  camera.position.set(9, 7, 10)
  camera.lookAt(target)
  alignView(camera, controls, axis)
  assert(camera.position.clone().sub(target).normalize().distanceTo(axis) < 1e-10)
  alignView(camera, controls, axis)
  assert(camera.position.clone().sub(target).normalize().distanceTo(axis.clone().negate()) < 1e-10)
  for (let i = 0; i < 100; i++) {
    orbitView(camera, controls, 0.2, i % 2 ? 10 : -10)
    assert(Math.abs(camera.position.distanceTo(target) - radius) < 1e-8)
    assert(camera.position.toArray().every(Number.isFinite))
    assert(camera.quaternion.toArray().every(Number.isFinite))
    const forward = camera.getWorldDirection(new Vector3())
    assert(forward.dot(target.clone().sub(camera.position).normalize()) > 0.999999)
    assert(controls.target.distanceTo(target) === 0)
  }
}
console.log('PASS: XYZ alignment/opposite-side toggle, drag rotation, pole stability, fixed orbit centre and distance')

camera.position.set(9, 7, 10)
camera.aspect = 1.6
camera.updateProjectionMatrix()
camera.lookAt(target)
camera.updateMatrixWorld(true)
const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
const point = target.clone().addScaledVector(right, 2)
const originalNdc = point.clone().project(camera)
let orthographic = switchProjection(camera, target, 1.6)
assert(orthographic.isOrthographicCamera)
assert(orthographic.position.distanceTo(camera.position) < 1e-10)
assert(Math.abs(point.clone().project(orthographic).x - originalNdc.x) < 1e-10, 'preserve scale on target plane')
orthographic.zoom = 2
orthographic.updateProjectionMatrix()
const zoomedNdc = point.clone().project(orthographic)
const perspective = switchProjection(orthographic, target, 1.6)
assert(perspective.isPerspectiveCamera)
assert(Math.abs(point.clone().project(perspective).x - zoomedNdc.x) < 1e-10, 'preserve orthographic zoom on return')
assert(perspective.quaternion.angleTo(camera.quaternion) < 1e-7)
const raycaster = new Raycaster()
raycaster.setFromCamera(new Vector2(0, 0), orthographic)
assert(raycaster.ray.intersectSphere(new Sphere(target, 1), new Vector3()), 'orthographic raycasting remains valid')
controls.object = orthographic
orbitView(orthographic, controls, 0.1, 0.1)
assert(orthographic.position.toArray().every(Number.isFinite))
alignView(orthographic, controls, new Vector3(1, 0, 0))
assert(orthographic.position.clone().sub(target).normalize().x > 0.999)
console.log('PASS: perspective/orthographic switch, target-plane scale, zoom, orientation, orthographic raycast and gizmo')
