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
  const username = decodeURIComponent(String(params.username || ''))

  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [followers, setFollowers] = useState(0)
  const [following, setFollowing] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)
  const [theyFollowMe, setTheyFollowMe] = useState(false)
  const [isOwnProfile, setIsOwnProfile] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [modal, setModal] = useState<'followers' | 'following' | null>(null)
  const [modalUsers, setModalUsers] = useState<{ id: string; username: string; avatar_url: string | null }[]>([])
  const [modalLoading, setModalLoading] = useState(false)

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
      const [{ data: iFollow }, { data: theyFollow }] = await Promise.all([
        supabase.from('follows').select('id')
          .eq('follower_id', user.id).eq('following_id', profileData.id)
          .maybeSingle(),
        supabase.from('follows').select('id')
          .eq('follower_id', profileData.id).eq('following_id', user.id)
          .maybeSingle(),
      ])
      setIsFollowing(!!iFollow)
      setTheyFollowMe(!!theyFollow)
    }
  }

  async function openModal(type: 'followers' | 'following') {
    if (!profile) return
    setModal(type)
    setModalLoading(true)
    setModalUsers([])

    let ids: string[] = []

    if (type === 'followers') {
      const { data } = await supabase
        .from('follows').select('follower_id').eq('following_id', profile.id)
      ids = (data || []).map((r: { follower_id: string }) => r.follower_id)
    } else {
      const { data } = await supabase
        .from('follows').select('following_id').eq('follower_id', profile.id)
      ids = (data || []).map((r: { following_id: string }) => r.following_id)
    }

    if (ids.length === 0) { setModalLoading(false); return }

    const { data: users } = await supabase
      .from('profiles').select('id, username, avatar_url').in('id', ids)

    setModalUsers(users || [])
    setModalLoading(false)
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

  function handleMessageClick() {
    if (!profile) return
    const canMessage = isFollowing && theyFollowMe
    if (!canMessage) {
      alert('Vocês precisam se seguir mutuamente para trocar mensagens.')
      return
    }
    window.location.href = `/messages/${profile.id}`
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

  const canMessage = isFollowing && theyFollowMe

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
                  <button onClick={() => openModal('followers')} className="text-center hover:opacity-70 transition-opacity">
                    <span className="font-bold text-white">{followers}</span>
                    <span className="text-zinc-500 ml-1">seguidores</span>
                  </button>
                  <button onClick={() => openModal('following')} className="text-center hover:opacity-70 transition-opacity">
                    <span className="font-bold text-white">{following}</span>
                    <span className="text-zinc-500 ml-1">seguindo</span>
                  </button>
                </div>

                {/* Botões — só para outros perfis */}
                {!isOwnProfile && (
                  <div className="flex items-center gap-2 mt-4">
                    <button
                      onClick={toggleFollow}
                      disabled={followLoading}
                      className={`px-5 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                        isFollowing
                          ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      {followLoading ? '…' : isFollowing ? 'Seguindo' : 'Seguir'}
                    </button>

                    <button
                      onClick={handleMessageClick}
                      title={!canMessage ? 'Vocês precisam se seguir mutuamente para trocar mensagens' : 'Enviar mensagem'}
                      className={`px-5 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                        canMessage
                          ? 'bg-blue-600 hover:bg-blue-500 text-white'
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
                      </svg>
                      Mensagem
                      {!canMessage && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2"/>
                          <path d="M7 11V7a5 5 0 0110 0v4"/>
                        </svg>
                      )}
                    </button>
                  </div>
                )}

                {!isOwnProfile && !canMessage && (
                  <p className="text-xs text-zinc-500 mt-2">
                    Sigam-se mutuamente para trocar mensagens.
                  </p>
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

      {/* Followers / Following modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setModal(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <h3 className="font-semibold text-white">
                {modal === 'followers' ? 'Seguidores' : 'Seguindo'}
              </h3>
              <button onClick={() => setModal(null)} className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="max-h-72 overflow-y-auto divide-y divide-zinc-800">
              {modalLoading ? (
                <div className="flex items-center justify-center py-10 gap-2 text-zinc-500 text-sm">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Carregando…
                </div>
              ) : modalUsers.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 text-sm">Nenhum usuário ainda.</div>
              ) : (
                modalUsers.map(u => (
                  <a key={u.id} href={`/u/${encodeURIComponent(u.username)}`} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-800 transition-colors">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt={u.username} className="w-9 h-9 rounded-full object-cover border border-zinc-700 shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-sm font-bold border border-zinc-700 shrink-0">
                        {u.username.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-medium text-zinc-100">@{u.username}</span>
                  </a>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
