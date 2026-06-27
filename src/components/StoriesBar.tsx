'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import StoryViewer from './StoryViewer'
import StoryCreator from './StoryCreator'

type StoryUser = {
  user_id: string
  username: string
  avatar_url: string | null
  stories: {
    id: number
    image_url: string
    caption: string | null
    created_at: string
    music_title?: string | null
    music_artist?: string | null
    music_preview_url?: string | null
    music_artwork_url?: string | null
  }[]
  seenAll: boolean
}

// Mesmo conceito de vidro fumê do glass-card usado nos posts do feed: um blur pesado
// por baixo (aqui usando a primeira foto disponível como fonte do desfoque) e um
// degradê escurecendo de cima pra baixo por cima, pra manter contraste com o conteúdo.
const STORIES_GLASS_STYLE = `
.stories-glass {
  position: relative;
  backdrop-filter: blur(20px) saturate(130%);
  -webkit-backdrop-filter: blur(20px) saturate(130%);
  background-color: rgba(24, 24, 27, 0.6);
  isolation: isolate;
}
.stories-glass::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background-image: var(--bg-image, none);
  background-size: cover;
  background-position: center;
  filter: blur(26px) brightness(0.45) saturate(1.1);
  transform: scale(1.2);
  opacity: 0.6;
}
.stories-glass::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  background: linear-gradient(
    180deg,
    rgba(9, 9, 11, 0.35) 0%,
    rgba(9, 9, 11, 0.55) 60%,
    rgba(9, 9, 11, 0.75) 100%
  );
  pointer-events: none;
}
.stories-glass > * {
  position: relative;
  z-index: 1;
}
@keyframes ringSpin {
  to { transform: rotate(360deg); }
}
.story-ring-active {
  background: conic-gradient(from 0deg, #fbbf24, #ec4899, #a855f7, #fbbf24);
  animation: ringSpin 4s linear infinite;
}
@keyframes addPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.55); }
  50% { box-shadow: 0 0 0 5px rgba(59,130,246,0.15); }
}
.add-btn-pulse { animation: addPulse 2.2s ease-in-out infinite; }
`

