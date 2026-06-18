'use client'
import Navbar from '@/components/Navbar'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Comment = {
  id: number
  username: string
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

  const [comments, setComments] = useState<
    Record<number, Comment[]>
  >({})

  const [commentInputs, setCommentInputs] = useState<
    Record<number, string>
  >({})

  async function loadPosts() {
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) return
  const [currentUserId, setCurrentUserId] =
  useState('')

const [editingPostId, setEditingPostId] =
  useState<number | null>(null)

const [editingContent, setEditingContent] =
  useState('')

  const { data: follows } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id)

  const followingIds =
    follows?.map(f => f.following_id) || []

  followingIds.push(user.id)

  const { data: postsData, error } =
    await supabase
      .from('posts')
      .select('*')
      .in('user_id', followingIds)
      .order('created_at', {
        ascending: false
      })

  if (error) {
    console.error(error)
    return
  }

  const postsWithLikes = await Promise.all(
    (postsData || []).map(async (post) => {
      const { count } = await supabase
        .from('likes')
        .select('*', {
          count: 'exact',
          head: true
        })
        .eq('post_id', post.id)

      let likedByMe = false

      if (user) {
        const { data: existingLike } =
          await supabase
            .from('likes')
            .select('id')
            .eq('post_id', post.id)
            .eq('user_id', user.id)
            .maybeSingle()

        likedByMe = !!existingLike
      }

      await loadComments(post.id)

      return {
        ...post,
        likes: count || 0,
        likedByMe
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

    setComments(prev => ({
      ...prev,
      [postId]: data || []
    }))
  }

  async function createComment(postId: number) {
    const text = commentInputs[postId]

    if (!text?.trim()) return

    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()

    await supabase
      .from('comments')
      .insert({
        post_id: postId,
        user_id: user.id,
        username: profile?.username || 'Usuário',
        content: text
      })

    setCommentInputs(prev => ({
      ...prev,
      [postId]: ''
    }))

    await loadComments(postId)
  }

  async function createPost() {
    if (!content.trim()) return

    setLoading(true)

    const {
      data: { user }
    } = await supabase.auth.getUser()

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

    const { error } = await supabase
      .from('posts')
      .insert({
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
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      alert('Faça login.')
      return
    }

    const { data: existingLike } = await supabase
      .from('likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingLike) {
      await supabase
        .from('likes')
        .delete()
        .eq('id', existingLike.id)
    } else {
      await supabase
        .from('likes')
        .insert({
          post_id: postId,
          user_id: user.id
        })
    }

    await loadPosts()
  }
  async function deletePost(postId: number) {
  const confirmDelete = confirm(
    'Deseja apagar este post?'
  )

  if (!confirmDelete) return

  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)

  if (error) {
    alert(error.message)
    return
  }

  await loadPosts()
}

async function startEdit(post: Post) {
  setEditingPostId(post.id)
  setEditingContent(post.content)
}

async function saveEdit(postId: number) {
  if (!editingContent.trim()) return

  const { error } = await supabase
    .from('posts')
    .update({
      content: editingContent
    })
    .eq('id', postId)

  if (error) {
    alert(error.message)
    return
  }

  setEditingPostId(null)
  setEditingContent('')

  await loadPosts()
}

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  useEffect(() => {
    loadPosts()
  }, [])

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-2xl mx-auto">
        <div className="p-4 flex justify-between items-center">
          <Navbar />

          <button
            onClick={logout}
            className="bg-red-600 px-3 py-2 rounded"
          >
            Sair
          </button>
        </div>

        <div className="p-4">
          <div className="bg-zinc-900 p-4 rounded-xl mb-6">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="O que está acontecendo na sua guilda?"
              className="w-full bg-zinc-800 rounded p-3"
              rows={4}
            />

            <button
              onClick={createPost}
              disabled={loading}
              className="mt-3 bg-green-600 px-4 py-2 rounded"
            >
              {loading ? 'Publicando...' : 'Publicar'}
            </button>
          </div>

          <div className="space-y-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className="bg-zinc-900 p-4 rounded-xl"
              >
                <div className="mb-3">
                  <h3 className="font-bold text-lg">
                    @{post.username}
                  </h3>

                  <p className="text-xs text-zinc-500">
                    {new Date(post.created_at).toLocaleString()}
                  </p>
                </div>

                <p className="text-zinc-100 whitespace-pre-wrap mb-4">
                  {post.content}
                </p>

                <button
                  onClick={() => toggleLike(post.id)}
                  className={`px-3 py-2 rounded transition ${
                    post.likedByMe
                      ? 'bg-pink-600'
                      : 'bg-zinc-800'
                  }`}
                >
                  ❤️ {post.likes}
                </button>

                <div className="mt-4 border-t border-zinc-800 pt-4">
                  <div className="space-y-2 mb-3">
                    {(comments[post.id] || []).map(comment => (
                      <div
                        key={comment.id}
                        className="bg-zinc-800 p-2 rounded"
                      >
                        <strong>
                          @{comment.username}
                        </strong>

                        <p>
                          {comment.content}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={
                        commentInputs[post.id] || ''
                      }
                      onChange={(e) =>
                        setCommentInputs(prev => ({
                          ...prev,
                          [post.id]: e.target.value
                        }))
                      }
                      placeholder="Comentar..."
                      className="flex-1 bg-zinc-800 p-2 rounded"
                    />

                    <button
                      onClick={() =>
                        createComment(post.id)
                      }
                      className="bg-blue-600 px-3 rounded"
                    >
                      💬
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </main>
  )
}