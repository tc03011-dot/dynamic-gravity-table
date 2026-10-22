import { RAPIER } from '../physics/createWorld.js'
import { TABLE_RADIUS, TABLE_THICKNESS } from '../utils/dimensions.js'

// Hollow upper hemisphere: convex shell panels, not a solid ball collider.
// Local to the dynamic tabletop; intentionally no visual Mesh.
export function createDome(world, body) {
  const colliders = []
  const segments = 24, rings = 8
  const thickness = 0.008
  const angularOverlap = 0.008 // ~3 mm overlap at the equator.
  const surfaceY = TABLE_THICKNESS / 2
  function point(radius, elevation, azimuth) {
    return [radius * Math.cos(elevation) * Math.cos(azimuth),
      surfaceY + radius * Math.sin(elevation),
      radius * Math.cos(elevation) * Math.sin(azimuth)]
  }
  for (let ring = 0; ring < rings; ring++) {
    const low = Math.max(0, ring / rings * Math.PI / 2 - angularOverlap)
    const high = Math.min(Math.PI / 2, (ring + 1) / rings * Math.PI / 2 + angularOverlap)
    for (let segment = 0; segment < segments; segment++) {
      const a = segment / segments * Math.PI * 2 - angularOverlap
      const b = (segment + 1) / segments * Math.PI * 2 + angularOverlap
      const vertices = []
      // Outer diameter equals the plate exactly; shell thickness grows inward.
      for (const radius of [TABLE_RADIUS - thickness, TABLE_RADIUS]) {
        vertices.push(...point(radius, low, a), ...point(radius, low, b),
          ...point(radius, high, a), ...point(radius, high, b))
      }
      const desc = RAPIER.ColliderDesc.convexHull(new Float32Array(vertices))
      if (!desc) throw new Error('Unable to create hemisphere shell panel')
      // Treat the shell as an ideal massless guard; keep plate mass/inertia intact.
      colliders.push(world.createCollider(desc.setDensity(0).setContactSkin(0.0003).setFriction(0.4).setRestitution(0.1), body))
    }
  }
  // Hidden annular gasket overlaps the plate edge and the hemisphere's equator.
  // It closes the seam beside the plate's rounded edge without filling the dome.
  for (let segment = 0; segment < segments; segment++) {
    const a = segment / segments * Math.PI * 2 - angularOverlap
    const b = (segment + 1) / segments * Math.PI * 2 + angularOverlap
    const vertices = []
    for (const y of [-TABLE_THICKNESS / 2, surfaceY + 0.006]) {
      for (const radius of [TABLE_RADIUS - thickness, TABLE_RADIUS]) {
        for (const angle of [a, b]) vertices.push(radius * Math.cos(angle), y, radius * Math.sin(angle))
      }
    }
    const desc = RAPIER.ColliderDesc.convexHull(new Float32Array(vertices))
    if (!desc) throw new Error('Unable to create hemisphere rim seal')
    colliders.push(world.createCollider(desc.setDensity(0).setContactSkin(0.0003).setFriction(0.4).setRestitution(0), body))
  }
  return colliders
}
