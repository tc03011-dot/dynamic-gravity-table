import { TABLE_RADIUS } from '../utils/dimensions.js'

export function findDishPosition(radius, existing, random = Math.random) {
  const gap = 0.012, limit = TABLE_RADIUS - radius - gap
  const fits = (x, z) => Math.hypot(x, z) <= limit + 1e-10
    && existing.every((dish) => Math.hypot(x - dish.root.position.x, z - dish.root.position.z) >= radius + dish.footprintRadius + gap)
  for (let attempt = 0; attempt < 800; attempt++) {
    const angle = random() * Math.PI * 2, distance = Math.sqrt(random()) * Math.max(0, limit)
    const x = Math.cos(angle) * distance, z = Math.sin(angle) * distance
    if (fits(x, z)) return { x, z }
  }
  // Scan as well, so unlucky random samples do not reject an obvious free spot.
  for (let distance = 0; distance <= limit; distance += 0.008) {
    for (let step = 0; step < 180; step++) {
      const angle = step * Math.PI / 90
      const x = Math.cos(angle) * distance, z = Math.sin(angle) * distance
      if (fits(x, z)) return { x, z }
    }
  }
  return null
}

export function placeDishes(dishes, random = Math.random) {
  const gap = 0.012
  let layout = null
  for (let attempt = 0; attempt < 150 && !layout; attempt++) {
    const candidates = []
    for (const dish of dishes) {
      const radius = dish.footprintRadius
      const angle = random() * Math.PI * 2
      const distance = Math.sqrt(random()) * Math.max(0, TABLE_RADIUS - radius - gap)
      const candidate = { x: Math.cos(angle) * distance, z: Math.sin(angle) * distance, radius }
      if (candidates.some((other) => Math.hypot(candidate.x - other.x, candidate.z - other.z) < radius + other.radius + gap)) break
      candidates.push(candidate)
    }
    if (candidates.length === dishes.length) layout = candidates
  }
  // Deterministic safe fallback for the current three dishes, rotated randomly.
  if (!layout) {
    const phase = random() * Math.PI * 2
    layout = dishes.map((dish, index) => ({
      x: Math.cos(phase + index * Math.PI * 2 / dishes.length) * 0.2,
      z: Math.sin(phase + index * Math.PI * 2 / dishes.length) * 0.2,
      radius: dish.footprintRadius,
    }))
  }
  // Validate before touching any object; never silently accept an overlapping layout.
  layout.forEach((position, index) => {
    if (Math.hypot(position.x, position.z) + position.radius > TABLE_RADIUS - gap + 1e-8
      || layout.slice(0, index).some((other) => Math.hypot(position.x - other.x, position.z - other.z) < position.radius + other.radius + gap)) {
      throw new Error('No non-overlapping dish layout fits on this tabletop')
    }
  })
  dishes.forEach((dish, index) => {
    dish.root.position.x = layout[index].x
    dish.root.position.z = layout[index].z
  })
  return layout
}
