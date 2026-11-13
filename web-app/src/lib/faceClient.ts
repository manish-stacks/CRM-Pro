// src/lib/faceClient.ts
// Browser-only helpers for face scan & 3D biometric anti-spoofing liveness detection.
// Loads models via CDN with zero heavy local npm dependencies.
const CDN = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15'

export type FaceStep = { msg: string; pct: number }
let current: FaceStep = { msg: 'Waiting to start', pct: 0 }
const subs = new Set<(s: FaceStep) => void>()
const emit = (msg: string, pct: number) => {
  current = { msg, pct }
  subs.forEach(fn => fn(current))
}

export function onFaceProgress(fn: (s: FaceStep) => void): () => void {
  subs.add(fn)
  fn(current)
  return () => {
    subs.delete(fn)
  }
}

const nextFrame = () => new Promise<void>(r => requestAnimationFrame(() => setTimeout(r, 0)))

let loading: Promise<any> | null = null

export function loadFaceApi(): Promise<any> {
  if (loading) return loading
  loading = (async () => {
    const w = window as any
    emit('Loading face engine…', 5)
    if (!w.faceapi) {
      await new Promise<void>((res, rej) => {
        const s = document.createElement('script')
        s.src = `${CDN}/dist/face-api.js`
        s.onload = () => res()
        s.onerror = () => rej(new Error('Could not load face engine. Check internet connection.'))
        document.head.appendChild(s)
      })
    }
    const f = w.faceapi

    emit('Preparing graphics acceleration…', 20)
    try {
      await f.tf.setBackend('webgl')
    } catch {
      /* keeps default */
    }
    await f.tf.ready()

    emit('Loading neural detection models…', 35)
    await f.nets.tinyFaceDetector.loadFromUri(`${CDN}/model`)
    emit('Loading 68-point biometric landmarks…', 55)
    await f.nets.faceLandmark68Net.loadFromUri(`${CDN}/model`)
    emit('Loading face recognition embedding…', 70)
    await f.nets.faceRecognitionNet.loadFromUri(`${CDN}/model`)

    emit('Optimising neural pipeline…', 85)
    await nextFrame()
    try {
      const c = document.createElement('canvas')
      c.width = c.height = 160
      const g = c.getContext('2d')!
      const grad = g.createLinearGradient(0, 0, 160, 160)
      grad.addColorStop(0, '#777')
      grad.addColorStop(1, '#ccc')
      g.fillStyle = grad
      g.fillRect(0, 0, 160, 160)
      await f.detectSingleFace(c, new f.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.6 }))
      await f.nets.faceLandmark68Net.detectLandmarks(c)
      await f.nets.faceRecognitionNet.computeFaceDescriptor(c)
    } catch {
      /* warm-up */
    }

    emit('Ready', 100)
    return f
  })().catch(e => {
    loading = null
    emit(e?.message || 'Failed to load', 0)
    throw e
  })
  return loading
}

export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  })
  video.srcObject = stream
  await video.play()
  return stream
}

export function stopCamera(stream?: MediaStream | null) {
  stream?.getTracks().forEach(t => t.stop())
}

export function pDist(p1: { x: number; y: number }, p2: { x: number; y: number }) {
  const dx = p1.x - p2.x
  const dy = p1.y - p2.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Computes 3D Biometric Liveness metrics:
 * 1. EAR (Eye Aspect Ratio): drops on blink.
 * 2. Smile Ratio: mouth width / eye distance (expands by >15% on smile).
 * 3. Yaw Offset: nose position relative to eye center (changes on head turn).
 * 4. Mouth Open Ratio: drops/expands on talking/mouth opening.
 *
 * A photo on a mobile phone CANNOT smile or turn in 3D.
 */
export function computeBiometricLiveness(positions: { x: number; y: number }[]) {
  if (!positions || positions.length < 68) {
    return { ear: 0.28, smileRatio: 0.5, yawOffset: 0, mouthOpen: 0.1 }
  }

  // Inter-ocular distance (scale baseline)
  const leftEyeOuter = positions[36]
  const rightEyeOuter = positions[45]
  const eyeDist = Math.max(pDist(leftEyeOuter, rightEyeOuter), 1)

  // 1. EAR (Eye Aspect Ratio)
  const lA = pDist(positions[37], positions[41])
  const lB = pDist(positions[38], positions[40])
  const lW = pDist(positions[36], positions[39])
  const leftEAR = (lA + lB) / (2.0 * Math.max(lW, 1))

  const rA = pDist(positions[43], positions[47])
  const rB = pDist(positions[44], positions[46])
  const rW = pDist(positions[42], positions[45])
  const rightEAR = (rA + rB) / (2.0 * Math.max(rW, 1))
  const ear = (leftEAR + rightEAR) / 2.0

  // 2. Smile Ratio: Mouth width normalized by eye distance
  const mouthWidth = pDist(positions[48], positions[54])
  const smileRatio = mouthWidth / eyeDist

  // 3. Head Yaw: Horizontal nose offset from eye center normalized by eye distance
  const eyeMidX = (positions[36].x + positions[45].x) / 2
  const yawOffset = (positions[30].x - eyeMidX) / eyeDist

  // 4. Mouth Open Ratio
  const mouthHeight = pDist(positions[51], positions[57])
  const mouthOpen = mouthHeight / eyeDist

  return { ear, smileRatio, yawOffset, mouthOpen }
}

export async function readFace(f: any, video: HTMLVideoElement, minSize = 0.18) {
  const det = await f
    .detectSingleFace(video, new f.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.55 }))
    .withFaceLandmarks()
    .withFaceDescriptor()

  if (!det) return null

  if (det.detection.box.width / (video.videoWidth || 640) < minSize) return null

  const positions = det.landmarks ? (det.landmarks.positions as { x: number; y: number }[]) : null
  const liveness = positions
    ? computeBiometricLiveness(positions)
    : { ear: 0.28, smileRatio: 0.5, yawOffset: 0, mouthOpen: 0.1 }

  return {
    descriptor: Array.from(det.descriptor as Float32Array) as number[],
    box: det.detection.box,
    landmarks: positions,
    liveness,
  }
}
