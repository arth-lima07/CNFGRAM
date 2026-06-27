
'use client'
import React from 'react'
import Navbar from '@/components/Navbar'
import StoriesBar from '@/components/StoriesBar'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const ANIMATION_STYLES = `
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes likePop {
  0%   { transform: scale(1); }
  35%  { transform: scale(1.35); }
  60%  { transform: scale(0.9); }
  100% { transform: scale(1); }
}
@keyframes dislikePop {
  0%   { transform: scale(1); }
  35%  { transform: scale(1.35); }
  60%  { transform: scale(0.9); }
  100% { transform: scale(1); }
}
@keyframes slideDown {
  from { opacity: 0; max-height: 0; }
  to   { opacity: 1; max-height: 800px; }
}
@keyframes shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
@keyframes spinSlow {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes bubbleFloat {
  0%   { transform: translate(0px, 0px) rotate(0deg); }
  25%  { transform: translate(3px, -4px) rotate(1deg); }
  50%  { transform: translate(-2px, -7px) rotate(-1deg); }
  75%  { transform: translate(-4px, -2px) rotate(0.5deg); }
  100% { transform: translate(0px, 0px) rotate(0deg); }
}
@keyframes bubblePopIn {
  0%   { opacity: 0; transform: scale(0.6) translateY(6px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes repostBurstParticle {
  0%   { opacity: 1; transform: translate(0, 0) scale(0.4) rotate(0deg); }
  60%  { opacity: 1; }
  100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(1.1) rotate(var(--rot)); }
}
@keyframes repostBurstRing {
  0%   { opacity: 0.55; transform: scale(0.3); }
  100% { opacity: 0; transform: scale(1.8); }
}
.repost-burst {
  position: absolute;
  inset: -22px;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
}
.repost-burst-ring {
  position: absolute;
  width: 28px;
  height: 28px;
  border-radius: 9999px;
  border: 2px solid #10b981;
  animation: repostBurstRing 0.55s ease-out both;
}
.repost-burst-particle {
  position: absolute;
  font-size: 13px;
  line-height: 1;
  animation: repostBurstParticle 0.7s cubic-bezier(0.2, 0.7, 0.3, 1) both;
  will-change: transform, opacity;
}
@keyframes repostMenuPopOut {
  0%   { opacity: 1; transform: scale(1); }
  40%  { opacity: 1; transform: scale(1.04); }
  100% { opacity: 0; transform: scale(0.9); }
}
.repost-menu-pop-out {
  animation: repostMenuPopOut 0.28s ease both;
}
.repost-bubble {
  animation: bubblePopIn 0.25s ease both, bubbleFloat 5.5s ease-in-out infinite 0.25s;
  cursor: grab;
  touch-action: none;
}
.repost-bubble:active {
  cursor: grabbing;
  animation: bubblePopIn 0.25s ease both;
}
.post-enter { animation: fadeInUp 0.35s ease both; }
.like-pop { animation: likePop 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
.dislike-pop { animation: dislikePop 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
.comments-enter { animation: slideDown 0.25s ease both; overflow: hidden; }
.skeleton {
  background: linear-gradient(90deg, #18181b 25%, #27272a 37%, #18181b 63%);
  background-size: 800px 100%;
  animation: shimmer 1.4s ease infinite;
}
.nav-link {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.nav-link:active {
  transform: scale(0.97);
  opacity: 0.7;
}
.page-fade-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: #09090b;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeInUp 0.2s ease both;
}
@keyframes commentsOverlayIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes commentsOverlayOut {
  from { opacity: 1; }
  to   { opacity: 0; }
}
@keyframes commentsSheetIn {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
@keyframes commentsSheetOut {
  from { transform: translateY(0); }
  to   { transform: translateY(100%); }
}
@keyframes commentLikePop {
  0%   { transform: scale(1); }
  35%  { transform: scale(1.4); }
  60%  { transform: scale(0.9); }
  100% { transform: scale(1); }
}
.comments-modal-overlay {
  animation: commentsOverlayIn 0.22s ease both;
}
.comments-modal-overlay.closing {
  animation: commentsOverlayOut 0.18s ease both;
}
.comments-modal-sheet-anim {
  animation: commentsSheetIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.comments-modal-sheet-anim.closing {
  animation: commentsSheetOut 0.2s cubic-bezier(0.4, 0, 1, 1) both;
}
@keyframes commentEnter {
  from { opacity: 0; transform: translateY(10px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.comment-enter { animation: commentEnter 0.32s cubic-bezier(0.16, 1, 0.3, 1) both; }

/* Modal de comentários — vidro translúcido. Quando o post tem imagem, ela aparece
   desfocada por baixo, com um degradê escurecendo de cima pra baixo para manter o
   texto legível. Sem imagem, cai num degradê neutro (zinc) com o mesmo efeito de vidro. */
.comments-modal-sheet {
  position: relative;
  backdrop-filter: blur(28px) saturate(140%);
  -webkit-backdrop-filter: blur(28px) saturate(140%);
  background-color: rgba(24, 24, 27, 0.72);
  isolation: isolate;
}
.comments-modal-sheet::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background-image: var(--bg-image, none);
  background-size: cover;
  background-position: center calc(50% + var(--parallax-y, 0px));
  filter: blur(34px) brightness(0.55) saturate(1.15);
  transform: scale(1.15);
  opacity: 0.9;
}
.comments-modal-sheet::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  background: linear-gradient(
    180deg,
    rgba(9, 9, 11, 0.35) 0%,
    rgba(9, 9, 11, 0.55) 18%,
    rgba(9, 9, 11, 0.82) 55%,
    rgba(9, 9, 11, 0.96) 100%
  );
  pointer-events: none;
}
.comments-modal-sheet > * {
  position: relative;
  z-index: 1;
}
.comments-modal-handle {
  width: 36px;
  height: 4px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.25);
  margin: 8px auto 0;
}
.comment-heart-glow {
  filter: drop-shadow(0 0 6px rgba(239, 68, 68, 0.55));
}

/* Card de post no feed — mesmo conceito de vidro do modal de comentários, porém mais
   sutil (blur mais leve, degradê menos contrastado), já que cards são menores e mais
   numerosos numa lista — um blur pesado repetido em cada post cansaria visualmente. */
.glass-card {
  position: relative;
  backdrop-filter: blur(18px) saturate(130%);
  -webkit-backdrop-filter: blur(18px) saturate(130%);
  background-color: rgba(24, 24, 27, 0.78);
  isolation: isolate;
}
.glass-card::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background-image: var(--bg-image, none);
  background-size: cover;
  background-position: center;
  filter: blur(22px) brightness(0.5) saturate(1.1);
  transform: scale(1.2);
  opacity: 0.55;
}
.glass-card::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  background: linear-gradient(
    180deg,
    rgba(9, 9, 11, 0.45) 0%,
    rgba(9, 9, 11, 0.7) 40%,
    rgba(9, 9, 11, 0.92) 100%
  );
  pointer-events: none;
}
.glass-card > * {
  position: relative;
  z-index: 1;
}
`

// Converte uma string de data vinda do Postgres/Supabase em milissegundos (UTC) de forma confiável.
// Problema raiz: o Postgres costuma devolver "2026-06-24 05:10:00.123456" — sem "T" e sem
// offset de timezone. O JS, ao ver uma string assim (sem indicação de fuso), interpreta como
// HORÁRIO LOCAL do navegador, não como UTC. Para alguém em UTC-3, isso desloca a data 3h "pro futuro",
// fazendo o post parecer mais recente do que é (por isso ficava preso em "agora" por muito tempo,
// e por isso a ordenação por data também ficava inconsistente — duas datas "iguais" na prática
// podiam virar valores diferentes dependendo de qual delas tinha ou não o sufixo de timezone).
function parseServerDate(dateStr: string): number {
  if (!dateStr) return NaN
  const trimmed = dateStr.trim()
  // Já tem indicação de timezone (Z ou +HH:MM / -HH:MM ao final)? Deixa como está.
  const hasTimezone = /Z$|[+-]\d{2}:?\d{2}$/.test(trimmed)
  if (hasTimezone) return new Date(trimmed).getTime()

  // Sem timezone: normaliza espaço -> "T" e força UTC anexando "Z".
  const normalized = trimmed.replace(' ', 'T') + 'Z'
  return new Date(normalized).getTime()
}

type Comment = {
  id: number
  username: string
  user_id: string
  avatar_url: string | null
  content: string
  post_id: number
  created_at: string
  likeCount: number
  likedByMe: boolean
}

type MentionUser = {
  user_id: string
  username: string
  avatar_url: string | null
}

type Post = {
  id: number
  user_id: string
  username: string
  avatar_url: string | null
  content: string
  image_url: string | null
  image_urls: string[]
  created_at: string
  likes: number
  dislikes: number
  likedByMe: boolean
  dislikedByMe: boolean
  mentionedUsers: MentionUser[]
  iAmMentioned: boolean
  repostCount: number
  repostedByMe: boolean
  quotedByMe: boolean
  // Música anexada ao post (mesmo sistema usado nas stories)
  music_title?: string | null
  music_artist?: string | null
  music_preview_url?: string | null
  music_artwork_url?: string | null
  // Enquete (opcional — só posts criados com enquete têm este campo)
  poll?: Poll | null
  // Preenchido quando este "post" no feed é, na verdade, um repost de outra pessoa
  repostInfo?: {
    repostId: number
    reposterId: string
    reposterUsername: string
    reposterAvatarUrl: string | null
    quoteContent: string | null
    createdAt: string
    isMutual: boolean
  }
}

type MutualUser = {
  user_id: string
  username: string
  avatar_url: string | null
}

type PollOption = {
  id: number
  post_id: number
  text: string
  position: number
  voteCount: number
  votedByMe: boolean
}

type Poll = {
  options: PollOption[]
  totalVotes: number
  myVoteOptionId: number | null
}

// Resultado retornado pela iTunes Search API — mesmo formato usado no StoryCreator
type ItunesTrack = {
  trackId: number
  trackName: string
  artistName: string
  artworkUrl100: string
  previewUrl: string | null
  collectionName: string
}

