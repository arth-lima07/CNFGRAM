'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'

type Profile = {
  id: string
  username: string
  bio: string
  guilda: string
  avatar_url: string | null
}

type Post = {
  id: number
  content: string
  created_at: string
}

function formatDate(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}m atrás`
  if (h < 24) return `${h}h atrás`
  if (d < 7) return `${d}d atrás`
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default function UserPage() {
  const params = useParams()
  const username = String(params.username || '')

  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [followers, setFollowers] = useState(0)
  const [following, setFollowing] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)
  const [isOwnProfile, setIsOwnProfile] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  async function loadUser() {
    if (!username) return

    const { data: { user } } = await supabase.auth.getUser()

    const { data: profileData } = await supabase
      .from('profiles').select('*').eq('username', username).maybeSingle()

    if (!profileData) return

    setProfile(profileData)
    setIsOwnProfile(user?.id === profileData.id)

    const { data: postsData } = await supabase
      .from('posts').select('*').eq('user_id', profileData.id)
      .order('created_at', { ascending: false })

    setPosts(postsData || [])

    const [{ count: followersCount }, { count: followingCount }] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profileData.id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profileData.id),
    ])

    setFollowers(followersCount || 0)
    setFollowing(followingCount || 0)

    if (user) {
      const { data: follow } = await supabase
        .from('follows').select('id')
        .eq('follower_id', user.id).eq('following_id', profileData.id)
        .maybeSingle()
      setIsFollowing(!!follow)
    }
  }

  async function toggleFollow() {
    if (!profile) return
    setFollowLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('Faça login.'); setFollowLoading(false); return }
    if (user.id === profile.id) { alert('Você não pode seguir você mesmo.'); setFollowLoading(false); return }

    if (isFollowing) {
      await supabase.from('follows').delete()
        .eq('follower_id', user.id).eq('following_id', profile.id)
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: profile.id })
    }

    await loadUser()
    setFollowLoading(false)
  }

  useEffect(() => { loadUser() }, [username])

  if (!profile) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-zinc-500">
            <svg className="animate-spin w-6 h-6" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <span className="text-sm">Carregando perfil…</span>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="max-w-2xl mx-auto p-4 space-y-4">

          {/* Profile card */}
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
            <div className="flex items-start gap-5">
              {/* Avatar */}
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.username}
                  className="w-20 h-20 rounded-full object-cover border-2 border-zinc-700 shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-2xl font-bold border-2 border-zinc-700 shrink-0">
                  {(profile.username || '?').slice(0, 2).toUpperCase()}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold truncate">@{profile.username}</h1>
                <p className="text-zinc-400 text-sm mt-0.5">⚔️ {profile.guilda || 'Sem guilda'}</p>

                {/* Stats */}
                <div className="flex gap-5 mt-3 text-sm">
                  <div className="text-center">
                    <span className="font-bold text-white">{posts.length}</span>
                    <span className="text-zinc-500 ml-1">posts</span>
                  </div>
                  <div className="text-center">
                    <span className="font-bold text-white">{followers}</span>
                    <span className="text-zinc-500 ml-1">seguidores</span>
                  </div>
                  <div className="text-center">
                    <span className="font-bold text-white">{following}</span>
                    <span className="text-zinc-500 ml-1">seguindo</span>
                  </div>
                </div>

                {/* Follow button — only for others */}
                {!isOwnProfile && (
                  <button
                    onClick={toggleFollow}
                    disabled={followLoading}
                    className={`mt-4 px-5 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                      isFollowing
                        ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {followLoading ? '…' : isFollowing ? 'Seguindo' : 'Seguir'}
                  </button>
                )}

                {isOwnProfile && (
                  <a
                    href="/profile"
                    className="inline-block mt-4 px-5 py-2 rounded-xl text-sm font-semibold bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors"
                  >
                    Editar perfil
                  </a>
                )}
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <div className="mt-5 pt-5 border-t border-zinc-800">
                <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{profile.bio}</p>
              </div>
            )}
          </div>

          {/* Posts */}
          <div>
            <h2 className="text-base font-bold mb-3 px-1 text-zinc-400 uppercase tracking-wider text-xs">Posts</h2>
            {posts.length === 0 ? (
              <div className="text-center py-12 text-zinc-600">
                <p className="text-3xl mb-2">📝</p>
                <p className="text-sm">Nenhum post ainda.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <div key={post.id} className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
                    <p className="text-sm text-zinc-100 whitespace-pre-wrap leading-relaxed">{post.content}</p>
                    <p className="text-xs text-zinc-500 mt-3">{formatDate(post.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </>
  )
}
