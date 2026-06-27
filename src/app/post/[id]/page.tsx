'use client'
import React, { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { supabase } from '@/lib/supabase'

// ─── Animações e estilos globais ────────────────────────────────────────────
const STYLES = `
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
@keyframes shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
@keyframes musicDiscSpin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes musicEqBar {
  0%, 100% { transform: scaleY(0.3); }
  50%       { transform: scaleY(1); }
}
@keyframes commentEnter {
  from { opacity: 0; transform: translateY(10px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.post-enter { animation: fadeInUp 0.35s ease both; }
.like-pop   { animation: likePop 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
.comment-enter { animation: commentEnter 0.32s cubic-bezier(0.16, 1, 0.3, 1) both; }
.skeleton {
  background: linear-gradient(90deg, #18181b 25%, #27272a 37%, #18181b 63%);
  background-size: 800px 100%;
  animation: shimmer 1.4s ease infinite;
}
.page-fade-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: #09090b;
  display: flex; align-items: center; justify-content: center;
  animation: fadeInUp 0.2s ease both;
}
.glass-card {
  position: relative;
  backdrop-filter: blur(18px) saturate(130%);
  -webkit-backdrop-filter: blur(18px) saturate(130%);
  background-color: rgba(24, 24, 27, 0.78);
  isolation: isolate;
}
.glass-card::before {
  content: '';
  position: absolute; inset: 0; z-index: -1;
  background-image: var(--bg-image, none);
  background-size: cover; background-position: center;
  filter: blur(22px) brightness(0.5) saturate(1.1);
  transform: scale(1.2); opacity: 0.55;
}
.glass-card::after {
  content: '';
  position: absolute; inset: 0; z-index: 0;
  background: linear-gradient(180deg, rgba(9,9,11,.45) 0%, rgba(9,9,11,.7) 40%, rgba(9,9,11,.92) 100%);
  pointer-events: none;
}
.glass-card > * { position: relative; z-index: 1; }
`

// ─── Helpers ────────────────────────────────────────────────────────────────
function parseServerDate(dateStr: string): number {
  if (!dateStr) return NaN
  const trimmed = dateStr.trim()
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(trimmed)) return new Date(trimmed).getTime()
  return new Date(trimmed.replace(' ', 'T') + 'Z').getTime()
}

