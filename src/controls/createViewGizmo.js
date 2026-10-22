import { MathUtils, Spherical, Vector3 } from 'three'

const axes = [
  ['X', 1, 0, 0, '#ee6374'], ['Y', 0, 1, 0, '#91cc55'], ['Z', 0, 0, 1, '#649ff5'],
  ['−X', -1, 0, 0, '#ee6374'], ['−Y', 0, -1, 0, '#91cc55'], ['−Z', 0, 0, -1, '#649ff5'],
]

// These helpers change only the camera, preserving the orbit target and distance.
export function orbitView(camera, controls, deltaX, deltaY) {
  const spherical = new Spherical().setFromVector3(camera.position.clone().sub(controls.target))
  spherical.theta -= deltaX
  spherical.phi = MathUtils.clamp(spherical.phi - deltaY, 1e-6, Math.PI - 1e-6)
  camera.position.copy(controls.target).add(new Vector3().setFromSpherical(spherical))
  camera.lookAt(controls.target)
}

export function alignView(camera, controls, direction) {
  const distance = camera.position.distanceTo(controls.target)
  const current = camera.position.clone().sub(controls.target).normalize()
  // At an aligned view the opposite buttons overlap; click again to flip sides.
  const sign = current.dot(direction) > 0.99999 ? -1 : 1
  camera.position.copy(controls.target).addScaledVector(direction, sign * distance)
  camera.lookAt(controls.target)
}

export function createViewGizmo(container, camera, controls) {
  const panel = document.createElement('div')
  panel.className = 'view-gizmo'
  panel.setAttribute('role', 'group')
  panel.setAttribute('aria-label', '카메라 방향: 축 클릭 또는 드래그로 회전')
  panel.title = '드래그: 시점 회전 · 축 클릭: 해당 축에서 보기'
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 128 128')
  svg.setAttribute('aria-hidden', 'true')
  panel.append(svg)
  const entries = axes.map(([label, x, y, z, color], index) => {
    const line = document.createElementNS(svg.namespaceURI, 'line')
    line.setAttribute('x1', '64'); line.setAttribute('y1', '64')
    line.setAttribute('stroke', color)
    line.setAttribute('stroke-width', index < 3 ? '2' : '1')
    svg.append(line)
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.dataset.axis = String(index)
    button.style.setProperty('--axis-color', color)
    button.setAttribute('aria-label', `${label}축 방향에서 보기`)
    panel.append(button)
    return { line, button, direction: new Vector3(x, y, z) }
  })
  container.append(panel)
  let drag = null
  function begin(event) {
    if (event.button !== 0 || drag) return
    event.preventDefault()
    // Flush old OrbitControls damping before moving the camera externally.
    const damping = controls.enableDamping
    controls.enableDamping = false
    controls.update()
    controls.enableDamping = damping
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, distance: 0,
      axis: event.target.dataset.axis, enabled: controls.enabled }
    controls.enabled = false
    controls.dispatchEvent({ type: 'start' })
    panel.setPointerCapture(event.pointerId)
    panel.classList.add('dragging')
  }
  function move(event) {
    if (!drag || drag.id !== event.pointerId) return
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y
    drag.distance += Math.hypot(dx, dy)
    if (drag.distance > 4) orbitView(controls.object, controls, dx * 0.012, dy * 0.012)
    drag.x = event.clientX; drag.y = event.clientY
  }
  function finish(event) {
    if (!drag || (event.pointerId !== undefined && drag.id !== event.pointerId)) return
    if (event.type === 'pointerup' && drag.distance <= 4 && drag.axis !== undefined) {
      alignView(controls.object, controls, entries[Number(drag.axis)].direction)
    }
    const previous = drag
    drag = null
    controls.enabled = previous.enabled
    controls.update()
    controls.dispatchEvent({ type: 'end' })
    if (panel.hasPointerCapture(previous.id)) panel.releasePointerCapture(previous.id)
    panel.classList.remove('dragging')
  }
  function keyboardClick(event) {
    if (event.detail !== 0 || event.target.dataset.axis === undefined) return
    const damping = controls.enableDamping
    controls.enableDamping = false; controls.update(); controls.enableDamping = damping
    controls.dispatchEvent({ type: 'start' })
    alignView(controls.object, controls, entries[Number(event.target.dataset.axis)].direction)
    controls.update()
    controls.dispatchEvent({ type: 'end' })
  }
  panel.addEventListener('pointerdown', begin)
  panel.addEventListener('pointermove', move)
  panel.addEventListener('pointerup', finish)
  panel.addEventListener('pointercancel', finish)
  panel.addEventListener('lostpointercapture', finish)
  panel.addEventListener('click', keyboardClick)
  window.addEventListener('blur', finish)
  function update() {
    const inverse = (controls.object ?? camera).quaternion.clone().invert()
    entries.forEach(({ line, button, direction }) => {
      const projected = direction.clone().applyQuaternion(inverse)
      const x = 64 + projected.x * 43, y = 64 - projected.y * 43
      line.setAttribute('x2', String(x)); line.setAttribute('y2', String(y))
      line.style.opacity = projected.z < 0 ? '0.3' : '0.9'
      button.style.left = `${x}px`; button.style.top = `${y}px`
      button.style.zIndex = String(10 + Math.round((projected.z + 1) * 10))
      button.style.opacity = projected.z < -0.1 ? '0.55' : '1'
    })
  }
  function dispose() {
    finish({ type: 'dispose' })
    window.removeEventListener('blur', finish)
    panel.removeEventListener('pointerdown', begin)
    panel.removeEventListener('pointermove', move)
    panel.removeEventListener('pointerup', finish)
    panel.removeEventListener('pointercancel', finish)
    panel.removeEventListener('lostpointercapture', finish)
    panel.removeEventListener('click', keyboardClick)
    panel.remove()
  }
  update()
  return { update, dispose }
}
