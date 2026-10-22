# Dynamic Gravity Table

Vite + Vanilla JavaScript + Three.js + Rapier + lil-gui. Units are metres,
kilograms and seconds. No rendering scale is used to fake physical dimensions.

## Run and verify

## Breath recording

Each start now immediately creates a new straight-profile cup in an unoccupied
tabletop position, without moving or overwriting existing cups. Once microphone
permission/setup is ready, a 0.5-second preparation countdown shows the untouched
new cup before audio capture and the bottom-to-top scan begin. The new source
profile and 3D surface then update together in real time. Previous completed cups
remain on the table until Reset Simulation. The original smooth cup, wavy cup and
bowl are never recorded over. Preparation can be cancelled by the same stop gesture.

Insertion reserves the full possible deformation footprint and a 12 mm gap.
If no position is found, no cup or microphone recording is created and the panel
reports that the table is full. The reserved space check concerns procedural
vessels; the separate dynamic cubes/spheres/cylinders do not have vessel collisions.
Reshuffling originals preserves recorded-cup positions. Reset clears all takes.

On the main canvas, Shift + right-click once starts microphone capture; Shift +
right-click twice within 450 ms stops early. A double click immediately after the
first start cancels that take, including a pending permission request. Ordinary
right-drag remains OrbitControls pan. The lower-right panel provides equivalent
Start/Stop buttons, input level, bottom-to-top recording progress and remaining time.

The default take lasts 12 seconds after preparation, then finishes automatically.
Recording affects only the newly created straight-profile cup. Other vessels are
unchanged. Each visited height records a radius offset. Silence
keeps the base radius; weak input shrinks, strong input expands. The inner wall is
clamped to 10 mm radius, preserving radial wall thickness. Neighbouring samples
are smoothed. Expansion is bounded at 15 mm and reserved in dish placement bounds.
Completed lower sections are not overwritten; an early stop leaves unvisited
upper sections at their base shape. The 2D panel shows a rising red recording head.

Breath Sculpting GUI sets duration (3-30 s, applied to the next take), microphone
sensitivity, neutral input level and silence threshold. Start with a comfortable
breath and adjust Neutral Input Level to the meter reading you want to preserve
the original radius. Input is RMS audio amplitude, not a breath classifier: speech
and background sounds can also deform the profile. There is no automatic calibration.

Completed profile coordinates and radial offsets can be saved as local JSON.
Where MediaRecorder is supported, the raw audio can also be downloaded. No audio
is uploaded or played through speakers. Mic tracks and AudioContext close on stop,
timeout, hidden page, Reset or HMR disposal; late permission results are discarded.
Pause/Resume freezes physics, not the independent timed recording session.

Microphone access needs browser permission and localhost or HTTPS. Hardware input,
actual Shift-click behavior and browser recording formats have not been tested
interactively. Tests use synthetic amplitudes and browser API stubs. Commands:
`npm.cmd run test:breath` and `npm.cmd run test:breath-recorder`.

```sh
npm.cmd install
npm.cmd run dev
npm.cmd run build
npm.cmd run test:physics
npm.cmd run test:mouse
npm.cmd run test:view
```

## Dimensions