function formatDate(dateStr: string) {
  const ms = parseServerDate(dateStr)
  if (Number.isNaN(ms)) return ''
  const diff = Date.now() - ms
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (diff < 0 || m < 1) return 'agora'
  if (m < 60) return `${m}m`
  if (h < 24) return `${h}h`
  if (d < 7) return `${d}d`
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function extractMentions(text: string): string[] {
  return (text.match(/@([a-zA-Z0-9_.]+)/g) || []).map(m => m.slice(1))
}

function renderWithMentions(text: string) {
  return text.split(/(@[a-zA-Z0-9_.]+)/g).map((part, i) => {
    if (part.startsWith('@') && part.length > 1) {
      const username = part.slice(1)
      return (
        <NavLink key={i} href={`/user/${encodeURIComponent(username)}`} className="text-emerald-400 font-medium hover:text-emerald-300">
          {part}
        </NavLink>
      )
    }
    return <span key={i}>{part}</span>
  })
}

// ─── NavLink com fade ────────────────────────────────────────────────────────
function NavLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const [navigating, setNavigating] = useState(false)
  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    setNavigating(true)
    setTimeout(() => { window.location.href = href }, 180)
  }
  return (
    <>
      <a href={href} onClick={handleClick} className={className}>{children}</a>
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

// ─── Avatar ──────────────────────────────────────────────────────────────────
function Avatar({ url, username, size = 'md', href }: { url: string | null; username: string | null | undefined; size?: 'sm' | 'md' | 'lg'; href?: string }) {
  const dim = size === 'sm' ? 'w-7 h-7 text-[10px]' : size === 'lg' ? 'w-12 h-12 text-sm' : 'w-9 h-9 text-xs'
  const initials = (username || '?').slice(0, 2).toUpperCase()
  const inner = url
    ? <img src={url} alt={username || ''} className={`${dim} rounded-full object-cover border border-zinc-700 shrink-0`} />
    : <div className={`${dim} rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-bold shrink-0`}>{initials}</div>
  if (href) return <NavLink href={href} className="inline-flex hover:opacity-80">{inner}</NavLink>
  return inner
}

// ─── Chip de música (autoplay mudo por padrão) ───────────────────────────────
function PostMusicChip({ title, artist, artworkUrl, previewUrl }: { title: string; artist: string | null; artworkUrl: string | null; previewUrl: string | null }) {
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!previewUrl) return
    const audio = new Audio(previewUrl)
    audio.muted = true
    audioRef.current = audio
    audio.onended = () => setPlaying(false)
    audio.play().then(() => setPlaying(true)).catch(() => {})
    return () => { audio.pause(); audio.src = '' }
  }, [previewUrl])

  function toggleMute(e: React.MouseEvent) {
    e.stopPropagation()
    if (!audioRef.current) return
    const newMuted = !audioRef.current.muted
    audioRef.current.muted = newMuted
    setMuted(newMuted)
    if (!playing) {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => {})
    }
  }

  return (
    <div className="mx-4 mb-3 mt-3 flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-full pl-1.5 pr-3 py-1.5">
      <div className="relative w-8 h-8 shrink-0">
        {artworkUrl
          ? <img src={artworkUrl} alt={title} className="w-8 h-8 rounded-full object-cover border border-white/15" style={{ animation: playing ? 'musicDiscSpin 3s linear infinite' : 'none' }} />
          : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 border border-white/15 flex items-center justify-center text-sm" style={{ animation: playing ? 'musicDiscSpin 3s linear infinite' : 'none' }}>🎵</div>
        }
        <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/70 border border-white/30" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-zinc-100 truncate leading-tight">{title}</p>
        {artist && <p className="text-[11px] text-zinc-500 truncate leading-tight">{artist}</p>}
      </div>
      {playing && (
        <div className="flex items-end gap-[2px] h-3 shrink-0">
          {[0, 1, 2].map(i => (
            <span key={i} className={`w-[2.5px] rounded-full ${muted ? 'bg-zinc-500' : 'bg-emerald-400'}`}
              style={{ height: '100%', animation: `musicEqBar 0.9s ease-in-out ${i * 0.15}s infinite` }} />
          ))}
        </div>
      )}
      {previewUrl && (
        <button onClick={toggleMute} aria-label={muted ? 'Ativar som' : 'Mutar'}
          className="shrink-0 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
          {muted ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>
          )}
        </button>
      )}
    </div>
  )
}

// ─── Tipos ───────────────────────────────────────────────────────────────────
type Comment = {
  id: number; username: string; user_id: string; avatar_url: string | null
  content: string; post_id: number; created_at: string; likeCount: number; likedByMe: boolean
}
type PollOption = { id: number; text: string; position: number; voteCount: number; votedByMe: boolean }
type Poll = { options: PollOption[]; totalVotes: number; myVoteOptionId: number | null; link: string | null }
type Post = {
  id: number; user_id: string; username: string; avatar_url: string | null
  content: string; image_url: string | null; image_urls: string[]; created_at: string
  likes: number; dislikes: number; likedByMe: boolean; dislikedByMe: boolean
  music_title?: string | null; music_artist?: string | null
  music_preview_url?: string | null; music_artwork_url?: string | null
  poll_link?: string | null
}