// ---------- Modal de busca de música (iTunes Search API) ----------
// Mesmo componente/comportamento usado no StoryCreator: busca com debounce,
// preview tocável na lista, e seleção de uma faixa pra anexar ao post.
function MusicSearchModal({
  onSelect,
  onClose,
}: {
  onSelect: (track: ItunesTrack) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ItunesTrack[]>([])
  const [loading, setLoading] = useState(false)
  const [playingId, setPlayingId] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function togglePreview(track: ItunesTrack) {
    if (!track.previewUrl) return

    if (playingId === track.trackId) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }

    if (audioRef.current) {
      audioRef.current.pause()
    } else {
      audioRef.current = new Audio()
    }
    audioRef.current.src = track.previewUrl
    audioRef.current.play()
    setPlayingId(track.trackId)

    audioRef.current.onended = () => setPlayingId(null)
  }

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

  function handleSelect(track: ItunesTrack) {
    audioRef.current?.pause()
    onSelect(track)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 rounded-t-3xl p-4 flex flex-col gap-3 max-h-[80vh]">
        <div className="flex items-center justify-between">
          <span className="text-white font-semibold text-base">🎵 Adicionar música</span>
          <button onClick={() => { audioRef.current?.pause(); onClose() }} className="text-zinc-400 text-xl">✕</button>
        </div>

        <input
          autoFocus
          type="text"
          value={query}
          onChange={handleInput}
          placeholder="Buscar música ou artista…"
          className="w-full bg-zinc-800 text-white placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-500"
        />

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
              <img
                src={track.artworkUrl100}
                alt={track.collectionName}
                className="w-12 h-12 rounded-lg object-cover shrink-0"
              />

              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{track.trackName}</p>
                <p className="text-zinc-400 text-xs truncate">{track.artistName}</p>
              </div>

              {track.previewUrl && (
                <button
                  onClick={() => togglePreview(track)}
                  className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-white text-sm"
                >
                  {playingId === track.trackId ? '⏸' : '▶'}
                </button>
              )}

              <button
                onClick={() => handleSelect(track)}
                className="shrink-0 px-3 py-1.5 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-white text-xs font-semibold"
              >
                Usar
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------- Controlador singleton de áudio do feed ----------
// Garante que apenas um chip toca por vez. Persiste a preferência de mute
// entre posts: se o usuário mutou, o próximo post já inicia mutado (e vice-versa).
const feedAudioController = (() => {
  let activeAudio: HTMLAudioElement | null = null
  let activeSetPlaying: ((v: boolean) => void) | null = null
  let globalMuted = true // mudo por padrão — browser permite autoplay mudo; usuário destrava o som

  return {
    isMuted: () => globalMuted,
    setMuted: (v: boolean) => { globalMuted = v },
    activate(audio: HTMLAudioElement, setPlaying: (v: boolean) => void) {
      if (activeAudio && activeAudio !== audio) {
        activeAudio.pause()
        activeSetPlaying?.(false)
      }
      activeAudio = audio
      activeSetPlaying = setPlaying
    },
    deactivate(audio: HTMLAudioElement) {
      if (activeAudio === audio) {
        activeAudio = null
        activeSetPlaying = null
      }
    },
  }
})()

// ---------- Chip de música com autoplay por visibilidade ----------
// • Toca automaticamente quando ≥60% do chip entra na viewport.
// • Som ligado por padrão — o botão é mute/unmute, não play/pause.
// • Só um chip toca por vez (feedAudioController pausa o anterior).
// • Preferência de mute persiste entre posts (igual ao Instagram Reels).
function PostMusicChip({
  title,
  artist,
  artworkUrl,
  previewUrl,
}: {
  title: string
  artist: string | null
  artworkUrl: string | null
  previewUrl: string | null
}) {
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(feedAudioController.isMuted())
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const chipRef = useRef<HTMLDivElement | null>(null)

  function getAudio(): HTMLAudioElement {
    if (!audioRef.current) {
      audioRef.current = new Audio(previewUrl!)
      audioRef.current.muted = feedAudioController.isMuted()
      audioRef.current.onended = () => {
        setPlaying(false)
        feedAudioController.deactivate(audioRef.current!)
      }
    }
    return audioRef.current
  }

  function startPlaying() {
    if (!previewUrl) return
    const audio = getAudio()
    audio.muted = feedAudioController.isMuted()
    setMuted(audio.muted)
    feedAudioController.activate(audio, setPlaying)
    // Autoplay mudo é permitido por todos os browsers modernos.
    // Se mesmo assim falhar (ex: política corporativa), tenta de novo mutado.
    audio.play().catch(() => {
      audio.muted = true
      feedAudioController.setMuted(true)
      setMuted(true)
      audio.play().catch(() => {})
    })
    setPlaying(true)
  }

  function stopPlaying() {
    audioRef.current?.pause()
    setPlaying(false)
    if (audioRef.current) feedAudioController.deactivate(audioRef.current)
  }

  useEffect(() => {
    if (!previewUrl || !chipRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => { entry.isIntersecting ? startPlaying() : stopPlaying() },
      { threshold: 0.6 }
    )
    observer.observe(chipRef.current)
    return () => { observer.disconnect(); stopPlaying() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl])

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        feedAudioController.deactivate(audioRef.current)
      }
    }
  }, [])

  function toggleMute(e: React.MouseEvent) {
    e.stopPropagation()
    if (!audioRef.current) {
      // Áudio ainda não criado (autoplay bloqueado) — cria e toca ao desmutar
      startPlaying()
      return
    }
    const newMuted = !audioRef.current.muted
    audioRef.current.muted = newMuted
    feedAudioController.setMuted(newMuted)
    setMuted(newMuted)
    if (!playing) startPlaying()
  }

  return (
    <div
      ref={chipRef}
      className="mx-4 mb-3 mt-3 flex items-center gap-2.5 bg-white/5 hover:bg-white/[0.07] border border-white/10 rounded-full pl-1.5 pr-3 py-1.5 transition-colors"
    >
      {/* Disco girando */}
      <div className="relative w-8 h-8 shrink-0">
        {artworkUrl ? (
          <img
            src={artworkUrl}
            alt={title}
            className="w-8 h-8 rounded-full object-cover border border-white/15"
            style={{ animation: playing ? 'musicDiscSpin 3s linear infinite' : 'none' }}
          />
        ) : (
          <div
            className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 border border-white/15 flex items-center justify-center text-sm"
            style={{ animation: playing ? 'musicDiscSpin 3s linear infinite' : 'none' }}
          >
            🎵
          </div>
        )}
        <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/70 border border-white/30" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-zinc-100 truncate leading-tight">{title}</p>
        {artist && <p className="text-[11px] text-zinc-500 truncate leading-tight">{artist}</p>}
      </div>

      {/* Equalizer — cinza quando mutado, verde quando com som */}
      {playing && (
        <div className="flex items-end gap-[2px] h-3 shrink-0">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className={`w-[2.5px] rounded-full ${muted ? 'bg-zinc-500' : 'bg-emerald-400'}`}
              style={{ height: '100%', animation: `musicEqBar 0.9s ease-in-out ${i * 0.15}s infinite` }}
            />
          ))}
        </div>
      )}

      {/* Mute / unmute */}
      {previewUrl && (
        <button
          onClick={toggleMute}
          aria-label={muted ? 'Ativar som' : 'Mutar'}
          className="shrink-0 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        >
          {muted ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>
          )}
        </button>
      )}

      <style>{`
        @keyframes musicDiscSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes musicEqBar {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}

function Avatar({
  url,
  username,
  size = 'md',
  href,
}: {
  url: string | null
  username: string | null | undefined
  size?: 'sm' | 'md' | 'lg'
  href?: string
}) {
  const dim = size === 'sm' ? 'w-7 h-7 text-[10px]' : size === 'lg' ? 'w-12 h-12 text-sm' : 'w-9 h-9 text-xs'
  const initials = (username || '?').slice(0, 2).toUpperCase()

  const inner = url ? (
    <img src={url} alt={username || ''} className={`${dim} rounded-full object-cover border border-zinc-700 shrink-0`} />
  ) : (
    <div className={`${dim} rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-bold shrink-0`}>
      {initials}
    </div>
  )

  if (href) return <NavLink href={href} className="nav-link inline-flex hover:opacity-80">{inner}</NavLink>
  return inner
}

const REPOST_BURST_EMOJIS = ['💚', '✨', '🔁', '💫', '🌿']

function RepostBurst() {
  const particles = REPOST_BURST_EMOJIS.map((emoji, i) => {
    const angle = (360 / REPOST_BURST_EMOJIS.length) * i + (i % 2 === 0 ? -8 : 8)
    const distance = 26 + (i % 3) * 6
    const rad = (angle * Math.PI) / 180
    const tx = Math.cos(rad) * distance
    const ty = Math.sin(rad) * distance
    const rot = (i % 2 === 0 ? 1 : -1) * (40 + i * 10)
    return (
      <span
        key={i}
        className="repost-burst-particle"
        style={{
          '--tx': `${tx}px`,
          '--ty': `${ty}px`,
          '--rot': `${rot}deg`,
          animationDelay: `${i * 25}ms`,
        } as React.CSSProperties}
      >
        {emoji}
      </span>
    )
  })

  return (
    <span className="repost-burst" aria-hidden="true">
      <span className="repost-burst-ring" />
      {particles}
    </span>
  )
}

function NavLink({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: React.ReactNode
}) {
  const [navigating, setNavigating] = useState(false)

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    setNavigating(true)
    setTimeout(() => { window.location.href = href }, 180)
  }

  return (
    <>
      <a href={href} onClick={handleClick} className={className}>
        {children}
      </a>
      {navigating && (
        <div className="page-fade-overlay">
          <svg className="animate-spin w-7 h-7 text-emerald-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
        </div>
      )}
    </>
  )
}

// Extrai usernames mencionados no formato @username (letras, números, _ e .)
function extractMentions(text: string): string[] {
  const matches = text.match(/@([a-zA-Z0-9_.]+)/g) || []
  return matches.map(m => m.slice(1))
}

// Renderiza o texto do post transformando @username em links destacados
function renderWithMentions(text: string) {
  const parts = text.split(/(@[a-zA-Z0-9_.]+)/g)
  return parts.map((part, i) => {
    if (part.startsWith('@') && part.length > 1) {
      const username = part.slice(1)
      return (
        <NavLink
          key={i}
          href={`/user/${encodeURIComponent(username)}`}
          className="nav-link text-emerald-400 font-medium hover:text-emerald-300"
        >
          {part}
        </NavLink>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function MentionDropdown({
  suggestions,
  activeIndex,
  onSelect,
}: {
  suggestions: MentionUser[]
  activeIndex: number
  onSelect: (person: MentionUser) => void
}) {
  if (suggestions.length === 0) return null

  return (
    <div className="absolute z-30 left-0 top-full mt-1 w-56 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl overflow-hidden">
      {suggestions.map((person, i) => (
        <button
          key={person.user_id}
          onMouseDown={(e) => { e.preventDefault(); onSelect(person) }}
          className={`w-full flex items-center gap-2 px-3 py-2 transition-colors text-left ${i === activeIndex ? 'bg-zinc-700' : 'hover:bg-zinc-700'}`}
        >
          <Avatar url={person.avatar_url} username={person.username} size="sm" />
          <span className="text-sm text-zinc-100">@{person.username}</span>
        </button>
      ))}
    </div>
  )
}

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null)
  const [currentUsername, setCurrentUsername] = useState('')
  const [cardNavigating, setCardNavigating] = useState(false)
  const [editingPostId, setEditingPostId] = useState<number | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [comments, setComments] = useState<Record<number, Comment[]>>({})
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({})
  const [openComments, setOpenComments] = useState<Record<number, boolean>>({})
  const [submittingComment, setSubmittingComment] = useState<Record<number, boolean>>({})
  // Controla a animação de saída do modal de comentários (bottom-sheet estilo Instagram).
  const [commentsModalClosing, setCommentsModalClosing] = useState(false)
  // Id do comentário recém-criado, para tocar a animação de entrada só nele.
  const [newCommentId, setNewCommentId] = useState<number | null>(null)
  // Deslocamento de parallax da imagem de fundo do modal de comentários (px, baseado no scroll da lista).
  const [commentsParallax, setCommentsParallax] = useState(0)
  // Deslocamento de arrasto (swipe down) do modal de comentários, em px. 0 = posição normal.
  const [commentsDragY, setCommentsDragY] = useState(0)
  const commentsDragStartY = useRef<number | null>(null)
  const commentsDragActive = useRef(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  // Música anexada ao post em criação (mesmo sistema de busca usado nas stories)
  const [musicModalOpen, setMusicModalOpen] = useState(false)
  const [composerTrack, setComposerTrack] = useState<ItunesTrack | null>(null)

  // Enquete em criação
  const [composerPollOptions, setComposerPollOptions] = useState<string[]>(['', ''])
  const [showPollComposer, setShowPollComposer] = useState(false)

  // Votos por post: postId -> Poll (carregado junto com os posts)
  const [polls, setPolls] = useState<Record<number, Poll>>({})
  const [initialLoading, setInitialLoading] = useState(true)
  const [likingPostId, setLikingPostId] = useState<number | null>(null)
  const [dislikingPostId, setDislikingPostId] = useState<number | null>(null)

  // Repostar / citar
  const [reposting, setReposting] = useState<Record<number, boolean>>({})
  const [burstingPostId, setBurstingPostId] = useState<number | null>(null)
  const [repostMenuClosing, setRepostMenuClosing] = useState(false)
  const [quoteModalClosing, setQuoteModalClosing] = useState(false)
  // Tick que avança a cada 30s só para forçar o feed a recalcular os tempos relativos
  // ("agora" -> "1m" -> "2m" ...) mesmo sem nenhuma outra interação na tela.
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [openRepostMenu, setOpenRepostMenu] = useState<number | null>(null)
  const [quotingPostId, setQuotingPostId] = useState<number | null>(null)
  const [quoteContent, setQuoteContent] = useState('')
  const [submittingQuote, setSubmittingQuote] = useState(false)

  // Compartilhar no chat
  const [shareModalPostId, setShareModalPostId] = useState<number | null>(null)
  const [mutuals, setMutuals] = useState<MutualUser[]>([])
  const [loadingMutuals, setLoadingMutuals] = useState(false)
  const [sharingToUserId, setSharingToUserId] = useState<string | null>(null)
  const [sharedToUserId, setSharedToUserId] = useState<string | null>(null)

  // Bolhas flutuantes de repost/citação que o usuário arrastou e escondeu (volta no reload)
  const [dismissedBubbles, setDismissedBubbles] = useState<Set<number>>(new Set())
  const dragState = useRef<{ repostId: number; startX: number; startY: number } | null>(null)

  function handleBubblePointerDown(e: React.PointerEvent, repostId: number) {
    dragState.current = { repostId, startX: e.clientX, startY: e.clientY }
  }

  function handleBubblePointerMove(e: React.PointerEvent) {
    if (!dragState.current) return
    const dx = e.clientX - dragState.current.startX
    const dy = e.clientY - dragState.current.startY
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance > 18) {
      const { repostId } = dragState.current
      dragState.current = null
      setDismissedBubbles(prev => new Set(prev).add(repostId))
    }
  }

  function handleBubblePointerUp() {
    dragState.current = null
  }

  // Menções (@username) — autocomplete
  const [following, setFollowing] = useState<MentionUser[]>([])
  const [mentionQuery, setMentionQuery] = useState<string | null>(null) // null = fechado
  const [mentionTarget, setMentionTarget] = useState<'composer' | 'editing'>('composer')
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)

  async function loadPosts() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setCurrentUserId(user.id)

    // Fetch current user profile for composer avatar
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', user.id)
      .single()

    if (myProfile) {
      setCurrentUserAvatar(myProfile.avatar_url)
      setCurrentUsername(myProfile.username)
    }

    const { data: postsData, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) { console.error(error); return }

    // Fetch all unique user profiles for avatars in one query
    const uniqueUserIds = [...new Set((postsData || []).map(p => p.user_id))]
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, avatar_url')
      .in('id', uniqueUserIds)

    const avatarMap: Record<string, string | null> = {}
    for (const p of profilesData || []) avatarMap[p.id] = p.avatar_url

    // Extrai todos os @usernames mencionados em todos os posts, de uma vez
    const allMentionedUsernames = new Set<string>()
    for (const post of postsData || []) {
      for (const uname of extractMentions(post.content || '')) {
        allMentionedUsernames.add(uname)
      }
    }

    const mentionProfileMap: Record<string, MentionUser> = {}
    if (allMentionedUsernames.size > 0) {
      const { data: mentionedProfiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('username', Array.from(allMentionedUsernames))

      for (const p of mentionedProfiles || []) {
        mentionProfileMap[p.username.toLowerCase()] = {
          user_id: p.id,
          username: p.username,
          avatar_url: p.avatar_url,
        }
      }
    }

    const postsWithLikes = await Promise.all(
      (postsData || []).map(async (post) => {
        const { count: likeCount } = await supabase
          .from('likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id)

        const { data: existingLike } = await supabase
          .from('likes')
          .select('id')
          .eq('post_id', post.id)
          .eq('user_id', user.id)
          .maybeSingle()

        const { count: dislikeCount } = await supabase
          .from('dislikes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id)

        const { data: existingDislike } = await supabase
          .from('dislikes')
          .select('id')
          .eq('post_id', post.id)
          .eq('user_id', user.id)
          .maybeSingle()

        const mentionedUsers: MentionUser[] = extractMentions(post.content || '')
          .map(uname => mentionProfileMap[uname.toLowerCase()])
          .filter((m): m is MentionUser => !!m)

        const imageUrls: string[] = post.image_urls?.length
          ? post.image_urls
          : post.image_url
          ? [post.image_url]
          : []

        return {
          ...post,
          avatar_url: avatarMap[post.user_id] ?? null,
          image_url: post.image_url ?? null,
          image_urls: imageUrls,
          likes: likeCount || 0,
          dislikes: dislikeCount || 0,
          likedByMe: !!existingLike,
          dislikedByMe: !!existingDislike,
          mentionedUsers,
          iAmMentioned: mentionedUsers.some(m => m.user_id === user.id),
          repostCount: 0,
          repostedByMe: false,
          quotedByMe: false,
        }
      })
    )

    const basePostMap: Record<number, Post> = {}
    for (const p of postsWithLikes) basePostMap[p.id] = p

    // Busca todos os reposts (republicações simples e citações)
    const { data: repostsData } = await supabase
      .from('reposts')
      .select('*')
      .order('created_at', { ascending: false })

    const reposterIds = [...new Set((repostsData || []).map(r => r.user_id))]
    const { data: reposterProfiles } = reposterIds.length
      ? await supabase.from('profiles').select('id, username, avatar_url').in('id', reposterIds)
      : { data: [] as any[] }

    const reposterMap: Record<string, { username: string; avatar_url: string | null }> = {}
    for (const p of reposterProfiles || []) reposterMap[p.id] = { username: p.username, avatar_url: p.avatar_url }

    // Calcula mutualidade (eu sigo o reposter E o reposter me segue) para decidir
    // se mostro a bolha flutuante de citação/repost ou só o contador.
    const mutualSet = new Set<string>()
    if (reposterIds.length > 0) {
      const [{ data: iFollowRows }, { data: followMeRows }] = await Promise.all([
        supabase.from('follows').select('following_id').eq('follower_id', user.id).in('following_id', reposterIds),
        supabase.from('follows').select('follower_id').eq('following_id', user.id).in('follower_id', reposterIds),
      ])
      const iFollowSet = new Set((iFollowRows || []).map((r: any) => r.following_id))
      const followMeSet = new Set((followMeRows || []).map((r: any) => r.follower_id))
      for (const id of reposterIds) {
        if (iFollowSet.has(id) && followMeSet.has(id)) mutualSet.add(id)
      }
    }

    // Conta reposts por post + marca se eu já repostei (repost simples, sem citação)
    for (const r of repostsData || []) {
      const base = basePostMap[r.post_id]
      if (!base) continue
      base.repostCount += 1
      if (r.user_id === user.id && !r.quote_content) base.repostedByMe = true
      if (r.user_id === user.id && r.quote_content) base.quotedByMe = true
    }

    // Gera entradas de feed extras: cada repost simples (sem citação) cria uma entrada
    // mostrando o post original com o cabeçalho "fulano republicou".
    // Citações entram como entradas próprias, carregando o post original embutido.
    const feedExtras: Post[] = []
    for (const r of repostsData || []) {
      const base = basePostMap[r.post_id]
      if (!base) continue
      const reposter = reposterMap[r.user_id]
      if (!reposter) continue

      feedExtras.push({
        ...base,
        repostInfo: {
          repostId: r.id,
          reposterId: r.user_id,
          reposterUsername: reposter.username,
          reposterAvatarUrl: reposter.avatar_url,
          quoteContent: r.quote_content ?? null,
          createdAt: r.created_at,
          isMutual: r.user_id === user.id || mutualSet.has(r.user_id),
        },
      })
    }

    // IDs de posts que já têm pelo menos uma entrada de repost no feed.
    // Esses posts não devem aparecer também como entrada "normal" (original),
    // senão o mesmo post some duplicado: 1x como post original, 1x como repost.
    const repostedPostIds = new Set(feedExtras.map(r => r.id))

    // Posts originais (sem repostInfo), exceto os que já entram via repost, + reposts
    const postsWithoutDuplicates = postsWithLikes.filter(p => !repostedPostIds.has(p.id))

    // Ordenados por data relevante (created_at do post, ou do repost se for entrada de repost).
    // Usamos parseServerDate (não new Date direto) porque o Postgres às vezes devolve a data
    // sem timezone explícito, o que o JS interpretaria como horário local em vez de UTC —
    // causando datas "erradas" e, por consequência, ordenação inconsistente.
    // Em caso de empate exato de timestamp, usamos um tiebreaker determinístico
    // (id do repost, se houver, senão id do post) para a ordem não depender de
    // em qual bloco do array (posts normais vs. feedExtras) o item caiu antes do sort —
    // isso é o que fazia o post "saltar" de posição ao republicar.
    const merged = [...postsWithoutDuplicates, ...feedExtras].sort((a, b) => {
      const dateA = a.repostInfo ? a.repostInfo.createdAt : a.created_at
      const dateB = b.repostInfo ? b.repostInfo.createdAt : b.created_at
      const timeA = parseServerDate(dateA)
      const timeB = parseServerDate(dateB)
      if (timeA !== timeB) return timeB - timeA

      const tieA = a.repostInfo ? a.repostInfo.repostId : a.id
      const tieB = b.repostInfo ? b.repostInfo.repostId : b.id
      return tieB - tieA
    })

    setPosts(merged)
    setInitialLoading(false)

    // Carrega enquetes para todos os posts que têm opções
    const allPostIds = merged.map(p => p.id)
    if (allPostIds.length > 0) {
      const { data: optionsData } = await supabase
        .from('poll_options')
        .select('*')
        .in('post_id', allPostIds)
        .order('position', { ascending: true })

      if (optionsData && optionsData.length > 0) {
        const postIdsWithPolls = [...new Set(optionsData.map((o: any) => o.post_id))]

        const { data: votesData } = await supabase
          .from('poll_votes')
          .select('poll_option_id, user_id, post_id')
          .in('post_id', postIdsWithPolls)

        const votesByOption: Record<number, number> = {}
        const myVoteByPost: Record<number, number> = {}
        for (const v of votesData || []) {
          votesByOption[v.poll_option_id] = (votesByOption[v.poll_option_id] || 0) + 1
          if (v.user_id === user.id) myVoteByPost[v.post_id] = v.poll_option_id
        }

        const pollsByPost: Record<number, Poll> = {}
        for (const postId of postIdsWithPolls) {
          const opts = (optionsData as any[]).filter((o: any) => o.post_id === postId)
          const options: PollOption[] = opts.map((o: any) => ({
            id: o.id,
            post_id: o.post_id,
            text: o.text,
            position: o.position,
            voteCount: votesByOption[o.id] || 0,
            votedByMe: myVoteByPost[postId] === o.id,
          }))
          const totalVotes = options.reduce((s, o) => s + o.voteCount, 0)
          pollsByPost[postId] = {
            options,
            totalVotes,
            myVoteOptionId: myVoteByPost[postId] ?? null,
          }
        }
        setPolls(pollsByPost)
      }
    }
  }

  async function loadComments(postId: number) {
    const { data: { user } } = await supabase.auth.getUser()

    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    const commentList = data || []

    // Fetch avatars for comment authors
    const uniqueIds = [...new Set(commentList.map(c => c.user_id))]
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, avatar_url')
      .in('id', uniqueIds)

    const avatarMap: Record<string, string | null> = {}
    for (const p of profilesData || []) avatarMap[p.id] = p.avatar_url

    // Fetch curtidas de todos os comentários deste post de uma vez
    const commentIds = commentList.map(c => c.id)
    const { data: likesData } = commentIds.length
      ? await supabase.from('comment_likes').select('comment_id, user_id').in('comment_id', commentIds)
      : { data: [] as any[] }

    const likeCountMap: Record<number, number> = {}
    const likedByMeSet = new Set<number>()
    for (const l of likesData || []) {
      likeCountMap[l.comment_id] = (likeCountMap[l.comment_id] || 0) + 1
      if (user && l.user_id === user.id) likedByMeSet.add(l.comment_id)
    }

    const commentsWithAvatars = commentList.map(c => ({
      ...c,
      avatar_url: avatarMap[c.user_id] ?? null,
      likeCount: likeCountMap[c.id] || 0,
      likedByMe: likedByMeSet.has(c.id),
    }))

    setComments(prev => ({ ...prev, [postId]: commentsWithAvatars }))
  }

  async function toggleCommentLike(commentId: number, postId: number) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('Faça login.'); return }

    const current = comments[postId] || []
    const target = current.find(c => c.id === commentId)
    const wasLiked = !!target?.likedByMe

    // Atualização otimista
    setComments(prev => ({
      ...prev,
      [postId]: (prev[postId] || []).map(c =>
        c.id === commentId
          ? { ...c, likedByMe: !wasLiked, likeCount: wasLiked ? c.likeCount - 1 : c.likeCount + 1 }
          : c
      ),
    }))

    if (wasLiked) {
      const { data: existing } = await supabase
        .from('comment_likes')
        .select('id')
        .eq('comment_id', commentId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (existing) await supabase.from('comment_likes').delete().eq('id', existing.id)
    } else {
      await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: user.id })
    }
  }

  function openCommentsModal(postId: number) {
    setOpenComments({ [postId]: true })
    setCommentsModalClosing(false)
    setCommentsDragY(0)
    setCommentsParallax(0)
    if (!comments[postId]) loadComments(postId)
  }

  function closeCommentsModal() {
    setCommentsModalClosing(true)
    setTimeout(() => {
      setOpenComments({})
      setCommentsModalClosing(false)
      setCommentsDragY(0)
    }, 200)
  }

  // Arrastar pra fechar: só inicia o gesto no handle/header (não na lista, pra não
  // conflitar com o scroll dos comentários). Acompanha o dedo proporcionalmente e,
  // ao soltar, fecha se passou de um terço da altura do sheet ou foi um arrasto rápido.
  function handleCommentsDragStart(e: React.PointerEvent) {
    commentsDragStartY.current = e.clientY
    commentsDragActive.current = true
  }

  function handleCommentsDragMove(e: React.PointerEvent) {
    if (!commentsDragActive.current || commentsDragStartY.current === null) return
    const delta = e.clientY - commentsDragStartY.current
    setCommentsDragY(Math.max(0, delta))
  }

  function handleCommentsDragEnd() {
    if (!commentsDragActive.current) return
    commentsDragActive.current = false
    commentsDragStartY.current = null

    const threshold = 110
    if (commentsDragY > threshold) {
      closeCommentsModal()
    } else {
      setCommentsDragY(0)
    }
  }

  // Parallax leve: a imagem de fundo se move mais lentamente que o scroll da lista,
  // dando uma sensação de profundidade ao rolar os comentários.
  function handleCommentsScroll(e: React.UIEvent<HTMLDivElement>) {
    setCommentsParallax(e.currentTarget.scrollTop * 0.15)
  }

  function toggleComments(postId: number) {
    const isOpen = !!openComments[postId]
    if (isOpen) {
      closeCommentsModal()
    } else {
      openCommentsModal(postId)
    }
  }

  async function createComment(postId: number) {
    const text = commentInputs[postId]
    if (!text?.trim()) return

    setSubmittingComment(prev => ({ ...prev, [postId]: true }))

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()

    const { data: inserted } = await supabase.from('comments').insert({
      post_id: postId,
      user_id: user.id,
      username: profile?.username || 'Usuário',
      content: text,
    }).select('id').single()

    setCommentInputs(prev => ({ ...prev, [postId]: '' }))
    await loadComments(postId)
    setSubmittingComment(prev => ({ ...prev, [postId]: false }))

    if (inserted?.id) {
      setNewCommentId(inserted.id)
      setTimeout(() => setNewCommentId(prev => (prev === inserted.id ? null : prev)), 500)
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const newFiles = [...imageFiles, ...files].slice(0, 4)
    setImageFiles(newFiles)
    setImagePreviews(newFiles.map(f => URL.createObjectURL(f)))
    setImageFile(newFiles[0] ?? null)
    setImagePreview(newFiles[0] ? URL.createObjectURL(newFiles[0]) : null)
    e.target.value = ''
  }

  function removeImage(index: number) {
    const newFiles = imageFiles.filter((_, i) => i !== index)
    setImageFiles(newFiles)
    setImagePreviews(newFiles.map(f => URL.createObjectURL(f)))
    setImageFile(newFiles[0] ?? null)
    setImagePreview(newFiles[0] ? URL.createObjectURL(newFiles[0]) : null)
  }

  // Busca QUALQUER usuário da plataforma pelo prefixo do username (sem exigir follow mútuo ou unilateral)
  async function searchMentionCandidates(prefix: string) {
    if (!prefix) {
      setFollowing([])
      return
    }
    const { data: rows } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .ilike('username', `${prefix}%`)
      .limit(6)

    const list: MentionUser[] = (rows || []).map((r: any) => ({
      user_id: r.id,
      username: r.username,
      avatar_url: r.avatar_url,
    }))

    setFollowing(list)
  }

  // Detecta se o cursor está digitando uma @menção e atualiza o estado de autocomplete
  function detectMention(text: string, cursorPos: number, target: 'composer' | 'editing') {
    const upToCursor = text.slice(0, cursorPos)
    const match = upToCursor.match(/@([a-zA-Z0-9_.]*)$/)
    if (match) {
      setMentionTarget(target)
      setMentionQuery(match[1])
      setMentionActiveIndex(0)
      searchMentionCandidates(match[1])
    } else {
      setMentionQuery(null)
    }
  }

  function handleComposerChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value
    setContent(text)
    detectMention(text, e.target.selectionStart ?? text.length, 'composer')
  }

  function handleEditingChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value
    setEditingContent(text)
    detectMention(text, e.target.selectionStart ?? text.length, 'editing')
  }

  function getMentionSuggestions() {
    if (mentionQuery === null) return []
    return following
  }

  function handleMentionKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery === null) return
    const suggestions = getMentionSuggestions()
    if (suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setMentionActiveIndex(i => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setMentionActiveIndex(i => (i - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      applyMention(suggestions[mentionActiveIndex] ?? suggestions[0])
    } else if (e.key === 'Escape') {
      setMentionQuery(null)
    }
  }

  function applyMention(person: MentionUser) {
    const isComposer = mentionTarget === 'composer'
    const text = isComposer ? content : editingContent
    const ref = isComposer ? textareaRef.current : editTextareaRef.current
    const cursorPos = ref?.selectionStart ?? text.length

    const upToCursor = text.slice(0, cursorPos)
    const afterCursor = text.slice(cursorPos)
    const replaced = upToCursor.replace(/@([a-zA-Z0-9_.]*)$/, `@${person.username} `)
    const newText = replaced + afterCursor

    if (isComposer) {
      setContent(newText)
    } else {
      setEditingContent(newText)
    }
    setMentionQuery(null)

    // Recoloca o foco e cursor após a menção inserida
    requestAnimationFrame(() => {
      if (ref) {
        const newCursorPos = replaced.length
        ref.focus()
        ref.setSelectionRange(newCursorPos, newCursorPos)
      }
    })
  }

  function closeMentionSuggestions() {
    setMentionQuery(null)
  }

  async function createPost() {
    if (!content.trim() && imageFiles.length === 0 && !composerTrack) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('Faça login novamente.'); setLoading(false); return }

    const uploadedUrls: string[] = []

    for (const file of imageFiles) {
      const ext = file.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(fileName, file, { upsert: true })

      if (uploadError) {
        alert('Erro ao enviar imagem: ' + uploadError.message)
        setLoading(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(fileName)

      uploadedUrls.push(publicUrl)
    }

    const { error } = await supabase.from('posts').insert({
      user_id: user.id,
      username: currentUsername || 'Usuário',
      content,
      image_url: uploadedUrls[0] ?? null,
      image_urls: uploadedUrls.length > 0 ? uploadedUrls : null,
      ...(composerTrack ? {
        music_title: composerTrack.trackName,
        music_artist: composerTrack.artistName,
        music_preview_url: composerTrack.previewUrl,
        music_artwork_url: composerTrack.artworkUrl100,
      } : {}),
    })

    if (error) { alert(error.message); setLoading(false); return }

    // Se havia enquete, insere as opções vinculadas ao post recém-criado
    if (showPollComposer) {
      const validOptions = composerPollOptions.map(t => t.trim()).filter(Boolean)
      if (validOptions.length >= 2) {
        const { data: newPost } = await supabase
          .from('posts')
          .select('id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (newPost) {
          await supabase.from('poll_options').insert(
            validOptions.map((text, i) => ({ post_id: newPost.id, text, position: i }))
          )
        }
      }
    }

    setContent('')
    setImageFile(null)
    setImagePreview(null)
    setImageFiles([])
    setImagePreviews([])
    setComposerTrack(null)
    setShowPollComposer(false)
    setComposerPollOptions(['', ''])
    await loadPosts()
    setLoading(false)
  }

  function togglePollComposer() {
    setShowPollComposer(prev => {
      if (prev) { setComposerPollOptions(['', '']) }
      return !prev
    })
  }

  async function votePoll(postId: number, optionId: number) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('Faça login.'); return }

    const poll = polls[postId]
    if (!poll) return

    const wasVoted = poll.myVoteOptionId === optionId
    const prevVotedId = poll.myVoteOptionId

    // Atualização otimista
    setPolls(prev => {
      const p = prev[postId]
      if (!p) return prev
      const newOptions = p.options.map(o => {
        if (o.id === optionId) return { ...o, voteCount: wasVoted ? o.voteCount - 1 : o.voteCount + 1, votedByMe: !wasVoted }
        if (o.id === prevVotedId) return { ...o, voteCount: o.voteCount - 1, votedByMe: false }
        return o
      })
      return {
        ...prev,
        [postId]: {
          options: newOptions,
          totalVotes: newOptions.reduce((s, o) => s + o.voteCount, 0),
          myVoteOptionId: wasVoted ? null : optionId,
        },
      }
    })

    // Remove voto anterior (sempre, inclusive se for o mesmo — toggle out)
    if (prevVotedId !== null) {
      await supabase.from('poll_votes').delete()
        .eq('post_id', postId).eq('user_id', user.id)
    }
    if (!wasVoted) {
      await supabase.from('poll_votes').insert({ post_id: postId, poll_option_id: optionId, user_id: user.id })
    }
  }

  // Abre a página dedicada do post (/post/[id]).
  // Regra: se o post TEM imagem, só a imagem em si abre o post (clicar no texto/área
  // vazia não faz nada). Se o post é só texto, qualquer área não-interativa do card abre.
  // Em qualquer caso, cliques em botão/link/input (curtir, comentar, @menção, editar...)
  // nunca disparam a navegação.
  function goToPost(e: React.MouseEvent, post: Post) {
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, textarea, [data-no-card-nav]')) return

    const hasImage = (post.image_urls && post.image_urls.length > 0) || !!post.image_url
    if (hasImage && !target.closest('[data-post-image]')) return

    setCardNavigating(true)
    setTimeout(() => { window.location.href = `/post/${post.id}` }, 180)
  }

  async function toggleLike(postId: number) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('Faça login.'); return }

    setLikingPostId(postId)
    setTimeout(() => setLikingPostId(prev => (prev === postId ? null : prev)), 400)

    const post = posts.find(p => p.id === postId)
    if (!post) return

    if (post.dislikedByMe) {
      const { data: existingDislike } = await supabase
        .from('dislikes').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle()
      if (existingDislike) await supabase.from('dislikes').delete().eq('id', existingDislike.id)
    }

    setPosts(prev => prev.map(p =>
      p.id === postId
        ? {
            ...p,
            likedByMe: !p.likedByMe,
            likes: p.likedByMe ? p.likes - 1 : p.likes + 1,
            dislikedByMe: false,
            dislikes: p.dislikedByMe ? p.dislikes - 1 : p.dislikes,
          }
        : p
    ))

    const { data: existingLike } = await supabase
      .from('likes').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle()

    if (existingLike) {
      await supabase.from('likes').delete().eq('id', existingLike.id)
    } else {
      await supabase.from('likes').insert({ post_id: postId, user_id: user.id })
    }
  }

  async function toggleDislike(postId: number) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('Faça login.'); return }

    setDislikingPostId(postId)
    setTimeout(() => setDislikingPostId(prev => (prev === postId ? null : prev)), 400)

    const post = posts.find(p => p.id === postId)
    if (!post) return

    if (post.likedByMe) {
      const { data: existingLike } = await supabase
        .from('likes').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle()
      if (existingLike) await supabase.from('likes').delete().eq('id', existingLike.id)
    }

    setPosts(prev => prev.map(p =>
      p.id === postId
        ? {
            ...p,
            dislikedByMe: !p.dislikedByMe,
            dislikes: p.dislikedByMe ? p.dislikes - 1 : p.dislikes + 1,
            likedByMe: false,
            likes: p.likedByMe ? p.likes - 1 : p.likes,
          }
        : p
    ))

    const { data: existingDislike } = await supabase
      .from('dislikes').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle()

    if (existingDislike) {
      await supabase.from('dislikes').delete().eq('id', existingDislike.id)
    } else {
      await supabase.from('dislikes').insert({ post_id: postId, user_id: user.id })
    }
  }

  async function deletePost(postId: number) {
    if (!confirm('Deseja apagar este post?')) return
    const { error } = await supabase.from('posts').delete().eq('id', postId)
    if (error) { alert(error.message); return }
    await loadPosts()
  }

  // ---------- Repostar / Citar ----------

  function closeRepostMenu() {
    setOpenRepostMenu(null)
    setRepostMenuClosing(false)
  }

  function triggerRepostBurst(postId: number) {
    setBurstingPostId(postId)
    setTimeout(() => {
      setBurstingPostId(prev => (prev === postId ? null : prev))
    }, 900)
  }

  async function toggleRepost(postId: number) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('Faça login.'); return }

    const post = posts.find(p => p.id === postId && !p.repostInfo) || posts.find(p => p.id === postId)
    const alreadyReposted = post?.repostedByMe

    if (alreadyReposted) {
      // Desfazer não tem festa — fecha o menu direto.
      closeRepostMenu()
      setReposting(prev => ({ ...prev, [postId]: true }))

      const { data: existing } = await supabase
        .from('reposts')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .is('quote_content', null)
        .maybeSingle()
      if (existing) await supabase.from('reposts').delete().eq('id', existing.id)
    } else {
      // Republicando: anima a saída fofa do modal antes de fechar, e dispara
      // a explosão no botão do card por baixo.
      setRepostMenuClosing(true)
      triggerRepostBurst(postId)
      await new Promise(resolve => setTimeout(resolve, 220))
      closeRepostMenu()
      setReposting(prev => ({ ...prev, [postId]: true }))

      const { error } = await supabase.from('reposts').insert({
        post_id: postId,
        user_id: user.id,
        quote_content: null,
      })
      if (error) { alert(error.message); setReposting(prev => ({ ...prev, [postId]: false })); return }
    }

    await loadPosts()
    setReposting(prev => ({ ...prev, [postId]: false }))
  }

  function openQuote(postId: number) {
    closeRepostMenu()
    setQuotingPostId(postId)
    setQuoteContent('')
  }

  function cancelQuote() {
    setQuotingPostId(null)
    setQuoteContent('')
    setQuoteModalClosing(false)
  }

  async function submitQuote() {
    if (quotingPostId === null) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('Faça login.'); return }

    setSubmittingQuote(true)
    const { error } = await supabase.from('reposts').insert({
      post_id: quotingPostId,
      user_id: user.id,
      quote_content: quoteContent.trim() || null,
    })

    if (error) { alert(error.message); setSubmittingQuote(false); return }

    const quotedPostId = quotingPostId
    triggerRepostBurst(quotedPostId)
    setQuoteModalClosing(true)
    await new Promise(resolve => setTimeout(resolve, 220))
    setQuotingPostId(null)
    setQuoteContent('')
    setQuoteModalClosing(false)
    setSubmittingQuote(false)
    await loadPosts()
  }

  async function removeQuote(postId: number) {
    if (!confirm('Deseja retirar sua citação deste post?')) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('Faça login.'); return }

    closeRepostMenu()
    setReposting(prev => ({ ...prev, [postId]: true }))

    const { data: existing } = await supabase
      .from('reposts')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .not('quote_content', 'is', null)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase.from('reposts').delete().eq('id', existing.id)
      if (error) { alert(error.message); setReposting(prev => ({ ...prev, [postId]: false })); return }
    }

    await loadPosts()
    setReposting(prev => ({ ...prev, [postId]: false }))
  }

  // ---------- Compartilhar no chat ----------

  async function openShareModal(postId: number) {
    setShareModalPostId(postId)
    setSharedToUserId(null)
    setLoadingMutuals(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoadingMutuals(false); return }

    const [{ data: iFollow }, { data: theyFollowMe }] = await Promise.all([
      supabase.from('follows').select('following_id').eq('follower_id', user.id),
      supabase.from('follows').select('follower_id').eq('following_id', user.id),
    ])

    const iFollowSet = new Set((iFollow || []).map(r => r.following_id))
    const followMeSet = new Set((theyFollowMe || []).map(r => r.follower_id))
    const mutualIds = [...iFollowSet].filter(id => followMeSet.has(id))

    if (mutualIds.length === 0) { setMutuals([]); setLoadingMutuals(false); return }

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', mutualIds)

    setMutuals((profilesData || []).map(p => ({ user_id: p.id, username: p.username, avatar_url: p.avatar_url })))
    setLoadingMutuals(false)
  }

  function closeShareModal() {
    setShareModalPostId(null)
    setMutuals([])
    setSharedToUserId(null)
  }

  async function shareToUser(receiverId: string) {
    if (shareModalPostId === null) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('Faça login.'); return }

    setSharingToUserId(receiverId)

    const { error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: receiverId,
      content: 'Compartilhou um post',
      shared_post_id: shareModalPostId,
      read: false,
    })

    setSharingToUserId(null)

    if (error) { alert(error.message); return }
    setSharedToUserId(receiverId)
    setTimeout(() => { closeShareModal() }, 900)
  }

  function startEdit(post: Post) {
    setEditingPostId(post.id)
    setEditingContent(post.content)
  }

  function cancelEdit() {
    setEditingPostId(null)
    setEditingContent('')
    setMentionQuery(null)
  }

  async function saveEdit(postId: number) {
    if (!editingContent.trim()) return
    const { error } = await supabase
      .from('posts').update({ content: editingContent }).eq('id', postId)
    if (error) { alert(error.message); return }
    setEditingPostId(null)
    setEditingContent('')
    setMentionQuery(null)
    await loadPosts()
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  function formatDate(dateStr: string) {
    const createdMs = parseServerDate(dateStr)
    if (Number.isNaN(createdMs)) return ''

    const diff = nowTick - createdMs
    const m = Math.floor(diff / 60000)
    const h = Math.floor(diff / 3600000)
    const d = Math.floor(diff / 86400000)
    if (diff < 0 || m < 1) return 'agora'
    if (m < 60) return `${m}m`
    if (h < 24) return `${h}h`
    if (d < 7) return `${d}d`
    return new Date(createdMs).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }
  useEffect(() => { loadPosts() }, [])

  // Atualiza o "agora" de referência a cada 30s, só para os tempos relativos
  // (formatDate) ficarem corretos sem precisar de outra interação na tela.
  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <style>{ANIMATION_STYLES}</style>
      <Navbar />

      {cardNavigating && (
        <div className="page-fade-overlay">
          <svg className="animate-spin w-7 h-7 text-emerald-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
        </div>
      )}

      <div className="xl:pl-[244px] pl-[72px]">
        <div className="max-w-[470px] mx-auto px-3 sm:px-4 py-6 space-y-4">

          {/* Stories */}
          <StoriesBar />

        {/* Composer */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 hover:border-zinc-700 transition-colors p-4 flex gap-3">
          <Avatar url={currentUserAvatar} username={currentUsername} href="/profile" size="lg" />
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleComposerChange}
              onBlur={() => setTimeout(closeMentionSuggestions, 150)}
              placeholder="O que está acontecendo na sua guilda? Use @ para marcar alguém"
              className="w-full bg-transparent resize-none text-zinc-100 placeholder-zinc-500 focus:outline-none text-[15px] leading-relaxed pt-1.5"
              rows={2}
              onKeyDown={(e) => {
                handleMentionKeyDown(e)
                if (mentionQuery === null && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) createPost()
              }}
            />

            {/* Autocomplete de menção */}
            {mentionTarget === 'composer' && mentionQuery !== null && (
              <MentionDropdown
                suggestions={getMentionSuggestions()}
                activeIndex={mentionActiveIndex}
                onSelect={applyMention}
              />
            )}

            {/* Image previews */}
            {imagePreviews.length > 0 && (
              <div className={`mt-2 mb-1 grid gap-2 ${imagePreviews.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {imagePreviews.map((preview, idx) => (
                  <div key={idx} className="relative rounded-xl overflow-hidden border border-zinc-700">
                    <img src={preview} alt={`Preview ${idx + 1}`} className="w-full h-32 object-cover" />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/70 hover:bg-black rounded-full flex items-center justify-center transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Música selecionada para o post */}
            {composerTrack && (
              <div className="mt-2 mb-1 flex items-center gap-2.5 bg-zinc-800/70 border border-zinc-700 rounded-full pl-1.5 pr-2 py-1.5">
                <img
                  src={composerTrack.artworkUrl100}
                  alt={composerTrack.trackName}
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-100 truncate leading-tight">{composerTrack.trackName}</p>
                  <p className="text-[11px] text-zinc-500 truncate leading-tight">{composerTrack.artistName}</p>
                </div>
                <button
                  onClick={() => setComposerTrack(null)}
                  className="shrink-0 w-6 h-6 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors"
                  aria-label="Remover música"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            )}

            {/* Editor de opções de enquete */}
            {showPollComposer && (
              <div className="mt-3 mb-1 space-y-2">
                <p className="text-xs text-zinc-500 font-medium px-0.5">Opções da enquete</p>
                {composerPollOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={opt}
                      onChange={e => {
                        const next = [...composerPollOptions]
                        next[i] = e.target.value
                        setComposerPollOptions(next)
                      }}
                      placeholder={`Opção ${i + 1}`}
                      maxLength={80}
                      className="flex-1 bg-zinc-800 border border-zinc-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
                    />
                    {composerPollOptions.length > 2 && (
                      <button
                        onClick={() => setComposerPollOptions(prev => prev.filter((_, j) => j !== i))}
                        className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-colors shrink-0"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                {composerPollOptions.length < 4 && (
                  <button
                    onClick={() => setComposerPollOptions(prev => [...prev, ''])}
                    className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors px-1 py-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Adicionar opção
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800">
              <div className="flex items-center gap-2">
                <label className={`flex items-center gap-1.5 text-xs cursor-pointer px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors ${imageFiles.length >= 4 ? 'text-zinc-600 pointer-events-none' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                  </svg>
                  {imageFiles.length >= 4 ? 'Máx. 4 fotos' : `Foto${imageFiles.length > 0 ? ` (${imageFiles.length}/4)` : ''}`}
                  <input type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" disabled={imageFiles.length >= 4} />
                </label>
                <button
                  onClick={() => setMusicModalOpen(true)}
                  className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors ${composerTrack ? 'text-pink-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  🎵 {composerTrack ? 'Trocar música' : 'Música'}
                </button>
                <button
                  onClick={togglePollComposer}
                  className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors ${showPollComposer ? 'text-violet-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                  </svg>
                  {showPollComposer ? 'Remover enquete' : 'Enquete'}
                </button>
                {imageFile && !imagePreviews.length && (
                  <span className="text-xs text-emerald-500 truncate max-w-[140px]">{imageFile.name}</span>
                )}
              </div>
              <button
                onClick={createPost}
                disabled={loading || (!content.trim() && !imageFile && !composerTrack && !(showPollComposer && composerPollOptions.filter(o => o.trim()).length >= 2))}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all shadow-md shadow-emerald-950/40"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Publicando…
                  </span>
                ) : 'Publicar'}
              </button>
            </div>
          </div>
        </div>

        {/* Posts */}
        {initialLoading ? (
          <div className="space-y-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="skeleton w-9 h-9 rounded-full" />
                  <div className="space-y-1.5">
                    <div className="skeleton h-3 w-24 rounded" />
                    <div className="skeleton h-2.5 w-14 rounded" />
                  </div>
                </div>
                <div className="skeleton h-3 w-full rounded" />
                <div className="skeleton h-3 w-3/4 rounded" />
                <div className="skeleton h-48 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center text-center py-20 px-8">
            <div className="w-20 h-20 rounded-full border-2 border-zinc-700 flex items-center justify-center mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>
              </svg>
            </div>
            <p className="font-semibold text-base text-white mb-1">Seu feed está quieto</p>
            <p className="text-zinc-500 text-sm max-w-xs">Siga outros membros da guilda ou publique algo para começar a ver atividade aqui.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post, idx) => {
              const isOwner = post.user_id === currentUserId
              const isEditing = editingPostId === post.id
              const postComments = comments[post.id] || []
              const isCommentsOpen = openComments[post.id]

              return (
                <div key={post.repostInfo ? `repost-wrap-${post.repostInfo.repostId}` : `wrap-${post.id}`} className="relative">
                  {/* Bolha flutuante de repost / citação — só aparece para seguidores mútuos. Fica FORA do article (que tem overflow-hidden) para nunca ser cortada. */}
                  {post.repostInfo && post.repostInfo.isMutual && !dismissedBubbles.has(post.repostInfo.repostId) && (
                    <div
                      className="repost-bubble absolute z-20 -top-3 left-3 max-w-[78%]"
                      onPointerDown={(e) => handleBubblePointerDown(e, post.repostInfo!.repostId)}
                      onPointerMove={handleBubblePointerMove}
                      onPointerUp={handleBubblePointerUp}
                      onPointerCancel={handleBubblePointerUp}
                    >
                      <div className="relative bg-zinc-100 text-zinc-900 rounded-2xl rounded-bl-sm px-3 py-2 shadow-lg flex items-start gap-2">
                        <Avatar url={post.repostInfo.reposterAvatarUrl} username={post.repostInfo.reposterUsername} size="sm" />
                        <div className="min-w-0 pt-0.5">
                          <p className="text-[11px] font-semibold text-zinc-500 leading-none mb-0.5">
                            @{post.repostInfo.reposterUsername}
                          </p>
                          {post.repostInfo.quoteContent ? (
                            <p className="text-xs leading-snug whitespace-pre-wrap break-words">
                              {post.repostInfo.quoteContent}
                            </p>
                          ) : (
                            <p className="text-xs leading-snug flex items-center gap-1 text-zinc-600">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                              </svg>
                              republicou
                            </p>
                          )}
                        </div>
                      </div>
                      {/* "Rabinho" da bolha de pensamento */}
                      <div className="absolute -bottom-1.5 left-4 w-3 h-3 bg-zinc-100 rounded-full" />
                      <div className="absolute -bottom-3 left-2.5 w-1.5 h-1.5 bg-zinc-100 rounded-full" />
                    </div>
                  )}

                <article
                  id={`post-${post.id}`}
                  onClick={e => goToPost(e, post)}
                  className={`post-enter glass-card rounded-2xl overflow-hidden ${
                    !((post.image_urls && post.image_urls.length > 0) || post.image_url) ? 'cursor-pointer' : ''
                  } ${
                    post.iAmMentioned
                      ? 'border-2 border-pink-600/60 shadow-[0_0_0_1px_rgba(236,72,153,0.25)]'
                      : 'border border-white/10'
                  }`}
                  style={{
                    animationDelay: `${Math.min(idx * 40, 200)}ms`,
                    '--bg-image': (post.image_urls?.[0] || post.image_url) ? `url(${post.image_urls?.[0] || post.image_url})` : 'none',
                  } as React.CSSProperties}
                >
                  <div className={post.repostInfo && post.repostInfo.isMutual && !dismissedBubbles.has(post.repostInfo.repostId) ? 'pt-5' : ''}>
                  {/* Post header */}
                  <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar url={post.avatar_url} username={post.username} href={`/user/${encodeURIComponent(post.username)}`} />
                      <div className="flex items-baseline gap-1.5 min-w-0">
                        <NavLink href={`/user/${encodeURIComponent(post.username)}`} className="nav-link font-semibold text-sm text-white hover:text-emerald-400 truncate">
                          @{post.username}
                        </NavLink>
                        <span className="text-xs text-zinc-500 shrink-0">· {formatDate(post.created_at)}</span>
                      </div>
                    </div>

                    {isOwner && !isEditing && (
                      <div className="flex items-center gap-1 ml-auto">
                        <button onClick={() => startEdit(post)} className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors" title="Editar">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button onClick={() => deletePost(post.id)} className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors" title="Excluir">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Aviso de menção (só pra quem foi mencionado) */}
                  {!isEditing && post.iAmMentioned && (
                    <div className="px-4 pb-2 -mt-1">
                      <span className="flex items-center gap-1 w-fit bg-pink-600/20 text-pink-300 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0116 0v1"/>
                        </svg>
                        Você foi marcado
                      </span>
                    </div>
                  )}

                  {/* Content */}
                  <div className={isEditing ? 'px-4 pb-3' : 'pb-1'}>
                    {isEditing ? (
                      <div className="space-y-2 relative">
                        <textarea
                          ref={editTextareaRef}
                          value={editingContent}
                          onChange={handleEditingChange}
                          onBlur={() => setTimeout(closeMentionSuggestions, 150)}
                          onKeyDown={handleMentionKeyDown}
                          className="w-full bg-zinc-800 rounded-xl p-3 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                          rows={4}
                          autoFocus
                        />
                        {mentionTarget === 'editing' && mentionQuery !== null && (
                          <MentionDropdown
                            suggestions={getMentionSuggestions()}
                            activeIndex={mentionActiveIndex}
                            onSelect={applyMention}
                          />
                        )}
                        <div className="flex gap-2 justify-end">
                          <button onClick={cancelEdit} className="text-xs px-3 py-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800 transition-colors">Cancelar</button>
                          <button onClick={() => saveEdit(post.id)} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors">Salvar</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {post.content && (
                          <p className="px-4 pb-3 text-sm text-zinc-100 whitespace-pre-wrap leading-relaxed">{renderWithMentions(post.content)}</p>
                        )}
                        {post.image_urls?.length > 0 && (
                          <div className={`grid gap-0.5 bg-black ${post.image_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                            {post.image_urls.map((url, idx) => (
                              <img
                                key={idx}
                                src={url}
                                alt={`Imagem ${idx + 1}`}
                                data-post-image
                                className={`w-full object-cover cursor-pointer ${post.image_urls.length === 1 ? 'max-h-[520px]' : post.image_urls.length === 3 && idx === 0 ? 'col-span-2 h-56' : 'h-44'}`}
                                loading="lazy"
                              />
                            ))}
                          </div>
                        )}
                        {post.music_title && (
                          <PostMusicChip
                            title={post.music_title}
                            artist={post.music_artist ?? null}
                            artworkUrl={post.music_artwork_url ?? null}
                            previewUrl={post.music_preview_url ?? null}
                          />
                        )}
                        {/* Enquete */}
                        {polls[post.id] && (() => {
                          const poll = polls[post.id]
                          const voted = poll.myVoteOptionId !== null
                          const maxVotes = Math.max(...poll.options.map(o => o.voteCount), 1)
                          return (
                            <div className="mx-4 mb-3 mt-2 space-y-2">
                              {poll.options.map(opt => {
                                const pct = poll.totalVotes > 0 ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0
                                const isWinner = voted && opt.voteCount === maxVotes && opt.voteCount > 0
                                return (
                                  <button
                                    key={opt.id}
                                    onClick={() => votePoll(post.id, opt.id)}
                                    className={`relative w-full text-left rounded-xl border overflow-hidden transition-colors ${
                                      opt.votedByMe
                                        ? 'border-violet-500 bg-violet-500/10'
                                        : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                                    }`}
                                  >
                                    {/* Barra de progresso */}
                                    {voted && (
                                      <div
                                        className={`absolute inset-y-0 left-0 transition-all duration-500 rounded-xl ${
                                          opt.votedByMe ? 'bg-violet-500/20' : isWinner ? 'bg-white/5' : 'bg-white/[0.03]'
                                        }`}
                                        style={{ width: `${pct}%` }}
                                      />
                                    )}
                                    <div className="relative flex items-center justify-between px-3 py-2.5 gap-2">
                                      <span className="text-sm text-zinc-100 flex items-center gap-1.5">
                                        {opt.votedByMe && (
                                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-violet-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12"/>
                                          </svg>
                                        )}
                                        {opt.text}
                                      </span>
                                      {voted && (
                                        <span className={`text-xs font-semibold shrink-0 ${opt.votedByMe ? 'text-violet-300' : 'text-zinc-400'}`}>
                                          {pct}%
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                )
                              })}
                              <p className="text-[11px] text-zinc-500 px-0.5">
                                {poll.totalVotes === 0
                                  ? 'Seja o primeiro a votar'
                                  : `${poll.totalVotes} voto${poll.totalVotes > 1 ? 's' : ''}${voted ? ' · Toque para mudar' : ''}`}
                              </p>
                            </div>
                          )
                        })()}
                      </>
                    )}
                  </div>
                  </div>

                  {/* Actions */}
                  {!isEditing && (
                    <div className="px-4 pt-3">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => toggleLike(post.id)}
                          className={`transition-colors ${post.likedByMe ? 'text-pink-500' : 'text-zinc-200 hover:text-zinc-400'}`}
                          aria-label="Curtir"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className={`w-6 h-6 ${likingPostId === post.id ? 'like-pop' : ''}`}
                            viewBox="0 0 24 24"
                            fill={post.likedByMe ? 'currentColor' : 'none'}
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                          </svg>
                        </button>

                        <button
                          onClick={() => toggleComments(post.id)}
                          className={`transition-colors active:scale-95 ${isCommentsOpen ? 'text-blue-400' : 'text-zinc-200 hover:text-zinc-400'}`}
                          aria-label="Comentar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                          </svg>
                        </button>

                        <button
                          onClick={() => toggleDislike(post.id)}
                          className={`transition-colors ${post.dislikedByMe ? 'text-orange-400' : 'text-zinc-200 hover:text-zinc-400'}`}
                          aria-label="Não curtir"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className={`w-6 h-6 ${dislikingPostId === post.id ? 'dislike-pop' : ''}`}
                            viewBox="0 0 24 24"
                            fill={post.dislikedByMe ? 'currentColor' : 'none'}
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>
                            <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
                          </svg>
                        </button>

                        {/* Repostar */}
                        <button
                          onClick={() => setOpenRepostMenu(post.id)}
                          disabled={!!reposting[post.id]}
                          className={`relative transition-colors disabled:opacity-40 ${post.repostedByMe ? 'text-emerald-500' : 'text-zinc-200 hover:text-zinc-400'}`}
                          aria-label="Repostar"
                        >
                          {burstingPostId === post.id && <RepostBurst />}
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                          </svg>
                        </button>

                        {/* Compartilhar no chat */}
                        <button
                          onClick={() => openShareModal(post.id)}
                          className="ml-auto text-zinc-200 hover:text-zinc-400 transition-colors"
                          aria-label="Compartilhar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                          </svg>
                        </button>
                      </div>

                      {/* Contador de reposts */}
                      {post.repostCount > 0 && (
                        <p className="mt-1.5 text-xs text-zinc-500">
                          {post.repostCount} {post.repostCount === 1 ? 'republicação' : 'republicações'}
                        </p>
                      )}

                      {/* Like / dislike counts, Instagram-style bold line */}
                      {(post.likes > 0 || post.dislikes > 0) && (
                        <div className="flex items-center gap-3 mt-2 text-sm">
                          {post.likes > 0 && (
                            <span className="font-semibold text-zinc-100">
                              {post.likes} curtida{post.likes > 1 ? 's' : ''}
                            </span>
                          )}
                          {post.dislikes > 0 && (
                            <span className="text-zinc-500">
                              {post.dislikes} não curtiu{post.dislikes > 1 ? 'ram' : ''}
                            </span>
                          )}
                        </div>
                      )}

                  {/* Ver comentários — abre o modal estilo Instagram */}
                  {postComments.length > 0 && (
                    <button
                      onClick={() => toggleComments(post.id)}
                      className="block mt-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      Ver {postComments.length === 1 ? 'o comentário' : `todos os ${postComments.length} comentários`}
                    </button>
                  )}

                  <div className="pb-3" />
                </div>
              )}
                </article>
                </div>
              )
            })}
          </div>
        )}
        </div>
      </div>

      {/* Modal: Republicar ou Citar */}
      {openRepostMenu !== null && (() => {
        const targetPost = posts.find(p => p.id === openRepostMenu)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={closeRepostMenu}>
            <div
              className={`bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xs overflow-hidden ${repostMenuClosing ? 'repost-menu-pop-out' : ''}`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => toggleRepost(openRepostMenu)}
                disabled={!!reposting[openRepostMenu]}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-left text-zinc-100 hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                </svg>
                {targetPost?.repostedByMe ? 'Desfazer republicação' : 'Republicar'}
              </button>
              <button
                onClick={() => openQuote(openRepostMenu)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-left text-zinc-100 hover:bg-zinc-800 transition-colors border-t border-zinc-800"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Citar
              </button>
              {targetPost?.quotedByMe && (
                <button
                  onClick={() => removeQuote(openRepostMenu)}
                  disabled={!!reposting[openRepostMenu]}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-left text-red-400 hover:bg-zinc-800 transition-colors border-t border-zinc-800 disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/><line x1="15" y1="9" x2="20" y2="14"/><line x1="20" y1="9" x2="15" y2="14"/>
                  </svg>
                  Retirar citação
                </button>
              )}
              <button
                onClick={closeRepostMenu}
                className="w-full px-4 py-3.5 text-sm text-center text-zinc-500 hover:bg-zinc-800 transition-colors border-t border-zinc-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        )
      })()}

      {/* Modal: Citar post */}
      {quotingPostId !== null && (() => {
        const quoted = posts.find(p => p.id === quotingPostId && !p.repostInfo)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={cancelQuote}>
            <div
              className={`bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-4 ${quoteModalClosing ? 'repost-menu-pop-out' : ''}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Citar post</h3>
                <button onClick={cancelQuote} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <textarea
                value={quoteContent}
                onChange={(e) => setQuoteContent(e.target.value)}
                placeholder="Adicione um comentário…"
                rows={3}
                autoFocus
                className="w-full bg-zinc-800 rounded-xl p-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
              />

              {quoted && (
                <div className="mt-3 border border-zinc-800 rounded-xl p-3 flex gap-2.5">
                  <Avatar url={quoted.avatar_url} username={quoted.username} size="sm" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-300">@{quoted.username}</p>
                    {quoted.content && (
                      <p className="text-xs text-zinc-500 line-clamp-2 mt-0.5">{quoted.content}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end mt-4">
                <button onClick={cancelQuote} className="text-sm px-3.5 py-2 rounded-lg text-zinc-400 hover:bg-zinc-800 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={submitQuote}
                  disabled={submittingQuote}
                  className="text-sm px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium transition-colors"
                >
                  {submittingQuote ? 'Publicando…' : 'Publicar'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal: Compartilhar no chat */}
      {shareModalPostId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={closeShareModal}>
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-4 max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h3 className="text-sm font-semibold text-white">Enviar para…</h3>
              <button onClick={closeShareModal} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1">
              {loadingMutuals ? (
                <div className="flex justify-center py-6">
                  <svg className="animate-spin w-5 h-5 text-zinc-500" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                </div>
              ) : mutuals.length === 0 ? (
                <p className="text-center text-sm text-zinc-500 py-6">
                  Você ainda não tem seguidores mútuos pra compartilhar.
                </p>
              ) : (
                mutuals.map(person => (
                  <button
                    key={person.user_id}
                    onClick={() => shareToUser(person.user_id)}
                    disabled={sharingToUserId === person.user_id}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-60"
                  >
                    <Avatar url={person.avatar_url} username={person.username} size="md" />
                    <span className="flex-1 text-left text-sm text-zinc-100">@{person.username}</span>
                    {sharedToUserId === person.user_id ? (
                      <span className="text-xs text-emerald-400 font-medium">Enviado ✓</span>
                    ) : sharingToUserId === person.user_id ? (
                      <svg className="animate-spin w-4 h-4 text-zinc-500" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                    ) : (
                      <span className="text-xs text-zinc-500">Enviar</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Comentários (estilo Instagram, bottom-sheet, vidro translúcido) */}
      {Object.keys(openComments).length > 0 && (() => {
        const activePostId = Number(Object.keys(openComments)[0])
        const activeComments = comments[activePostId] || []
        const activePost = posts.find(p => p.id === activePostId)
        const bgImage = activePost?.image_urls?.[0] || activePost?.image_url || null

        return (
          <div
            className={`fixed inset-0 z-50 flex items-end justify-center bg-black/70 comments-modal-overlay ${commentsModalClosing ? 'closing' : ''}`}
            onClick={closeCommentsModal}
          >
            <div
              className={`comments-modal-sheet comments-modal-sheet-anim border-t border-white/10 w-full max-w-lg rounded-t-2xl flex flex-col h-[75vh] max-h-[680px] ${commentsModalClosing ? 'closing' : ''}`}
              style={{
                '--bg-image': bgImage ? `url(${bgImage})` : 'none',
                '--parallax-y': `${commentsParallax}px`,
                transform: commentsDragY > 0 ? `translateY(${commentsDragY}px)` : undefined,
                transition: commentsDragActive.current ? 'none' : 'transform 0.2s ease',
              } as React.CSSProperties}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="comments-modal-handle shrink-0"
                style={{ cursor: 'grab', touchAction: 'none', padding: '6px 0' }}
                onPointerDown={handleCommentsDragStart}
                onPointerMove={handleCommentsDragMove}
                onPointerUp={handleCommentsDragEnd}
                onPointerCancel={handleCommentsDragEnd}
              />

              {/* Header */}
              <div
                className="relative shrink-0 flex flex-col items-center gap-1.5 px-4 pt-1 pb-3 border-b border-white/10"
                style={{ cursor: 'grab', touchAction: 'none' }}
                onPointerDown={handleCommentsDragStart}
                onPointerMove={handleCommentsDragMove}
                onPointerUp={handleCommentsDragEnd}
                onPointerCancel={handleCommentsDragEnd}
              >
                <button
                  onClick={closeCommentsModal}
                  className="absolute left-3 top-2 text-zinc-400 hover:text-zinc-200 transition-colors p-1"
                  aria-label="Fechar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
                <h3 className="text-sm font-semibold text-white mt-1.5">Comentários</h3>
                {activePost && (
                  <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <Avatar url={activePost.avatar_url} username={activePost.username} size="sm" />
                    no post de <span className="text-zinc-200 font-medium">@{activePost.username}</span>
                  </p>
                )}
              </div>

              {/* Lista de comentários */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4" onScroll={handleCommentsScroll}>
                {activeComments.length === 0 ? (
                  <p className="text-center text-sm text-zinc-500 py-10">
                    Nenhum comentário ainda. Seja o primeiro!
                  </p>
                ) : (
                  activeComments.map(comment => (
                    <div key={comment.id} className={`flex gap-3 ${comment.id === newCommentId ? 'comment-enter' : ''}`}>
                      <Avatar url={comment.avatar_url} username={comment.username} size="sm" href={`/user/${encodeURIComponent(comment.username)}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm leading-snug">
                          <NavLink href={`/user/${encodeURIComponent(comment.username)}`} className="nav-link font-semibold text-zinc-100 hover:text-white mr-1.5">
                            @{comment.username}
                          </NavLink>
                          <span className="text-xs text-zinc-500">{formatDate(comment.created_at)}</span>
                        </div>
                        <p className="text-sm text-zinc-200 leading-snug mt-0.5 whitespace-pre-wrap break-words">
                          {comment.content}
                        </p>
                        <div className="flex items-center gap-4 mt-1.5">
                          {comment.likeCount > 0 && (
                            <span className="text-xs text-zinc-500">
                              {comment.likeCount} curtida{comment.likeCount > 1 ? 's' : ''}
                            </span>
                          )}
                          <button
                            onClick={() => setCommentInputs(prev => ({ ...prev, [activePostId]: `@${comment.username} ${prev[activePostId] || ''}`.trimStart() }))}
                            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-medium"
                          >
                            Responder
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleCommentLike(comment.id, activePostId)}
                        className="shrink-0 pt-0.5 text-zinc-400 hover:text-zinc-200 transition-colors"
                        aria-label="Curtir comentário"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`w-4 h-4 ${comment.likedByMe ? 'comment-like-pop comment-heart-glow text-red-500' : ''}`}
                          viewBox="0 0 24 24"
                          fill={comment.likedByMe ? 'currentColor' : 'none'}
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Input fixo no rodapé */}
              <div className="shrink-0 border-t border-white/10 px-3 py-2.5 flex items-center gap-2.5">
                <Avatar url={currentUserAvatar} username={currentUsername} size="sm" />
                <div className="flex-1 flex items-center bg-white/5 border border-white/10 rounded-full px-3.5 py-2">
                  <input
                    value={commentInputs[activePostId] || ''}
                    onChange={(e) => setCommentInputs(prev => ({ ...prev, [activePostId]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); createComment(activePostId) } }}
                    placeholder="Adicione um comentário…"
                    autoFocus
                    className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => createComment(activePostId)}
                  disabled={submittingComment[activePostId] || !commentInputs[activePostId]?.trim()}
                  className="text-sm font-semibold text-blue-400 hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors px-1"
                >
                  Publicar
                </button>
              </div>
            </div>
          </div>
        )
      })()}
      {/* Modal de busca de música para o composer (mesmo sistema usado nas stories) */}
      {musicModalOpen && (
        <MusicSearchModal
          onSelect={(track) => setComposerTrack(track)}
          onClose={() => setMusicModalOpen(false)}
        />
      )}
    </main>
  )
}