An invisible hollow upper hemisphere covers the tabletop. Its outer radius
is exactly 0.6 m, with an 8 mm inward collision thickness, centred on the upper plate surface. It is
approximated by 192 overlapping convex panels and 24 rim seals on the same plate body. There
is no visual mesh and no filled sphere collider, so objects move freely inside.
The idealized shell has zero added mass; it transmits contact forces to the plate.
It remains fixed with the tabletop; loose objects still collide with it.
Show Colliders exposes its physical panels. Table > Show Collision Hemisphere
shows a separate upper-half wireframe parented to the plate, with the equator at
local y=0.0025 m. The old full interaction-sphere debug mesh has been removed;
the mathematical raycasting sphere remains independent and invisible. The hidden
rim seals overlap into the existing plate thickness to close the equator seam;
there is no lower spherical half. Object spawns use conservative bounding spheres
to reject initial overlap and positions outside the enclosure. Additions are
rejected if no free spawn location is found after 120 attempts. Both plate and
objects use 20 mm soft CCD prediction alongside nonlinear CCD; shell panels also
use 0.3 mm contact skin. No position correction/teleport containment is used.
`npm.cmd run test:dome` checks upward-gravity ceiling collision and containment.
`npm.cmd run test:dome-stress` checks 24 seam/pole/equator directions with
12 m/s launches, three object shapes and a fixed table under changing
gravity, plus duplicate/outside spawn rejection. No escapes occurred in these
sampled cases; this does not guarantee containment under arbitrarily extreme states.

`src/utils/dimensions.js` is the common dimensional reference. The circular plate
is exactly 1.2 m in diameter and 0.01 m (10 mm) thick. Other lengths use the previous
layout scaled by 0.8 / 6. The thinner plate is an explicit exception to that ratio.

- Tabletop upper surface: 900 mm above the floor in the horizontal rest position.
- Ball-joint pivot height: 0.855 m; fixed reference C: (0, 0.895, 0).
- Plate centre offset above pivot: 40 mm; underside height: 0.890 m.
- Leg diameter: 64 mm; leg ends at 0.835 m.
- Base diameter: 226.667 mm; base thickness: 29.333 mm.
- Joint visual sphere radius: 35 mm (70 mm diameter); its top touches the underside.
- Object cube side and sphere diameter: 74.667 mm.
- Object cylinder diameter: 72 mm; height: 80 mm.
- Floor reference grid: 13.333 x 13.333 m, 100 divisions (no floor collider).
- Interaction sphere default radius: 0.666667 m.

Camera position, clipping distances, orbit distances, lighting positions, axes,
spawn positions and debug markers are scaled with the layout. Plate mass is 1.5 kg;
loose object masses are 36 g, 24 g and 30 g for cube, sphere and cylinder.
These are simulation defaults, not a specified material-density model. Gravity
remains 9.81 m/s2. The table is fixed and has no rotation motor. Its static triangle
mesh collider exactly follows the rendered 1.2 m by 10 mm cylinder, including top
and bottom faces. Its contact skin is 0.5 mm.

## Controls

### Finalize and drop sculptures

Holding the left mouse button on the main canvas for 1 second now latches gravity
input AND captures all visible, unreleased cup/bowl meshes in their current shape.
An in-progress microphone take is finalized first. Each captured vessel is detached
from the table and becomes an independent dynamic Rapier rigid body without changing
its world pose. Source-profile/axis overlays are hidden, geometry and thickness are
frozen, and later mouse gravity changes cannot deform it. Repeating a hold never
duplicates an already released body. Newly generated cups can be released on a later
hold, even if input is already locked. Programmatic reset+lock does not release cups.

Captured vessels ignore world gravity and receive a separate force m*(0,-9.81,0)
on each physics step. Loose cubes/spheres/cylinders still use variable world gravity.
The static table/dome remain collidable. A vessel already supported on the tabletop
may settle or tip rather than fall through it; if it leaves the table it can land
on a new solid floor at world y=0. The capture collider is one solid convex envelope
of current vertices: it approximates external shape and fills the cup cavity. This
is not yet a hollow vessel collision model. Rendering preserves the exact captured
mesh, including its thickness and deformed silhouette.

Left double-click unlocks gravity input, removes the captured rigid bodies and
returns the vessels to their saved table-local modelling positions. The retained
source profiles (including audio edits) resume following current mouse gravity;
automatic lift is recalculated. Former modelling spots remain reserved while
sculptures fall, so new recordings cannot occupy a location needed on restore.
Reset removes captures and recreates the previews.
Pause/Resume also pauses released-body physics. `npm.cmd run test:drop` checks
snapshot pose and frozen vertices, independent acceleration under opposing world
gravity, floor landing and cleanup using actual Rapier. Real browser interaction
has not been manually verified.

