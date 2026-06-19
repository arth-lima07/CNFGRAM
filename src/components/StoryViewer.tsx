'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

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

const STORY_DURATION = 5000 // ms por story

export default function StoryViewer({
  groups,
  startIndex,
  myId,
  onClose,
}: {
  groups: StoryUser[]
  startIndex: number
  myId: string | null
  onClose: () => void
}) {
  const [groupIndex, setGroupIndex] = useState(startIndex)
  const [storyIndex, setStoryIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)

  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number>(0)
  const elapsedRef = useRef<number>(0)

  const group = groups[groupIndex]
  const story = group?.stories[storyIndex]
  const isMine = group?.user_id === myId

  function markViewed(storyId: number) {
    if (!myId || isMine) return
    supabase.from('story_views').upsert({ story_id: storyId, viewer_id: myId }, { onConflict: 'story_id,viewer_id' }).then(() => {})
  }

  function goNextStory() {
    if (!group) return
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex(i => i + 1)
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex(i => i + 1)
      setStoryIndex(0)
    } else {
      onClose()
    }
  }

  function goPrevStory() {
    if (!group) return
    if (storyIndex > 0) {
      setStoryIndex(i => i - 1)
    } else if (groupIndex > 0) {
      const prevGroup = groups[groupIndex - 1]
      setGroupIndex(i => i - 1)
      setStoryIndex(prevGroup.stories.length - 1)
    }
  }

  async function deleteStory() {
    if (!story || !isMine) return
    if (!confirm('Apagar este story?')) return
    await supabase.from('stories').delete().eq('id', story.id)
    if (group.stories.length === 1) {
      onClose()
    } else {
      goNextStory()
    }
  }

  // Progresso / autoplay
  useEffect(() => {
    if (!story) return
    setProgress(0)
    elapsedRef.current = 0
    markViewed(story.id)

    function tick(ts: number) {
      if (paused) {
        startRef.current = ts
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      if (!startRef.current) startRef.current = ts
      const delta = ts - startRef.current
      startRef.current = ts
      elapsedRef.current += delta
      const pct = Math.min(100, (elapsedRef.current / STORY_DURATION) * 100)
      setProgress(pct)
      if (pct >= 100) {
        goNextStory()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    startRef.current = 0
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [groupIndex, storyIndex, paused])

  // Teclado
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') goNextStory()
      if (e.key === 'ArrowLeft') goPrevStory()
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!group || !story) return null

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
      <div className="relative w-full h-full max-w-md mx-auto flex flex-col">

        {/* Barras de progresso */}
        <div className="absolute top-2 left-2 right-2 flex gap-1 z-20">
          {group.stories.map((s, i) => (
            <div key={s.id} className="flex-1 h-[2px] bg-white/30 rounded overflow-hidden">
              <div
                className="h-full bg-white"
                style={{
                  width: i < storyIndex ? '100%' : i === storyIndex ? `${progress}%` : '0%',
                  transition: i === storyIndex ? 'none' : undefined,
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 left-2 right-2 flex items-center justify-between z-20 px-2">
          <div className="flex items-center gap-2">
            {group.avatar_url ? (
              <img src={group.avatar_url} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-xs font-bold">
                {group.username.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="text-white text-sm font-semibold">{group.username}</span>
          </div>
          <div className="flex items-center gap-3">
            {isMine && (
              <button onClick={deleteStory} className="text-white/80 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4a2 2 0 012-2h0a2 2 0 012 2v2"/>
                </svg>
              </button>
            )}
            <button onClick={onClose} className="text-white/80 hover:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Imagem + áreas de toque */}
        <div className="flex-1 relative overflow-hidden">
          <img
            src={story.image_url}
            className="w-full h-full object-contain bg-black"
            onMouseDown={() => setPaused(true)}
            onMouseUp={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
          />
          <button
            aria-label="Anterior"
            onClick={goPrevStory}
            className="absolute left-0 top-0 w-1/3 h-full"
          />
          <button
            aria-label="Próximo"
            onClick={goNextStory}
            className="absolute right-0 top-0 w-2/3 h-full"
          />

          {story.caption && (
            <div className="absolute bottom-4 left-4 right-4 z-20">
              <p className="text-white text-sm bg-black/40 rounded-xl px-3 py-2 backdrop-blur-sm">
                {story.caption}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
