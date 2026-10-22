import { CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three'
import { scaled as s, TABLE_RADIUS, TABLE_THICKNESS, PLATE_HEIGHT, JOINT_RADIUS, LEG_HEIGHT, LEG_CENTER } from '../utils/dimensions.js'
import { RAPIER } from '../physics/createWorld.js'
import { createDome } from './createDome.js'
import { PIVOT, UP, syncMesh } from '../utils/mathUtils.js'

export function createTable(world, scene) {
  const visuals = new Group()
  scene.add(visuals)
  const fixed = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  function part(geometry, color, position) {
    const mesh = new Mesh(geometry, new MeshStandardMaterial({ color, roughness: 0.65 }))
    mesh.position.copy(position)
    visuals.add(mesh)
    return mesh
  }
  part(new CylinderGeometry(s(0.85), s(0.85), s(0.22), 40), 0x555c67, new Vector3(0, s(0.11), 0))
  const baseCollider = world.createCollider(RAPIER.ColliderDesc.cylinder(s(0.11), s(0.85)).setTranslation(0, s(0.11), 0), fixed)
  // Leg ends below the pivot; the ball is visual only, avoiding self-collision.
  part(new CylinderGeometry(s(0.24), s(0.24), LEG_HEIGHT, 32), 0x69717c, new Vector3(0, LEG_CENTER, 0))
  const legCollider = world.createCollider(RAPIER.ColliderDesc.cylinder(LEG_HEIGHT / 2, s(0.24)).setTranslation(0, LEG_CENTER, 0), fixed)
  const ball = part(new SphereGeometry(JOINT_RADIUS, 32, 24), 0xf5b85a, PIVOT)
  const plate = part(new CylinderGeometry(TABLE_RADIUS, TABLE_RADIUS, TABLE_THICKNESS, 96), 0x929ca8, new Vector3(0, PLATE_HEIGHT, 0))
  // Upper hemisphere in plate-local space. Its equator lies on the top surface.
  const domeDebug = new Mesh(
    new SphereGeometry(TABLE_RADIUS, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new MeshBasicMaterial({ color: 0x8bbee8, wireframe: true, transparent: true, opacity: 0.25, depthWrite: false }),
  )
  domeDebug.name = 'table-upper-hemisphere'
  domeDebug.position.y = TABLE_THICKNESS / 2
  domeDebug.visible = false
  plate.add(domeDebug)
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed()
    .setTranslation(0, PLATE_HEIGHT, 0))
  // A static triangle mesh gives the thin plate explicit top/bottom contact faces
  // and exactly matches its render geometry, avoiding thin-cylinder degeneracy.
  const collider = world.createCollider(RAPIER.ColliderDesc.trimesh(
    new Float32Array(plate.geometry.attributes.position.array),
    new Uint32Array(plate.geometry.index.array),
  ).setContactSkin(0.0005).setFriction(0.65).setRestitution(0), body)
  const domeColliders = createDome(world, body)
  // The plate and its child hemisphere are immovable collision geometry.
  const targetNormal = UP.clone()
  const actualNormal = UP.clone()
  function sync() {
    syncMesh(plate, body)
    actualNormal.copy(UP).applyQuaternion(plate.quaternion)
  }
  return { fixed, body, collider, legCollider, baseCollider, domeColliders, domeDebug, visuals, ball, plate, targetNormal, actualNormal, sync }
}
