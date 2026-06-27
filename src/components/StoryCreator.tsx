'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

const EXPORT_W = 1080
const EXPORT_H = 1920

const FONTS = [
  { label: 'Sans', value: 'sans-serif' },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Mono', value: 'monospace' },
  { label: 'Impact', value: 'Impact, fantasy' },
  { label: 'Cursive', value: 'cursive' },
]

type TextLayer = {
  id: string
  type: 'text'
  x: number
  y: number
  text: string
  color: string
  fontSize: number
  fontFamily: string
  align: 'left' | 'center' | 'right'
  bgStyle: 'none' | 'box' | 'outline'
}
type StickerLayer = {
  id: string
  type: 'sticker'
  x: number
  y: number
  emoji: string
  fontSize: number
}
type MusicLayer = {
  id: string
  type: 'music'
  x: number
  y: number
  title: string
  artist: string
  artworkUrl: string | null
  previewUrl: string | null // URL do preview de 30s (iTunes)
  startTime: number // segundos onde o trecho de 15s começa, dentro do preview de 30s
  scale: number
}
type Layer = TextLayer | StickerLayer | MusicLayer

// Resultado retornado pela iTunes Search API
type ItunesTrack = {
  trackId: number
  trackName: string
  artistName: string
  artworkUrl100: string
  previewUrl: string | null
  collectionName: string
}