The floor's hidden collision slab is 20 cm thick, with its upper surface still at
y=0. Released sculpture contact skin is 1 mm, soft CCD prediction is 5 cm, and extra
solver iterations are 16. Speed-dependent integration subdivides each nominal
physics step up to 128 times, limiting estimated linear/angular vertex travel;
the original timestep is restored afterwards. This costs more CPU at high speeds.
`test:drop-collision` checks three shapes at 5, 30 and 80 m/s against the tabletop
and floor. Table-edge falls are distinguished from interior tunnelling. The sampled
maximum transient interior penetration was 7.524 mm under extreme impacts, within
the reinforced plate thickness; contacts are not mathematically penetration-free.

### Gravity-driven profile cup prototype

The smooth starting profile is now a straight, outward-sloping blank:
150 mm height, 15 mm base radius and 30 mm outer mouth radius and 3 mm default radial wall
thickness. The upper-left expandable Base Profile panel shows its current
material section, rotation axis and a 10 mm radial reference line; it updates with
the thickness slider and breath recording. The standalone undeformed default preview
is available at public/base-profile.svg.

A third, low/wide bowl profile (approximately 196 mm diameter by 52 mm high) joins
the smooth and wavy cups. All three are randomly placed on each startup and Reset
Simulation. Profile Cup > Randomize Dish Positions reshuffles only these vessels.
Show Bowl controls the third vessel. They share thickness, sweep and diagnostics.

Placement reserves a conservative circle per vessel using maximum distance from
its profile endpoint at both thickness extremes. Revolution preserves that bound,
and vertical lift does not change XZ extent. Circles stay inside the 120 cm tabletop
with at least 12 mm between them, so gravity-driven deformation cannot cause mutual
vessel overlap. Sampling is bounded and uses a verified, randomly rotated fallback
layout. There is no per-frame position randomization or jitter. These are still
procedural previews: the separation applies between the three vessels, not dynamic
Rapier cubes/spheres/cylinders, and is not a vessel collision simulation.
`npm.cmd run test:dishes` verifies 500 random layouts, fallback, bowl proportions,
thickness extremes, deformed footprints and automatic table contact height.

After each deformation, the lowest mesh vertex is computed in tabletop-local
coordinates. Both cups are translated upward along world/table Y just enough for
that vertex to touch the upper plate surface. Their profiles and revolution axes
move together with the cup root. Returning upright removes the extra lift. This
is geometric placement for the procedural preview, not Rapier collision response;
it does not prevent overlap with the hemisphere or other objects.

A smooth cup (about 108 mm high) and a wavy cup (about 112 mm high) are placed
side by side near the rear of the tabletop. Each uses a single continuous material
profile: underside, outer wall, rim, inner wall and inner floor. Default radial
wall thickness is 3 mm; bottom thickness is at least 4 mm. The mouth stays open.
The wavy meridian has multiple smooth bulges and waists. Its lower endpoint is the revolution pivot. The default
360-degree sweep forms an open-top cup surface. The profile remains fixed in the
table's local frame; its revolution axis follows opposite actual smoothed gravity
in world space, converted back to that local frame. Vertices are regenerated using
axis-angle rotation, rather than rigidly rotating a prebuilt cup. The axis and the
source profile can be shown separately. Zero gravity retains the last valid axis.

Profile Cup GUI controls each object's visibility, wall thickness (1-8 mm), sweep angle (including 90-degree inspection),
source-profile line, axis and wireframe. Buffers are reused. Pause and Reset retain
their existing behavior. The table/profile frame stays horizontal while the revolution axis follows gravity,
so changing gravity directly changes the relative axis/profile angle and cup shape. This initial cup is a procedural surface preview:
it has geometric wall and bottom thickness but no independent rigid body or collision geometry. Existing
loose objects and the table/dome retain actual Rapier simulation. Extreme relative
axes may make the swept surface self-intersect; no manufacturing constraints yet.
`npm.cmd run test:profile` validates revolution math, seam closure, live deformation,
coordinate frames, stable zero gravity and buffer reuse without a browser.

