import assert from 'node:assert/strict'
import { scaled as s, TABLE_RADIUS } from '../src/utils/dimensions.js'
import { PerspectiveCamera, Raycaster, Scene, Sphere, Vector2, Vector3 } from 'three'
import { createMouseGravity, intersectInteractionSphere } from '../src/controls/mouseGravity.js'
import { defaults } from '../src/controls/createGUI.js'
import { createGravitySystem } from '../src/physics/gravitySystem.js'
import { initializePhysics, createWorld, FIXED_DT } from '../src/physics/createWorld.js'
import { createTable } from '../src/objects/createTable.js'
import { createObjects } from '../src/objects/createObjects.js'
import { CENTER, PIVOT, limitTableNormal } from '../src/utils/mathUtils.js'

const params = { ...defaults }
for (const degrees of [0, 15, 45, 90, 180]) {
  for (const normal of [new Vector3(1, 0, 0), new Vector3(0, -1, 0), new Vector3(1, -2, 3).normalize()]) {
    limitTableNormal(normal, degrees)
    assert(Math.acos(Math.max(-1, Math.min(1, normal.y))) <= degrees * Math.PI / 180 + 1e-8)
    assert(Math.abs(normal.length() - 1) < 1e-10)
  }
}
const camera = new PerspectiveCamera(50, 1.25, 0.05, 300)
camera.position.set(0, s(12), s(10))
camera.lookAt(CENTER)
const sphere = new Sphere(CENTER.clone(), s(5)), caster = new Raycaster()
const hit = new Vector3()
assert(intersectInteractionSphere(camera, new Vector2(), sphere, caster, hit))
assert(Math.abs(hit.distanceTo(CENTER) - s(5)) < 1e-10)
// Choose the nearest positive hit from outside, exit hit from inside.
assert(hit.distanceTo(camera.position) < CENTER.distanceTo(camera.position))
camera.position.copy(CENTER); camera.lookAt(CENTER.clone().add(new Vector3(0, 1, 0)))
assert(intersectInteractionSphere(camera, new Vector2(), sphere, caster, hit))
assert(hit.distanceTo(CENTER.clone().add(new Vector3(0, s(5), 0))) < 0.001)
camera.position.set(0, s(12), s(10)); camera.lookAt(CENTER)
let previous
for (let i = -20; i <= 20; i++) {
  assert(intersectInteractionSphere(camera, new Vector2(i / 100, 0), sphere, caster, hit))
  const normal = hit.clone().sub(CENTER).normalize()
  if (previous) assert(normal.angleTo(previous) < 0.1, 'continuous ray hits')
  previous = normal
}
assert(!intersectInteractionSphere(camera, new Vector2(1, 1), sphere, caster, hit), 'miss outside silhouette')
class Events {
  listeners = new Map()
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn) }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn) }
  emit(type, event = {}) { this.listeners.get(type)?.forEach((fn) => fn(event)) }
}
const host = new Events(), canvas = new Events(), controls = new Events()
canvas.getBoundingClientRect = () => ({ left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800 })
let clockNow = 0, nextTimer = 0
const timers = new Map()
const clock = {
  performance: { now: () => clockNow },
  setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, at: clockNow + delay }); return id },
  clearTimeout(id) { timers.delete(id) },
}
function advance(ms) {
  clockNow += ms
  for (const [id, timer] of timers) if (timer.at <= clockNow) { timers.delete(id); timer.fn() }
}
let holdActions = 0
let restoreActions = 0
const input = createMouseGravity(canvas, camera, controls, params, host, clock, () => holdActions++, () => restoreActions++)
const move = (x, y, target = canvas) => host.emit('pointermove', { target, clientX: x, clientY: y })
assert(input.sample().y === -1, 'horizontal initial target')
move(500, 400)
const held = input.sample().clone(), heldP = input.target.clone()
assert(held.clone().negate().distanceTo(heldP.clone().sub(CENTER).normalize()) < 1e-12)
move(1000, 0)
assert(input.sample().distanceTo(held) < 1e-12 && input.target.distanceTo(heldP) < 1e-12, 'miss holds target')
controls.emit('start'); move(550, 400)
assert(input.sample().distanceTo(held) < 1e-12, 'drag freezes target')
controls.emit('end')
assert(input.sample().distanceTo(held) > 0.01, 'release resumes')
const resumed = input.sample().clone()
move(300, 100, { closest: () => true })
camera.position.set(0, s(4), s(10)); camera.lookAt(CENTER)
assert(input.sample().distanceTo(resumed) < 1e-12, 'GUI holds direction after camera change')
move(1200, 100)
assert(input.sample().distanceTo(resumed) < 1e-12, 'outside holds direction')
move(500, 400)
assert(input.sample().distanceTo(resumed) > 0.01, 'world ray follows changed camera')
const centerBefore = input.center.clone()
params.interactionRadius = s(7)
input.sample()
assert(Math.abs(input.target.distanceTo(CENTER) - s(7)) < 1e-10)
assert(input.center.distanceTo(centerBefore) === 0, 'C is fixed')
const down = (button = 0) => canvas.emit('pointerdown', { button, pointerId: 1 })
const up = () => host.emit('pointerup', { button: 0, pointerId: 1, target: canvas, clientX: 500, clientY: 400 })
down(); advance(999)
assert(!input.locked, 'short hold must not lock')
up(); advance(1)
assert(!input.locked)
down(); advance(1000)
assert(input.locked, '1 second hold locks before release')
assert(holdActions === 1, 'long hold triggers sculpture release once')
up()
assert(holdActions === 1, 'pointer-up does not trigger duplicate release')
const lockedTarget = input.target.clone()
move(550, 400)
assert(input.sample().clone().sub(input.direction).length() === 0)
assert(input.target.distanceTo(lockedTarget) === 0 && input.locked, 'release/move retains lock')
canvas.emit('dblclick', { button: 0, shiftKey: true, target: canvas, clientX: 550, clientY: 400 })
assert(input.locked && restoreActions === 0, 'Shift double-click is reserved for reset, not unlock')
canvas.emit('dblclick', { button: 0, target: canvas, clientX: 550, clientY: 400 })
assert(!input.locked)
assert(restoreActions === 1, 'left double-click restores sculpture modeling')
input.sample()
assert(input.target.distanceTo(lockedTarget) > 0.01, 'double click resumes ray input')
down(2); advance(4000)
assert(!input.locked, 'right button cannot lock')
down(); host.emit('blur'); advance(1000)
assert(!input.locked, 'blur cancels pending hold')
down(); host.emit('pointercancel', { pointerId: 1 }); advance(1000)
assert(!input.locked, 'cancelled pointer cannot lock')
down(); advance(1000); assert(input.locked)
input.reset()
assert(!input.locked && timers.size === 0, 'reset clears lock and timer')
input.lock()
move(550, 400)
assert(input.locked && input.sample().y === -1, 'reset then lock holds default gravity axis')
canvas.emit('dblclick', { button: 0, target: canvas, clientX: 550, clientY: 400 })
assert(!input.locked, 'double click also releases programmatic lock')
input.reset()
assert(input.coordinates.length() === 0 && input.direction.y === -1)
input.dispose()
assert([...host.listeners.values(), ...canvas.listeners.values(), ...controls.listeners.values()].every((set) => set.size === 0))
assert(timers.size === 0)

