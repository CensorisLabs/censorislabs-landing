// On-device barcode decoding for AbsoluteCal.
//
// Uses the BarcodeDetector API built into Chromium/Android WebView, so a scan
// never leaves the device and no product catalogue service is involved. Older
// engines simply report unsupported and the manual code field still works.

const PREFERRED_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf']

export function barcodeDetectorAvailable() {
  return typeof window !== 'undefined' && typeof window.BarcodeDetector === 'function'
}

export async function createBarcodeDetector() {
  if (!barcodeDetectorAvailable()) return null
  try {
    const supported = typeof window.BarcodeDetector.getSupportedFormats === 'function'
      ? await window.BarcodeDetector.getSupportedFormats()
      : null
    const formats = Array.isArray(supported)
      ? PREFERRED_FORMATS.filter(format => supported.includes(format))
      : PREFERRED_FORMATS
    return formats.length ? new window.BarcodeDetector({ formats }) : new window.BarcodeDetector()
  } catch {
    return null
  }
}

/** Decode a single still image (photo library or screenshot). */
export async function scanImageFile(file) {
  const detector = await createBarcodeDetector()
  if (!detector) return null
  const bitmap = await createImageBitmap(file)
  try {
    const codes = await detector.detect(bitmap)
    return codes.map(code => code.rawValue).find(Boolean) || null
  } finally {
    bitmap.close?.()
  }
}

/**
 * Start the rear camera and poll frames until a barcode is found.
 * Returns a stop() function; it is also safe to call stop() twice.
 */
export async function startCameraScan(video, onDetect) {
  const detector = await createBarcodeDetector()
  if (!detector) throw new Error('unsupported')
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported')

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
  })

  video.srcObject = stream
  video.setAttribute('playsinline', '')
  video.muted = true
  await video.play().catch(() => {})

  let stopped = false
  let timer = 0
  const stop = () => {
    if (stopped) return
    stopped = true
    window.clearTimeout(timer)
    stream.getTracks().forEach(track => track.stop())
    video.srcObject = null
  }

  const tick = async () => {
    if (stopped) return
    try {
      const codes = await detector.detect(video)
      const value = codes.map(code => code.rawValue).find(Boolean)
      if (value) {
        stop()
        onDetect(value)
        return
      }
    } catch {
      /* the frame is not readable yet; try again */
    }
    if (!stopped) timer = window.setTimeout(tick, 320)
  }
  tick()

  return stop
}
