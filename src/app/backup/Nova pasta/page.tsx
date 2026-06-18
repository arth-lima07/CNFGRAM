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

export default function PerfilPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [bio, setBio] = useState('')
  const [loading, setLoading] = useState(false)

  async function loadProfile() {
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/login'
      return
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileData) {
      setProfile(profileData)
      setBio(profileData.bio || '')
    }

    const { data: postsData } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setPosts(postsData || [])
  }

  async function saveBio() {
    if (!profile) return

    setLoading(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        bio
      })
      .eq('id', profile.id)

    setLoading(false)

    if (error) {
      alert(error.message)
      return
    }

    alert('Bio salva com sucesso!')
  }

  async function uploadAvatar(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0]

    if (!file || !profile) return

    const fileName = `${profile.id}-${Date.now()}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file)

    if (uploadError) {
      alert(
        'ERRO NO UPLOAD:\n\n' +
        JSON.stringify(uploadError, null, 2)
      )
      return
    }

    const {
      data: { publicUrl }
    } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName)

    console.log('PUBLIC URL:', publicUrl)

    const { data, error } = await supabase
      .from('profiles')
      .update({
        avatar_url: publicUrl
      })
      .eq('id', profile.id)
      .select()

    console.log('UPDATE DATA:', data)
    console.log('UPDATE ERROR:', error)

    if (error) {
      alert(
        'ERRO AO SALVAR AVATAR:\n\n' +
        JSON.stringify(error, null, 2)
      )
      return
    }

    await loadProfile()

    alert('Avatar atualizado!')
  }

  useEffect(() => {
    loadProfile()
  }, [])

  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="max-w-2xl mx-auto p-4">

          <div className="bg-zinc-900 rounded-xl p-6 mb-6">

            <div className="flex items-center gap-4 mb-4">

              <div className="flex flex-col items-center">

                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    className="w-20 h-20 rounded-full object-cover border border-zinc-700"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-zinc-700 flex items-center justify-center text-3xl">
                    👤
                  </div>
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={uploadAvatar}
                  className="mt-2 text-xs"
                />

              </div>

              <div>
                <h1 className="text-2xl font-bold">
                  @{profile?.username}
                </h1>

                <p className="text-zinc-400">
                  ⚔️ {profile?.guilda || 'Sem guilda'}
                </p>
              </div>

            </div>

            <div className="mb-4">
              <p className="font-semibold mb-2">
                Bio
              </p>

              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full bg-zinc-800 rounded p-3"
                rows={3}
              />
            </div>

            <button
              onClick={saveBio}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
            >
              {loading ? 'Salvando...' : 'Salvar Bio'}
            </button>

          </div>

          <div className="bg-zinc-900 rounded-xl p-4 mb-4">
            <h2 className="text-xl font-bold">
              Estatísticas
            </h2>

            <div className="mt-3">
              📝 Posts: {posts.length}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-4">
              Seus Posts
            </h2>

            <div className="space-y-4">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="bg-zinc-900 rounded-xl p-4"
                >
                  <p className="whitespace-pre-wrap">
                    {post.content}
                  </p>

                  <p className="text-zinc-500 text-sm mt-3">
                    {new Date(
                      post.created_at
                    ).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </>
  )
}