await initializePhysics()
const world = createWorld(), gravity = createGravitySystem(params), scene = new Scene()
const table = createTable(world, scene), objects = createObjects(world, scene, table)
for (let i = 0; i < 1920; i++) {
  gravity.update(world, FIXED_DT, input.direction); world.step(); table.sync()
}
assert(table.actualNormal.y > 0.999, 'initial horizontal table')
objects.reset()
const spawnPositions = objects.entries.map(({ body }) => new Vector3().copy(body.translation()))
const desiredNormal = new Vector3(0.45, 1, 0.1).normalize()
camera.position.copy(CENTER).addScaledVector(desiredNormal, s(15))
camera.lookAt(CENTER)
const desiredP = new Vector3()
assert(intersectInteractionSphere(camera, new Vector2(), new Sphere(CENTER, params.interactionRadius), caster, desiredP))
const targetGravity = CENTER.clone().sub(desiredP).normalize()
for (let i = 0; i < 5760; i++) {
  gravity.update(world, FIXED_DT, targetGravity)
  assert(Math.abs(gravity.vector.length() - params.strength) < 1e-10)
  world.step(); table.sync()
  assert.deepEqual({ ...table.fixed.rotation() }, { x: 0, y: 0, z: 0, w: 1 })
  assert.deepEqual({ ...table.fixed.translation() }, { x: 0, y: 0, z: 0 })
  assert(input.center.distanceTo(CENTER) === 0)
}
assert(gravity.direction.distanceTo(targetGravity) < 1e-8)
assert(new Vector3().copy(world.gravity).distanceTo(gravity.vector) < 1e-10)
assert(table.actualNormal.distanceTo(new Vector3(0, 1, 0)) < 1e-10, 'table remains level under mouse gravity')
assert(objects.entries.some(({ body }, i) => new Vector3().copy(body.translation()).distanceTo(spawnPositions[i]) > 0.03), 'objects move independently inside the dome')
for (const { body } of objects.entries) {
  const local = new Vector3().copy(body.translation()).sub(table.plate.position).applyQuaternion(table.plate.quaternion.clone().invert())
  assert(local.length() < TABLE_RADIUS + 0.02, 'objects remain inside dome')
}
params.gravityMode = 'Manual'; params.smoothGravity = false
params.gravityX = 0; params.gravityY = -1; params.gravityZ = 0
gravity.update(world, FIXED_DT, targetGravity)
assert(gravity.direction.y === -1)
objects.clear(); world.free()
console.log('PASS: ray/sphere hit/miss/inside/continuity, NDC, fixed C, drag/GUI/outside, camera/radius changes, reset/cleanup, 7680 Rapier steps, constant strength, table/object response, Manual mode')
