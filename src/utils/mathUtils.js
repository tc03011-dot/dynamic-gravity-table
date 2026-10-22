import { Quaternion, Vector3 } from 'three'
import { PIVOT_HEIGHT, PLATE_HEIGHT } from './dimensions.js'

export const UP = new Vector3(0, 1, 0)
export const PIVOT = new Vector3(0, PIVOT_HEIGHT, 0)
// Fixed initial plate centre, including the scaled plate offset above the joint.
export const CENTER = new Vector3(0, PLATE_HEIGHT, 0)
export const finiteVector = (v) => [v.x, v.y, v.z].every(Number.isFinite)
// Clamp the desired plate normal to a cone around world up, retaining azimuth.
export function limitTableNormal(normal, maxDegrees) {
  const limit = Math.max(0, Math.min(180, maxDegrees)) * Math.PI / 180
  const angle = Math.acos(Math.max(-1, Math.min(1, normal.y)))
  if (angle <= limit) return normal
  const horizontal = Math.hypot(normal.x, normal.z)
  if (horizontal > 1e-8) {
    normal.set(normal.x / horizontal * Math.sin(limit), Math.cos(limit), normal.z / horizontal * Math.sin(limit))
  } else normal.set(Math.sin(limit), Math.cos(limit), 0)
  return normal.normalize()
}
export function syncMesh(mesh, body) {
  mesh.position.copy(body.translation())
  mesh.quaternion.copy(body.rotation())
}
export function releaseMesh(mesh) {
  mesh.removeFromParent()
  mesh.geometry.dispose()
  mesh.material.dispose()
}
// Parallel-transport the previous orientation: no arbitrary yaw jumps near poles.
export function transportTarget(target, normal) {
  const previous = UP.clone().applyQuaternion(target)
  const delta = new Quaternion().setFromUnitVectors(previous, normal)
  return target.premultiply(delta).normalize()
}