// ─── Página ──────────────────────────────────────────────────────────────────
export default function PostPage() {
  const params = useParams()
  const postId = Number(params.id)

  const [post, setPost] = useState<Post | null>(null)
  const [poll, setPoll] = useState<Poll | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentInput, setCommentInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [newCommentId, setNewCommentId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState('')
  const [currentUsername, setCurrentUsername] = useState('')
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null)
  const [likingPost, setLikingPost] = useState(false)
  const [nowTick, setNowTick] = useState(() => Date.now())

  useEffect(() => {
    loadPost()
    const interval = setInterval(() => setNowTick(Date.now()), 30000)
    return () => clearInterval(interval)
  }, [postId])

  async function loadPost() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setCurrentUserId(user.id)
      const { data: profile } = await supabase.from('profiles').select('username, avatar_url').eq('id', user.id).single()
      if (profile) { setCurrentUsername(profile.username); setCurrentUserAvatar(profile.avatar_url) }
    }

    const { data: postData } = await supabase.from('posts').select('*').eq('id', postId).single()
    if (!postData) { setLoading(false); return }

    const { data: profile } = await supabase.from('profiles').select('avatar_url').eq('id', postData.user_id).single()

    const [{ count: likeCount }, { data: myLike }, { count: dislikeCount }, { data: myDislike }] = await Promise.all([
      supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', postId),
      user ? supabase.from('likes').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('dislikes').select('*', { count: 'exact', head: true }).eq('post_id', postId),
      user ? supabase.from('dislikes').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
    ])

    const imageUrls: string[] = postData.image_urls?.length ? postData.image_urls : postData.image_url ? [postData.image_url] : []

    setPost({
      ...postData,
      avatar_url: profile?.avatar_url ?? null,
      image_urls: imageUrls,
      likes: likeCount || 0,
      dislikes: dislikeCount || 0,
      likedByMe: !!myLike,
      dislikedByMe: !!myDislike,
    })

    // Enquete
    const { data: optionsData } = await supabase.from('poll_options').select('*').eq('post_id', postId).order('position', { ascending: true })
    if (optionsData && optionsData.length > 0) {
      const { data: votesData } = await supabase.from('poll_votes').select('poll_option_id, user_id').eq('post_id', postId)
      const votesByOption: Record<number, number> = {}
      let myVoteOptionId: number | null = null
      for (const v of votesData || []) {
        votesByOption[v.poll_option_id] = (votesByOption[v.poll_option_id] || 0) + 1
        if (user && v.user_id === user.id) myVoteOptionId = v.poll_option_id
      }
      const options: PollOption[] = optionsData.map((o: any) => ({
        id: o.id, text: o.text, position: o.position,
        voteCount: votesByOption[o.id] || 0,
        votedByMe: myVoteOptionId === o.id,
      }))
      setPoll({ options, totalVotes: options.reduce((s, o) => s + o.voteCount, 0), myVoteOptionId, link: postData.poll_link ?? null })
    }

    // Comentários
    await loadComments(user)
    setLoading(false)
  }

  async function loadComments(user: any) {
    const { data } = await supabase.from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: true })
    const list = data || []
    const uniqueIds = [...new Set(list.map((c: any) => c.user_id))]
    const { data: profiles } = uniqueIds.length
      ? await supabase.from('profiles').select('id, avatar_url').in('id', uniqueIds)
      : { data: [] as any[] }
    const avatarMap: Record<string, string | null> = {}
    for (const p of profiles || []) avatarMap[p.id] = p.avatar_url

    const commentIds = list.map((c: any) => c.id)
    const { data: likesData } = commentIds.length
      ? await supabase.from('comment_likes').select('comment_id, user_id').in('comment_id', commentIds)
      : { data: [] as any[] }
    const likeCountMap: Record<number, number> = {}
    const likedByMeSet = new Set<number>()
    for (const l of likesData || []) {
      likeCountMap[l.comment_id] = (likeCountMap[l.comment_id] || 0) + 1
      if (user && l.user_id === user.id) likedByMeSet.add(l.comment_id)
    }
    setComments(list.map((c: any) => ({ ...c, avatar_url: avatarMap[c.user_id] ?? null, likeCount: likeCountMap[c.id] || 0, likedByMe: likedByMeSet.has(c.id) })))
  }

  async function toggleLike() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !post) return
    setLikingPost(true)
    setTimeout(() => setLikingPost(false), 400)
    const wasLiked = post.likedByMe
    setPost(p => p ? ({ ...p, likedByMe: !wasLiked, likes: wasLiked ? p.likes - 1 : p.likes + 1, dislikedByMe: false, dislikes: p.dislikedByMe ? p.dislikes - 1 : p.dislikes }) : p)
    if (post.dislikedByMe) {
      const { data: d } = await supabase.from('dislikes').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle()
      if (d) await supabase.from('dislikes').delete().eq('id', d.id)
    }
    const { data: existing } = await supabase.from('likes').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle()
    if (existing) await supabase.from('likes').delete().eq('id', existing.id)
    else await supabase.from('likes').insert({ post_id: postId, user_id: user.id })
  }

  async function toggleDislike() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !post) return
    const wasDisliked = post.dislikedByMe
    setPost(p => p ? ({ ...p, dislikedByMe: !wasDisliked, dislikes: wasDisliked ? p.dislikes - 1 : p.dislikes + 1, likedByMe: false, likes: p.likedByMe ? p.likes - 1 : p.likes }) : p)
    if (post.likedByMe) {
      const { data: l } = await supabase.from('likes').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle()
      if (l) await supabase.from('likes').delete().eq('id', l.id)
    }
    const { data: existing } = await supabase.from('dislikes').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle()
    if (existing) await supabase.from('dislikes').delete().eq('id', existing.id)
    else await supabase.from('dislikes').insert({ post_id: postId, user_id: user.id })
  }

  async function votePoll(optionId: number) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !poll) return
    const wasVoted = poll.myVoteOptionId === optionId
    const prevVotedId = poll.myVoteOptionId
    setPoll(prev => {
      if (!prev) return prev
      const newOptions = prev.options.map(o => {
        if (o.id === optionId) return { ...o, voteCount: wasVoted ? o.voteCount - 1 : o.voteCount + 1, votedByMe: !wasVoted }
        if (o.id === prevVotedId) return { ...o, voteCount: o.voteCount - 1, votedByMe: false }
        return o
      })
      return { ...prev, options: newOptions, totalVotes: newOptions.reduce((s, o) => s + o.voteCount, 0), myVoteOptionId: wasVoted ? null : optionId }
    })
    if (prevVotedId !== null) await supabase.from('poll_votes').delete().eq('post_id', postId).eq('user_id', user.id)
    if (!wasVoted) await supabase.from('poll_votes').insert({ post_id: postId, poll_option_id: optionId, user_id: user.id })
  }

  async function toggleCommentLike(commentId: number) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const target = comments.find(c => c.id === commentId)
    const wasLiked = !!target?.likedByMe
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, likedByMe: !wasLiked, likeCount: wasLiked ? c.likeCount - 1 : c.likeCount + 1 } : c))
    if (wasLiked) {
      const { data: ex } = await supabase.from('comment_likes').select('id').eq('comment_id', commentId).eq('user_id', user.id).maybeSingle()
      if (ex) await supabase.from('comment_likes').delete().eq('id', ex.id)
    } else {
      await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: user.id })
    }
  }

  async function createComment() {
    if (!commentInput.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setSubmitting(true)
    const { data: inserted } = await supabase.from('comments').insert({ post_id: postId, user_id: user.id, username: currentUsername || 'Usuário', content: commentInput }).select('id').single()
    setCommentInput('')
    await loadComments(user)
    setSubmitting(false)
    if (inserted?.id) {
      setNewCommentId(inserted.id)
      setTimeout(() => setNewCommentId(prev => prev === inserted.id ? null : prev), 500)
    }
  }

  function fmtDate(dateStr: string) {
    const ms = parseServerDate(dateStr)
    if (Number.isNaN(ms)) return ''
    const diff = nowTick - ms
    const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), d = Math.floor(diff / 86400000)
    if (diff < 0 || m < 1) return 'agora'
    if (m < 60) return `${m}m`; if (h < 24) return `${h}h`; if (d < 7) return `${d}d`
    return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  if (loading) return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <style>{STYLES}</style>
      <Navbar />
      <div className="xl:pl-[244px] pl-[72px]">
        <div className="max-w-[470px] mx-auto px-3 sm:px-4 py-6 space-y-4">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 space-y-3">
            <div className="flex items-center gap-3"><div className="skeleton w-9 h-9 rounded-full" /><div className="space-y-1.5"><div className="skeleton h-3 w-24 rounded" /><div className="skeleton h-2.5 w-14 rounded" /></div></div>
            <div className="skeleton h-3 w-full rounded" /><div className="skeleton h-3 w-3/4 rounded" /><div className="skeleton h-48 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </main>
  )

  if (!post) return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
      <style>{STYLES}</style>
      <Navbar />
      <p className="text-zinc-500 text-sm">Post não encontrado.</p>
    </main>
  )

  const voted = poll ? poll.myVoteOptionId !== null : false
  const maxVotes = poll ? Math.max(...poll.options.map(o => o.voteCount), 1) : 1

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <style>{STYLES}</style>
      <Navbar />
      <div className="xl:pl-[244px] pl-[72px]">
        <div className="max-w-[470px] mx-auto px-3 sm:px-4 py-6 space-y-4">

          {/* Voltar */}
          <NavLink href="/feed" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Voltar ao feed
          </NavLink>

          {/* Card do post */}
          <article
            className="post-enter glass-card rounded-2xl overflow-hidden border border-white/10"
            style={{ '--bg-image': (post.image_urls?.[0] || post.image_url) ? `url(${post.image_urls?.[0] || post.image_url})` : 'none' } as React.CSSProperties}
          >
            {/* Header */}
            <div className="px-4 pt-4 pb-3 flex items-start gap-3">
              <Avatar url={post.avatar_url} username={post.username} href={`/user/${encodeURIComponent(post.username)}`} size="lg" />
              <div>
                <NavLink href={`/user/${encodeURIComponent(post.username)}`} className="font-semibold text-sm text-white hover:text-emerald-400">
                  @{post.username}
                </NavLink>
                <p className="text-xs text-zinc-500">{fmtDate(post.created_at)}</p>
              </div>
            </div>

            {/* Conteúdo */}
            {post.content && (
              <p className="px-4 pb-3 text-sm text-zinc-100 whitespace-pre-wrap leading-relaxed">
                {renderWithMentions(post.content)}
              </p>
            )}

            {/* Imagens */}
            {post.image_urls?.length > 0 && (
              <div className={`grid gap-0.5 bg-black ${post.image_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {post.image_urls.map((url, i) => (
                  <img key={i} src={url} alt={`Imagem ${i + 1}`}
                    className={`w-full object-cover ${post.image_urls.length === 1 ? 'max-h-[520px]' : post.image_urls.length === 3 && i === 0 ? 'col-span-2 h-56' : 'h-44'}`}
                  />
                ))}
              </div>
            )}

            {/* Música */}
            {post.music_title && (
              <PostMusicChip title={post.music_title} artist={post.music_artist ?? null} artworkUrl={post.music_artwork_url ?? null} previewUrl={post.music_preview_url ?? null} />
            )}

            {/* Enquete */}
            {poll && (
              <div className="mx-4 mb-3 mt-2 space-y-2">
                {poll.options.map(opt => {
                  const pct = poll.totalVotes > 0 ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0
                  const isWinner = voted && opt.voteCount === maxVotes && opt.voteCount > 0
                  return (
                    <button key={opt.id} onClick={() => votePoll(opt.id)}
                      className={`relative w-full text-left rounded-xl border overflow-hidden transition-colors ${opt.votedByMe ? 'border-violet-500 bg-violet-500/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}>
                      {voted && <div className={`absolute inset-y-0 left-0 transition-all duration-500 rounded-xl ${opt.votedByMe ? 'bg-violet-500/20' : isWinner ? 'bg-white/5' : 'bg-white/[0.03]'}`} style={{ width: `${pct}%` }} />}
                      <div className="relative flex items-center justify-between px-3 py-2.5 gap-2">
                        <span className="text-sm text-zinc-100 flex items-center gap-1.5">
                          {opt.votedByMe && <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-violet-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                          {opt.text}
                        </span>
                        {voted && <span className={`text-xs font-semibold shrink-0 ${opt.votedByMe ? 'text-violet-300' : 'text-zinc-400'}`}>{pct}%</span>}
                      </div>
                    </button>
                  )
                })}
                <p className="text-[11px] text-zinc-500 px-0.5">
                  {poll.totalVotes === 0 ? 'Seja o primeiro a votar' : `${poll.totalVotes} voto${poll.totalVotes > 1 ? 's' : ''}${voted ? ' · Toque para mudar' : ''}`}
                </p>
              </div>
            )}

            {/* Ações */}
            <div className="px-4 pt-3 pb-3">
              <div className="flex items-center gap-4">
                <button onClick={toggleLike} className={`transition-colors ${post.likedByMe ? 'text-pink-500' : 'text-zinc-200 hover:text-zinc-400'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className={`w-6 h-6 ${likingPost ? 'like-pop' : ''}`} viewBox="0 0 24 24" fill={post.likedByMe ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                </button>
                <button onClick={toggleDislike} className={`transition-colors ${post.dislikedByMe ? 'text-orange-400' : 'text-zinc-200 hover:text-zinc-400'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill={post.dislikedByMe ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>
                    <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
                  </svg>
                </button>
              </div>

              {(post.likes > 0 || post.dislikes > 0) && (
                <div className="flex items-center gap-3 mt-2 text-sm">
                  {post.likes > 0 && <span className="font-semibold text-zinc-100">{post.likes} curtida{post.likes > 1 ? 's' : ''}</span>}
                  {post.dislikes > 0 && <span className="text-zinc-500">{post.dislikes} não curtiu{post.dislikes > 1 ? 'ram' : ''}</span>}
                </div>
              )}
            </div>
          </article>

          {/* Comentários */}
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-zinc-400 px-1 pb-1">
              {comments.length === 0 ? 'Nenhum comentário ainda' : `${comments.length} comentário${comments.length > 1 ? 's' : ''}`}
            </h2>

            {/* Input */}
            <div className="flex items-center gap-2.5 bg-zinc-900 border border-zinc-800 rounded-2xl px-3 py-2.5">
              <Avatar url={currentUserAvatar} username={currentUsername} size="sm" />
              <input
                value={commentInput}
                onChange={e => setCommentInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); createComment() } }}
                placeholder="Adicione um comentário…"
                className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
              />
              <button
                onClick={createComment}
                disabled={submitting || !commentInput.trim()}
                className="text-sm font-semibold text-blue-400 hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors px-1"
              >
                {submitting ? (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                ) : 'Publicar'}
              </button>
            </div>

            {/* Lista */}
            <div className="space-y-3 pt-2">
              {comments.map(comment => (
                <div key={comment.id} className={`flex gap-3 ${comment.id === newCommentId ? 'comment-enter' : ''}`}>
                  <Avatar url={comment.avatar_url} username={comment.username} size="sm" href={`/user/${encodeURIComponent(comment.username)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm leading-snug">
                      <NavLink href={`/user/${encodeURIComponent(comment.username)}`} className="font-semibold text-zinc-100 hover:text-white mr-1.5">
                        @{comment.username}
                      </NavLink>
                      <span className="text-xs text-zinc-500">{fmtDate(comment.created_at)}</span>
                    </div>
                    <p className="text-sm text-zinc-200 leading-snug mt-0.5 whitespace-pre-wrap break-words">{comment.content}</p>
                    {comment.likeCount > 0 && <span className="text-xs text-zinc-500 mt-1 block">{comment.likeCount} curtida{comment.likeCount > 1 ? 's' : ''}</span>}
                  </div>
                  <button onClick={() => toggleCommentLike(comment.id)} className="shrink-0 pt-0.5 text-zinc-400 hover:text-zinc-200 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${comment.likedByMe ? 'text-red-500' : ''}`} viewBox="0 0 24 24" fill={comment.likedByMe ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </main>
  )
}
