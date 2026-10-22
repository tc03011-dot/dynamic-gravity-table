export const MAX_BREATH_EXPANSION = 0.015
export const MIN_INNER_RADIUS = 0.01

export function breathDisplacement(rms, params) {
  const noise = Math.max(0.0001, params.breathNoise)
  if (!Number.isFinite(rms) || rms <= noise) return 0
  const level = Math.max(0, Math.min(1, rms * params.breathGain))
  const neutral = Math.max(0.05, Math.min(0.95, params.breathNeutral))
  const signed = level < neutral ? (level - neutral) / neutral : (level - neutral) / (1 - neutral)
  const gate = Math.min(1, (rms - noise) / noise)
  return signed * MAX_BREATH_EXPANSION * gate
}

export function createBreathSession(params) {
  const offsets = new Float32Array(65)
  let active = false, startedAt = 0, duration = 12, nextSample = 0, progress = 0, level = 0, version = 0
  function start(time) {
    offsets.fill(0)
    active = true; startedAt = time; duration = Math.max(1, params.breathDuration)
    nextSample = 0; progress = 0; level = 0; version++
  }
  function update(time, rms) {
    if (!active) return false
    progress = Math.max(progress, Math.min(1, (time - startedAt) / duration))
    level = Math.max(0, Math.min(1, rms * params.breathGain))
    const displacement = breathDisplacement(rms, params)
    // Record each height once; a stalled frame never rewrites the completed base.
    while (nextSample <= Math.floor(progress * 64) && nextSample < 65) {
      offsets[nextSample++] = displacement
      version++
    }
    if (progress >= 1) active = false
    return !active
  }
  function stop() { active = false; level = 0 }
  return { offsets, start, update, stop,
    get active() { return active }, get progress() { return progress }, get level() { return level },
    get version() { return version }, get remaining() { return duration * (1 - progress) } }
}
