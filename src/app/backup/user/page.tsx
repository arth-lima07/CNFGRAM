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

export default function UserPage() {
  const params = useParams()

  const username = String(params.username || '')

  const [profile, setProfile] =
    useState<Profile | null>(null)

  const [posts, setPosts] = useState<Post[]>([])

  const [followers, setFollowers] = useState(0)
  const [following, setFollowing] = useState(0)

  const [isFollowing, setIsFollowing] =
    useState(false)

  async function loadUser() {
    if (!username) return

    const {
      data: { user }
    } = await supabase.auth.getUser()

    const { data: profileData } =
      await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .maybeSingle()

    if (!profileData) return

    setProfile(profileData)

    const { data: postsData } =
      await supabase
        .from('posts')
        .select('*')
        .eq('user_id', profileData.id)
        .order('created_at', {
          ascending: false
        })

    setPosts(postsData || [])

    const { count: followersCount } =
      await supabase
        .from('follows')
        .select('*', {
          count: 'exact',
          head: true
        })
        .eq('following_id', profileData.id)

    setFollowers(followersCount || 0)

    const { count: followingCount } =
      await supabase
        .from('follows')
        .select('*', {
          count: 'exact',
          head: true
        })
        .eq('follower_id', profileData.id)

    setFollowing(followingCount || 0)

    if (user) {
      const { data: follow } =
        await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', profileData.id)
          .maybeSingle()

      setIsFollowing(!!follow)
    }
  }

  async function toggleFollow() {
    if (!profile) return

    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      alert('Faça login.')
      return
    }

    if (user.id === profile.id) {
      alert('Você não pode seguir você mesmo.')
      return
    }

    if (isFollowing) {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', profile.id)
    } else {
      await supabase
        .from('follows')
        .insert({
          follower_id: user.id,
          following_id: profile.id
        })
    }

    loadUser()
  }

  useEffect(() => {
    loadUser()
  }, [username])

  if (!profile) {
    return (
      <>
        <Navbar />

        <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
          <h1 className="text-2xl">
            Carregando perfil...
          </h1>
        </main>
      </>
    )
  }

  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="max-w-2xl mx-auto p-4">

          <div className="bg-zinc-900 rounded-xl p-6 mb-6">

            <div className="flex items-center gap-6">

              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Avatar"
                  className="w-24 h-24 rounded-full object-cover border border-zinc-700"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-zinc-700 flex items-center justify-center text-4xl">
                  👤
                </div>
              )}

              <div>
                <h1 className="text-4xl font-bold">
                  @{profile.username}
                </h1>

                <p className="text-zinc-400 mt-1">
                  ⚔️ {profile.guilda || 'Sem guilda'}
                </p>

                <div className="flex gap-6 mt-3 text-sm text-zinc-300">
                  <span>
                    👥 {followers} seguidores
                  </span>

                  <span>
                    ➡️ {following} seguindo
                  </span>
                </div>

                <button
                  onClick={toggleFollow}
                  className={`mt-4 px-5 py-2 rounded-lg font-semibold transition ${
                    isFollowing
                      ? 'bg-zinc-700 hover:bg-zinc-600'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isFollowing
                    ? 'Seguindo'
                    : 'Seguir'}
                </button>

              </div>

            </div>

            <div className="mt-6 border-t border-zinc-800 pt-6">
              <h2 className="font-bold text-lg mb-3">
                Bio
              </h2>

              <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 text-zinc-200 whitespace-pre-wrap leading-7">
                {profile.bio || 'Sem bio'}
              </div>
            </div>

          </div>

          <h2 className="text-2xl font-bold mb-4">
            Posts
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
      </main>
    </>
  )
}