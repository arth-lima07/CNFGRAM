'use client'
import React from 'react'
import Navbar from '@/components/Navbar'
import { useEffect, useState } from 'react'
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
.post-enter { animation: fadeInUp 0.35s ease both; }
.like-pop { animation: likePop 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
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
`

type Comment = {
  id: number
  username: string
  user_id: string
  avatar_url: string | null
  content: string
  post_id: number
  created_at: string
}

type Post = {
  id: number
  user_id: string
  username: string
  avatar_url: string | null
  content: string
  image_url: string | null
  created_at: string
  likes: number
  likedByMe: boolean
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

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null)
  const [currentUsername, setCurrentUsername] = useState('')
  const [editingPostId, setEditingPostId] = useState<number | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [comments, setComments] = useState<Record<number, Comment[]>>({})
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({})
  const [openComments, setOpenComments] = useState<Record<number, boolean>>({})
  const [submittingComment, setSubmittingComment] = useState<Record<number, boolean>>({})
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [likingPostId, setLikingPostId] = useState<number | null>(null)

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

    const postsWithLikes = await Promise.all(
      (postsData || []).map(async (post) => {
        const { count } = await supabase
          .from('likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id)

        const { data: existingLike } = await supabase
          .from('likes')
          .select('id')
          .eq('post_id', post.id)
          .eq('user_id', user.id)
          .maybeSingle()

        return {
          ...post,
          avatar_url: avatarMap[post.user_id] ?? null,
          image_url: post.image_url ?? null,
          likes: count || 0,
          likedByMe: !!existingLike,
        }
      })
    )

    setPosts(postsWithLikes)
    setInitialLoading(false)
  }

  async function loadComments(postId: number) {
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

    const commentsWithAvatars = commentList.map(c => ({
      ...c,
      avatar_url: avatarMap[c.user_id] ?? null,
    }))

    setComments(prev => ({ ...prev, [postId]: commentsWithAvatars }))
  }

  function toggleComments(postId: number) {
    const isOpen = !openComments[postId]
    setOpenComments(prev => ({ ...prev, [postId]: isOpen }))
    if (isOpen && !comments[postId]) loadComments(postId)
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

    await supabase.from('comments').insert({
      post_id: postId,
      user_id: user.id,
      username: profile?.username || 'Usuário',
      content: text,
    })

    setCommentInputs(prev => ({ ...prev, [postId]: '' }))
    await loadComments(postId)
    setSubmittingComment(prev => ({ ...prev, [postId]: false }))
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function removeImage() {
    setImageFile(null)
    setImagePreview(null)
  }

  async function createPost() {
    if (!content.trim() && !imageFile) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('Faça login novamente.'); setLoading(false); return }

    let image_url: string | null = null

    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(fileName, imageFile, { upsert: true })

      if (uploadError) {
        alert('Erro ao enviar imagem: ' + uploadError.message)
        setLoading(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(fileName)

      image_url = publicUrl
    }

    const { error } = await supabase.from('posts').insert({
      user_id: user.id,
      username: currentUsername || 'Usuário',
      content,
      image_url,
    })

    if (error) { alert(error.message); setLoading(false); return }

    setContent('')
    setImageFile(null)
    setImagePreview(null)
    await loadPosts()
    setLoading(false)
  }

  async function toggleLike(postId: number) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('Faça login.'); return }

    setLikingPostId(postId)
    setTimeout(() => setLikingPostId(prev => (prev === postId ? null : prev)), 400)

    const post = posts.find(p => p.id === postId)
    if (!post) return

    // Optimistic update
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, likedByMe: !p.likedByMe, likes: p.likedByMe ? p.likes - 1 : p.likes + 1 }
        : p
    ))

    const { data: existingLike } = await supabase
      .from('likes').select('id')
      .eq('post_id', postId).eq('user_id', user.id)
      .maybeSingle()

    if (existingLike) {
      await supabase.from('likes').delete().eq('id', existingLike.id)
    } else {
      await supabase.from('likes').insert({ post_id: postId, user_id: user.id })
    }
  }

  async function deletePost(postId: number) {
    if (!confirm('Deseja apagar este post?')) return
    const { error } = await supabase.from('posts').delete().eq('id', postId)
    if (error) { alert(error.message); return }
    await loadPosts()
  }

  function startEdit(post: Post) {
    setEditingPostId(post.id)
    setEditingContent(post.content)
  }

  function cancelEdit() {
    setEditingPostId(null)
    setEditingContent('')
  }

  async function saveEdit(postId: number) {
    if (!editingContent.trim()) return
    const { error } = await supabase
      .from('posts').update({ content: editingContent }).eq('id', postId)
    if (error) { alert(error.message); return }
    setEditingPostId(null)
    setEditingContent('')
    await loadPosts()
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  function formatDate(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    const h = Math.floor(diff / 3600000)
    const d = Math.floor(diff / 86400000)
    if (m < 1) return 'agora'
    if (m < 60) return `${m}m`
    if (h < 24) return `${h}h`
    if (d < 7) return `${d}d`
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  useEffect(() => { loadPosts() }, [])

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <style>{ANIMATION_STYLES}</style>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Navbar />
          <a
            href="/messages"
            className="relative p-2 text-zinc-200 hover:text-emerald-400 rounded-lg hover:bg-zinc-900 transition-colors"
            title="Mensagens"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </a>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Composer */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 flex gap-3">
          <Avatar url={currentUserAvatar} username={currentUsername} href="/profile" />
          <div className="flex-1">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="O que está acontecendo na sua guilda?"
              className="w-full bg-transparent resize-none text-zinc-100 placeholder-zinc-600 focus:outline-none text-sm leading-relaxed"
              rows={3}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) createPost() }}
            />

            {/* Image preview */}
            {imagePreview && (
              <div className="relative mt-2 mb-1 rounded-xl overflow-hidden border border-zinc-700 inline-block">
                <img src={imagePreview} alt="Preview" className="max-h-48 max-w-full rounded-xl object-cover" />
                <button
                  onClick={removeImage}
                  className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/70 hover:bg-black rounded-full flex items-center justify-center transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            )}

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                  </svg>
                  Foto
                  <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                </label>
                {imageFile && (
                  <span className="text-xs text-emerald-500 truncate max-w-[140px]">{imageFile.name}</span>
                )}
              </div>
              <button
                onClick={createPost}
                disabled={loading || (!content.trim() && !imageFile)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
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
          <div className="space-y-3">
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
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 text-zinc-600">
            <p className="text-4xl mb-3">🏰</p>
            <p className="text-sm">Nenhuma publicação ainda.</p>
            <p className="text-xs mt-1">Siga outros membros para ver o feed.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post, idx) => {
              const isOwner = post.user_id === currentUserId
              const isEditing = editingPostId === post.id
              const postComments = comments[post.id] || []
              const isCommentsOpen = openComments[post.id]

              return (
                <article
                  key={post.id}
                  className="post-enter bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden"
                  style={{ animationDelay: `${Math.min(idx * 40, 200)}ms` }}
                >
                  {/* Post header */}
                  <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar url={post.avatar_url} username={post.username} href={`/user/${encodeURIComponent(post.username)}`} />
                      <div>
                        <NavLink href={`/user/${encodeURIComponent(post.username)}`} className="nav-link font-semibold text-sm text-white hover:text-emerald-400">
                          @{post.username}
                        </NavLink>
                        <p className="text-xs text-zinc-500">{formatDate(post.created_at)}</p>
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

                  {/* Content */}
                  <div className="px-4 pb-3">
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="w-full bg-zinc-800 rounded-xl p-3 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                          rows={4}
                          autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                          <button onClick={cancelEdit} className="text-xs px-3 py-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800 transition-colors">Cancelar</button>
                          <button onClick={() => saveEdit(post.id)} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors">Salvar</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-zinc-100 whitespace-pre-wrap leading-relaxed">{post.content}</p>
                        {post.image_url && (
                          <div className="mt-3 rounded-xl overflow-hidden border border-zinc-800">
                            <img
                              src={post.image_url}
                              alt="Imagem do post"
                              className="w-full max-h-96 object-cover"
                              loading="lazy"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  {!isEditing && (
                    <div className="px-4 pb-3 flex items-center gap-1 border-t border-zinc-800 pt-3">
                      <button
                        onClick={() => toggleLike(post.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${post.likedByMe ? 'bg-pink-600/20 text-pink-400' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`w-4 h-4 ${likingPostId === post.id ? 'like-pop' : ''}`}
                          viewBox="0 0 24 24"
                          fill={post.likedByMe ? 'currentColor' : 'none'}
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                        {post.likes > 0 && <span>{post.likes}</span>}
                      </button>

                      <button
                        onClick={() => toggleComments(post.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all active:scale-95 ${isCommentsOpen ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        {postComments.length > 0 && <span>{postComments.length}</span>}
                      </button>
                    </div>
                  )}

                  {/* Comments */}
                  {isCommentsOpen && !isEditing && (
                    <div className="comments-enter border-t border-zinc-800 px-4 py-3 space-y-3">
                      {postComments.length > 0 && (
                        <div className="space-y-2">
                          {postComments.map(comment => (
                            <div key={comment.id} className="flex gap-2.5">
                              <Avatar url={comment.avatar_url} username={comment.username} size="sm" href={`/user/${encodeURIComponent(comment.username)}`} />
                              <div className="flex-1 bg-zinc-800 rounded-xl px-3 py-2">
                                <NavLink href={`/user/${encodeURIComponent(comment.username)}`} className="nav-link text-xs font-semibold text-zinc-300 hover:text-white">
                                  @{comment.username}
                                </NavLink>
                                <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{comment.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <input
                          value={commentInputs[post.id] || ''}
                          onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); createComment(post.id) } }}
                          placeholder="Escreva um comentário…"
                          className="flex-1 bg-zinc-800 text-sm text-zinc-100 placeholder-zinc-600 px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => createComment(post.id)}
                          disabled={submittingComment[post.id] || !commentInputs[post.id]?.trim()}
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
