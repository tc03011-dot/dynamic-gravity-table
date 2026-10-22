import { Euler, MathUtils, Quaternion, Vector3 } from 'three'

export function orientationQuaternion(alpha, beta, gamma, screenAngle = 0) {
  return new Quaternion().setFromEuler(new Euler(
    MathUtils.degToRad(beta), MathUtils.degToRad(alpha), -MathUtils.degToRad(gamma), 'YXZ',
  )).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -MathUtils.degToRad(screenAngle)))
}

export function tiltInput(reference, current, maxDegrees = 45) {
  const normal = new Vector3(0, 0, 1).applyQuaternion(reference.clone().invert().multiply(current))
  const angle = Math.acos(MathUtils.clamp(normal.z, -1, 1))
  const horizontal = Math.hypot(normal.x, normal.y)
  const tilt = Math.min(MathUtils.degToRad(maxDegrees), Math.max(0, angle - MathUtils.degToRad(2)))
  return horizontal < 1e-8 ? { x: 0, y: 0, tilt: 0 }
    : { x: normal.x / horizontal, y: normal.y / horizontal, tilt }
}

export function createMobileGravity({ container, controls, params, actions }) {
  const panel = document.createElement('section')
  panel.className = 'mobile-controls'
  panel.setAttribute('aria-label', '휴대폰 조작')
  const info = document.createElement('div')
  info.setAttribute('aria-live', 'polite')
  info.textContent = '시작을 누르고 편한 자세를 기준으로 설정하세요'
  panel.append(info)
  let active = false, locked = false, dragging = false, disposed = false
  let current = null, reference = null, joystick = null, screenAngle = null
  const direction = new Vector3(0, -1, 0), forward = new Vector3(0, 0, -1)
  const buttons = []
  function button(label, callback) {
    const node = document.createElement('button')
    node.type = 'button'; node.textContent = label
    const handler = () => { Promise.resolve(callback()).catch((e) => { info.textContent = e.message }) }
    node.addEventListener('click', handler); panel.append(node); buttons.push([node, handler])
    return node
  }
  button('시작 · 센서 사용', async () => {
    if (!globalThis.isSecureContext) { info.textContent = '센서·마이크는 HTTPS에서 사용하세요. 아래 조이스틱은 사용할 수 있어요.'; return }
    const Sensor = globalThis.DeviceOrientationEvent
    if (!Sensor) { info.textContent = '센서 미지원 · 아래 조이스틱을 사용하세요'; return }
    if (typeof Sensor.requestPermission === 'function' && await Sensor.requestPermission() !== 'granted') {
      info.textContent = '센서 권한 거부 · 아래 조이스틱을 사용하세요'; return
    }
    if (disposed) return
    active = true; locked = false; joystick = null
    reference = current?.clone() ?? null
    params.gravityMode = 'Center-to-Mouse'
    info.textContent = current ? '현재 자세를 기준으로 시작합니다' : '센서 대기 중 · 반응이 없으면 조이스틱을 사용하세요'
  })
  button('현재 자세를 기준으로', () => {
    if (!current) { info.textContent = '센서를 시작하거나 조이스틱을 사용하세요'; return }
    reference = current.clone(); joystick = null; active = true; locked = false
    params.gravityMode = 'Center-to-Mouse'
    direction.set(0, -1, 0); info.textContent = '기준 설정 완료'
  })
  const lockButton = button('기울기 고정', () => {
    if (!active) { info.textContent = '먼저 센서 또는 조이스틱을 시작하세요'; return }
    locked = !locked; lockButton.textContent = locked ? '기울기 다시 조절' : '기울기 고정'
  })
  const tiltLabel = document.createElement('label')
  tiltLabel.textContent = '최대 기울기 45° '
  const range = document.createElement('input')
  range.type = 'range'; range.min = '5'; range.max = '90'; range.value = '45'
  range.setAttribute('aria-label', '최대 기울기 각도')
  const onRange = () => { tiltLabel.firstChild.textContent = `최대 기울기 ${range.value}° ` }
  range.addEventListener('input', onRange); tiltLabel.append(range); panel.append(tiltLabel)
  const pad = document.createElement('div')
  pad.className = 'gravity-pad'; pad.textContent = '중력 조이스틱 · 센서 대신 드래그'
  pad.setAttribute('role', 'group'); pad.setAttribute('aria-label', '중력 방향 조이스틱')
  let pointer = null
  function padMove(event) {
    if (event.pointerId !== pointer) return
    const rect = pad.getBoundingClientRect()
    joystick = { x: MathUtils.clamp((event.clientX - rect.left) / rect.width * 2 - 1, -1, 1),
      y: MathUtils.clamp(1 - (event.clientY - rect.top) / rect.height * 2, -1, 1) }
    active = true; params.gravityMode = 'Center-to-Mouse'
    info.textContent = locked ? '기울기 고정 중' : '조이스틱 입력 · 놓으면 방향 유지'
  }
  const padDown = (event) => { pointer = event.pointerId; pad.setPointerCapture(pointer); padMove(event) }
  const padUp = () => { pointer = null }
  pad.addEventListener('pointerdown', padDown); pad.addEventListener('pointermove', padMove)
  pad.addEventListener('pointerup', padUp); pad.addEventListener('pointercancel', padUp)
  panel.append(pad)
  button('불어서 만들기', () => actions.record())
  button('제작 완료', () => actions.finish())
  button('떨어뜨리기', () => { locked = true; lockButton.textContent = '기울기 다시 조절'; actions.drop() })
  button('다시 변형', () => { locked = false; lockButton.textContent = '기울기 고정'; actions.restore() })
  button('저장', () => actions.save())
  button('리셋', () => actions.reset())
  button('마우스로 조절', () => { active = false; locked = false; lockButton.textContent = '기울기 고정'; info.textContent = '기존 마우스 조작 사용' })
  container.append(panel)
  const coarse = matchMedia('(pointer: coarse)')
  function visibility() {
    panel.hidden = !coarse.matches
    container.classList.toggle('mobile-mode', coarse.matches)
  }
  visibility(); coarse.addEventListener('change', visibility)
  function orientation(event) {
    if (![event.alpha, event.beta, event.gamma].every(Number.isFinite)) return
    const angle = window.screen.orientation?.angle ?? window.orientation ?? 0
    current = orientationQuaternion(event.alpha, event.beta, event.gamma, angle)
    if (active && (!reference || angle !== screenAngle)) {
      reference = current.clone()
      info.textContent = '기준 설정 완료 · 휴대폰을 기울여 보세요'
    }
    screenAngle = angle
  }
  function onStart() { dragging = true }
  function onEnd() { dragging = false }
  window.addEventListener('deviceorientation', orientation)
  controls.addEventListener('start', onStart); controls.addEventListener('end', onEnd)
  function sample() {
    if (!active) return null
    if (locked || dragging || document.hidden) return direction
    let input
    if (joystick) {
      const length = Math.hypot(joystick.x, joystick.y)
      input = { x: length ? joystick.x / length : 0, y: length ? joystick.y / length : 0,
        tilt: Math.min(1, length) * MathUtils.degToRad(Number(range.value)) }
    } else if (reference && current) input = tiltInput(reference, current, Number(range.value))
    else return direction
    const candidate = new Vector3()
    controls.object.getWorldDirection(candidate); candidate.y = 0
    if (candidate.lengthSq() > 1e-6) forward.copy(candidate).normalize()
    const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize()
    direction.copy(right).multiplyScalar(input.x * Math.sin(input.tilt))
      .addScaledVector(forward, input.y * Math.sin(input.tilt))
    direction.y = -Math.cos(input.tilt)
    return direction.normalize()
  }
  function reset() {
    locked = true; joystick = null; reference = current?.clone() ?? null
    direction.set(0, -1, 0); lockButton.textContent = '기울기 다시 조절'
  }
  return { sample, reset, get active() { return active }, dispose() {
    disposed = true
    window.removeEventListener('deviceorientation', orientation)
    controls.removeEventListener('start', onStart); controls.removeEventListener('end', onEnd)
    coarse.removeEventListener('change', visibility)
    buttons.forEach(([node, handler]) => node.removeEventListener('click', handler))
    range.removeEventListener('input', onRange)
    pad.removeEventListener('pointerdown', padDown); pad.removeEventListener('pointermove', padMove)
    pad.removeEventListener('pointerup', padUp); pad.removeEventListener('pointercancel', padUp)
    panel.remove(); container.classList.remove('mobile-mode')
  } }
}
