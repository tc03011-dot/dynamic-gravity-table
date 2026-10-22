import { MathUtils, Raycaster, Sphere, Vector2, Vector3 } from 'three'
import { scaled as s } from '../utils/dimensions.js'
import { CENTER } from '../utils/mathUtils.js'

// Analytic sphere only: scene meshes and physical objects are never raycast.
export function intersectInteractionSphere(camera, coordinates, sphere, raycaster, target) {
  camera.updateWorldMatrix(true, false)
  raycaster.setFromCamera(coordinates, camera)
  return raycaster.ray.intersectSphere(sphere, target)
}

export function createMouseGravity(canvas, camera, controls, params, host = window, clock = globalThis, onHold = () => {}, onUnlock = () => {}) {
  const coordinates = new Vector2()
  const center = CENTER.clone()
  const direction = new Vector3(0, -1, 0)
  const sphere = new Sphere(center, params.interactionRadius)
  const target = center.clone().add(new Vector3(0, sphere.radius, 0))
  const raycaster = new Raycaster()
  const hit = new Vector3()
  let dragging = false, inside = false, hasRay = false, lastHit = false
  let locked = false, press = null, holdTimer = null
  function cancelHold() {
    if (holdTimer !== null) clock.clearTimeout(holdTimer)
    holdTimer = null
    press = null
  }
  function onDown(event) {
    if (event.pointerType === 'touch' || event.button !== 0 || event.shiftKey || event.isPrimary === false || params.gravityMode !== 'Center-to-Mouse') return
    cancelHold()
    press = { id: event.pointerId, time: clock.performance.now() }
    holdTimer = clock.setTimeout(() => {
      if (press && params.gravityMode === 'Center-to-Mouse') latchHold()
      holdTimer = null
    }, 1000)
  }
  function onUp(event) {
    onMove(event)
    if (!press || event.pointerId !== press.id || event.button !== 0) return
    if (clock.performance.now() - press.time >= 1000 && params.gravityMode === 'Center-to-Mouse') latchHold()
    cancelHold()
  }
  function latchHold() {
    if (!press || press.triggered) return
    press.triggered = true
    locked = true
    onHold()
  }
  function onCancel(event) {
    if (press && event.pointerId === press.id) cancelHold()
  }
  function onDoubleClick(event) {
    if (event.sourceCapabilities?.firesTouchEvents || event.button !== 0 || event.shiftKey) return
    cancelHold()
    locked = false
    onMove(event)
    onUnlock()
  }
  function onMove(event) {
    const rect = canvas.getBoundingClientRect()
    inside = event.target === canvas && !event.target.closest?.('.lil-gui')
      && event.clientX >= rect.left && event.clientX <= rect.right
      && event.clientY >= rect.top && event.clientY <= rect.bottom
    if (!inside || rect.width <= 0 || rect.height <= 0) return
    coordinates.set(
      MathUtils.clamp(2 * (event.clientX - rect.left) / rect.width - 1, -1, 1),
      MathUtils.clamp(1 - 2 * (event.clientY - rect.top) / rect.height, -1, 1),
    )
  }
  function onStart() { dragging = true }
  function onEnd() { dragging = false }
  function onLeave() { inside = false; cancelHold() }
  function onBlur() { inside = false; dragging = false; cancelHold() }
  host.addEventListener('pointermove', onMove)
  host.addEventListener('pointerup', onUp)
  host.addEventListener('pointercancel', onCancel)
  host.addEventListener('blur', onBlur)
  canvas.addEventListener('pointerenter', onMove)
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('dblclick', onDoubleClick)
  canvas.addEventListener('pointerleave', onLeave)
  controls.addEventListener('start', onStart)
  controls.addEventListener('end', onEnd)
  function sample() {
    const radius = Math.max(s(0.1), Number.isFinite(params.interactionRadius) ? params.interactionRadius : s(5))
    if (sphere.radius !== radius) {
      sphere.radius = radius
      target.copy(center).addScaledVector(direction, -radius)
    }
    if (inside && !dragging && !locked) {
      const intersection = intersectInteractionSphere(controls.object ?? camera, coordinates, sphere, raycaster, hit)
      hasRay = true
      lastHit = Boolean(intersection && hit.distanceToSquared(center) > 1e-10)
      if (lastHit) {
        target.copy(hit)
        direction.subVectors(center, target).normalize()
      }
    }
    return direction
  }
  function reset() {
    cancelHold()
    locked = false
    coordinates.set(0, 0); direction.set(0, -1, 0)
    sphere.radius = params.interactionRadius
    target.copy(center).add(new Vector3(0, sphere.radius, 0))
    inside = false; dragging = false; hasRay = false; lastHit = false
  }
  function lock() {
    cancelHold()
    locked = true
  }
  function dispose() {
    cancelHold()
    host.removeEventListener('pointermove', onMove)
    host.removeEventListener('pointerup', onUp)
    host.removeEventListener('pointercancel', onCancel)
    host.removeEventListener('blur', onBlur)
    canvas.removeEventListener('pointerenter', onMove)
    canvas.removeEventListener('pointerdown', onDown)
    canvas.removeEventListener('dblclick', onDoubleClick)
    canvas.removeEventListener('pointerleave', onLeave)
    controls.removeEventListener('start', onStart)
    controls.removeEventListener('end', onEnd)
  }
  return { coordinates, center, target, sphere, raycaster, direction, sample, reset, lock, dispose,
    get locked() { return locked },
    get dragging() { return dragging }, get hasRay() { return hasRay }, get lastHit() { return lastHit } }
}
