// src/lib/faceClient.ts
// Browser-only helpers for face scan. The face engine and its models load from
// a CDN at runtime, so no npm package or model files are needed in the repo.
const CDN = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15'

let loading: Promise<any> | null = null

export function loadFaceApi(): Promise<any> {
  if (loading) return loading
  loading = (async () => {
    const w = window as any
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
    await Promise.all([
      f.nets.tinyFaceDetector.loadFromUri(`${CDN}/model`),
      f.nets.faceLandmark68Net.loadFromUri(`${CDN}/model`),
      f.nets.faceRecognitionNet.loadFromUri(`${CDN}/model`),
    ])
    return f
  })().catch(e => { loading = null; throw e })
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
