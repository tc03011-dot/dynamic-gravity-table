import assert from 'node:assert/strict'
import { Mesh, Vector3 } from 'three'
import { breathDisplacement, createBreathSession } from '../src/controls/breathSession.js'
import { createCupProfile, createProfileCup } from '../src/objects/createProfileCup.js'
import { defaults } from '../src/controls/createGUI.js'
import { placeDishes } from '../src/objects/placeDishes.js'

const params = { ...defaults, breathDuration: 10 }
assert(breathDisplacement(0, params) === 0)
assert(breathDisplacement(params.breathNoise, params) === 0)
assert(breathDisplacement(0.01, params) < 0, 'weak breath shrinks')
assert(Math.abs(breathDisplacement(params.breathNeutral / params.breathGain, params)) < 1e-10)
assert(breathDisplacement(0.1, params) > 0, 'strong breath expands')
assert(breathDisplacement(Number.NaN, params) === 0)
const session = createBreathSession(params)
session.start(100)
session.update(102, 0.01)
assert(Math.abs(session.progress - 0.2) < 1e-10)
const lower = Array.from(session.offsets.slice(0, 13))
session.update(105, 0.1)
assert.deepEqual(Array.from(session.offsets.slice(0, 13)), lower, 'past heights remain fixed')
assert(session.offsets[30] > 0 && session.offsets[60] === 0)
session.stop()
const stopped = session.offsets.slice()
session.update(200, 0.1)
assert.deepEqual(session.offsets, stopped, 'manual stop freezes results')
session.start(0)
assert(session.offsets.every((v) => v === 0), 'new take starts from straight base')
assert(session.update(10, 0.1) && session.progress === 1 && !session.active)
assert(session.offsets[64] > 0, 'automatic finish records upper rim')
for (const thickness of [0.001, 0.003, 0.008]) {
  const profile = createCupProfile({ thickness, radialOffsets: new Float32Array(65).fill(-1) })
  for (let i = 0; i < 65; i++) {
    const outer = profile[3 + i], inner = profile[68 + 64 - i]
    assert(inner.x >= 0.01 - 1e-10, '10 mm inner radius hard floor')
    assert(Math.abs(outer.x - inner.x - thickness) < 1e-10, 'wall thickness preserved')
  }
}
const plate = new Mesh()
const dishes = ['smooth', 'wavy', 'bowl'].map((variant) => createProfileCup({ plate }, params, { variant }))
placeDishes(dishes)
dishes[0].setRecording(session)
const gravity = { direction: new Vector3(0.7, 0.2, -0.4).normalize(), vector: new Vector3(1, 0, 0) }
for (const dish of dishes) dish.update(gravity)
const vertices = dishes[0].mesh.geometry.attributes.position
for (let i = 0; i < vertices.count; i++) {
  assert(Math.hypot(vertices.getX(i), vertices.getZ(i)) <= dishes[0].footprintRadius + 1e-7)
  assert(vertices.getY(i) + dishes[0].root.position.y >= 0.005 - 1e-8)
}
console.log('PASS: silence/weak/neutral/strong input, bottom-to-top capture, manual/automatic stop, new takes, 10 mm floor, wall thickness, reserved footprint and table contact')
