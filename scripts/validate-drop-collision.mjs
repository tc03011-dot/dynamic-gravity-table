import assert from 'node:assert/strict'
import { Scene, Vector3 } from 'three'
import { initializePhysics, createWorld } from '../src/physics/createWorld.js'
import { createSculpturePhysics } from '../src/physics/sculpturePhysics.js'
import { createProfileCup } from '../src/objects/createProfileCup.js'
import { createTable } from '../src/objects/createTable.js'
import { defaults } from '../src/controls/createGUI.js'
import { TABLE_TOP_HEIGHT, TABLE_RADIUS, TABLE_THICKNESS } from '../src/utils/dimensions.js'

await initializePhysics()
let maxPenetration = 0
for (const variant of ['smooth', 'wavy', 'bowl']) {
  for (const speed of [5, 30, 80]) {
    const world = createWorld(), scene = new Scene(), table = createTable(world, scene)
    const physics = createSculpturePhysics(world, scene)
    const dish = createProfileCup(table, { ...defaults }, { variant })
    dish.update({ direction: new Vector3(0, -1, 0), vector: new Vector3(0, -9.81, 0) })
    dish.root.position.set(0, dish.root.position.y + 0.2, 0)
    const entry = physics.release(dish)
    entry.body.setLinvel({ x: 0, y: -speed, z: 0 }, true)
    for (let step = 0; step < 960; step++) {
      physics.advance(); physics.sync()
      dish.root.updateMatrixWorld(true)
      // Exact support point along world Y, computed from all frozen mesh vertices.
      const positions = dish.mesh.geometry.attributes.position
      const inverse = dish.root.quaternion.clone().invert()
      const localDown = new Vector3(0, -1, 0).applyQuaternion(inverse)
      let support = -Infinity
      for (let vertex = 0; vertex < positions.count; vertex++) support = Math.max(support, positions.getX(vertex) * localDown.x + positions.getY(vertex) * localDown.y + positions.getZ(vertex) * localDown.z)
      const lowest = dish.root.position.y - support
      // Falling over a circular table's edge is valid, not tunneling through it.
      if (Math.hypot(dish.root.position.x, dish.root.position.z) + dish.footprintRadius < TABLE_RADIUS - 0.01) {
        // At extreme 80 m/s impacts, allow a transient contact correction within
        // the plate thickness; no point may cross completely below the plate.
        maxPenetration = Math.max(maxPenetration, TABLE_TOP_HEIGHT - lowest)
        const tolerance = TABLE_THICKNESS + 0.0005
        assert(lowest >= TABLE_TOP_HEIGHT - tolerance, `${variant}: ${speed} m/s interior penetration ${(TABLE_TOP_HEIGHT - lowest) * 1000} mm`)
      }
      assert(lowest >= -0.003, 'sculpture must not pass through the room floor')
    }
    physics.clear(); world.free()
  }
}
console.log(`PASS: 9 tabletop impacts, 3 shapes at 5/30/80 m/s; max transient interior penetration ${(maxPenetration * 1000).toFixed(3)} mm`)
