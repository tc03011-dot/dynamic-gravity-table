import assert from 'node:assert/strict'
import { Mesh, Vector3 } from 'three'
import { createCupProfile, createProfileCup } from '../src/objects/createProfileCup.js'
import { placeDishes, findDishPosition } from '../src/objects/placeDishes.js'
import { defaults } from '../src/controls/createGUI.js'
import { TABLE_RADIUS } from '../src/utils/dimensions.js'

const params = { ...defaults }, table = { plate: new Mesh() }
const dishes = ['smooth', 'wavy', 'bowl'].map((variant) => createProfileCup(table, params, { variant }))
const bowlProfile = createCupProfile({ variant: 'bowl' })
const height = Math.max(...bowlProfile.map((p) => p.y))
const width = 2 * Math.max(...bowlProfile.map((p) => p.x))
assert(height < 0.06 && width > 0.18 && width > 3 * height, 'low wide bowl')
let state = 47
function random() { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296 }
function verify(layout) {
  layout.forEach((p, index) => {
    assert(Math.hypot(p.x, p.z) + p.radius <= TABLE_RADIUS - 0.012 + 1e-8, 'inside circular tabletop')
    layout.slice(0, index).forEach((other) => assert(Math.hypot(p.x - other.x, p.z - other.z) >= p.radius + other.radius + 0.012 - 1e-8, 'reserved shapes do not overlap'))
  })
}
const signatures = new Set()
for (let i = 0; i < 500; i++) {
  const layout = placeDishes(dishes, random)
  verify(layout)
  signatures.add(JSON.stringify(layout))
}
assert(signatures.size > 490, 'positions randomized')
const originalPositions = dishes.map((dish) => dish.root.position.clone())
const inserted = findDishPosition(0.05, dishes, random)
assert(inserted, 'find an additional free position without moving the originals')
dishes.forEach((dish, index) => {
  assert(dish.root.position.distanceTo(originalPositions[index]) === 0)
  assert(Math.hypot(inserted.x - dish.root.position.x, inserted.z - dish.root.position.z) >= 0.05 + dish.footprintRadius + 0.012)
})
assert(findDishPosition(0.15, [{ root: { position: new Vector3() }, footprintRadius: TABLE_RADIUS - 0.01 }], random) === null, 'full tabletop safely rejects insertion')
verify(placeDishes(dishes, () => 0)) // Exhaust attempts, exercise guaranteed fallback.
for (const thickness of [1, 4.5, 8]) {
  params.cupThickness = thickness
  for (let i = 0; i < 8; i++) {
    const direction = new Vector3(Math.sin(i), Math.cos(i), Math.cos(i * 0.7)).normalize()
    for (const dish of dishes) {
      dish.update({ direction, vector: direction.clone().multiplyScalar(9.81) })
      const positions = dish.mesh.geometry.attributes.position
      let minY = Infinity
      for (let vertex = 0; vertex < positions.count; vertex++) {
        assert(Math.hypot(positions.getX(vertex), positions.getZ(vertex)) <= dish.footprintRadius + 1e-7, 'deformation stays in reserved footprint')
        minY = Math.min(minY, positions.getY(vertex) + dish.root.position.y)
      }
      assert(Math.abs(minY - 0.005) < 1e-8, 'bowl and cups touch tabletop')
    }
  }
}
console.log('PASS: bowl proportions, 500 random non-overlapping layouts, fallback, thickness extremes and deforming footprints')
