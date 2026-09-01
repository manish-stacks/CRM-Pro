// src/lib/celebrationSound.ts
// A short built-in "level up" style fanfare, synthesized with the Web Audio
// API — used as the default announcement sound so admins don't have to find
// or upload a song for every celebration. No audio file, no hosting, no
// licensing concerns.
export const DEFAULT_SOUND_VALUE = 'default'

export function playCelebrationChime(): boolean {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return false
    const ctx: AudioContext = new Ctx()

    // Rising major arpeggio — C5, E5, G5, C6
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.15
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.3, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.5)
    })
    // Sparkly chord at the end to land the celebration
    const chordAt = ctx.currentTime + notes.length * 0.15 + 0.1
    ;[1046.5, 1318.5, 1568.0].forEach(freq => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, chordAt)
      gain.gain.linearRampToValueAtTime(0.15, chordAt + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, chordAt + 1.2)
      osc.connect(gain).connect(ctx.destination)
      osc.start(chordAt)
      osc.stop(chordAt + 1.2)
    })

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
    return true
  } catch {
    return false
  }
}
