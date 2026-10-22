import { BoxGeometry, CylinderGeometry, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three'
import { scaled as s, TABLE_RADIUS } from '../utils/dimensions.js'
import { RAPIER } from '../physics/createWorld.js'
import { releaseMesh, syncMesh } from '../utils/mathUtils.js'

export function createObjects(world, scene, table) {
  const entries = []
  const properties = {
    cube: { mass: 1.2, friction: 0.65, restitution: 0.12, color: 0xd39863 },
    sphere: { mass: 0.8, friction: 0.35, restitution: 0.35, color: 0x74b6b1 },
    cylinder: { mass: 1, friction: 0.5, restitution: 0.16, color: 0x9a90c8 },
  }
  function add(type, localPosition) {
    if (entries.length >= 80) return
    const radius = type === 'sphere' ? s(0.28) : type === 'cube' ? Math.sqrt(3) * s(0.28) : Math.hypot(s(0.3), s(0.27))
    let position
    for (let attempt = 0; attempt < 120; attempt++) {
      const offset = localPosition?.clone().multiplyScalar(s(1))
        ?? new Vector3((Math.random() - 0.5) * 0.44, 0.08 + Math.random() * 0.18, (Math.random() - 0.5) * 0.44)
      if (offset.length() + radius > TABLE_RADIUS - 0.02) { if (localPosition) return false; continue }
      const candidate = offset.applyQuaternion(table.plate.quaternion).add(table.plate.position)
      if (entries.every((entry) => candidate.distanceTo(entry.body.translation()) > radius + entry.radius + 0.002)) {
        position = candidate
        break
      }
      if (localPosition) return false
    }
    // A crowded enclosure should reject a spawn instead of creating interpenetration.
    if (!position) return false
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z).setRotation(table.plate.quaternion)
      .setCcdEnabled(true).setSoftCcdPrediction(0.02).setLinearDamping(0.02).setAngularDamping(0.04))
    let geometry, shape
    if (type === 'sphere') {
      geometry = new SphereGeometry(s(0.28), 24, 16)
      shape = RAPIER.ColliderDesc.ball(s(0.28))
    } else if (type === 'cylinder') {
      geometry = new CylinderGeometry(s(0.27), s(0.27), s(0.6), 24)
      shape = RAPIER.ColliderDesc.cylinder(s(0.3), s(0.27))
    } else {
      geometry = new BoxGeometry(s(0.56), s(0.56), s(0.56))
      shape = RAPIER.ColliderDesc.cuboid(s(0.28), s(0.28), s(0.28))
    }
    const p = properties[type]
    world.createCollider(shape.setMass(p.mass * 0.03).setFriction(p.friction).setRestitution(p.restitution), body)
    const mesh = new Mesh(geometry, new MeshStandardMaterial({ color: p.color, roughness: 0.65 }))
    scene.add(mesh)
    syncMesh(mesh, body)
    entries.push({ mesh, body, type, radius })
    return true
  }
  function removeLast() {
    const entry = entries.pop()
    if (!entry) return
    world.removeRigidBody(entry.body)
    releaseMesh(entry.mesh)
  }
  function clear() { while (entries.length) removeLast() }
  function reset() {
    clear()
    add('cube', new Vector3(-1.2, 0.65, -0.6))
    add('sphere', new Vector3(0, 0.65, 0.5))
    add('cylinder', new Vector3(1.2, 0.65, -0.4))
  }
  function sync() { entries.forEach(({ mesh, body }) => syncMesh(mesh, body)) }
  return { entries, add, removeLast, clear, reset, sync }
}
