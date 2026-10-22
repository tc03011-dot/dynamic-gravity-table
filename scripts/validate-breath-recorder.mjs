import assert from 'node:assert/strict'
import { defaults } from '../src/controls/createGUI.js'
import { createBreathRecorder } from '../src/controls/createBreathRecorder.js'

// Browser API stubs validate asynchronous permission/cleanup, not real hardware.
class Element extends EventTarget {
  children = []
  append(...children) { this.children.push(...children) }
  setAttribute() {}
  remove() { this.removed = true }
}
const doc = new Element()
doc.createElement = () => new Element()
doc.hidden = false
Object.defineProperty(globalThis, 'document', { configurable: true, value: doc })
let time = 0, timerId = 0, inputLevel = 0.04, acquisitionCount = 0
const timers = new Map()
function advance(seconds) {
  time += seconds
  for (const [id, timer] of [...timers]) {
    if (timer.time <= time) { timers.delete(id); timer.callback() }
  }
}
Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => time * 1000 } })
globalThis.setTimeout = (callback, delay) => { timers.set(++timerId, { callback, time: time + delay / 1000 }); return timerId }
globalThis.clearTimeout = (id) => timers.delete(id)
const streams = [], contexts = []
function createStream() {
  const track = new Element()
  track.stop = () => { track.stopped = true }
  const stream = { getTracks: () => [track], getAudioTracks: () => [track], track }
  streams.push(stream)
  return stream
}
let acquire = async () => createStream()
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: () => { acquisitionCount++; return acquire() } } } })
globalThis.AudioContext = class {
  constructor() { contexts.push(this) }
  async resume() {}
  async close() { this.closed = true }
  createAnalyser() { return { fftSize: 2048, disconnect() {}, getFloatTimeDomainData(data) { for (let i = 0; i < data.length; i++) data[i] = i % 2 ? inputLevel : -inputLevel } } }
  createMediaStreamSource() { return { connect() {}, disconnect() {} } }
}
globalThis.MediaRecorder = class {
  state = 'inactive'
  mimeType = 'audio/webm'
  start() { this.state = 'recording' }
  stop() { this.state = 'inactive'; queueMicrotask(() => { this.ondataavailable?.({ data: new Blob(['fake audio']) }); this.onstop?.() }) }
}
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }
const canvas = new Element(), container = new Element(), params = { ...defaults, breathDuration: 3 }
let attached
const cup = { setRecording(take) { attached = take } }
let createdCount = 0, hasRoom = true
const recorder = createBreathRecorder({ canvas, container, params, getCup: () => cup,
  createCup: () => { if (!hasRoom) return null; createdCount++; return { setRecording(take) { attached = take } } } })
function click(shiftKey = true) {
  const event = new Event('pointerdown', { cancelable: true })
  Object.defineProperties(event, { button: { value: 2 }, shiftKey: { value: shiftKey } })
  canvas.dispatchEvent(event)
  return event
}
assert(!click(false).defaultPrevented && acquisitionCount === 0, 'ordinary right click remains camera input')
assert(click().defaultPrevented)
assert(createdCount === 1, 'new base cup created immediately on Shift right-click')
await flush()
assert(!recorder.session.active, 'waiting before microphone capture')
advance(0.49)
assert(!recorder.session.active, 'no sound deformation before 0.5 seconds')
advance(0.01)
assert(recorder.session.active && attached === recorder.session)
time += 1
click() // First of the stop double click.
time += 0.2
click()
await flush()
assert(!recorder.session.active && streams.at(-1).track.stopped, 'Shift right double-click finalizes and closes microphone')
await recorder.start()
const cancelledTake = recorder.session
assert(!cancelledTake.active)
recorder.finish()
advance(0.5)
assert(!cancelledTake.active && streams.at(-1).track.stopped, 'cancelling the 0.5-second preparation never starts recording later')
await recorder.start()
advance(0.5)
time += 1; recorder.update()
assert(recorder.session.progress > 0)
time += 3; recorder.update()
await flush()
assert(!recorder.session.active && recorder.session.progress === 1 && streams.at(-1).track.stopped, 'automatic finish')
assert(contexts.every((context) => context.closed))
let resolvePermission
acquire = () => new Promise((resolve) => { resolvePermission = resolve })
const pending = recorder.start()
await flush()
recorder.finish()
const late = createStream()
resolvePermission(late)
await pending
assert(late.track.stopped, 'late permission must not reactivate cancelled recording')
acquire = async () => { const error = new Error('denied'); error.name = 'NotAllowedError'; throw error }
await recorder.start()
assert(contexts.every((context) => context.closed), 'permission rejection closes context')
acquire = async () => createStream()
await recorder.start()
doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'))
assert(streams.at(-1).track.stopped, 'hidden page ends recording')
doc.hidden = false
await recorder.start()
recorder.reset()
assert(recorder.session === null && timers.size === 0)
await recorder.start()
recorder.dispose()
assert(streams.every((stream) => stream.track.stopped) && timers.size === 0)
const countBefore = acquisitionCount
const other = createBreathRecorder({ canvas: new Element(), container, params, getCup: () => cup, createCup: () => null })
await other.start()
assert(acquisitionCount === countBefore && timers.size === 0, 'full table rejects take before requesting microphone')
other.dispose()
console.log('PASS: Shift-only capture, ordinary right click, double-click finish, automatic finish, late permission cancellation, denial, hidden page, reset and disposal')
