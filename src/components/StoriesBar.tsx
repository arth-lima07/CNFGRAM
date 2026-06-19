'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import StoryViewer from './StoryViewer'

type StoryUser = {
  user_id: string
  username: string
  avatar_url: string | null
  stories: {
    id: number
    image_url: string
    caption: string | null
    created_at: string
  }[]
  seenAll: boolean
}

export default function StoriesBar() {
  const [myId, setMyId] = useState<string | null>(null)
  const [groups, setGroups] = useState<StoryUser[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setMyId(user.id)

    // Quem eu sigo + eu mesmo
    const { data: followingRows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)

    const followingIds = (followingRows || []).map(r => r.following_id)
    const relevantIds = [user.id, ...followingIds]

    const { data: stories } = await supabase
      .from('stories')
      .select('id, user_id, image_url, caption, created_at, profiles(username, avatar_url)')
      .in('user_id', relevantIds)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true })

    const { data: viewedRows } = await supabase
      .from('story_views')
      .select('story_id')
      .eq('viewer_id', user.id)

    const viewedSet = new Set((viewedRows || []).map(r => r.story_id))

    const byUser = new Map<string, StoryUser>()
    for (const s of (stories || []) as any[]) {
      const uid = s.user_id
      if (!byUser.has(uid)) {
        byUser.set(uid, {
          user_id: uid,
          username: s.profiles?.username || '?',
          avatar_url: s.profiles?.avatar_url || null,
          stories: [],
          seenAll: true,
        })
      }
      const grp = byUser.get(uid)!
      grp.stories.push({ id: s.id, image_url: s.image_url, caption: s.caption, created_at: s.created_at })
      if (!viewedSet.has(s.id)) grp.seenAll = false
    }

    // Eu primeiro, depois quem eu sigo (não vistos primeiro)
    const arr = Array.from(byUser.values())
    arr.sort((a, b) => {
      if (a.user_id === user.id) return -1
      if (b.user_id === user.id) return 1
      return Number(a.seenAll) - Number(b.seenAll)
    })

    setGroups(arr)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !myId) return
    setUploading(true)

    const ext = file.name.split('.').pop()
    const path = `${myId}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('stories')
      .upload(path, file, { contentType: file.type })

    if (uploadError) {
      alert('Erro ao enviar story: ' + uploadError.message)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('stories').getPublicUrl(path)

    const { error: insertError } = await supabase.from('stories').insert({
      user_id: myId,
      image_url: urlData.publicUrl,
    })

    if (insertError) {
      alert('Erro ao salvar story: ' + insertError.message)
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    load()
  }

  if (loading) {
    return (
      <div className="flex gap-4 px-4 py-4 overflow-x-auto">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1 shrink-0">
            <div className="w-16 h-16 rounded-full bg-zinc-800 animate-pulse" />
            <div className="w-12 h-2 rounded bg-zinc-800 animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  const myGroup = groups.find(g => g.user_id === myId)
  const otherGroups = groups.filter(g => g.user_id !== myId)

  return (
    <>
      <div className="flex gap-4 px-4 py-4 overflow-x-auto border-b border-zinc-800 scrollbar-none">
        {/* Meu story / botão de adicionar */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <button
            onClick={() => {
              if (myGroup) {
                setViewerIndex(groups.findIndex(g => g.user_id === myId))
              } else {
                fileInputRef.current?.click()
              }
            }}
            className="relative w-16 h-16 rounded-full"
          >
            <div className={`w-16 h-16 rounded-full p-[2px] ${
              myGroup && !myGroup.seenAll
                ? 'bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600'
                : myGroup
                  ? 'bg-zinc-700'
                  : 'bg-transparent'
            }`}>
              <div className="w-full h-full rounded-full bg-black p-[2px]">
                {myGroup?.avatar_url ? (
                  <img src={myGroup.avatar_url} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-sm font-bold">
                    {(myGroup?.username || '?').slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-blue-500 border-2 border-black flex items-center justify-center text-white text-xs leading-none">
              {uploading ? '…' : '+'}
            </span>
          </button>
          <span className="text-[11px] text-zinc-400 max-w-[64px] truncate">Seu story</span>
        </div>

        {/* Stories de quem eu sigo */}
        {otherGroups.map((g) => (
          <button
            key={g.user_id}
            onClick={() => setViewerIndex(groups.findIndex(x => x.user_id === g.user_id))}
            className="flex flex-col items-center gap-1 shrink-0"
          >
            <div className={`w-16 h-16 rounded-full p-[2px] ${
              g.seenAll ? 'bg-zinc-700' : 'bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600'
            }`}>
              <div className="w-full h-full rounded-full bg-black p-[2px]">
                {g.avatar_url ? (
                  <img src={g.avatar_url} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-sm font-bold">
                    {g.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <span className="text-[11px] text-zinc-400 max-w-[64px] truncate">{g.username}</span>
          </button>
        ))}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {viewerIndex !== null && (
        <StoryViewer
          groups={groups}
          startIndex={viewerIndex}
          myId={myId}
          onClose={() => { setViewerIndex(null); load() }}
        />
      )}
    </>
  )
}
