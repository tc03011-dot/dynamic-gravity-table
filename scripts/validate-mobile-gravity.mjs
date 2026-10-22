import assert from 'node:assert/strict'
import { PerspectiveCamera } from 'three'
import { orientationQuaternion, tiltInput, createMobileGravity } from '../src/controls/mobileGravity.js'

for (const screenAngle of [0, 90, 180, 270]) {
  const reference = orientationQuaternion(20, 55, -10, screenAngle)
  assert.equal(tiltInput(reference, reference).tilt, 0)
  for (let beta = -180; beta <= 180; beta += 15) {
    for (let gamma = -90; gamma <= 90; gamma += 15) {
      const value = tiltInput(reference, orientationQuaternion(20, beta, gamma, screenAngle))
      assert.ok([value.x, value.y, value.tilt].every(Number.isFinite))
      assert.ok(value.tilt >= 0 && value.tilt <= Math.PI / 4)
    }
  }
}
assert.equal(tiltInput(orientationQuaternion(0, 0, 0), orientationQuaternion(0, 1, 0)).tilt, 0)

class Node {
  constructor() { this.listeners = new Map(); this.children = []; this.classList = { toggle() {}, remove() {} } }
  setAttribute() {}
  append(...children) { this.children.push(...children) }
  addEventListener(type, fn) { this.listeners.set(type, fn) }
  removeEventListener(type) { this.listeners.delete(type) }
  remove() {}
  setPointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 200, height: 100 } }
  emit(type, event = {}) { return this.listeners.get(type)?.(event) }
}
globalThis.document = { createElement: () => new Node(), hidden: false }
const host = new Node()
host.screen = { orientation: { angle: 0 } }
globalThis.window = host
globalThis.matchMedia = () => Object.assign(new Node(), { matches: true })
globalThis.isSecureContext = true
globalThis.DeviceOrientationEvent = { requestPermission: async () => 'granted' }
const container = new Node(), controls = new Node()
controls.object = new PerspectiveCamera()
const params = { gravityMode: 'Center-to-Mouse' }
const counts = {}
const actions = Object.fromEntries(['record', 'finish', 'drop', 'restore', 'save', 'reset'].map((key) => [key, () => { counts[key] = (counts[key] || 0) + 1 }]))
const mobile = createMobileGravity({ container, controls, params, actions })
assert.equal(mobile.sample(), null, 'desktop input remains default before opt-in')
const panel = container.children[0]
const button = (label) => panel.children.find((node) => node.textContent === label)
host.emit('deviceorientation', { alpha: 0, beta: 50, gamma: 0 })
await button('시작 · 센서 사용').emit('click')
assert.ok(mobile.active)
assert.ok(mobile.sample().y < -0.999)
host.emit('deviceorientation', { alpha: 0, beta: 70, gamma: 20 })
const tilted = mobile.sample().clone()
assert.ok(tilted.y > -0.99)
assert.ok(Math.abs(tilted.length() - 1) < 1e-12)
await button('기울기 고정').emit('click')
host.emit('deviceorientation', { alpha: 0, beta: 30, gamma: -30 })
assert.ok(mobile.sample().distanceTo(tilted) < 1e-12)
await button('기울기 다시 조절').emit('click')
controls.emit('start')
assert.ok(mobile.sample().distanceTo(tilted) < 1e-12, 'camera drag freezes gravity input')
controls.emit('end')
assert.ok(mobile.sample().distanceTo(tilted) > 0.01)
await button('떨어뜨리기').emit('click')
await button('다시 변형').emit('click')
await button('저장').emit('click')
assert.deepEqual(counts, { drop: 1, restore: 1, save: 1 })
mobile.reset()
assert.ok(mobile.sample().y < -0.999)
await button('마우스로 조절').emit('click')
assert.equal(mobile.sample(), null)
const pad = panel.children.find((node) => node.className === 'gravity-pad')
pad.emit('pointerdown', { pointerId: 1, clientX: 200, clientY: 0 })
assert.ok(mobile.active)
assert.ok(Math.abs(mobile.sample().length() - 1) < 1e-12)
pad.emit('pointerup')
mobile.dispose()
assert.equal(host.listeners.size, 0)
assert.equal(controls.listeners.size, 0)
console.log('PASS: neutral calibration, angle cap, dead zone, finite sensor math, opt-in, camera drag, independent lock, actions, reset, joystick and cleanup')
