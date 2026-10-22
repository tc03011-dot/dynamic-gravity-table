import './style.css'
import { scaled as s, PLATE_OFFSET } from './utils/dimensions.js'
import { ArrowHelper, Vector3 } from 'three'
import { createScene } from './scene/createScene.js'
import { createWorld, FIXED_DT, initializePhysics } from './physics/createWorld.js'
import { createGravitySystem } from './physics/gravitySystem.js'
import { createSculpturePhysics } from './physics/sculpturePhysics.js'
import { createTable } from './objects/createTable.js'
import { createObjects } from './objects/createObjects.js'
import { createProfileCup } from './objects/createProfileCup.js'
import { createProfilePreview } from './controls/createProfilePreview.js'
import { createBreathRecorder } from './controls/createBreathRecorder.js'
import { placeDishes, findDishPosition } from './objects/placeDishes.js'
import { createGUI, defaults } from './controls/createGUI.js'
import { createMouseGravity } from './controls/mouseGravity.js'
import { createGravityDebug } from './scene/createGravityDebug.js'
import { finiteVector, PIVOT, UP } from './utils/mathUtils.js'
import { initialCups, loadCups, saveCup } from './controls/cupLibrary.js'
import { createMobileGravity } from './controls/mobileGravity.js'

const app = document.querySelector('#app')
const status = document.createElement('aside')
status.className = 'status'
status.textContent = 'Loading physics…'
app.append(status)
let cleanup = () => status.remove()
let cancelled = false
if (import.meta.hot) import.meta.hot.dispose(() => { cancelled = true; cleanup() })

