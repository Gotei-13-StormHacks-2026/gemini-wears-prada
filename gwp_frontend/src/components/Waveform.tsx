import { useEffect, useRef } from 'react'

type Props = {
  // When null (e.g. the AudioContext couldn't start), the wave animates on its own
  analyser: AnalyserNode | null
  // When false, the wave settles into a flat line
  playing: boolean
}

// Layered sine waves: [amplitude, frequency, opacity, line width]
const LINES = [
  [1, 1.6, 1, 2.5],
  [0.7, 2.4, 0.55, 1.75],
  [0.45, 3.3, 0.3, 1.25],
] as const

export default function Waveform({ analyser, playing }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Read inside the animation loop without restarting it
  const playingRef = useRef(playing)
  playingRef.current = playing

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const samples = analyser ? new Uint8Array(analyser.fftSize) : null
    let level = 0
    let phase = 0
    let frame = 0

    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr
        canvas.height = height * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Loudness of the current audio frame, 0..1
      let target: number
      if (!playingRef.current) {
        target = 0
      } else if (analyser && samples) {
        analyser.getByteTimeDomainData(samples)
        let sum = 0
        for (const sample of samples) {
          const value = (sample - 128) / 128
          sum += value * value
        }
        // Keep a slight ripple during pauses between words
        target = Math.max(0.08, Math.min(1, Math.sqrt(sum / samples.length) * 5))
      } else {
        target = 0.45 + 0.25 * Math.sin(phase * 0.6)
      }
      // Ease toward the target so the wave swells instead of jittering
      level += (target - level) * 0.12
      phase += 0.06

      const mid = height / 2
      ctx.clearRect(0, 0, width, height)

      for (const [amplitude, frequency, opacity, lineWidth] of LINES) {
        ctx.beginPath()
        for (let x = 0; x <= width; x += 2) {
          const t = x / width
          // Taper both ends so the wave fades into a flat line
          const envelope = Math.sin(Math.PI * t) ** 2
          const y =
            mid +
            Math.sin(t * frequency * Math.PI * 2 - phase * frequency) *
              envelope *
              level *
              amplitude *
              mid *
              0.85
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`
        ctx.lineWidth = lineWidth
        ctx.lineCap = 'round'
        ctx.stroke()
      }

      frame = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(frame)
  }, [analyser])

  return (
    <>
      <canvas ref={canvasRef} className="waveform" aria-hidden="true" />
      <style>{styles}</style>
    </>
  )
}

const styles = `
  .waveform {
    display: block;
    width: 100%;
    height: 96px;
    border-radius: 14px;
    background: #111111;
    animation: waveform-in 0.35s ease-out;
  }

  @keyframes waveform-in {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`
