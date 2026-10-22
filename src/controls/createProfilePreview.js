import { createCupProfile } from '../objects/createProfileCup.js'

export function profilePreviewSVG(thickness = 3, recording = null) {
  const profile = createCupProfile({ thickness: thickness / 1000, radialOffsets: recording?.offsets })
  const x = (metres) => 38 + metres * 1900
  const y = (metres) => 334 - metres * 1900
  const path = profile.map((point, index) => `${index ? 'L' : 'M'}${x(point.x).toFixed(2)},${y(point.y).toFixed(2)}`).join(' ') + ' Z'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 390" role="img" aria-label="기본 컵 단면: 높이 150mm, 밑면 반지름 15mm, 입구 반지름 30mm, 벽 두께 ${thickness}mm">
    <rect width="240" height="390" rx="10" fill="#202630"/>
    <g stroke="#394451" stroke-width="1">
      ${[0, 30, 60, 90, 120, 150].map((mm) => `<path d="M38 ${y(mm / 1000)}H210"/>`).join('')}
    </g>
    <path d="M38 30V334H210" stroke="#b3bfcc" fill="none"/>
    <path d="M${x(0.01)} 42V334" stroke="#ffbd69" stroke-dasharray="4 4"/>
    <path d="${path}" fill="#e9cda6" fill-opacity="0.55" stroke="#5ce8d6" stroke-width="1.5"/>
    ${recording?.active ? `<path d="M38 ${y(Math.max(0.004, thickness / 1000 * 1.3) + (0.15 - Math.max(0.004, thickness / 1000 * 1.3)) * recording.progress)}H210" stroke="#ff6d77" stroke-width="2"/>` : ''}
    <circle cx="38" cy="334" r="3" fill="#ffbd69"/>
    <g fill="#dce4ec" font-family="system-ui, sans-serif" font-size="11">
      <text x="10" y="20">높이 / 반지름 (mm)</text>
      <text x="7" y="49">150</text><text x="17" y="338">0</text>
      <text x="${x(0.01) - 6}" y="352" fill="#ffbd69">10</text>
      <text x="${x(0.015) - 7}" y="366">15</text>
      <text x="${x(0.030) - 7}" y="352">30</text>
      <text x="12" y="384">점선: 안쪽 벽 최소 반지름</text>
    </g>
  </svg>`
}

export function createProfilePreview(container) {
  const panel = document.createElement('details')
  panel.className = 'profile-preview'
  panel.open = true
  const summary = document.createElement('summary')
  summary.textContent = '기본 프로파일'
  const content = document.createElement('div')
  panel.append(summary, content)
  container.append(panel)
  let previousThickness = null, previousVersion = null, previousActive = null, previousProgress = null
  function update(thickness, recording = null) {
    if (previousThickness === thickness && previousVersion === recording?.version && previousActive === recording?.active && previousProgress === recording?.progress) return
    content.innerHTML = profilePreviewSVG(thickness, recording)
    previousThickness = thickness
    previousVersion = recording?.version; previousActive = recording?.active; previousProgress = recording?.progress
  }
  return { update, dispose() { panel.remove() } }
}
