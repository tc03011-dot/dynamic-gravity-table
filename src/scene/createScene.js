import { AmbientLight, AxesHelper, BufferGeometry, Color, DirectionalLight, Float32BufferAttribute, GridHelper, LineBasicMaterial, LineSegments, PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createViewGizmo } from '../controls/createViewGizmo.js'
import { scaled as s, PLATE_HEIGHT } from '../utils/dimensions.js'
import { switchProjection } from '../controls/switchProjection.js'

export function createScene(container) {
  const scene = new Scene()
  scene.background = new Color(0x24262b)
  let camera = new PerspectiveCamera(50, 1, s(0.05), s(300))
  camera.position.set(s(9), PLATE_HEIGHT + s(3.5), s(10))
  const renderer = new WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  container.append(renderer.domElement)
  renderer.domElement.setAttribute('aria-label', 'Dynamic Gravity Table interactive simulation')
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, PLATE_HEIGHT - s(0.8), 0)
  controls.enableDamping = true
  controls.minDistance = s(2)
  controls.maxDistance = s(100)
  controls.update()
  const viewGizmo = createViewGizmo(container, camera, controls)
  const projectionButton = document.createElement('button')
  projectionButton.type = 'button'
  projectionButton.className = 'projection-toggle'
  projectionButton.textContent = '투시: 켜짐'
  projectionButton.setAttribute('aria-label', '투시 투영 켜짐, 클릭하여 평행 투영으로 전환')
  projectionButton.setAttribute('aria-pressed', 'true')
  projectionButton.title = '투시 / 평행 투영 전환'
  container.append(projectionButton)
  function toggleProjection() {
    if (!controls.enabled) return
    controls.dispatchEvent({ type: 'start' })
    const damping = controls.enableDamping
    controls.enableDamping = false
    controls.update()
    controls.enableDamping = damping
    const aspect = container.clientWidth / Math.max(1, container.clientHeight)
    camera = switchProjection(camera, controls.target, aspect)
    controls.object = camera
    controls.update()
    const perspective = camera.isPerspectiveCamera === true
    projectionButton.textContent = perspective ? '투시: 켜짐' : '투시: 꺼짐 (평행)'
    projectionButton.setAttribute('aria-pressed', String(perspective))
    projectionButton.setAttribute('aria-label', perspective ? '투시 투영 켜짐, 클릭하여 평행 투영으로 전환' : '평행 투영 켜짐, 클릭하여 투시 투영으로 전환')
    viewGizmo.update()
    controls.dispatchEvent({ type: 'end' })
  }
  projectionButton.addEventListener('click', toggleProjection)
  const light = new DirectionalLight(0xffffff, 3)
  light.position.set(s(5), s(10), s(7))
  const axes = new AxesHelper(s(2))
  scene.add(new AmbientLight(0xffffff, 1.3), light, new GridHelper(s(100), 100, 0x62666f, 0x393d45), axes)
  const debug = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.75 }))
  debug.frustumCulled = false
  debug.renderOrder = 10
  scene.add(debug)
  function updateDebug(world, visible) {
    debug.visible = visible
    if (!visible) return
    const { vertices, colors } = world.debugRender()
    debug.geometry.dispose()
    debug.geometry = new BufferGeometry()
    debug.geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
    debug.geometry.setAttribute('color', new Float32BufferAttribute(colors, 4))
  }
  function resize() {
    const aspect = container.clientWidth / Math.max(1, container.clientHeight)
    if (camera.isPerspectiveCamera) camera.aspect = aspect
    else {
      const halfHeight = (camera.top - camera.bottom) / 2
      camera.left = -halfHeight * aspect
      camera.right = halfHeight * aspect
    }
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
  }
  window.addEventListener('resize', resize)
  resize()
  function dispose() {
    projectionButton.removeEventListener('click', toggleProjection)
    projectionButton.remove()
    viewGizmo.dispose()
    window.removeEventListener('resize', resize)
    controls.dispose()
    const geometries = new Set(), materials = new Set()
    scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry)
      if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach((m) => materials.add(m))
    })
    geometries.forEach((g) => g.dispose())
    materials.forEach((m) => m.dispose())
    renderer.dispose()
    renderer.domElement.remove()
  }
  return { scene, get camera() { return camera }, renderer, controls, axes, viewGizmo, updateDebug, dispose }
}
