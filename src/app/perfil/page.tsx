'use client'

import React, { useEffect, useRef, useState } from 'react'
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

// Extrai paleta de cores dominantes de uma imagem via canvas
function extractColors(imgEl: HTMLImageElement): Promise<string[]> {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 50
      canvas.height = 50
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(['#18181b', '#27272a'])
      ctx.drawImage(imgEl, 0, 0, 50, 50)
      const data = ctx.getImageData(0, 0, 50, 50).data

      // Agrupa pixels em blocos e pega os tons mais frequentes
      const buckets: Record<string, number> = {}
      for (let i = 0; i < data.length; i += 4) {
        const r = Math.round(data[i] / 32) * 32
        const g = Math.round(data[i + 1] / 32) * 32
        const b = Math.round(data[i + 2] / 32) * 32
        const key = `${r},${g},${b}`
        buckets[key] = (buckets[key] || 0) + 1
      }

      const sorted = Object.entries(buckets)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([k]) => {
          const [r, g, b] = k.split(',')
          // Escurece cada cor para ficar mais elegante como banner
          const dr = Math.max(0, parseInt(r) - 40)
          const dg = Math.max(0, parseInt(g) - 40)
          const db = Math.max(0, parseInt(b) - 40)
          return `rgb(${dr},${dg},${db})`
        })

      resolve(sorted.length >= 2 ? sorted : ['#18181b', '#27272a'])
    } catch {
      resolve(['#18181b', '#27272a'])
    }
  })
}

export default function PerfilPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [bio, setBio] = useState('')
  const [guilda, setGuilda] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [bannerColors, setBannerColors] = useState<string[]>(['#18181b', '#27272a'])
  const imgRef = useRef<HTMLImageElement | null>(null)

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login'; return }

    const { data: profileData } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()

    if (profileData) {
      setProfile(profileData)
      setBio(profileData.bio || '')
      setGuilda(profileData.guilda || '')
    }

    const { data: postsData } = await supabase
      .from('posts').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setPosts(postsData || [])
  }

  async function saveProfile() {
    if (!profile) return
    setLoading(true)
    const { error } = await supabase
      .from('profiles')
      .update({ bio, guilda })
      .eq('id', profile.id)
    setLoading(false)
    if (error) { alert(error.message); return }
    setProfile(prev => prev ? { ...prev, bio, guilda } : prev)
    alert('Perfil salvo!')
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    setUploading(true)

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

  // Extrai cores quando o avatar carrega
  function handleImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    extractColors(e.currentTarget).then(setBannerColors)
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  useEffect(() => { loadProfile() }, [])

  const bannerGradient = bannerColors.length >= 2
    ? `linear-gradient(135deg, ${bannerColors[0]} 0%, ${bannerColors[1]} 50%, ${bannerColors[2] ?? bannerColors[0]} 100%)`
    : 'linear-gradient(135deg, #18181b 0%, #27272a 100%)'

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="max-w-2xl mx-auto p-4 space-y-4">

          {/* Profile card */}
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">

            {/* Banner com cores extraídas da foto */}
            <div
              className="h-32 w-full transition-all duration-700"
              style={{ background: bannerGradient }}
            />

            {/* Avatar sobreposto ao banner */}
            <div className="px-6 pb-6">
              <div className="flex items-end justify-between -mt-12 mb-4">
                <div className="relative">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      ref={imgRef}
                      onLoad={handleImgLoad}
                      crossOrigin="anonymous"
                      className="w-24 h-24 rounded-full object-cover border-4 border-zinc-900 shadow-xl"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-3xl font-bold border-4 border-zinc-900 shadow-xl">
                      {(profile?.username || '?').slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  {uploading && (
                    <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center border-4 border-zinc-900">
                      <svg className="animate-spin w-6 h-6 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                    </div>
                  )}

                  {/* Botão de câmera */}
                  <label className="absolute bottom-0 right-0 w-8 h-8 bg-emerald-600 hover:bg-emerald-500 rounded-full flex items-center justify-center cursor-pointer transition-colors border-2 border-zinc-900 shadow-md">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                    <input type="file" accept="image/*" onChange={uploadAvatar} className="hidden" />
                  </label>
                </div>

                <button
                  onClick={logout}
                  className="text-xs text-zinc-500 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-zinc-800 border border-zinc-700 mb-1"
                >
                  Sair
                </button>
              </div>

              {/* Nome e stats */}
              <h1 className="text-xl font-bold">@{profile?.username}</h1>
              <p className="text-zinc-400 text-sm mt-0.5">⚔️ {profile?.guilda || 'Sem guilda'}</p>
              <div className="flex gap-4 mt-3 text-sm text-zinc-400">
                <span>📝 {posts.length} posts</span>
              </div>
            </div>

            {/* Formulário de edição */}
            <div className="px-6 pb-6 border-t border-zinc-800 pt-5 space-y-4">

              {/* Guilda */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  ⚔️ Guilda
                </label>
                <input
                  type="text"
                  value={guilda}
                  onChange={(e) => setGuilda(e.target.value)}
                  className="w-full bg-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 border border-zinc-700"
                  placeholder="Nome da sua guilda..."
                  maxLength={40}
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full bg-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none border border-zinc-700"
                  rows={3}
                  placeholder="Fale sobre você..."
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={saveProfile}
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
                >
                  {loading ? 'Salvando…' : 'Salvar perfil'}
                </button>
              </div>
            </div>
          </div>

          {/* Posts */}
          <div>
            <h2 className="text-base font-bold mb-3 px-1 text-zinc-400 uppercase tracking-wider text-xs">Seus posts</h2>
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
