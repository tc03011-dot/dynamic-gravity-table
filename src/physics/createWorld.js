import RAPIER from '@dimforge/rapier3d-compat'

export { RAPIER }
export const FIXED_DT = 1 / 960
export async function initializePhysics() {
  await RAPIER.init()
}
export function createWorld() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  world.timestep = FIXED_DT
  world.numSolverIterations = 24
  world.integrationParameters.normalizedAllowedLinearError = 0.00005
  world.integrationParameters.normalizedPredictionDistance = 0.001
  world.integrationParameters.maxCcdSubsteps = 8
  return world
}