- Drag main view: orbit; right-drag: pan; wheel: zoom.
- Upper-left XYZ gizmo: drag to orbit, click an axis to align, click again to flip.
- Button below gizmo: perspective / orthographic, preserving target-plane scale.
- Hold left button on main canvas for 1 second: latch gravity target after release.
- Double-click canvas: unlock gravity target.
- Triple-click canvas: reset simulation and lock default downward gravity.
- Reset Simulation: restore parameters, objects and world; retain camera view.
- Reset Objects: recreate loose objects above current plate; Remove Last: delete one.

GUI/gizmo clicks do not trigger canvas shortcuts. Leaving the canvas, blur or
pointer cancellation cancels a pending long hold. Existing locks persist until
unlock/reset. The object cap is 80.

Gravity Control Mode selects Manual world X/Y/Z inputs or Center-to-Mouse.
The latter converts pointer NDC into a Three.js Raycaster ray and intersects an
analytic sphere centred at fixed C. Physical/rendered objects are excluded.
From the nearest positive intersection P, d = normalize(P-C), gravity = -d * strength.
From inside the sphere the positive exit point is used. Missing/degenerate hits
retain the previous target. Camera drags, GUI hover and leaving the canvas freeze
input. Accepted samples use the current active camera, including orthographic.

Reset initializes P above C, so the unloaded table starts horizontal. Screen centre
subsequently follows the actual camera ray. One outside viewpoint reaches only the
sphere's visible side; orbit the camera for other directions. Changing sphere radius
radially reprojects the held target. Gravity Smoothing is an exponential response
rate in 1/s. Strength is independent of interpolation. Zero strength retains the last
valid cup revolution axis. Table rotation/torque/maximum-tilt controls have been removed
because the table is immovable.

## Physics and debugging

The leg, base and tabletop are fixed Rapier rigid bodies. The plate stays horizontal
at a 900 mm top-surface height under all gravity directions and object impacts.
The visible ball remains tangent beneath it, but the active spherical joint and
PD motor have been removed. The hemisphere remains attached to the fixed plate.
Loose cubes/spheres/cylinders remain independent dynamic bodies under world gravity.
The cups retain their procedural geometry and gravity-driven revolution axes.

The world retains 960 Hz fixed steps, 24 solver iterations and up to 8 CCD
substeps for the thin enclosure. The obsolete extra plate solver iterations are
removed with the dynamic plate. CCD remains enabled for loose objects.
Allowed linear error is 0.05 mm and predictive contact distance is 1 mm. Rendering
uses requestAnimationFrame with a bounded accumulator. This costs more CPU than the
previous large-table setup, especially with many objects. No render interpolation.

White point: C; pink point: P; pink arrow: gravity axis; yellow: sampled ray.
Orange arrow: actual gravity; green/blue: target/actual plate normals. GUI toggles
points, axis, sphere, colliders, joint marker and world axes. Overlay includes
input lock state, NDC, C/P, gravity, tilt, normal error, joint error and support contact.

## Files and validation

Scene, physics, gravity input, table, objects, GUI, view gizmo and projection switching
remain separate modules under src/. Shared dimensions are in utils/dimensions.js.

The current regression checks 27,360 physics steps: exact plate dimensions, no initial
overlap, horizontal equilibrium, object settling, three-axis gravity, reversal,
physical leg/base stops, finite states, removal and reconstruction. Measured maximum
anchor error: below 0.00003 mm; support penetration: 0 mm with the fixed table. Penetration is queried using
current collider transforms. These sampled results do not guarantee zero penetration
under every GUI setting. The mouse test runs 7,680 actual Rapier steps plus ray/input
checks; the view test covers projection/zoom and camera rotation math.

