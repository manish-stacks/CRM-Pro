// src/lib/faceClient.ts
// Browser-only helpers for face scan. The face engine and its models load from
// a CDN at runtime, so no npm package or model files are needed in the repo.
const CDN = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15'

// ---- progress reporting (so screens can show a loader instead of freezing) ----
export type FaceStep = { msg: string; pct: number }
let current: FaceStep = { msg: 'Waiting to start', pct: 0 }
const subs = new Set<(s: FaceStep) => void>()
const emit = (msg: string, pct: number) => { current = { msg, pct }; subs.forEach(fn => fn(current)) }

/** Subscribe to engine loading progress. Returns an unsubscribe function. */
export function onFaceProgress(fn: (s: FaceStep) => void): () => void {
  subs.add(fn); fn(current)
  return () => { subs.delete(fn) }
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
        s.onerror = () => rej(new Error('Could not load the face engine. Check the internet connection.'))
        document.head.appendChild(s)
      })
    }
    const f = w.faceapi

    // GPU backend is far faster than the CPU fallback
    emit('Preparing graphics acceleration…', 20)
    try { await f.tf.setBackend('webgl') } catch { /* keeps default */ }
    await f.tf.ready()

    emit('Loading detection model…', 35)
    await f.nets.tinyFaceDetector.loadFromUri(`${CDN}/model`)
    emit('Loading landmark model…', 55)
    await f.nets.faceLandmark68Net.loadFromUri(`${CDN}/model`)
    emit('Loading recognition model…', 70)
    await f.nets.faceRecognitionNet.loadFromUri(`${CDN}/model`)

    // Warm-up: the first run compiles GPU shaders and can freeze the tab for a few
    // seconds. Doing it here, behind a loader, keeps the first real scan fast.
    emit('Optimising for this device…', 85)
    await nextFrame()
    try {
      const c = document.createElement('canvas'); c.width = c.height = 160
      const g = c.getContext('2d')!
      const grad = g.createLinearGradient(0, 0, 160, 160); grad.addColorStop(0, '#777'); grad.addColorStop(1, '#ccc')
      g.fillStyle = grad; g.fillRect(0, 0, 160, 160)
      await f.detectSingleFace(c, new f.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.6 }))
      await f.nets.faceLandmark68Net.detectLandmarks(c)
      await f.nets.faceRecognitionNet.computeFaceDescriptor(c)
    } catch { /* warm-up is best effort */ }

    emit('Ready', 100)
    return f
  })().catch(e => { loading = null; emit(e?.message || 'Failed to load', 0); throw e })
  return loading
}

export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false,
  })
  video.srcObject = stream
  await video.play()
  return stream
}

export function stopCamera(stream?: MediaStream | null) {
  stream?.getTracks().forEach(t => t.stop())
}

/** One face descriptor (128 numbers) from the current frame, or null if no clear face. */
export async function readFace(f: any, video: HTMLVideoElement, minSize = 0.22) {
  const det = await f
    .detectSingleFace(video, new f.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.6 }))
    .withFaceLandmarks()
    .withFaceDescriptor()
  if (!det) return null
  // Ignore faces that are too far from the camera
  if (det.detection.box.width / (video.videoWidth || 640) < minSize) return null
  return { descriptor: Array.from(det.descriptor as Float32Array) as number[], box: det.detection.box }
}
