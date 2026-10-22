import { createBreathSession } from './breathSession.js'
import { createCupProfile } from '../objects/createProfileCup.js'

export function createBreathRecorder({ canvas, container, params, getCup, createCup = null, saveToLibrary = null }) {
  const panel = document.createElement('section')
  panel.className = 'breath-recorder'
  panel.setAttribute('aria-label', '호흡 프로파일 녹음')
  const title = document.createElement('strong')
  title.textContent = '불어서 프로파일 만들기'
  const stateLabel = document.createElement('div')
  stateLabel.setAttribute('aria-live', 'polite')
  const progress = document.createElement('progress')
  progress.max = 1
  const meter = document.createElement('meter')
  meter.min = 0; meter.max = 1
  meter.title = '마이크 입력 세기'
  const hint = document.createElement('small')
  hint.textContent = 'Shift+우클릭 1번: 시작 · 2번: 종료 | 무음: 유지 · 약하게: 축소 · 강하게: 확대'
  const toggle = document.createElement('button')
  const save = document.createElement('button')
  save.textContent = '프로파일 저장'
  save.disabled = true
  const saveLibrary = document.createElement('button')
  saveLibrary.textContent = import.meta.env?.MODE === 'pages' ? '컵 파일로 저장' : '컵 영구 저장'
  saveLibrary.disabled = true
  const saveAudio = document.createElement('button')
  saveAudio.textContent = '녹음 저장'
  saveAudio.disabled = true
  panel.append(title, stateLabel, progress, meter, toggle, save, saveAudio, hint)
  if (saveToLibrary) panel.append(saveLibrary)
  container.append(panel)
  let state = 'idle', message = '대기 · 기본 컵에 기록됩니다'
  let session = null, stream = null, context = null, source = null, analyser = null, data = null
  let mediaRecorder = null, audioBlob = null, timer = null, token = 0, disposed = false
  let lastRight = -Infinity, rms = 0, lastRms = 0, lastTime = 0, recordedProfile = null
  let takeCup = null, readyAt = 0
  const busy = () => ['recording', 'requesting', 'preparing'].includes(state)
  const consumedPointers = new Set()
  const now = () => performance.now() / 1000
  function render() {
    stateLabel.textContent = state === 'recording'
      ? `녹음 중 ${(session.progress * 100).toFixed(0)}% · 남은 ${session.remaining.toFixed(1)}초 · 입력 ${(session.level * 100).toFixed(0)}%`
      : state === 'preparing' ? `새 컵 준비 · ${Math.max(0, readyAt - now()).toFixed(1)}초 후 녹음 시작` : message
    progress.value = session?.progress ?? 0
    meter.value = session?.active ? session.level : 0
    toggle.textContent = busy() ? '녹음 종료' : '녹음 시작'
  }
  function releaseMicrophone() {
    if (timer !== null) clearTimeout(timer)
    timer = null
    if (mediaRecorder?.state === 'recording') mediaRecorder.stop()
    mediaRecorder = null
    source?.disconnect(); analyser?.disconnect()
    source = null; analyser = null; data = null
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
    const oldContext = context
    context = null
    oldContext?.close().catch(() => {})
  }
  function finish(reason = '중도 종료') {
    token++
    if (state === 'recording') {
      session.update(now(), lastRms)
      session.stop()
    }
    const hadSession = state === 'recording'
    state = hadSession ? 'complete' : 'idle'
    message = hadSession ? `${reason} · 프로파일 변형 완료` : '녹음 시작 취소'
    if (hadSession) {
      // Read the finalized source profile after its next normal frame update.
      recordedProfile = session
      save.disabled = false
      saveLibrary.disabled = false
    }
    releaseMicrophone()
    render()
  }
  async function start() {
    if (disposed || busy()) return
    if (!navigator.mediaDevices?.getUserMedia || !globalThis.AudioContext) {
      message = '마이크를 사용할 수 없습니다. localhost 또는 HTTPS에서 실행해 주세요.'
      render(); return
    }
    takeCup = createCup ? createCup() : getCup()
    if (!takeCup) { message = '상판에 빈자리가 없습니다. 초기화하거나 배치를 바꿔 주세요.'; render(); return }
    session = null
    recordedProfile = null; saveLibrary.disabled = true
    const request = ++token
    state = 'requesting'; message = '마이크 권한을 허용해 주세요'; render()
    // Resume from the initiating user gesture, before the permission prompt resolves.
    const audio = new AudioContext()
    context = audio
    const resumed = audio.resume().catch((error) => { throw error })
    try {
      await resumed
      if (request !== token || disposed) return
      const input = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      if (request !== token || disposed) { input.getTracks().forEach((track) => track.stop()); return }
      stream = input
      analyser = audio.createAnalyser()
      analyser.fftSize = 2048
      source = audio.createMediaStreamSource(input)
      source.connect(analyser) // No speaker output / feedback loop.
      data = new Float32Array(analyser.fftSize)
      session = createBreathSession(params)
      takeCup.setRecording(session)
      state = 'preparing'
      readyAt = now() + 0.5
      message = '새 기본 컵 생성 · 0.5초 후 녹음 시작'
      audioBlob = null; saveAudio.disabled = true; save.disabled = true
      const beginRecording = () => {
        if (request !== token || disposed) return
        session.start(now())
      rms = 0; lastRms = 0; lastTime = now()
      state = 'recording'; audioBlob = null; saveAudio.disabled = true; save.disabled = true
      if (globalThis.MediaRecorder) {
        try {
          const recorder = new MediaRecorder(input)
          const chunks = []
          recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
          recorder.onstop = () => {
            if (disposed || session !== take) return
            audioBlob = new Blob(chunks, { type: recorder.mimeType })
            saveAudio.disabled = audioBlob.size === 0
          }
          const take = session
          recorder.start()
          mediaRecorder = recorder
        } catch { /* Profiling still works when audio-file recording is unsupported. */ }
      }
      timer = setTimeout(() => finish('시간 종료'), Math.max(1, params.breathDuration) * 1000)
      render()
      }
      timer = setTimeout(beginRecording, 500)
      input.getAudioTracks().forEach((track) => track.addEventListener('ended', () => { if (stream === input && busy()) finish('마이크 연결 종료') }))
      render()
    } catch (error) {
      if (request !== token || disposed) return
      state = 'idle'
      message = error.name === 'NotAllowedError' ? '마이크 권한이 거부되었습니다. 브라우저 권한을 확인해 주세요.' : `마이크 오류: ${error.message}`
      releaseMicrophone(); render()
    }
  }
  function update() {
    if (state === 'preparing') { render(); return }
    if (state !== 'recording' || !analyser) return
    analyser.getFloatTimeDomainData(data)
    const mean = data.reduce((sum, value) => sum + value, 0) / data.length
    const raw = Math.sqrt(data.reduce((sum, value) => sum + (value - mean) ** 2, 0) / data.length)
    const time = now()
    rms += (raw - rms) * (1 - Math.exp(-Math.max(0, time - lastTime) / 0.08))
    lastTime = time; lastRms = rms
    if (session.update(time, rms)) finish('시간 종료')
    render()
  }
  function onPointer(event) {
    if (event.button !== 2 || !event.shiftKey) return
    event.preventDefault(); event.stopImmediatePropagation()
    consumedPointers.add(event.pointerId)
    if (event.pointerId !== undefined) canvas.setPointerCapture?.(event.pointerId)
    const time = now()
    if ((busy()) && time - lastRight < 0.45) {
      lastRight = -Infinity; finish()
    } else {
      lastRight = time
      if (!busy()) void start()
    }
  }
  function onPointerUp(event) {
    if (consumedPointers.has(event.pointerId)) {
      consumedPointers.delete(event.pointerId)
      event.preventDefault(); event.stopImmediatePropagation()
    }
  }
  function onToggle() { if (busy()) finish(); else void start() }
  function download(blob, name) {
    const url = URL.createObjectURL(blob), link = document.createElement('a')
    link.href = url; link.download = name; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  function onSave() {
    if (!recordedProfile) return
    const profile = createCupProfile({ thickness: params.cupThickness / 1000, radialOffsets: recordedProfile.offsets })
    download(new Blob([JSON.stringify({ version: 1, unit: 'metres', type: 'breath-profile', thickness: params.cupThickness / 1000, offsets: Array.from(recordedProfile.offsets), profile: profile.map((p) => [p.x, p.y, p.z]) }, null, 2)], { type: 'application/json' }), 'breath-profile.json')
  }
  function onSaveAudio() {
    if (audioBlob) download(audioBlob, `breath-recording.${audioBlob.type.includes('mp4') ? 'mp4' : audioBlob.type.includes('ogg') ? 'ogg' : 'webm'}`)
  }
  async function onSaveLibrary() {
    if (!recordedProfile || busy()) { message = '녹음을 완료한 뒤 저장해 주세요'; render(); return }
    if (import.meta.env?.MODE === 'pages') {
      onSave(); message = '컵 프로파일 파일 다운로드 · 온라인 누적 저장은 아직 지원하지 않습니다'; render(); return
    }
    if (saveLibrary.disabled) { message = '이미 저장했거나 저장 중인 컵입니다'; render(); return }
    saveLibrary.disabled = true
    const take = recordedProfile
    const thickness = params.cupThickness / 1000
    try {
      await saveToLibrary({ name: `Breath cup ${new Date().toLocaleString()}`, thickness,
        profile: createCupProfile({ thickness, radialOffsets: take.offsets }).map((p) => [p.x, p.y, p.z]) })
      if (recordedProfile === take) { message = '컵 저장 완료 · Shift+좌클릭 두 번으로 저장 컵도 랜덤 배치됩니다'; render() }
    } catch (error) {
      if (recordedProfile === take) { message = error.message; saveLibrary.disabled = false; render() }
    }
  }
  function onVisibility() { if (document.hidden && (busy())) finish('화면 이탈') }
  function reset() {
    token++; state = 'idle'; session?.stop(); releaseMicrophone()
    session = null; recordedProfile = null; audioBlob = null; lastRight = -Infinity
    saveLibrary.disabled = true
    message = '대기 · 기본 컵에 기록됩니다'; save.disabled = true; saveAudio.disabled = true; render()
  }
  canvas.addEventListener('pointerdown', onPointer, true)
  canvas.addEventListener('pointerup', onPointerUp, true)
  canvas.addEventListener('pointercancel', onPointerUp, true)
  document.addEventListener('visibilitychange', onVisibility)
  toggle.addEventListener('click', onToggle)
  save.addEventListener('click', onSave)
  saveAudio.addEventListener('click', onSaveAudio)
  saveLibrary.addEventListener('click', onSaveLibrary)
  function dispose() {
    disposed = true; reset()
    canvas.removeEventListener('pointerdown', onPointer, true)
    canvas.removeEventListener('pointerup', onPointerUp, true)
    canvas.removeEventListener('pointercancel', onPointerUp, true)
    consumedPointers.clear()
    document.removeEventListener('visibilitychange', onVisibility)
    toggle.removeEventListener('click', onToggle)
    save.removeEventListener('click', onSave)
    saveAudio.removeEventListener('click', onSaveAudio)
    saveLibrary.removeEventListener('click', onSaveLibrary)
    panel.remove()
  }
  render()
  return { update, reset, dispose, start, finish, saveToLibrary: onSaveLibrary, get busy() { return busy() }, get session() { return session } }
}