async function boot() {
  await initializePhysics()
  if (cancelled) return
  const view = createScene(app)
  const params = { ...defaults }
  const profilePreview = createProfilePreview(app)
  const domeButton = document.createElement('button')
  domeButton.type = 'button'
  domeButton.className = 'dome-toggle'
  domeButton.title = '반구 표시 전환 (충돌은 항상 유지)'
  function updateDomeButton() {
    domeButton.textContent = params.showDome ? '반구: 보임' : '반구: 숨김'
    domeButton.setAttribute('aria-pressed', String(params.showDome))
    domeButton.setAttribute('aria-label', params.showDome ? '반구 숨기기' : '반구 보이기')
  }
  function toggleDome() {
    params.showDome = !params.showDome
    updateDomeButton()
  }
  domeButton.addEventListener('click', toggleDome)
  app.append(domeButton)
  updateDomeButton()
  const mouseGravity = createMouseGravity(view.renderer.domElement, view.camera, view.controls, params, window, globalThis, releaseSculptures, restoreSculptures)
  let world, table, objects, gravity, profileCup, wavyCup, bowl, sculpturePhysics
  let breathRecorder = null
  let mobileGravity = null
  let recordedDishes = []
  let accumulator = 0
  let fault = ''
  let savedCups = [...initialCups]
  let libraryMessage = ''
  let libraryLoading = false
  try { savedCups = await loadCups() }
  catch (error) { libraryMessage = error.message }
  if (cancelled) { mouseGravity.dispose(); profilePreview.dispose(); domeButton.remove(); view.dispose(); return }
  function reset() {
    breathRecorder?.reset()
    sculpturePhysics?.clear()
    recordedDishes = []
    if (world) {
      objects.clear()
      table.visuals.traverse((object) => {
        object.geometry?.dispose()
        object.material?.dispose()
      })
      table.visuals.removeFromParent()
      world.free()
    }
    Object.assign(params, defaults)
    mouseGravity.reset()
    mobileGravity?.reset()
    world = createWorld()
    sculpturePhysics = createSculpturePhysics(world, view.scene)
    table = createTable(world, view.scene)
    profileCup = createProfileCup(table, params)
    wavyCup = createProfileCup(table, params, { variant: 'wavy' })
    bowl = createProfileCup(table, params, { variant: 'bowl' })
    placeDishes([profileCup, wavyCup, bowl])
    gravity = createGravitySystem(params)
    objects = createObjects(world, view.scene, table)
    objects.reset()
    accumulator = 0
    fault = ''
    // Shuffle a copy: a full tabletop gets a different selection each reset.
    const shuffled = [...savedCups]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    for (const entry of shuffled) {
      const cup = createProfileCup(table, params, { storedProfile: entry.profile, color: entry.color ?? null })
      const position = findDishPosition(cup.footprintRadius, vesselReservations())
      if (!position) { cup.dispose(); continue }
      cup.root.position.x = position.x; cup.root.position.z = position.z
      cup.update(gravity)
      recordedDishes.push(cup)
    }
    if (savedCups.length) libraryMessage = `저장 컵 ${recordedDishes.length}/${savedCups.length}개 배치 · 나머지는 파일에 보관`
  }
  reset()
  function releaseSculptures() {
    if (breathRecorder?.busy) breathRecorder.finish('형태 확정')
    for (const dish of [profileCup, wavyCup, bowl, ...recordedDishes]) {
      if (dish.released) continue
      dish.update(gravity)
      try { sculpturePhysics.release(dish) }
      catch (error) { fault = error.message; console.error(error) }
    }
  }
  function restoreSculptures() {
    if (!sculpturePhysics.entries.length) return
    params.gravityMode = 'Center-to-Mouse'
    mouseGravity.sample() // Read the double-click's current coordinates now.
    sculpturePhysics.restoreAll(gravity)
  }
  function vesselReservations() {
    return [profileCup, wavyCup, bowl, ...recordedDishes].filter((dish) => !dish.released)
      .concat(sculpturePhysics.reservations())
  }
  function createRecordingCup() {
    const cup = createProfileCup(table, params)
    const position = findDishPosition(cup.footprintRadius, vesselReservations())
    if (!position) { cup.dispose(); return null }
    params.showProfileCup = true
    cup.root.position.x = position.x; cup.root.position.z = position.z
    cup.update(gravity)
    recordedDishes.push(cup)
    return cup
  }
  breathRecorder = createBreathRecorder({ canvas: view.renderer.domElement, container: app, params, createCup: createRecordingCup, getCup: () => profileCup,
    saveToLibrary: async (cup) => {
      const saved = await saveCup(cup)
      if (!savedCups.some((entry) => entry.id === saved.id)) savedCups.push(saved)
      return saved
    },
  })
  async function onCanvasClick(event) {
    if (event.button !== 0 || !event.shiftKey) return
    if (libraryLoading) return
    libraryLoading = true
    mouseGravity.lock()
    try {
      savedCups = await loadCups()
      libraryMessage = ''
    } catch (error) { libraryMessage = error.message }
    finally {
      libraryLoading = false
      if (!cancelled) {
        const loadMessage = libraryMessage
        reset()
        mouseGravity.lock()
        if (loadMessage) libraryMessage = loadMessage
      }
    }
  }
  view.renderer.domElement.addEventListener('dblclick', onCanvasClick)
  mobileGravity = createMobileGravity({ container: app, controls: view.controls, params, actions: {
    record: () => breathRecorder.start(), finish: () => breathRecorder.finish('제작 완료'),
    drop: () => { mouseGravity.lock(); releaseSculptures() },
    restore: () => restoreSculptures(), save: () => breathRecorder.saveToLibrary(),
    reset: () => onCanvasClick({ button: 0, shiftKey: true }),
  } })
  const gui = createGUI(params, {
    cube: () => objects.add('cube'), sphere: () => objects.add('sphere'),
    cylinder: () => objects.add('cylinder'), remove: () => objects.removeLast(),
    resetObjects: () => objects.reset(), reset,
    // Keep captured cups in place while finding safe new positions for originals.
    randomizeDishes: () => {
      if (!recordedDishes.length && !sculpturePhysics.entries.length) { placeDishes([profileCup, wavyCup, bowl]); return }
      const all = vesselReservations()
      for (const dish of [profileCup, wavyCup, bowl]) {
        if (dish.released) continue
        const position = findDishPosition(dish.footprintRadius, all.filter((other) => other !== dish))
        if (position) { dish.root.position.x = position.x; dish.root.position.z = position.z }
      }
    },
  })
  const gravityArrow = new ArrowHelper(new Vector3(0, -1, 0), new Vector3(s(-4), s(4), 0), s(2), 0xffbd69)
  const targetArrow = new ArrowHelper(UP, PIVOT, s(1.8), 0x68e8b6)
  const actualArrow = new ArrowHelper(UP, PIVOT, s(1.4), 0x78aaff)
  const mouseDebug = createGravityDebug(view.scene, mouseGravity)
  view.scene.add(gravityArrow, targetArrow, actualArrow)
  let previous = null, frameId, lastStatus = 0
  function render(now) {
    const dt = previous === null ? 0 : Math.min((now - previous) / 1000, 0.1)
    previous = now
    if (!params.paused) {
      accumulator += dt
      while (accumulator >= FIXED_DT) {
        const mouseDirection = params.gravityMode === 'Center-to-Mouse' ? (mobileGravity.sample() ?? mouseGravity.sample()) : undefined
        gravity.update(world, FIXED_DT, mouseDirection)
        sculpturePhysics.advance()
        accumulator -= FIXED_DT
        const bodies = [table.body, ...objects.entries.map((entry) => entry.body), ...sculpturePhysics.entries.map((entry) => entry.body)]
        if (bodies.some((body) => !finiteVector(body.translation()) || !finiteVector(body.angvel()) || !finiteVector(body.linvel()) || !Number.isFinite(body.rotation().w))) {
          fault = 'Non-finite physics state: reset simulation to recover.'
          params.paused = true
          break
        }
      }
    } else accumulator = 0
    table.sync()
    breathRecorder.update()
    profileCup.update(gravity)
    profilePreview.update(params.cupThickness, breathRecorder.session)
    wavyCup.update(gravity)
    bowl.update(gravity)
    recordedDishes.forEach((dish) => dish.update(gravity))
    sculpturePhysics.sync()
    objects.sync()
    table.ball.visible = params.showJoint
    table.domeDebug.visible = params.showDome
    updateDomeButton()
    view.axes.visible = params.showAxes
    gravityArrow.visible = params.showGravity && params.strength > 0
    gravityArrow.setDirection(gravity.direction)
    gravityArrow.setLength(s(Math.max(0.2, Math.min(3, params.strength / 5))))
    targetArrow.setDirection(table.targetNormal)
    actualArrow.setDirection(table.actualNormal)
    mouseDebug.update(params)
    view.updateDebug(world, params.showColliders)
    if (now - lastStatus > 100) {
      const anchor = new Vector3(0, -PLATE_OFFSET, 0).applyQuaternion(table.plate.quaternion).add(table.plate.position)
      let contact = false
      for (const obstacle of [table.legCollider, table.baseCollider]) world.contactPair(table.collider, obstacle, (manifold) => { if (manifold.numSolverContacts() > 0) contact = true })
      const tilt = Math.acos(Math.max(-1, Math.min(1, table.actualNormal.y))) * 180 / Math.PI
      const gravityTilt = Math.acos(Math.max(-1, Math.min(1, -gravity.direction.y))) * 180 / Math.PI
      const alignment = Math.acos(Math.max(-1, Math.min(1, -gravity.direction.dot(table.actualNormal)))) * 180 / Math.PI
      status.textContent = `DYNAMIC GRAVITY TABLE\n${params.paused ? 'PAUSED' : 'RUNNING'} · ${objects.entries.length}/80 objects\ng = (${gravity.vector.x.toFixed(2)}, ${gravity.vector.y.toFixed(2)}, ${gravity.vector.z.toFixed(2)}) m/s²\nTilt ${tilt.toFixed(1)}° · anchor error ${(anchor.distanceTo(PIVOT) * 1000).toFixed(2)} mm\nSupport contact: ${contact ? 'YES' : 'no'}\nOrange: gravity · Green: target · Blue: actual\nDrag: orbit · Right drag: pan · Wheel: zoom${fault ? '\n' + fault : ''}`
      lastStatus = now
      status.textContent += `\nReleased sculptures: ${sculpturePhysics.entries.length} · downward gravity`
      status.textContent += `\n${libraryLoading ? '저장 컵 불러오는 중…' : libraryMessage}`
      status.textContent += `\nGravity input: ${mouseGravity.locked ? 'LOCKED · double-click to unlock' : 'hold left mouse 1s to lock'}`
      status.textContent += '\nShift + double-click: reset + lock gravity'
      if (mobileGravity.active) status.textContent += '\nMobile gravity input active'
      status.textContent += `\n${params.gravityMode} · Mouse (${mouseGravity.coordinates.x.toFixed(2)}, ${mouseGravity.coordinates.y.toFixed(2)})${mouseGravity.dragging ? ' · CAMERA DRAG' : ''}\nGravity tilt ${gravityTilt.toFixed(1)}° · normal error ${alignment.toFixed(1)}°\nC: (0, ${mouseGravity.center.y.toFixed(3)}, 0) · P: (${mouseGravity.target.x.toFixed(2)}, ${mouseGravity.target.y.toFixed(2)}, ${mouseGravity.target.z.toFixed(2)})\nPink: C–P gravity axis · Yellow: ray${mouseGravity.hasRay && !mouseGravity.lastHit ? ' (miss: holding P)' : ''}`
    }
    view.controls.update()
    view.viewGizmo.update()
    view.renderer.render(view.scene, view.camera)
    frameId = requestAnimationFrame(render)
  }
  frameId = requestAnimationFrame(render)
  cleanup = () => {
    breathRecorder.dispose()
    mobileGravity.dispose()
    profilePreview.dispose()
    domeButton.removeEventListener('click', toggleDome)
    domeButton.remove()
    cancelAnimationFrame(frameId)
    view.renderer.domElement.removeEventListener('dblclick', onCanvasClick)
    gui.destroy()
    mouseGravity.dispose()
    sculpturePhysics.clear()
    view.dispose()
    world.free()
    status.remove()
  }
}
boot().catch((error) => {
  console.error(error)
  status.textContent = `Unable to initialize simulation: ${error.message}`
})