Browser WebGL, actual pointer capture and GUI clicks have not been manually verified.
The build retains a large-bundle warning due to embedded Rapier WASM. The floor is a
visual reference; tabletop objects are normally retained by the plate/dome enclosure.
The model omits socket shells,
structural flex, material strength and joint failure. The fixed rigid plate has no bending model.
# 컵 영구 보관

## 휴대폰 조작

터치 기기에서는 하단 모바일 패널이 표시됩니다. ‘시작 · 센서 사용’을 탭해 필요 시 권한을 허용하고, ‘현재 자세를 기준으로’ 편한 자세를 중립으로 설정합니다. 좌우·앞뒤 기울기가 중력 방향을 제어하며 세기는 유지됩니다. 2도 이내 손떨림은 무시하고 최대 기울기는 기본 45도(5~90도 조절)입니다. 물리 스텝에서 기존 Gravity System의 보간을 사용합니다. 화면 방향 변경 시 기준을 다시 잡습니다. 카메라 드래그 중 입력은 유지됩니다.

‘기울기 고정’은 입력 방향만 고정합니다. ‘불어서 만들기’ → ‘제작 완료’로 녹음을 제어하고, ‘떨어뜨리기’로 현재 형상을 물리 강체로 확정합니다. ‘다시 변형’으로 원위치에서 생성 모드로 돌아갑니다. ‘저장’은 완성된 마지막 녹음 컵을 기존 로컬 API에 저장하며, 온라인 공용 저장소 배포 기능은 아직 없습니다. ‘리셋’은 컵 재배치와 기본 중력 고정을 실행합니다. 센서가 없거나 권한이 거부되면 조이스틱을 드래그할 수 있습니다. 센서와 마이크에는 HTTPS 및 기기별 권한 허용이 필요합니다.

데스크톱에서는 모바일 패널을 숨기고 기존 마우스·키보드 조작을 유지합니다. 센서는 사용자가 활성화하기 전에는 중력 입력에 영향을 주지 않습니다. 터치 길게 누르기를 기존 마우스 길게 누르기로 처리하지 않습니다. 자동 검증은 `npm.cmd run test:mobile`로 실행합니다. 실제 휴대폰 센서·마이크 및 브라우저별 터치 검증은 별도로 필요합니다.

`npm.cmd run dev`로 실행하면 Vite와 로컬 컵 저장 API가 함께 실행됩니다. 녹음을 완료한 뒤 **컵 영구 저장**을 누르면 이름, 생성 시간, 두께, 실제 프로파일 좌표가 프로젝트의 `data/cups.json`에 추가됩니다. 기존 프로파일 다운로드/녹음 다운로드도 유지됩니다. 원본 녹음 파일은 라이브러리에 저장하지 않습니다.

시작 시와 Shift+좌클릭 두 번 시 저장 컵을 불러와 기본 그릇들과 함께 랜덤 배치합니다. 중력 축 고정과 초기화도 유지됩니다. 저장 서버 연결에 실패해도 기존에 불러온 데이터로 초기화합니다. 일반 좌클릭 두 번은 기존 잠금 해제를 유지합니다. 회전 시의 최대 반경을 기준으로 간격을 확보하며, 공간이 부족하면 무작위로 들어가는 컵만 표시합니다. 표시되지 않은 컵도 파일에는 남습니다. 저장 프로파일은 GUI 두께 변경으로 변형되지 않으며 중력에 따른 회전 생성 및 물리 낙하는 유지됩니다.

다른 컴퓨터로 옮길 때 `data` 폴더를 함께 복사하세요. `npm.cmd run preview`도 로컬 저장 API를 제공합니다. `dist`만 정적 호스팅하면 파일 저장 API는 사용할 수 없습니다. 개발 서버가 이미 실행 중이었다면 재시작하세요.