export default function StoriesBar() {
  const [myId, setMyId] = useState<string | null>(null)
  const [myProfile, setMyProfile] = useState<{ username: string; avatar_url: string | null } | null>(null)
  const [groups, setGroups] = useState<StoryUser[]>([])
  const [loading, setLoading] = useState(true)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [creatorOpen, setCreatorOpen] = useState(false)

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setMyId(user.id)

    // Busca o próprio perfil sempre, independente de ter story ativo ou não — antes,
    // a foto só aparecia no botão "Seu story" quando myGroup existia (ou seja, quando
    // havia pelo menos uma story ativa). Sem nenhuma story, caía no fallback de
    // iniciais/"?" mesmo com avatar_url cadastrado.
    const { data: ownProfile } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', user.id)
      .single()

    setMyProfile(ownProfile ? { username: ownProfile.username, avatar_url: ownProfile.avatar_url } : null)

    // Quem eu sigo + eu mesmo
    const { data: followingRows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)

    const followingIds = (followingRows || []).map(r => r.following_id)
    const relevantIds = [user.id, ...followingIds]

    // Busca as stories sem depender do join embutido do Supabase (profiles(...)) —
    // esse join depende de uma foreign key explícita entre stories.user_id e profiles.id
    // estar cadastrada no schema cache do Supabase. Quando não está, o join simplesmente
    // não traz os dados e profiles vem undefined, fazendo username/avatar_url sempre
    // caírem no fallback ('?' / null). Por isso buscamos profiles à parte e montamos
    // o mapa manualmente, do mesmo jeito que o feed (page.tsx) já faz.
    const { data: stories } = await supabase
      .from('stories')
      .select('id, user_id, image_url, caption, created_at, music_title, music_artist, music_preview_url, music_artwork_url')
      .in('user_id', relevantIds)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true })

    const storyUserIds = Array.from(new Set((stories || []).map((s: any) => s.user_id)))

    const { data: profilesData } = storyUserIds.length
      ? await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', storyUserIds)
      : { data: [] as any[] }

    const profileMap = new Map<string, { username: string; avatar_url: string | null }>()
    for (const p of profilesData || []) {
      profileMap.set(p.id, { username: p.username, avatar_url: p.avatar_url })
    }

    const { data: viewedRows } = await supabase
      .from('story_views')
      .select('story_id')
      .eq('viewer_id', user.id)

    const viewedSet = new Set((viewedRows || []).map(r => r.story_id))

    const byUser = new Map<string, StoryUser>()
    for (const s of (stories || []) as any[]) {
      const uid = s.user_id
      if (!byUser.has(uid)) {
        const profile = profileMap.get(uid)
        byUser.set(uid, {
          user_id: uid,
          username: profile?.username || '?',
          avatar_url: profile?.avatar_url || null,
          stories: [],
          seenAll: true,
        })
      }
      const grp = byUser.get(uid)!
      grp.stories.push({
        id: s.id,
        image_url: s.image_url,
        caption: s.caption,
        created_at: s.created_at,
        music_title: s.music_title ?? null,
        music_artist: s.music_artist ?? null,
        music_preview_url: s.music_preview_url ?? null,
        music_artwork_url: s.music_artwork_url ?? null,
      })
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

  if (loading) {
    return (
      <>
        <style>{STORIES_GLASS_STYLE}</style>
        <div className="stories-glass flex gap-5 px-4 py-5 overflow-x-auto border-b border-white/10">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="w-[68px] h-[68px] rounded-full bg-zinc-800 animate-pulse" />
              <div className="w-12 h-2 rounded-full bg-zinc-800 animate-pulse" />
            </div>
          ))}
        </div>
      </>
    )
  }

  const myGroup = groups.find(g => g.user_id === myId)
  const otherGroups = groups.filter(g => g.user_id !== myId)

  // Usa a primeira imagem disponível (a sua, se houver, senão a de quem você segue)
  // como fonte do desfoque de fundo — mesmo truque do glass-card do feed.
  const bgImage = myGroup?.avatar_url || myProfile?.avatar_url || otherGroups.find(g => g.avatar_url)?.avatar_url || null

  return (
    <>
      <style>{STORIES_GLASS_STYLE}</style>

      <div
        className="stories-glass flex gap-5 px-4 py-5 overflow-x-auto border-b border-white/10 scrollbar-none"
        style={{ '--bg-image': bgImage ? `url(${bgImage})` : 'none' } as React.CSSProperties}
      >
        {/* Meu story / botão de adicionar */}
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <div className="relative w-[68px] h-[68px]">
            {/* Avatar: se já existe story, abre o viewer; sem story, abre direto o criador */}
            <button
              onClick={() => {
                if (myGroup) {
                  setViewerIndex(groups.findIndex(g => g.user_id === myId))
                } else {
                  setCreatorOpen(true)
                }
              }}
              className="relative w-[68px] h-[68px] rounded-full block group"
            >
              <div className={`w-full h-full rounded-full p-[2.5px] transition-transform duration-200 group-active:scale-95 ${
                myGroup && !myGroup.seenAll
                  ? 'story-ring-active'
                  : myGroup
                    ? 'bg-zinc-700'
                    : 'bg-zinc-800'
              }`}>
                <div className="w-full h-full rounded-full bg-black p-[2.5px]">
                  {(myGroup?.avatar_url || myProfile?.avatar_url) ? (
                    <img
                      src={myGroup?.avatar_url || myProfile?.avatar_url || ''}
                      alt={myGroup?.username || myProfile?.username || ''}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-emerald-400 to-teal-700 flex items-center justify-center text-sm font-bold shadow-inner">
                      {(myGroup?.username || myProfile?.username || '?').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            </button>

            {/* Botão "+": sempre abre o criador, independente de já existir story ou não.
                Fica por cima do avatar como um botão próprio, com stopPropagation pra
                garantir que o clique nele nunca dispare o onClick do avatar por baixo. */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setCreatorOpen(true)
              }}
              aria-label="Adicionar story"
              title="Adicionar story"
              className={`absolute bottom-0 right-0 w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-black flex items-center justify-center text-white text-sm font-bold leading-none shadow-lg z-10 transition-transform active:scale-90 ${!myGroup ? 'add-btn-pulse' : ''}`}
            >
              +
            </button>
          </div>
          <span className="text-[11px] font-medium text-zinc-300 max-w-[68px] truncate">Seu story</span>
        </div>

        {/* Stories de quem eu sigo */}
        {otherGroups.map((g) => (
          <button
            key={g.user_id}
            onClick={() => setViewerIndex(groups.findIndex(x => x.user_id === g.user_id))}
            className="flex flex-col items-center gap-1.5 shrink-0 group"
          >
            <div className={`w-[68px] h-[68px] rounded-full p-[2.5px] transition-transform duration-200 group-active:scale-95 ${
              g.seenAll ? 'bg-zinc-700' : 'story-ring-active'
            }`}>
              <div className="w-full h-full rounded-full bg-black p-[2.5px]">
                {g.avatar_url ? (
                  <img src={g.avatar_url} alt={g.username} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-emerald-400 to-teal-700 flex items-center justify-center text-sm font-bold shadow-inner">
                    {g.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <span className={`text-[11px] max-w-[68px] truncate ${g.seenAll ? 'text-zinc-400 font-medium' : 'text-zinc-100 font-semibold'}`}>
              {g.username}
            </span>
          </button>
        ))}
      </div>

      {viewerIndex !== null && (
        <StoryViewer
          groups={groups}
          startIndex={viewerIndex}
          myId={myId}
          onClose={() => { setViewerIndex(null); load() }}
        />
      )}

      {creatorOpen && myId && (
        <StoryCreator
          myId={myId}
          onClose={() => setCreatorOpen(false)}
          onPosted={() => load()}
        />
      )}
    </>
  )
}
