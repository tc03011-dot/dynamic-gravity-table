import GUI from 'lil-gui'
import { scaled as s } from '../utils/dimensions.js'

export const defaults = {
  breathDuration: 12, breathGain: 12, breathNeutral: 0.3, breathNoise: 0.003,
  showProfileCup: true, showWavyCup: true, showBowl: true, cupThickness: 3, showCupProfile: true, showCupAxis: true, cupWireframe: false, cupSweep: 360,
  gravityMode: 'Center-to-Mouse', interactionRadius: s(5), mouseSmoothing: 5,
  showCenter: true, showTarget: true, showGravityAxis: true, showDome: false,
  gravityX: 0, gravityY: -1, gravityZ: 0, strength: 9.81,
  smoothGravity: true, transitionSpeed: 2,
  showJoint: true, showColliders: false, paused: false, showGravity: true, showAxes: true,
}
export function createGUI(params, actions) {
  const gui = new GUI({ title: 'Dynamic Gravity Table' })
  gui.add(params, 'gravityMode', ['Manual', 'Center-to-Mouse']).name('Gravity Control Mode').listen()
  const mouse = gui.addFolder('Center-to-Mouse')
  mouse.add(params, 'interactionRadius', s(0.5), s(15), 0.01).name('Interaction Sphere Radius').listen()
  mouse.add(params, 'mouseSmoothing', 0.1, 20, 0.1).name('Gravity Smoothing').listen()
  mouse.add(params, 'showCenter').name('Show Center Point').listen()
  mouse.add(params, 'showTarget').name('Show Target Point').listen()
  mouse.add(params, 'showGravityAxis').name('Show Gravity Axis').listen()
  const gravity = gui.addFolder('Gravity')
  for (const axis of ['X', 'Y', 'Z']) gravity.add(params, `gravity${axis}`, -1, 1, 0.01).name(`Gravity ${axis}`).listen()
  gravity.add(params, 'strength', 0, 30, 0.01).name('Gravity Strength').listen()
  gravity.add(params, 'smoothGravity').name('Smooth Gravity Transition').listen()
  gravity.add(params, 'transitionSpeed', 0.1, 10, 0.1).name('Gravity Transition Speed').listen()
  const table = gui.addFolder('Table')
  table.add(params, 'showDome').name('Show Collision Hemisphere').listen()
  table.add(params, 'showJoint').name('Show Joint').listen()
  table.add(params, 'showColliders').name('Show Colliders').listen()
  const objects = gui.addFolder('Objects')
  const breath = gui.addFolder('Breath Sculpting')
  breath.add(params, 'breathDuration', 3, 30, 1).name('Recording Duration (s)').listen()
  breath.add(params, 'breathGain', 1, 50, 0.5).name('Microphone Sensitivity').listen()
  breath.add(params, 'breathNeutral', 0.05, 0.9, 0.01).name('Neutral Input Level').listen()
  breath.add(params, 'breathNoise', 0.001, 0.03, 0.001).name('Silence Threshold').listen()
  const cup = gui.addFolder('Profile Cup')
  cup.add(params, 'showProfileCup').name('Show Cup').listen()
  cup.add(params, 'showWavyCup').name('Show Wavy Cup').listen()
  cup.add(params, 'showBowl').name('Show Bowl').listen()
  cup.add(actions, 'randomizeDishes').name('Randomize Dish Positions')
  cup.add(params, 'cupThickness', 1, 8, 0.5).name('Wall Thickness (mm)').listen()
  cup.add(params, 'cupSweep', 15, 360, 1).name('Revolution Angle (deg)').listen()
  cup.add(params, 'showCupProfile').name('Show Source Profile').listen()
  cup.add(params, 'showCupAxis').name('Show Revolution Axis').listen()
  cup.add(params, 'cupWireframe').name('Wireframe').listen()
  objects.add(actions, 'cube').name('Add Cube')
  objects.add(actions, 'sphere').name('Add Sphere')
  objects.add(actions, 'cylinder').name('Add Cylinder')
  objects.add(actions, 'remove').name('Remove Last Object')
  objects.add(actions, 'resetObjects').name('Reset Objects')
  const simulation = gui.addFolder('Simulation')
  simulation.add(params, 'paused').name('Pause / Resume').listen()
  simulation.add(actions, 'reset').name('Reset Simulation')
  simulation.add(params, 'showGravity').name('Show Gravity Vector').listen()
  simulation.add(params, 'showAxes').name('Show World Axes').listen()
  return gui
}