const COLORS = ['#ffffff', '#000000', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899']
const STICKERS = ['😀', '😂', '😍', '🔥', '❤️', '👍', '🎉', '😎', '🥳', '😭', '💯', '✨', '🙌', '😡', '👀', '🤔']

// Trecho de música usado no story: 15s, recortado de dentro do preview de 30s do iTunes.
const CLIP_DURATION = 15
const PREVIEW_DURATION = 30

const BACKGROUNDS: { css: string }[] = [
  { css: '#000000' },
  { css: 'linear-gradient(135deg, #4f46e5, #ec4899, #f59e0b)' },
  { css: 'linear-gradient(135deg, #0ea5e9, #22d3ee)' },
  { css: 'linear-gradient(160deg, #16a34a, #84cc16)' },
  { css: 'linear-gradient(160deg, #ef4444, #f59e0b)' },
  { css: 'linear-gradient(160deg, #7c3aed, #db2777)' },
  { css: 'linear-gradient(160deg, #111827, #374151)' },
  { css: '#ffffff' },
  { css: 'linear-gradient(160deg, #fde68a, #fca5a5, #c084fc)' },
]

// ---------- Modal de busca de música (iTunes Search API) ----------
// Fluxo em 2 etapas: 1) buscar e escolher a faixa  2) escolher o trecho de 15s
function MusicSearchModal({
  onSelect,
  onClose,
}: {
  onSelect: (track: ItunesTrack, startTime: number) => void
  onClose: () => void
}) {
  const [stage, setStage] = useState<'search' | 'trim'>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ItunesTrack[]>([])
  const [loading, setLoading] = useState(false)
  const [playingId, setPlayingId] = useState<number | null>(null)
  const [trimTrack, setTrimTrack] = useState<ItunesTrack | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Toca/pausa o preview via <audio> nativo (etapa de busca)
  function togglePreview(track: ItunesTrack) {
    if (!track.previewUrl) return

    if (playingId === track.trackId) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = track.previewUrl
    } else {
      audioRef.current = new Audio(track.previewUrl)
    }
    audioRef.current.src = track.previewUrl
    audioRef.current.play()
    setPlayingId(track.trackId)

    audioRef.current.onended = () => setPlayingId(null)
  }

  // Limpeza ao fechar
  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  async function search(q: string) {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      // country=br traz resultados em português / Brasil
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=15&country=br`
      )
      const json = await res.json()
      setResults(json.results || [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setQuery(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(v), 400)
  }

  // Ao escolher uma faixa na busca, avança para a etapa de seleção de trecho
  // (se não houver preview de áudio, não há trecho pra escolher — usa direto)
  function handlePickTrack(track: ItunesTrack) {
    audioRef.current?.pause()
    setPlayingId(null)
    if (!track.previewUrl) {
      onSelect(track, 0)
      onClose()
      return
    }
    setTrimTrack(track)
    setStage('trim')
  }

  function handleConfirmTrim(startTime: number) {
    if (!trimTrack) return
    audioRef.current?.pause()
    onSelect(trimTrack, startTime)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 rounded-t-3xl p-4 flex flex-col gap-3 max-h-[80vh]">
        {stage === 'search' ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-white font-semibold text-base">🎵 Adicionar música</span>
              <button onClick={() => { audioRef.current?.pause(); onClose() }} className="text-zinc-400 text-xl">✕</button>
            </div>

            {/* Campo de busca */}
            <input
              autoFocus
              type="text"
              value={query}
              onChange={handleInput}
              placeholder="Buscar música ou artista…"
              className="w-full bg-zinc-800 text-white placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-500"
            />

            {/* Resultados */}
            <div className="overflow-y-auto flex flex-col gap-1 flex-1">
              {loading && (
                <div className="text-zinc-500 text-sm text-center py-6">Buscando…</div>
              )}
              {!loading && query && results.length === 0 && (
                <div className="text-zinc-500 text-sm text-center py-6">Nenhum resultado encontrado.</div>
              )}
              {!loading && !query && (
                <div className="text-zinc-600 text-xs text-center py-6">Digite o nome de uma música ou artista.</div>
              )}
              {results.map(track => (
                <div
                  key={track.trackId}
                  className="flex items-center gap-3 rounded-xl p-2 hover:bg-zinc-800 active:bg-zinc-700 transition-colors"
                >
                  {/* Capa do álbum */}
                  <img
                    src={track.artworkUrl100}
                    alt={track.collectionName}
                    className="w-12 h-12 rounded-lg object-cover shrink-0"
                  />

                  {/* Título + artista */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{track.trackName}</p>
                    <p className="text-zinc-400 text-xs truncate">{track.artistName}</p>
                  </div>

                  {/* Botão de preview */}
                  {track.previewUrl && (
                    <button
                      onClick={() => togglePreview(track)}
                      className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-white text-sm"
                    >
                      {playingId === track.trackId ? '⏸' : '▶'}
                    </button>
                  )}

                  {/* Botão de escolher — avança para seleção de trecho */}
                  <button
                    onClick={() => handlePickTrack(track)}
                    className="shrink-0 px-3 py-1.5 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-white text-xs font-semibold"
                  >
                    Usar
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          trimTrack && (
            <MusicTrimStep
              track={trimTrack}
              onBack={() => { audioRef.current?.pause(); setStage('search') }}
              onConfirm={handleConfirmTrim}
              onClose={() => { audioRef.current?.pause(); onClose() }}
            />
          )
        )}
      </div>
    </div>
  )
}

// ---------- Etapa 2: seleção do trecho de 15s ----------
// Mostra uma "waveform" simulada (o iTunes não expõe a forma de onda real) com
// barras pseudo-aleatórias derivadas do trackId, e uma janela de 15s arrastável
// sobre os 30s do preview. O preview toca em loop dentro da janela enquanto
// o usuário arrasta, dando feedback imediato do trecho escolhido.
function MusicTrimStep({
  track,
  initialStartTime = 0,
  onBack,
  onConfirm,
  onClose,
}: {
  track: ItunesTrack
  initialStartTime?: number
  onBack: () => void
  onConfirm: (startTime: number) => void
  onClose: () => void
}) {
  const maxStart = Math.max(0, PREVIEW_DURATION - CLIP_DURATION)
  const [startTime, setStartTime] = useState(Math.min(maxStart, Math.max(0, initialStartTime)))
  const [playing, setPlaying] = useState(false)
  const [playheadPct, setPlayheadPct] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef(false)
  const rafRef = useRef<number | null>(null)

  // Barras pseudo-aleatórias mas deterministas (mesma faixa = mesma "waveform" sempre)
  const bars = useMemo(() => {
    let seed = track.trackId % 100000
    function rand() {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    const n = 60
    const out: number[] = []
    for (let i = 0; i < n; i++) {
      // mistura de seno (para parecer "musical", com picos e vales) com ruído
      const base = 0.35 + 0.3 * Math.abs(Math.sin(i * 0.4 + (track.trackId % 7)))
      out.push(Math.min(1, Math.max(0.12, base + (rand() - 0.5) * 0.4)))
    }
    return out
  }, [track.trackId])

  // Prepara o elemento de áudio
  useEffect(() => {
    if (!track.previewUrl) return
    const audio = new Audio(track.previewUrl)
    audioRef.current = audio
    return () => {
      audio.pause()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [track.previewUrl])

  // Loop de reprodução: toca do startTime e, ao chegar em startTime + 15s, volta pro início do trecho
  function playFrom(s: number) {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = s
    audio.play().catch(() => {})
    setPlaying(true)

    function tick() {
      if (!audioRef.current) return
      const t = audioRef.current.currentTime
      if (t >= startTime + CLIP_DURATION || audioRef.current.paused) {
        audioRef.current.currentTime = startTime
      }
      const pct = ((audioRef.current.currentTime - startTime) / CLIP_DURATION) * 100
      setPlayheadPct(Math.min(100, Math.max(0, pct)))
      rafRef.current = requestAnimationFrame(tick)
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
  }

  function togglePlay() {
    if (playing) {
      audioRef.current?.pause()
      setPlaying(false)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    } else {
      playFrom(startTime)
    }
  }

  // Atualiza o trecho a partir de uma posição X dentro da waveform (em % de 0..100)
  function setStartFromPct(pct: number) {
    const clipPct = (CLIP_DURATION / PREVIEW_DURATION) * 100
    const maxPct = 100 - clipPct
    const clampedPct = Math.min(maxPct, Math.max(0, pct - clipPct / 2))
    const newStart = Math.round((clampedPct / 100) * PREVIEW_DURATION)
    setStartTime(Math.min(maxStart, Math.max(0, newStart)))
  }

  function pctFromClientX(clientX: number) {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    return ((clientX - rect.left) / rect.width) * 100
  }

  function onTrackPointerDown(e: React.PointerEvent) {
    dragRef.current = true
    setStartFromPct(pctFromClientX(e.clientX))
    // Toca o trecho assim que o usuário começa a arrastar, dando feedback imediato
    if (!playing) playFrom(startTime)
  }
  function onTrackPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return
    setStartFromPct(pctFromClientX(e.clientX))
  }
  function onTrackPointerUp() {
    if (!dragRef.current) return
    dragRef.current = false
    // Reinicia a reprodução já no novo início escolhido
    if (playing) playFrom(startTime)
  }

  // Se o usuário soltar fora do elemento, ainda assim encerra o arrasto
  useEffect(() => {
    function onUp() { if (dragRef.current) { dragRef.current = false; if (playing) playFrom(startTime) } }
    window.addEventListener('pointerup', onUp)
    return () => window.removeEventListener('pointerup', onUp)
  }, [playing, startTime])

  const windowLeftPct = (startTime / PREVIEW_DURATION) * 100
  const windowWidthPct = (CLIP_DURATION / PREVIEW_DURATION) * 100

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-zinc-400 text-sm flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Voltar
        </button>
        <span className="text-white font-semibold text-sm">Escolher trecho</span>
        <button onClick={onClose} className="text-zinc-400 text-xl">✕</button>
      </div>

      {/* Faixa selecionada */}
      <div className="flex items-center gap-3 px-1">
        <img
          src={track.artworkUrl100}
          alt={track.collectionName}
          className="w-12 h-12 rounded-lg object-cover shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">{track.trackName}</p>
          <p className="text-zinc-400 text-xs truncate">{track.artistName}</p>
        </div>
      </div>

      <p className="text-zinc-500 text-xs px-1">Arraste a janela para escolher os 15s que vão tocar no seu story.</p>

      {/* Waveform com janela deslizável de 15s */}
      <div
        ref={trackRef}
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
        onPointerUp={onTrackPointerUp}
        className="relative h-16 rounded-xl bg-zinc-800 overflow-hidden touch-none cursor-grab select-none"
      >
        {/* Barras da waveform simulada */}
        <div className="absolute inset-0 flex items-center gap-[2px] px-1.5">
          {bars.map((h, i) => {
            const barPct = (i / bars.length) * 100
            const inWindow = barPct >= windowLeftPct && barPct <= windowLeftPct + windowWidthPct
            return (
              <div
                key={i}
                className="flex-1 rounded-full"
                style={{
                  height: `${h * 100}%`,
                  background: inWindow ? 'linear-gradient(180deg,#f9a8d4,#ec4899)' : 'rgba(255,255,255,0.18)',
                  transition: 'background 0.1s ease-out',
                }}
              />
            )
          })}
        </div>

        {/* Janela arrastável de 15s */}
        <div
          className="absolute top-0 bottom-0 border-2 border-pink-400 rounded-lg pointer-events-none"
          style={{
            left: `${windowLeftPct}%`,
            width: `${windowWidthPct}%`,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
          }}
        >
          {/* Cursor de reprodução dentro da janela */}
          {playing && (
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-white"
              style={{ left: `${playheadPct}%` }}
            />
          )}
        </div>
      </div>

      {/* Marcações de tempo */}
      <div className="flex justify-between text-zinc-500 text-[10px] px-1">
        <span>0s</span>
        <span>{PREVIEW_DURATION}s (preview iTunes)</span>
      </div>

      {/* Play/pause do trecho + confirmação */}
      <div className="flex items-center gap-3 mt-1">
        <button
          onClick={togglePlay}
          className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-white text-base"
        >
          {playing ? '⏸' : '▶'}
        </button>
        <span className="text-zinc-400 text-xs flex-1">
          Tocando {startTime}s–{startTime + CLIP_DURATION}s
        </span>
        <button
          onClick={() => { audioRef.current?.pause(); onConfirm(startTime) }}
          className="px-4 py-2.5 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-white text-sm font-semibold"
        >
          Usar este trecho
        </button>
      </div>
    </>
  )
}

// ---------- Componente principal ----------
export default function StoryCreator({
  myId,
  onClose,
  onPosted,
}: {
  myId: string
  onClose: () => void
  onPosted: () => void
}) {
  const [step, setStep] = useState<'select' | 'camera' | 'edit'>('select')
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [imgNaturalSize, setImgNaturalSize] = useState({ w: 0, h: 0 })
  const [layers, setLayers] = useState<Layer[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tool, setTool] = useState<'none' | 'pen' | 'stickers'>('none')
  const [penColor, setPenColor] = useState('#ffffff')
  const [posting, setPosting] = useState(false)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [imgScale, setImgScale] = useState(1)
  const [panPx, setPanPx] = useState({ x: 0, y: 0 })
  const [bgIndex, setBgIndex] = useState(0)
  const [musicModalOpen, setMusicModalOpen] = useState(false)
  const [trimEditLayer, setTrimEditLayer] = useState<MusicLayer | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const drawCanvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const addPhotoInputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<{ id: string; offX: number; offY: number } | null>(null)
  const panningRef = useRef<{ startX: number; startY: number; origX: number; origY: number; containerW: number; containerH: number } | null>(null)
  const drawingRef = useRef(false)
  const lastPtRef = useRef<{ x: number; y: number } | null>(null)
  const historyRef = useRef<ImageData[]>([])

  // ---------- Câmera ----------
  async function openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false })
      streamRef.current = stream
      setStep('camera')
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream }, 0)
    } catch (err: unknown) {
      alert('Não foi possível acessar a câmera: ' + (err as Error).message)
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  function flipCamera() {
    stopCamera()
    setFacing(f => (f === 'environment' ? 'user' : 'environment'))
    setTimeout(openCamera, 50)
  }

  function capturePhoto() {
    const video = videoRef.current
    if (!video) return
    const vw = video.videoWidth
    const vh = video.videoHeight
    const canvas = document.createElement('canvas')
    canvas.width = vw
    canvas.height = vh
    canvas.getContext('2d')!.drawImage(video, 0, 0, vw, vh)
    const src = canvas.toDataURL('image/jpeg', 0.92)
    setImageSrc(src)
    setImgNaturalSize({ w: vw, h: vh })
    setPanPx({ x: 0, y: 0 })
    setImgScale(calcFitScale(vw, vh))
    stopCamera()
    setStep('edit')
  }

  function handleGalleryFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = reader.result as string
      const img = new window.Image()
      img.onload = () => {
        setImageSrc(src)
        setImgNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
        setPanPx({ x: 0, y: 0 })
        setImgScale(calcFitScale(img.naturalWidth, img.naturalHeight))
        setStep('edit')
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  }

  function calcFitScale(imgW: number, imgH: number) {
    const containerRatio = 9 / 16
    const imgRatio = imgW / imgH
    return imgRatio > containerRatio ? containerRatio / imgRatio : 1
  }

  useEffect(() => { return () => stopCamera() }, [])

  useEffect(() => {
    if (step !== 'edit') return
    const canvas = drawCanvasRef.current
    if (!canvas) return
    canvas.width = EXPORT_W
    canvas.height = EXPORT_H
  }, [step])

  // ---------- Desenho (caneta) ----------
  function canvasPoint(e: React.PointerEvent) {
    const canvas = drawCanvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  function pushHistory() {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
    if (historyRef.current.length > 15) historyRef.current.shift()
  }

  function undoDraw() {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const prev = historyRef.current.pop()
    if (prev) ctx.putImageData(prev, 0, 0)
    else ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  function onPenDown(e: React.PointerEvent) {
    if (tool !== 'pen') return
    pushHistory()
    drawingRef.current = true
    lastPtRef.current = canvasPoint(e)
  }

  function onPenMove(e: React.PointerEvent) {
    if (tool !== 'pen' || !drawingRef.current) return
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const pt = canvasPoint(e)
    const last = lastPtRef.current
    if (last) {
      ctx.strokeStyle = penColor
      ctx.lineWidth = 14
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(last.x, last.y)
      ctx.lineTo(pt.x, pt.y)
      ctx.stroke()
    }
    lastPtRef.current = pt
  }

  function onPenUp() {
    drawingRef.current = false
    lastPtRef.current = null
  }

  // ---------- Camadas ----------
  function addText() {
    const text = window.prompt('Digite o texto:')
    if (!text) return
    const id = Math.random().toString(36).slice(2)
    const newLayer: TextLayer = {
      id, type: 'text', x: 50, y: 50,
      text, color: '#ffffff', fontSize: 48, fontFamily: 'sans-serif',
      align: 'center', bgStyle: 'none',
    }
    setLayers(prev => [...prev, newLayer])
    setSelectedId(id)
    setTool('none')
  }

  function addSticker(emoji: string) {
    const id = Math.random().toString(36).slice(2)
    const newLayer: StickerLayer = { id, type: 'sticker', x: 50, y: 50, emoji, fontSize: 90 }
    setLayers(prev => [...prev, newLayer])
    setSelectedId(id)
    setTool('none')
  }

  // Abre o modal de busca real (iTunes API) em vez do prompt manual
  function openMusicModal() {
    setTool('none')
    setMusicModalOpen(true)
  }

  // Reabre só a etapa de seleção de trecho para uma camada de música já adicionada
  function openMusicTrimEditor(layer: MusicLayer) {
    setTool('none')
    setTrimEditLayer(layer)
  }

  function handleMusicSelect(track: ItunesTrack, startTime: number) {
    const id = Math.random().toString(36).slice(2)
    const newLayer: MusicLayer = {
      id,
      type: 'music',
      x: 50,
      y: 20,
      title: track.trackName,
      artist: track.artistName,
      artworkUrl: track.artworkUrl100 || null,
      previewUrl: track.previewUrl || null,
      startTime,
      scale: 1,
    }
    setLayers(prev => [...prev, newLayer])
    setSelectedId(id)
  }

  function cycleBackground(dir: 1 | -1 = 1) {
    setBgIndex(i => (i + dir + BACKGROUNDS.length) % BACKGROUNDS.length)
  }

  function cycleTextAlign(id: string) {
    setLayers(prev => prev.map(l => {
      if (l.id !== id || l.type !== 'text') return l
      const order: TextLayer['align'][] = ['left', 'center', 'right']
      const next = order[(order.indexOf(l.align) + 1) % order.length]
      return { ...l, align: next }
    }))
  }

  function cycleTextStyle(id: string) {
    setLayers(prev => prev.map(l => {
      if (l.id !== id || l.type !== 'text') return l
      const order: TextLayer['bgStyle'][] = ['none', 'box', 'outline']
      const next = order[(order.indexOf(l.bgStyle) + 1) % order.length]
      return { ...l, bgStyle: next }
    }))
  }

  function updateTextLayer(id: string, patch: Partial<Omit<TextLayer, 'id' | 'type'>>) {
    setLayers(prev => prev.map(l => {
      if (l.id !== id || l.type !== 'text') return l
      return { ...l, ...patch }
    }))
  }

  function updateStickerLayer(id: string, patch: Partial<Omit<StickerLayer, 'id' | 'type'>>) {
    setLayers(prev => prev.map(l => {
      if (l.id !== id || l.type !== 'sticker') return l
      return { ...l, ...patch }
    }))
  }

  function updateMusicLayer(id: string, patch: Partial<Omit<MusicLayer, 'id' | 'type'>>) {
    setLayers(prev => prev.map(l => {
      if (l.id !== id || l.type !== 'music') return l
      return { ...l, ...patch }
    }))
  }

  function deleteLayer(id: string) {
    setLayers(prev => prev.filter(l => l.id !== id))
    setSelectedId(null)
  }

  function editTextLayer(layer: TextLayer) {
    const text = window.prompt('Editar texto:', layer.text)
    if (text === null) return
    updateTextLayer(layer.id, { text })
  }

  function onLayerPointerDown(e: React.PointerEvent, layer: Layer) {
    e.stopPropagation()
    if (tool === 'pen') return
    setSelectedId(layer.id)
    const rect = containerRef.current!.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * 100
    const py = ((e.clientY - rect.top) / rect.height) * 100
    dragRef.current = { id: layer.id, offX: px - layer.x, offY: py - layer.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onContainerPointerMove(e: React.PointerEvent) {
    if (tool === 'pen') { onPenMove(e); return }
    const drag = dragRef.current
    if (drag) {
      const rect = containerRef.current!.getBoundingClientRect()
      const px = ((e.clientX - rect.left) / rect.width) * 100
      const py = ((e.clientY - rect.top) / rect.height) * 100
      const nx = Math.min(96, Math.max(4, px - drag.offX))
      const ny = Math.min(96, Math.max(4, py - drag.offY))
      setLayers(prev => prev.map(l => l.id === drag.id ? { ...l, x: nx, y: ny } : l))
      return
    }
    const pan = panningRef.current
    if (pan) {
      const dx = e.clientX - pan.startX
      const dy = e.clientY - pan.startY
      setPanPx(clampPan(pan.origX + dx, pan.origY + dy, pan.containerW, pan.containerH))
    }
  }

  function onContainerPointerUp() {
    dragRef.current = null
    panningRef.current = null
    onPenUp()
  }

  function onContainerPointerDownBg(e: React.PointerEvent) {
    if (tool === 'pen') { onPenDown(e); return }
    setSelectedId(null)
    const rect = containerRef.current!.getBoundingClientRect()
    panningRef.current = {
      startX: e.clientX, startY: e.clientY,
      origX: panPx.x, origY: panPx.y,
      containerW: rect.width, containerH: rect.height,
    }
  }

  function clampPan(x: number, y: number, containerW: number, containerH: number) {
    const maxX = Math.max(0, ((imgScale - 1) * containerW) / 2 + 40)
    const maxY = Math.max(0, ((imgScale - 1) * containerH) / 2 + 40)
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    }
  }

  function zoomBy(delta: number) {
    setImgScale(s => {
      const minScale = Math.min(calcFitScale(imgNaturalSize.w, imgNaturalSize.h), 0.2)
      const next = Math.min(3, Math.max(minScale, s + delta))
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) setPanPx(p => clampPan(p.x, p.y, rect.width, rect.height))
      return next
    })
  }

  function onContainerWheel(e: React.WheelEvent) {
    e.preventDefault()
    zoomBy(-e.deltaY * 0.002)
  }

  function resetImagePosition() {
    setImgScale(calcFitScale(imgNaturalSize.w, imgNaturalSize.h))
    setPanPx({ x: 0, y: 0 })
  }

  // ---------- Exportar e publicar ----------
  async function handlePost() {
    setPosting(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = EXPORT_W
      canvas.height = EXPORT_H
      const ctx = canvas.getContext('2d')!

      paintBackground(ctx, BACKGROUNDS[bgIndex].css)

      if (imageSrc) {
        const img = new window.Image()
        img.src = imageSrc
        await new Promise<void>(res => { img.onload = () => res() })

        const rect = containerRef.current?.getBoundingClientRect()
        const ratio = rect ? EXPORT_W / rect.width : 1

        ctx.save()
        ctx.translate(EXPORT_W / 2 + panPx.x * ratio, EXPORT_H / 2 + panPx.y * ratio)
        ctx.scale(imgScale, imgScale)
        const iw = img.naturalWidth
        const ih = img.naturalHeight
        const sc = Math.min(EXPORT_W / iw, EXPORT_H / ih)
        ctx.drawImage(img, -(iw * sc) / 2, -(ih * sc) / 2, iw * sc, ih * sc)
        ctx.restore()
      }

      const drawCanvas = drawCanvasRef.current
      if (drawCanvas) ctx.drawImage(drawCanvas, 0, 0, EXPORT_W, EXPORT_H)

      // Desenha camadas de texto, sticker e music no canvas de exportação.
      // Para music com artwork (capa do álbum), carregamos a imagem primeiro;
      // para garantir CORS, usamos o tamanho 60x60 da URL do iTunes (basta
      // trocar "100x100" por "60x60bb" — a API suporta vários tamanhos).
      for (const layer of layers) {
        const x = (layer.x / 100) * EXPORT_W
        const y = (layer.y / 100) * EXPORT_H

        if (layer.type === 'text') {
          ctx.font = `bold ${layer.fontSize}px ${layer.fontFamily}`
          ctx.textAlign = layer.align
          ctx.textBaseline = 'middle'
          const metrics = ctx.measureText(layer.text)
          const textW = metrics.width
          const padX = layer.fontSize * 0.35
          const padY = layer.fontSize * 0.28
          const boxX = layer.align === 'left' ? x - padX
            : layer.align === 'right' ? x - textW - padX
            : x - textW / 2 - padX

          if (layer.bgStyle === 'box') {
            ctx.fillStyle = layer.color === '#000000' ? '#ffffff' : '#000000'
            ctx.fillRect(boxX, y - layer.fontSize / 2 - padY, textW + padX * 2, layer.fontSize + padY * 2)
            ctx.fillStyle = layer.color
            ctx.fillText(layer.text, x, y)
          } else if (layer.bgStyle === 'outline') {
            ctx.lineWidth = layer.fontSize * 0.12
            ctx.strokeStyle = layer.color === '#000000' ? '#ffffff' : '#000000'
            ctx.lineJoin = 'round'
            ctx.strokeText(layer.text, x, y)
            ctx.fillStyle = layer.color
            ctx.fillText(layer.text, x, y)
          } else {
            ctx.lineWidth = 6
            ctx.strokeStyle = 'rgba(0,0,0,0.45)'
            ctx.strokeText(layer.text, x, y)
            ctx.fillStyle = layer.color
            ctx.fillText(layer.text, x, y)
          }
        } else if (layer.type === 'sticker') {
          ctx.font = `${layer.fontSize}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(layer.emoji, x, y)
        } else if (layer.type === 'music') {
          // Tenta carregar a capa do álbum para o canvas de exportação.
          // A URL do iTunes aceita crossOrigin anônimo sem precisar de proxy.
          let artworkImg: HTMLImageElement | null = null
          if (layer.artworkUrl) {
            try {
              artworkImg = new window.Image()
              artworkImg.crossOrigin = 'anonymous'
              // A iTunes API devolve 100×100 por padrão; 60×60bb é menor e carrega mais rápido
              artworkImg.src = layer.artworkUrl.replace('100x100bb', '60x60bb')
              await new Promise<void>((res, rej) => {
                artworkImg!.onload = () => res()
                artworkImg!.onerror = () => { artworkImg = null; res() }
                setTimeout(() => { artworkImg = null; res() }, 3000)
              })
            } catch {
              artworkImg = null
            }
          }
          drawMusicChip(ctx, x, y, layer, artworkImg)
        }
      }

      const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/jpeg', 0.92))
      const path = `${myId}/${Date.now()}.jpg`

      const { error: uploadError } = await supabase.storage
        .from('stories').upload(path, blob, { contentType: 'image/jpeg' })

      if (uploadError) { alert('Erro ao enviar story: ' + uploadError.message); setPosting(false); return }

      const { data: urlData } = supabase.storage.from('stories').getPublicUrl(path)

      // Pega a primeira MusicLayer (se houver) para salvar os metadados no banco.
      // Salva nas colunas adicionadas pelo add_music_columns.sql.
      const musicLayer = layers.find((l): l is MusicLayer => l.type === 'music')

      const { error: insertError } = await supabase.from('stories').insert({
        user_id: myId,
        image_url: urlData.publicUrl,
        ...(musicLayer ? {
          music_title: musicLayer.title,
          music_artist: musicLayer.artist,
          music_preview_url: musicLayer.previewUrl,
          music_artwork_url: musicLayer.artworkUrl,
          music_start_time: musicLayer.startTime,
        } : {}),
      })

      if (insertError) alert('Erro ao salvar story: ' + insertError.message)

      onPosted()
      onClose()
    } catch (err: unknown) {
      alert('Erro: ' + (err as Error).message)
    } finally {
      setPosting(false)
    }
  }

  // ---------- Canvas helpers ----------
  function paintBackground(ctx: CanvasRenderingContext2D, css: string) {
    if (!css.includes('gradient')) {
      ctx.fillStyle = css
      ctx.fillRect(0, 0, EXPORT_W, EXPORT_H)
      return
    }
    const stopMatches = css.match(/#[0-9a-fA-F]{3,8}/g) || ['#000000', '#000000']
    const angleMatch = css.match(/(\d+)deg/)
    const angle = angleMatch ? parseInt(angleMatch[1], 10) : 135
    const rad = (angle - 90) * (Math.PI / 180)
    const cx = EXPORT_W / 2
    const cy = EXPORT_H / 2
    const len = Math.max(EXPORT_W, EXPORT_H)
    const x0 = cx - Math.cos(rad) * len
    const y0 = cy - Math.sin(rad) * len
    const x1 = cx + Math.cos(rad) * len
    const y1 = cy + Math.sin(rad) * len
    const grad = ctx.createLinearGradient(x0, y0, x1, y1)
    stopMatches.forEach((color, i) => grad.addColorStop(i / Math.max(1, stopMatches.length - 1), color))
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, EXPORT_W, EXPORT_H)
  }

  // Pílula de música no canvas: com capa do álbum se disponível
  function drawMusicChip(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    layer: MusicLayer,
    artworkImg: HTMLImageElement | null = null,
  ) {
    const scale = layer.scale
    const w = 460 * scale
    const h = 120 * scale
    const r = h / 2
    const left = x - w / 2
    const top = y - h / 2
    const artSize = h - 16 * scale
    const artLeft = left + 8 * scale
    const artTop = top + 8 * scale

    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.60)'
    roundRectPath(ctx, left, top, w, h, r)
    ctx.fill()

    // Artwork ou ícone de nota
    if (artworkImg) {
      ctx.save()
      roundRectPath(ctx, artLeft, artTop, artSize, artSize, 10 * scale)
      ctx.clip()
      ctx.drawImage(artworkImg, artLeft, artTop, artSize, artSize)
      ctx.restore()
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      roundRectPath(ctx, artLeft, artTop, artSize, artSize, 10 * scale)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.font = `${40 * scale}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🎵', artLeft + artSize / 2, y)
    }

    const textLeft = artLeft + artSize + 14 * scale
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.font = `600 ${26 * scale}px sans-serif`
    ctx.fillStyle = '#ffffff'

    // Trunca o título para não vazar pra fora da pílula
    const maxTextW = w - artSize - 36 * scale
    let title = layer.title
    while (title.length > 1 && ctx.measureText(title).width > maxTextW) {
      title = title.slice(0, -1)
    }
    if (title !== layer.title) title += '…'

    ctx.fillText(title, textLeft, y - 14 * scale)

    if (layer.artist) {
      ctx.font = `${20 * scale}px sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      let artist = layer.artist
      while (artist.length > 1 && ctx.measureText(artist).width > maxTextW) {
        artist = artist.slice(0, -1)
      }
      if (artist !== layer.artist) artist += '…'
      ctx.fillText(artist, textLeft, y + 18 * scale)
    }

    ctx.restore()
  }

  function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  // ===================== UI =====================

  if (step === 'select') {
    return (
      <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center gap-4">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/80 text-2xl">✕</button>
        <h2 className="text-white text-lg font-semibold mb-4">Novo story</h2>
        <button onClick={openCamera}
          className="w-64 py-3 rounded-xl bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600 text-white font-semibold">
          📷 Usar câmera
        </button>
        <button onClick={() => fileInputRef.current?.click()}
          className="w-64 py-3 rounded-xl bg-zinc-800 text-white font-semibold">
          🖼️ Escolher da galeria
        </button>
        <button
          onClick={() => {
            setImageSrc(null)
            setLayers([])
            setBgIndex(0)
            setStep('edit')
          }}
          className="w-64 py-3 rounded-xl bg-zinc-800 text-white font-semibold"
        >
          ✏️ Escrever algo
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleGalleryFile} />
      </div>
    )
  }

  if (step === 'camera') {
    return (
      <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center">
        <button onClick={() => { stopCamera(); setStep('select') }}
          className="absolute top-4 left-4 text-white/80 text-2xl z-10">✕</button>
        <button onClick={flipCamera} className="absolute top-4 right-4 text-white/80 text-2xl z-10">🔄</button>
        <div className="relative w-full max-w-md aspect-[9/16] bg-black overflow-hidden">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        </div>
        <button onClick={capturePhoto} className="mt-6 w-16 h-16 rounded-full bg-white border-4 border-zinc-400" />
      </div>
    )
  }

  // step === 'edit'
  const rawSelected = layers.find(l => l.id === selectedId)
  const selectedText = rawSelected?.type === 'text' ? rawSelected : null
  const selectedSticker = rawSelected?.type === 'sticker' ? rawSelected : null
  const selectedMusic = rawSelected?.type === 'music' ? rawSelected : null

  return (
    <>
      <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center select-none">
        <div
          ref={containerRef}
          className="relative w-full max-w-md aspect-[9/16] overflow-hidden touch-none"
          style={{ background: BACKGROUNDS[bgIndex].css }}
          onPointerDown={onContainerPointerDownBg}
          onPointerMove={onContainerPointerMove}
          onPointerUp={onContainerPointerUp}
          onWheel={onContainerWheel}
        >
          {imageSrc && (
            <img
              src={imageSrc}
              alt=""
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              style={{
                transform: `translate(${panPx.x}px, ${panPx.y}px) scale(${imgScale})`,
                transformOrigin: 'center center',
              }}
            />
          )}

          <canvas
            ref={drawCanvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ pointerEvents: tool === 'pen' ? 'auto' : 'none' }}
          />

          {layers.map(layer => (
            <div
              key={layer.id}
              onPointerDown={e => onLayerPointerDown(e, layer)}
              onDoubleClick={() => layer.type === 'text' && editTextLayer(layer)}
              style={{
                position: 'absolute',
                left: `${layer.x}%`,
                top: `${layer.y}%`,
                transform: 'translate(-50%, -50%)',
                cursor: 'grab',
                outline: selectedId === layer.id ? '2px dashed rgba(255,255,255,0.7)' : 'none',
                borderRadius: 4,
                padding: 4,
                touchAction: 'none',
                userSelect: 'none',
              }}
            >
              {layer.type === 'text' ? (
                <span style={{
                  color: layer.color,
                  fontSize: layer.fontSize / 3,
                  fontWeight: 700,
                  fontFamily: layer.fontFamily,
                  textAlign: layer.align,
                  textShadow: layer.bgStyle === 'none' ? '0 1px 4px rgba(0,0,0,0.6)' : 'none',
                  WebkitTextStroke: layer.bgStyle === 'outline' ? `${layer.fontSize / 30}px ${layer.color === '#000000' ? '#ffffff' : '#000000'}` : undefined,
                  whiteSpace: 'nowrap',
                  display: 'block',
                  background: layer.bgStyle === 'box' ? (layer.color === '#000000' ? '#ffffff' : '#000000') : 'transparent',
                  padding: layer.bgStyle === 'box' ? '4px 10px' : 0,
                  borderRadius: layer.bgStyle === 'box' ? 6 : 0,
                }}>
                  {layer.text}
                </span>
              ) : layer.type === 'sticker' ? (
                <span style={{ fontSize: layer.fontSize / 3, display: 'block', lineHeight: 1 }}>
                  {layer.emoji}
                </span>
              ) : (
                // Chip de música no editor: mostra a capa do álbum (img tag) se disponível
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'rgba(0,0,0,0.60)',
                    borderRadius: 999,
                    padding: '6px 14px 6px 6px',
                    transform: `scale(${layer.scale})`,
                    whiteSpace: 'nowrap',
                    maxWidth: 220,
                  }}
                >
                  {layer.artworkUrl ? (
                    <img
                      src={layer.artworkUrl}
                      alt={layer.title}
                      style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <span style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, flexShrink: 0,
                    }}>🎵</span>
                  )}
                  <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0 }}>
                    <span style={{ color: '#fff', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>
                      {layer.title}
                    </span>
                    {layer.artist && (
                      <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>
                        {layer.artist}
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          ))}

          {/* Barra superior */}
          <div className="absolute top-3 left-3 right-3 flex justify-between z-30">
            <button onClick={onClose} className="text-white text-2xl drop-shadow">✕</button>
            <div className="flex gap-2 items-center flex-wrap justify-end">
              {imageSrc && (
                <>
                  <button onClick={() => zoomBy(-0.15)} className="text-white text-lg drop-shadow bg-black/40 rounded-full w-7 h-7 flex items-center justify-center">−</button>
                  <button onClick={resetImagePosition} className="text-white text-xs drop-shadow bg-black/40 px-2 py-0.5 rounded-lg">fit</button>
                  <button onClick={() => zoomBy(0.15)} className="text-white text-lg drop-shadow bg-black/40 rounded-full w-7 h-7 flex items-center justify-center">+</button>
                </>
              )}
              {tool === 'pen' && (
                <button onClick={undoDraw} className="text-white text-xl drop-shadow">↩️</button>
              )}
              <button
                onClick={() => cycleBackground(1)}
                title="Trocar fundo"
                className="w-7 h-7 rounded-full border border-white/40 drop-shadow"
                style={{ background: BACKGROUNDS[(bgIndex + 1) % BACKGROUNDS.length].css }}
              />
              <button onClick={() => addPhotoInputRef.current?.click()} className="text-white text-xl drop-shadow">
                {imageSrc ? '🔄' : '🖼️'}
              </button>
              <button onClick={() => setTool(t => t === 'pen' ? 'none' : 'pen')}
                className={`text-xl drop-shadow ${tool === 'pen' ? 'text-amber-400' : 'text-white'}`}>
                🖊️
              </button>
              <button onClick={addText} className="text-white text-xl drop-shadow font-bold">Aa</button>
              <button onClick={() => setTool(t => t === 'stickers' ? 'none' : 'stickers')}
                className={`text-xl drop-shadow ${tool === 'stickers' ? 'text-amber-400' : 'text-white'}`}>
                😊
              </button>
              {/* Botão de música agora abre o modal de busca real */}
              <button onClick={openMusicModal} className="text-white text-xl drop-shadow">🎵</button>
            </div>
          </div>
        </div>
        <input ref={addPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleGalleryFile} />

        {/* Controles do texto selecionado */}
        {selectedText && (
          <div className="absolute bottom-20 left-2 right-2 z-30 flex flex-col gap-2 bg-black/40 rounded-2xl p-3 backdrop-blur-sm">
            <div className="flex gap-2 justify-center flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  onPointerDown={e => { e.stopPropagation(); updateTextLayer(selectedText.id, { color: c }) }}
                  className="w-7 h-7 rounded-full border-2 transition-all"
                  style={{
                    background: c,
                    borderColor: selectedText.color === c ? '#fff' : 'rgba(255,255,255,0.25)',
                    transform: selectedText.color === c ? 'scale(1.3)' : 'scale(1)',
                    boxShadow: selectedText.color === c ? '0 0 0 2px rgba(255,255,255,0.5)' : 'none',
                  }}
                />
              ))}
            </div>
            <div className="flex gap-1.5 justify-center flex-wrap">
              {FONTS.map(f => (
                <button
                  key={f.value}
                  onPointerDown={e => { e.stopPropagation(); updateTextLayer(selectedText.id, { fontFamily: f.value }) }}
                  className="px-2.5 py-1 rounded-lg text-xs border transition-all"
                  style={{
                    fontFamily: f.value,
                    color: selectedText.fontFamily === f.value ? '#000' : '#fff',
                    background: selectedText.fontFamily === f.value ? '#fff' : 'rgba(255,255,255,0.15)',
                    borderColor: selectedText.fontFamily === f.value ? '#fff' : 'rgba(255,255,255,0.2)',
                    fontWeight: 600,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 justify-center items-center">
              <button
                onPointerDown={e => { e.stopPropagation(); cycleTextAlign(selectedText.id) }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/15 text-white"
              >
                Alinhar: {selectedText.align === 'left' ? 'Esquerda' : selectedText.align === 'right' ? 'Direita' : 'Centro'}
              </button>
              <button
                onPointerDown={e => { e.stopPropagation(); cycleTextStyle(selectedText.id) }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/15 text-white"
              >
                Estilo: {selectedText.bgStyle === 'box' ? 'Destaque' : selectedText.bgStyle === 'outline' ? 'Contorno' : 'Clássico'}
              </button>
            </div>
            <div className="flex gap-3 justify-center items-center">
              <button
                onPointerDown={e => { e.stopPropagation(); updateTextLayer(selectedText.id, { fontSize: Math.max(20, selectedText.fontSize - 8) }) }}
                className="w-9 h-9 bg-white/20 rounded-full text-white font-bold text-lg flex items-center justify-center"
              >−</button>
              <span className="text-white text-xs opacity-60 w-10 text-center">{Math.round(selectedText.fontSize / 3)}px</span>
              <button
                onPointerDown={e => { e.stopPropagation(); updateTextLayer(selectedText.id, { fontSize: Math.min(180, selectedText.fontSize + 8) }) }}
                className="w-9 h-9 bg-white/20 rounded-full text-white font-bold text-lg flex items-center justify-center"
              >+</button>
              <button
                onPointerDown={e => { e.stopPropagation(); deleteLayer(selectedText.id) }}
                className="w-9 h-9 bg-red-500/70 rounded-full text-white flex items-center justify-center"
              >🗑</button>
            </div>
          </div>
        )}

        {/* Controles do sticker selecionado */}
        {selectedSticker && (
          <div className="absolute bottom-20 left-2 right-2 z-30 flex gap-3 justify-center items-center bg-black/40 rounded-2xl p-3 backdrop-blur-sm">
            <button
              onPointerDown={e => { e.stopPropagation(); updateStickerLayer(selectedSticker.id, { fontSize: Math.max(30, selectedSticker.fontSize - 10) }) }}
              className="w-9 h-9 bg-white/20 rounded-full text-white font-bold text-lg flex items-center justify-center"
            >−</button>
            <span className="text-white text-xs opacity-60">{selectedSticker.emoji}</span>
            <button
              onPointerDown={e => { e.stopPropagation(); updateStickerLayer(selectedSticker.id, { fontSize: Math.min(200, selectedSticker.fontSize + 10) }) }}
              className="w-9 h-9 bg-white/20 rounded-full text-white font-bold text-lg flex items-center justify-center"
            >+</button>
            <button
              onPointerDown={e => { e.stopPropagation(); deleteLayer(selectedSticker.id) }}
              className="w-9 h-9 bg-red-500/70 rounded-full text-white flex items-center justify-center"
            >🗑</button>
          </div>
        )}

        {/* Controles da música selecionada */}
        {selectedMusic && (
          <div className="absolute bottom-20 left-2 right-2 z-30 flex gap-3 justify-center items-center bg-black/40 rounded-2xl p-3 backdrop-blur-sm">
            <button
              onPointerDown={e => { e.stopPropagation(); updateMusicLayer(selectedMusic.id, { scale: Math.max(0.6, selectedMusic.scale - 0.1) }) }}
              className="w-9 h-9 bg-white/20 rounded-full text-white font-bold text-lg flex items-center justify-center"
            >−</button>
            <span className="text-white text-xs opacity-70 truncate max-w-[120px]">🎵 {selectedMusic.title}</span>
            {selectedMusic.previewUrl && (
              <button
                onPointerDown={e => { e.stopPropagation(); openMusicTrimEditor(selectedMusic) }}
                className="px-2.5 py-1.5 bg-white/15 rounded-full text-white text-[11px] font-semibold shrink-0"
              >
                Trecho
              </button>
            )}
            <button
              onPointerDown={e => { e.stopPropagation(); updateMusicLayer(selectedMusic.id, { scale: Math.min(1.6, selectedMusic.scale + 0.1) }) }}
              className="w-9 h-9 bg-white/20 rounded-full text-white font-bold text-lg flex items-center justify-center"
            >+</button>
            <button
              onPointerDown={e => { e.stopPropagation(); deleteLayer(selectedMusic.id) }}
              className="w-9 h-9 bg-red-500/70 rounded-full text-white flex items-center justify-center"
            >🗑</button>
          </div>
        )}

        {/* Paleta da caneta */}
        {tool === 'pen' && (
          <div className="absolute bottom-20 left-2 right-2 z-30 flex gap-2 justify-center flex-wrap bg-black/40 rounded-2xl p-3 backdrop-blur-sm">
            {COLORS.map(c => (
              <button
                key={c}
                onPointerDown={e => { e.stopPropagation(); setPenColor(c) }}
                className="w-7 h-7 rounded-full border-2 transition-all"
                style={{
                  background: c,
                  borderColor: penColor === c ? '#fff' : 'rgba(255,255,255,0.3)',
                  transform: penColor === c ? 'scale(1.3)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        )}

        {/* Seletor de stickers */}
        {tool === 'stickers' && (
          <div className="absolute bottom-20 left-2 right-2 z-30 bg-black/60 rounded-2xl p-2 grid grid-cols-8 gap-1 backdrop-blur-sm">
            {STICKERS.map(s => (
              <button key={s} onPointerDown={e => { e.stopPropagation(); addSticker(s) }} className="text-2xl">
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Botão publicar */}
        <div className="absolute bottom-4 left-3 right-3 z-30 flex justify-end">
          <button
            onClick={handlePost}
            disabled={posting}
            className="px-5 py-2.5 rounded-full bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600 text-white font-semibold disabled:opacity-50"
          >
            {posting ? 'Enviando…' : 'Compartilhar ▶'}
          </button>
        </div>
      </div>

      {/* Modal de busca de música — renderizado fora do container para z-index correto */}
      {musicModalOpen && (
        <MusicSearchModal
          onSelect={handleMusicSelect}
          onClose={() => setMusicModalOpen(false)}
        />
      )}

      {/* Modal de re-edição do trecho — abre direto na etapa de trim para a camada já existente */}
      {trimEditLayer && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 rounded-t-3xl p-4 flex flex-col gap-3 max-h-[80vh]">
            <MusicTrimStep
              track={{
                trackId: Number(trimEditLayer.id.replace(/\D/g, '').slice(0, 8)) || 1,
                trackName: trimEditLayer.title,
                artistName: trimEditLayer.artist,
                artworkUrl100: trimEditLayer.artworkUrl || '',
                previewUrl: trimEditLayer.previewUrl,
                collectionName: trimEditLayer.title,
              }}
              initialStartTime={trimEditLayer.startTime}
              onBack={() => setTrimEditLayer(null)}
              onClose={() => setTrimEditLayer(null)}
              onConfirm={(startTime) => {
                updateMusicLayer(trimEditLayer.id, { startTime })
                setTrimEditLayer(null)
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}
