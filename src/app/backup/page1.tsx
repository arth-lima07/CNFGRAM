'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Comment = {
  id: number
  username: string
  user_id: string
  content: string
  post_id: number
  created_at: string
}

type Post = {
  id: number
  user_id: string
  username: string
  content: string
  created_at: string
  likes: number
  likedByMe: boolean
}

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [editingPostId, setEditingPostId] = useState<number | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [comments, setComments] = useState<Record<number, Comment[]>>({})
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({})
  const [openComments, setOpenComments] = useState<Record<number, boolean>>({})
  const [submittingComment, setSubmittingComment] = useState<Record<number, boolean>>({})

  async function loadPosts() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setCurrentUserId(user.id)

    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)

    const followingIds = follows?.map(f => f.following_id) || []
    followingIds.push(user.id)

    const { data: postsData, error } = await supabase
      .from('posts')
      .select('*')
      .in('user_id', followingIds)
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      return
    }

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
          likes: count || 0,
          likedByMe: !!existingLike
        }
      })
    )

    setPosts(postsWithLikes)
  }

  async function loadComments(postId: number) {
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    setComments(prev => ({ ...prev, [postId]: data || [] }))
  }

  function toggleComments(postId: number) {
    const isOpen = !openComments[postId]
    setOpenComments(prev => ({ ...prev, [postId]: isOpen }))
    if (isOpen && !comments[postId]) {
      loadComments(postId)
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

    await supabase.from('comments').insert({
      post_id: postId,
      user_id: user.id,
      username: profile?.username || 'Usuário',
      content: text
    })

    setCommentInputs(prev => ({ ...prev, [postId]: '' }))
    await loadComments(postId)
    setSubmittingComment(prev => ({ ...prev, [postId]: false }))
  }

  async function createPost() {
    if (!content.trim()) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert('Faça login novamente.')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()

    const { error } = await supabase.from('posts').insert({
      user_id: user.id,
      username: profile?.username || 'Usuário',
      content
    })

    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    setContent('')
    await loadPosts()
    setLoading(false)
  }

  async function toggleLike(postId: number) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('Faça login.'); return }

    const { data: existingLike } = await supabase
      .from('likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingLike) {
      await supabase.from('likes').delete().eq('id', existingLike.id)
    } else {
      await supabase.from('likes').insert({ post_id: postId, user_id: user.id })
    }

    await loadPosts()
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
      .from('posts')
      .update({ content: editingContent })
      .eq('id', postId)

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
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'agora'
    if (minutes < 60) return `${minutes}m`
    if (hours < 24) return `${hours}h`
    if (days < 7) return `${days}d`
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  function getInitials(username: string) {
    return username.slice(0, 2).toUpperCase()
  }

  useEffect(() => {
    loadPosts()
  }, [])

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Navbar />
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-zinc-900"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sair
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Composer */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="O que está acontecendo na sua guilda?"
            className="w-full bg-transparent resize-none text-zinc-100 placeholder-zinc-600 focus:outline-none text-sm leading-relaxed"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) createPost()
            }}
          />
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800">
            <span className="text-xs text-zinc-600">
              {content.length > 0 ? `${content.length} caracteres` : 'Ctrl+Enter para publicar'}
            </span>
            <button
              onClick={createPost}
              disabled={loading || !content.trim()}
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

        {/* Posts */}
        {posts.length === 0 ? (
          <div className="text-center py-20 text-zinc-600">
            <p className="text-4xl mb-3">🏰</p>
            <p className="text-sm">Nenhuma publicação ainda.</p>
            <p className="text-xs mt-1">Siga outros membros para ver o feed.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => {
              const isOwner = post.user_id === currentUserId
              const isEditing = editingPostId === post.id
              const postComments = comments[post.id] || []
              const isCommentsOpen = openComments[post.id]

              return (
                <article key={post.id} className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                  {/* Post header */}
                  <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <a
                        href={`/profile/${post.username}`}
                        className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-xs font-bold shrink-0 hover:opacity-80 transition-opacity"
                      >
                        {getInitials(post.username)}
                      </a>
                      <div>
                        <a
                          href={`/profile/${post.username}`}
                          className="font-semibold text-sm text-white hover:text-emerald-400 transition-colors"
                        >
                          @{post.username}
                        </a>
                        <p className="text-xs text-zinc-500">{formatDate(post.created_at)}</p>
                      </div>
                    </div>

                    {/* Owner actions */}
                    {isOwner && !isEditing && (
                      <div className="flex items-center gap-1 ml-auto">
                        <button
                          onClick={() => startEdit(post)}
                          className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => deletePost(post.id)}
                          className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Content / Edit mode */}
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
                          <button
                            onClick={cancelEdit}
                            className="text-xs px-3 py-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800 transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => saveEdit(post.id)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
                          >
                            Salvar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-100 whitespace-pre-wrap leading-relaxed">
                        {post.content}
                      </p>
                    )}
                  </div>

                  {/* Actions bar */}
                  {!isEditing && (
                    <div className="px-4 pb-3 flex items-center gap-1 border-t border-zinc-800 pt-3">
                      {/* Like */}
                      <button
                        onClick={() => toggleLike(post.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                          post.likedByMe
                            ? 'bg-pink-600/20 text-pink-400'
                            : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                        }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill={post.likedByMe ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                        {post.likes > 0 && <span>{post.likes}</span>}
                      </button>

                      {/* Comments toggle */}
                      <button
                        onClick={() => toggleComments(post.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                          isCommentsOpen
                            ? 'bg-blue-600/20 text-blue-400'
                            : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                        }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        {postComments.length > 0 && <span>{postComments.length}</span>}
                      </button>
                    </div>
                  )}

                  {/* Comments section */}
                  {isCommentsOpen && !isEditing && (
                    <div className="border-t border-zinc-800 px-4 py-3 space-y-3">
                      {/* Comment list */}
                      {postComments.length > 0 && (
                        <div className="space-y-2">
                          {postComments.map(comment => (
                            <div key={comment.id} className="flex gap-2.5">
                              <a
                                href={`/profile/${comment.username}`}
                                className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0 hover:opacity-80 transition-opacity mt-0.5"
                              >
                                {getInitials(comment.username)}
                              </a>
                              <div className="flex-1 bg-zinc-800 rounded-xl px-3 py-2">
                                <a
                                  href={`/profile/${comment.username}`}
                                  className="text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
                                >
                                  @{comment.username}
                                </a>
                                <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{comment.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Comment input */}
                      <div className="flex gap-2">
                        <input
                          value={commentInputs[post.id] || ''}
                          onChange={(e) =>
                            setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              createComment(post.id)
                            }
                          }}
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
