'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type TaggedPerson = {
  user_id: string
  username: string
  avatar_url: string | null
}

type StoryUser = {
  user_id: string
  username: string
  avatar_url: string | null
  stories: {
    id: number
    image_url: string
    caption: string | null
    created_at: string
    music_title?: string | null
    music_artist?: string | null
    music_preview_url?: string | null
    music_artwork_url?: string | null
    music_start_time?: number | null // segundos, onde o trecho de 15s começa no preview de 30s
  }[]
  seenAll: boolean
}

type FollowingPerson = {
  user_id: string
  username: string
  avatar_url: string | null
}

const STORY_DURATION = 15000 // ms por story (acompanha o trecho de música de 15s)
const MUSIC_CLIP_DURATION = 15 // segundos do trecho de música tocado

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (h >= 1) return `${h}h`
  if (m >= 1) return `${m}m`
  return 'agora'
}

export default function StoryViewer({
  groups,
  startIndex,
  myId,
  onClose,
}: {
  groups: StoryUser[]
  startIndex: number
  myId: string | null
  onClose: () => void
}) {
  const [groupIndex, setGroupIndex] = useState(startIndex)
  const [storyIndex, setStoryIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)

  // Curtidas por story: { [storyId]: { count, likedByMe } }
  const [likeData, setLikeData] = useState<Record<number, { count: number; likedByMe: boolean }>>({})
  const [likePop, setLikePop] = useState(false)

  // Pessoas marcadas por story: { [storyId]: TaggedPerson[] }
  const [tagsByStory, setTagsByStory] = useState<Record<number, TaggedPerson[]>>({})
  const [showTagModal, setShowTagModal] = useState(false)
  const [following, setFollowing] = useState<FollowingPerson[]>([])
  const [tagSearch, setTagSearch] = useState('')
  const [savingTag, setSavingTag] = useState(false)

  // Resposta ao story (envia como DM)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [replySent, setReplySent] = useState(false)
  const replyInputRef = useRef<HTMLInputElement>(null)

  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number>(0)
  const elapsedRef = useRef<number>(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // ---- Música: mute, equalizer animado (Web Audio API) ----
  const [musicMuted, setMusicMuted] = useState(false)
  const [eqLevels, setEqLevels] = useState<[number, number, number]>([0.3, 0.5, 0.35])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  const eqRafRef = useRef<number | null>(null)

  const group = groups[groupIndex]
  const story = group?.stories[storyIndex]
  const isMine = group?.user_id === myId
  const currentLike = story ? likeData[story.id] : undefined
  const currentTags = story ? (tagsByStory[story.id] || []) : []

  function markViewed(storyId: number) {
    if (!myId || isMine) return
    supabase.from('story_views').upsert({ story_id: storyId, viewer_id: myId }, { onConflict: 'story_id,viewer_id' }).then(() => {})
  }

  async function loadLike(storyId: number) {
    if (!myId) return
    const { count } = await supabase
      .from('story_likes')
      .select('id', { count: 'exact', head: true })
      .eq('story_id', storyId)

    const { data: existing } = await supabase
      .from('story_likes')
      .select('id')
      .eq('story_id', storyId)
      .eq('user_id', myId)
      .maybeSingle()

    setLikeData(prev => ({
      ...prev,
      [storyId]: { count: count || 0, likedByMe: !!existing },
    }))
  }

  async function toggleLike() {
    if (!myId || !story) return
    const storyId = story.id
    const current = likeData[storyId] || { count: 0, likedByMe: false }

    setLikePop(true)
    setTimeout(() => setLikePop(false), 400)

    // Atualização otimista
    setLikeData(prev => ({
      ...prev,
      [storyId]: {
        count: current.likedByMe ? current.count - 1 : current.count + 1,
        likedByMe: !current.likedByMe,
      },
    }))

    if (current.likedByMe) {
      await supabase.from('story_likes').delete().eq('story_id', storyId).eq('user_id', myId)
    } else {
      await supabase.from('story_likes').insert({ story_id: storyId, user_id: myId })
    }
  }

  async function loadTags(storyId: number) {
    const { data } = await supabase
      .from('story_tags')
      .select('tagged_user_id, profiles(username, avatar_url)')
      .eq('story_id', storyId)

    const tagged: TaggedPerson[] = (data || []).map((row: any) => ({
      user_id: row.tagged_user_id,
      username: row.profiles?.username || '?',
      avatar_url: row.profiles?.avatar_url || null,
    }))

    setTagsByStory(prev => ({ ...prev, [storyId]: tagged }))
  }

  async function loadFollowing() {
    if (!myId) return
    const { data: rows } = await supabase
      .from('follows')
      .select('following_id, profiles:following_id(username, avatar_url)')
      .eq('follower_id', myId)

    const list: FollowingPerson[] = (rows || []).map((r: any) => ({
      user_id: r.following_id,
      username: r.profiles?.username || '?',
      avatar_url: r.profiles?.avatar_url || null,
    }))

    setFollowing(list)
  }

  function openTagModal() {
    setTagSearch('')
    if (following.length === 0) loadFollowing()
    setShowTagModal(true)
    setPaused(true)
  }

  function closeTagModal() {
    setShowTagModal(false)
    setPaused(false)
  }

  async function toggleTagPerson(person: FollowingPerson) {
    if (!myId || !story || savingTag) return
    const storyId = story.id
    const already = (tagsByStory[storyId] || []).some(t => t.user_id === person.user_id)

    setSavingTag(true)

    if (already) {
      setTagsByStory(prev => ({
        ...prev,
        [storyId]: (prev[storyId] || []).filter(t => t.user_id !== person.user_id),
      }))
      await supabase.from('story_tags').delete().eq('story_id', storyId).eq('tagged_user_id', person.user_id)
    } else {
      setTagsByStory(prev => ({
        ...prev,
        [storyId]: [...(prev[storyId] || []), person],
      }))
      await supabase.from('story_tags').insert({
        story_id: storyId,
        tagged_user_id: person.user_id,
        tagged_by: myId,
      })
    }

    setSavingTag(false)
  }

  async function sendReply() {
    if (!replyText.trim() || !myId || !group || sendingReply) return
    setSendingReply(true)

    const { error } = await supabase.from('messages').insert({
      sender_id: myId,
      receiver_id: group.user_id,
      content: `Respondeu seu story: "${replyText.trim()}"`,
      read: false,
    })

    setSendingReply(false)

    if (!error) {
      setReplyText('')
      setReplySent(true)
      setTimeout(() => setReplySent(false), 1800)
      replyInputRef.current?.blur()
    } else {
      alert('Erro ao enviar resposta: ' + error.message)
    }
  }

  function goNextStory() {
    if (!group) return
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex(i => i + 1)
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex(i => i + 1)
      setStoryIndex(0)
    } else {
      onClose()
    }
  }

  function goPrevStory() {
    if (!group) return
    if (storyIndex > 0) {
      setStoryIndex(i => i - 1)
    } else if (groupIndex > 0) {
      const prevGroup = groups[groupIndex - 1]
      setGroupIndex(i => i - 1)
      setStoryIndex(prevGroup.stories.length - 1)
    }
  }

  async function deleteStory() {
    if (!story || !isMine) return
    if (!confirm('Apagar este story?')) return
    await supabase.from('stories').delete().eq('id', story.id)
    if (group.stories.length === 1) {
      onClose()
    } else {
      goNextStory()
    }
  }

  // ---------- Áudio do preview de música ----------
  // Toca o trecho de 15s do preview (iTunes) a partir de music_start_time.
  // Para automaticamente ao trocar de story, ao pausar (hold) e ao fechar.
  useEffect(() => {
    const url = story?.music_preview_url
    if (!url) {
      audioRef.current?.pause()
      return
    }
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.crossOrigin = 'anonymous'
    }
    const audio = audioRef.current
    audio.muted = musicMuted
    audio.volume = 0.85

    const startAt = story?.music_start_time || 0

    if (audio.src !== url) {
      audio.src = url
      audio.currentTime = startAt
    } else {
      audio.currentTime = startAt
    }

    // Conecta o AnalyserNode (Web Audio API) uma única vez por elemento <audio>,
    // para alimentar o equalizer animado do chip.
    if (!audioCtxRef.current) {
      try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext
        const ctx = new Ctx()
        const source = ctx.createMediaElementSource(audio)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 64
        source.connect(analyser)
        analyser.connect(ctx.destination)
        audioCtxRef.current = ctx
        analyserRef.current = analyser
        sourceNodeRef.current = source
      } catch {
        // Web Audio pode falhar (ex.: Safari restrito) — o chip cai para animação fallback
      }
    }

    audio.play().catch(() => {
      // Autoplay bloqueado — o usuário precisará interagir primeiro.
      // Não exibimos alerta: o chip de música já indica que há som.
    })

    return () => { audio.pause() }
  }, [story?.id])

  // Para o trecho no fim dos 15s definidos (caso o preview de 30s continue além disso)
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !story?.music_preview_url) return
    const startAt = story?.music_start_time || 0
    const endAt = startAt + MUSIC_CLIP_DURATION

    function onTimeUpdate() {
      if (audio!.currentTime >= endAt) {
        audio!.currentTime = startAt
      }
    }
    audio.addEventListener('timeupdate', onTimeUpdate)
    return () => audio.removeEventListener('timeupdate', onTimeUpdate)
  }, [story?.id, story?.music_start_time])

  // Mute/unmute
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = musicMuted
  }, [musicMuted])

  // Pausa/retoma o áudio junto com a barra de progresso (hold na tela)
  useEffect(() => {
    if (!audioRef.current || !audioRef.current.src) return
    if (paused) audioRef.current.pause()
    else audioRef.current.play().catch(() => {})
  }, [paused])

  // Para o áudio e fecha o AudioContext ao desmontar o viewer
  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioCtxRef.current?.close().catch(() => {})
    }
  }, [])

  // Loop do equalizer: lê o AnalyserNode e atualiza as 3 barrinhas do chip.
  // Se não houver AnalyserNode disponível (falha no Web Audio), anima por pseudo-ritmo.
  useEffect(() => {
    if (!story?.music_preview_url) return

    let fallbackPhase = 0
    function loop() {
      const analyser = analyserRef.current
      if (analyser && !paused && !musicMuted) {
        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        const third = Math.max(1, Math.floor(data.length / 3))
        const avg = (from: number, to: number) => {
          let sum = 0
          for (let i = from; i < to; i++) sum += data[i]
          return sum / (to - from) / 255
        }
        const a = Math.min(1, Math.max(0.12, avg(0, third)))
        const b = Math.min(1, Math.max(0.12, avg(third, third * 2)))
        const c = Math.min(1, Math.max(0.12, avg(third * 2, data.length)))
        setEqLevels([a, b, c])
      } else if (!paused && !musicMuted) {
        // Fallback: pulso pseudo-aleatório com base em seno, parece "no ritmo" sem dados reais
        fallbackPhase += 0.18
        const a = 0.3 + Math.abs(Math.sin(fallbackPhase)) * 0.6
        const b = 0.3 + Math.abs(Math.sin(fallbackPhase + 1.3)) * 0.6
        const c = 0.3 + Math.abs(Math.sin(fallbackPhase + 2.6)) * 0.6
        setEqLevels([a, b, c])
      } else {
        setEqLevels([0.15, 0.15, 0.15])
      }
      eqRafRef.current = requestAnimationFrame(loop)
    }
    eqRafRef.current = requestAnimationFrame(loop)
    return () => {
      if (eqRafRef.current) cancelAnimationFrame(eqRafRef.current)
    }
  }, [story?.id, paused, musicMuted])

  // Progresso / autoplay
  useEffect(() => {
    if (!story) return
    setProgress(0)
    elapsedRef.current = 0
    setReplyText('')
    markViewed(story.id)
    loadLike(story.id)
    loadTags(story.id)

    function tick(ts: number) {
      if (paused) {
        startRef.current = ts
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      if (!startRef.current) startRef.current = ts
      const delta = ts - startRef.current
      startRef.current = ts
      elapsedRef.current += delta
      const pct = Math.min(100, (elapsedRef.current / STORY_DURATION) * 100)
      setProgress(pct)
      if (pct >= 100) {
        goNextStory()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    startRef.current = 0
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [groupIndex, storyIndex, paused])

  // Teclado
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowRight') goNextStory()
      if (e.key === 'ArrowLeft') goPrevStory()
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!group || !story) return null

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
      <style>{`
        @keyframes storyLikePop {
          0%   { transform: scale(1); }
          35%  { transform: scale(1.5) rotate(-8deg); }
          60%  { transform: scale(0.92); }
          100% { transform: scale(1); }
        }
        .like-pop { animation: storyLikePop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }

        @keyframes replySentPulse {
          0%   { transform: scale(0.85); opacity: 0; }
          40%  { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .reply-sent-anim { animation: replySentPulse 0.3s ease-out; }

        @keyframes storyGlow {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        .story-bg-glow { animation: storyGlow 6s ease-in-out infinite; }
      `}</style>

      <div className="relative w-full h-full max-w-md mx-auto flex flex-col overflow-hidden">

        {/* Glow de fundo sutil baseado na imagem, dá profundidade */}
        <div
          className="story-bg-glow absolute inset-0 -z-10 opacity-60 blur-3xl scale-110"
          style={{
            backgroundImage: `url(${story.image_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0 -z-10 bg-black/40" />

        {/* Barras de progresso */}
        <div className="absolute top-3 left-3 right-3 flex gap-1 z-20">
          {group.stories.map((s, i) => (
            <div key={s.id} className="flex-1 h-[3px] bg-white/25 rounded-full overflow-hidden backdrop-blur-sm">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-300 via-pink-400 to-fuchsia-400 shadow-[0_0_6px_rgba(236,72,153,0.6)]"
                style={{
                  width: i < storyIndex ? '100%' : i === storyIndex ? `${progress}%` : '0%',
                  transition: i === storyIndex ? 'none' : undefined,
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-7 left-3 right-3 flex items-center justify-between z-20">
          <div className="flex items-center gap-2.5 bg-black/30 backdrop-blur-md rounded-full pl-1 pr-3 py-1 border border-white/10">
            <div className="w-8 h-8 rounded-full p-[1.5px] bg-gradient-to-br from-amber-300 via-pink-400 to-fuchsia-500">
              <div className="w-full h-full rounded-full bg-black p-[1.5px]">
                {group.avatar_url ? (
                  <img src={group.avatar_url} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-[10px] font-bold text-white">
                    {group.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <span className="text-white text-sm font-semibold tracking-tight">{group.username}</span>
            <span className="text-white/50 text-xs">{formatRelativeTime(story.created_at)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {isMine && (
              <button
                onClick={openTagModal}
                className="text-white/85 hover:text-white bg-black/30 backdrop-blur-md rounded-full p-2 border border-white/10 transition-colors"
                title="Marcar pessoas"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>
                </svg>
              </button>
            )}
            {isMine && (
              <button
                onClick={deleteStory}
                className="text-white/85 hover:text-white bg-black/30 backdrop-blur-md rounded-full p-2 border border-white/10 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4a2 2 0 012-2h0a2 2 0 012 2v2"/>
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-white/85 hover:text-white bg-black/30 backdrop-blur-md rounded-full p-2 border border-white/10 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Imagem + áreas de toque */}
        <div className="flex-1 relative overflow-hidden">
          <img
            src={story.image_url}
            className="w-full h-full object-contain bg-black"
            onMouseDown={() => setPaused(true)}
            onMouseUp={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
          />
          <button
            aria-label="Anterior"
            onClick={goPrevStory}
            className="absolute left-0 top-0 w-1/3 h-full"
          />
          <button
            aria-label="Próximo"
            onClick={goNextStory}
            className="absolute right-0 top-0 w-2/3 h-full"
          />

          {story.caption && (
            <div className="absolute bottom-4 left-4 right-16 z-20">
              <p className="text-white text-sm font-medium bg-black/45 rounded-2xl px-3.5 py-2.5 backdrop-blur-md border border-white/10 shadow-lg">
                {story.caption}
              </p>
            </div>
          )}

          {/* Pessoas marcadas */}
          {currentTags.length > 0 && (
            <div className="absolute bottom-20 left-4 right-4 z-20 flex flex-wrap gap-1.5 pointer-events-none">
              {currentTags.map(tag => (
                <span
                  key={tag.user_id}
                  className="flex items-center gap-1 bg-black/55 backdrop-blur-md text-white text-xs font-medium px-2.5 py-1 rounded-full border border-white/10"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0116 0v1"/>
                  </svg>
                  @{tag.username}
                </span>
              ))}
            </div>
          )}

          {/* Chip de música — disco girando, nome em marquee, equalizer animado, mute */}
          {story.music_preview_url && (
            <div className="absolute bottom-20 right-4 z-20 flex items-center gap-2 bg-black/55 backdrop-blur-md border border-white/10 rounded-full pl-1.5 pr-2.5 py-1.5 max-w-[210px]">
              {/* Capa do álbum girando como disco de vinil */}
              <div className="relative w-8 h-8 shrink-0">
                {story.music_artwork_url ? (
                  <img
                    src={story.music_artwork_url}
                    alt={story.music_title || ''}
                    className="w-8 h-8 rounded-full object-cover border border-white/20"
                    style={{
                      animation: paused ? 'none' : 'musicDiscSpin 3s linear infinite',
                    }}
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 border border-white/20 flex items-center justify-center text-sm"
                    style={{ animation: paused ? 'none' : 'musicDiscSpin 3s linear infinite' }}
                  >
                    🎵
                  </div>
                )}
                {/* Furo central do disco, dá o efeito vinil */}
                <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/70 border border-white/30" />
              </div>

              {/* Nome + artista com marquee quando o texto é longo */}
              <div className="flex flex-col min-w-0 max-w-[90px] overflow-hidden">
                {story.music_title && (
                  <div className="overflow-hidden">
                    <span
                      className="text-white text-[11px] font-semibold leading-tight inline-block whitespace-nowrap"
                      style={
                        story.music_title.length > 14
                          ? { animation: 'musicMarquee 6s linear infinite' }
                          : undefined
                      }
                    >
                      {story.music_title}
                      {story.music_title.length > 14 && '\u00A0\u00A0•\u00A0\u00A0' + story.music_title}
                    </span>
                  </div>
                )}
                {story.music_artist && (
                  <span className="text-white/65 text-[10px] truncate leading-tight">{story.music_artist}</span>
                )}
              </div>

              {/* Equalizer animado — 3 barrinhas pulsando no ritmo via AnalyserNode */}
              <div className="flex items-end gap-[2px] h-3.5 shrink-0 ml-0.5">
                {eqLevels.map((lvl, i) => (
                  <span
                    key={i}
                    className="w-[2.5px] rounded-full bg-white/90"
                    style={{
                      height: `${Math.max(15, lvl * 100)}%`,
                      transition: 'height 0.1s ease-out',
                      opacity: musicMuted ? 0.3 : 1,
                    }}
                  />
                ))}
              </div>

              {/* Mute / unmute */}
              <button
                onClick={(e) => { e.stopPropagation(); setMusicMuted(m => !m) }}
                className="shrink-0 text-white/85 hover:text-white"
                aria-label={musicMuted ? 'Ativar som' : 'Silenciar'}
              >
                {musicMuted ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/>
                  </svg>
                )}
              </button>

              <style>{`
                @keyframes musicDiscSpin {
                  from { transform: rotate(0deg); }
                  to   { transform: rotate(360deg); }
                }
                @keyframes musicMarquee {
                  from { transform: translateX(0); }
                  to   { transform: translateX(-50%); }
                }
              `}</style>
            </div>
          )}
        </div>

        {/* Rodapé: responder + curtir */}
        {!isMine ? (
          <div className="relative z-30 px-3 pb-4 pt-2 flex items-center gap-2.5 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex-1 flex items-center bg-black/35 backdrop-blur-md border border-white/15 rounded-full pl-4 pr-1.5 py-1.5 focus-within:border-white/40 transition-colors">
              <input
                ref={replyInputRef}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onFocus={() => setPaused(true)}
                onBlur={() => setPaused(false)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendReply() } }}
                placeholder={`Responder a ${group.username}…`}
                className="flex-1 bg-transparent text-sm text-white placeholder-white/50 focus:outline-none"
              />
              {replyText.trim() && (
                <button
                  onClick={sendReply}
                  disabled={sendingReply}
                  className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-amber-300 via-pink-400 to-fuchsia-500 flex items-center justify-center disabled:opacity-50 transition-opacity"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                </button>
              )}
            </div>

            {!replyText.trim() && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleLike() }}
                className="shrink-0 flex items-center gap-1.5 bg-black/35 backdrop-blur-md border border-white/15 rounded-full px-3.5 py-2.5"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`w-5 h-5 ${likePop ? 'like-pop' : ''}`}
                  viewBox="0 0 24 24"
                  fill={currentLike?.likedByMe ? '#ec4899' : 'none'}
                  stroke={currentLike?.likedByMe ? '#ec4899' : 'white'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                {currentLike && currentLike.count > 0 && (
                  <span className="text-white text-xs font-semibold">{currentLike.count}</span>
                )}
              </button>
            )}

            {replySent && (
              <div className="reply-sent-anim absolute -top-9 right-3 bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Enviado
              </div>
            )}
          </div>
        ) : (
          <div className="relative z-30 px-3 pb-4 pt-2 flex items-center justify-end bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center gap-1.5 bg-black/35 backdrop-blur-md border border-white/15 rounded-full px-3.5 py-2.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-pink-400" viewBox="0 0 24 24" fill="#ec4899" stroke="none">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              {currentLike && currentLike.count > 0 ? (
                <span className="text-white text-xs font-semibold">{currentLike.count} curtida{currentLike.count > 1 ? 's' : ''}</span>
              ) : (
                <span className="text-white/60 text-xs font-medium">Sem curtidas ainda</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal: marcar pessoas */}
      {showTagModal && (
        <div className="fixed inset-0 z-[110] bg-black/70 flex items-end sm:items-center justify-center" onClick={closeTagModal}>
          <div
            className="bg-zinc-900 w-full sm:w-96 sm:rounded-2xl rounded-t-2xl max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h3 className="text-white font-semibold text-sm">Marcar pessoas</h3>
              <button onClick={closeTagModal} className="text-zinc-400 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="px-4 py-2 border-b border-zinc-800">
              <input
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                placeholder="Buscar pessoa…"
                className="w-full bg-zinc-800 text-sm text-zinc-100 placeholder-zinc-600 px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-pink-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {following.length === 0 ? (
                <p className="text-center text-zinc-500 text-sm py-6">Você ainda não segue ninguém.</p>
              ) : (
                following
                  .filter(p => p.username.toLowerCase().includes(tagSearch.toLowerCase()))
                  .map(person => {
                    const isTagged = currentTags.some(t => t.user_id === person.user_id)
                    return (
                      <button
                        key={person.user_id}
                        onClick={() => toggleTagPerson(person)}
                        disabled={savingTag}
                        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                      >
                        <div className="flex items-center gap-3">
                          {person.avatar_url ? (
                            <img src={person.avatar_url} className="w-9 h-9 rounded-full object-cover" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-xs font-bold text-white">
                              {person.username.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span className="text-sm text-zinc-200">@{person.username}</span>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isTagged ? 'bg-pink-500 border-pink-500' : 'border-zinc-600'}`}>
                          {isTagged && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                        </div>
                      </button>
                    )
                  })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
