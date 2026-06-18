'use client'

import React, { useEffect, useState } from 'react'
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

export default function PerfilPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [bio, setBio] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login'; return }

    const { data: profileData } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()

    if (profileData) {
      setProfile(profileData)
      setBio(profileData.bio || '')
    }

    const { data: postsData } = await supabase
      .from('posts').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setPosts(postsData || [])
  }

  async function saveBio() {
    if (!profile) return
    setLoading(true)
    const { error } = await supabase.from('profiles').update({ bio }).eq('id', profile.id)
    setLoading(false)
    if (error) { alert(error.message); return }
    setProfile(prev => prev ? { ...prev, bio } : prev)
    alert('Bio salva!')
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    setUploading(true)

    // Remove old avatar if exists
    if (profile.avatar_url) {
      const oldPath = profile.avatar_url.split('/avatars/')[1]
      if (oldPath) await supabase.storage.from('avatars').remove([oldPath])
    }

    const ext = file.name.split('.').pop()
    const fileName = `${profile.id}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars').upload(fileName, file, { upsert: true })

    if (uploadError) {
      alert('Erro no upload: ' + uploadError.message)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName)

    const { error: updateError } = await supabase
      .from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id)

    if (updateError) {
      alert('Erro ao salvar avatar: ' + updateError.message)
      setUploading(false)
      return
    }

    setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : prev)
    setUploading(false)
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  useEffect(() => { loadProfile() }, [])

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="max-w-2xl mx-auto p-4 space-y-4">

          {/* Profile card */}
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
            <div className="flex items-start gap-5 mb-6">
              {/* Avatar */}
              <div className="relative shrink-0">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    className="w-20 h-20 rounded-full object-cover border-2 border-zinc-700"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-2xl font-bold border-2 border-zinc-700">
                    {(profile?.username || '?').slice(0, 2).toUpperCase()}
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                    <svg className="animate-spin w-5 h-5 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  </div>
                )}
                <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-600 hover:bg-emerald-500 rounded-full flex items-center justify-center cursor-pointer transition-colors border-2 border-zinc-900">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                  </svg>
                  <input type="file" accept="image/*" onChange={uploadAvatar} className="hidden" />
                </label>
              </div>

              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold truncate">@{profile?.username}</h1>
                <p className="text-zinc-400 text-sm mt-0.5">⚔️ {profile?.guilda || 'Sem guilda'}</p>
                <div className="flex gap-4 mt-3 text-sm text-zinc-400">
                  <span>📝 {posts.length} posts</span>
                </div>
              </div>

              <button
                onClick={logout}
                className="shrink-0 text-xs text-zinc-500 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-zinc-800"
              >
                Sair
              </button>
            </div>

            {/* Bio editor */}
            <div>
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full bg-zinc-800 rounded-xl p-3 mt-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                rows={3}
                placeholder="Fale sobre você..."
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={saveBio}
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                >
                  {loading ? 'Salvando…' : 'Salvar bio'}
                </button>
              </div>
            </div>
          </div>

          {/* Posts */}
          <div>
            <h2 className="text-lg font-bold mb-3 px-1">Seus posts</h2>
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
