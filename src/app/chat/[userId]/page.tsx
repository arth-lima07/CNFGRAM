'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Message = {
  id: number
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
  read: boolean
  shared_post_id: number | null
}

type SharedPost = {
  id: number
  username: string
  avatar_url: string | null
  content: string
  image_url: string | null
  image_urls: string[]
}

type Profile = {
  id: string
  username: string
  avatar_url: string | null
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function groupByDate(messages: Message[]) {
  const groups: { date: string; messages: Message[] }[] = []
  let currentDate = ''

  for (const msg of messages) {
    const date = new Date(msg.created_at).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric'
    })
    if (date !== currentDate) {
      currentDate = date
      groups.push({ date, messages: [msg] })
    } else {
      groups[groups.length - 1].messages.push(msg)
    }
  }
  return groups
}

export default function ConversationPage() {
  const params = useParams()
  const otherId = String(params.userId || '')

  const [myId, setMyId] = useState<string | null>(null)
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [sharedPosts, setSharedPosts] = useState<Record<number, SharedPost>>({})
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [canMessage, setCanMessage] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  async function loadSharedPosts(msgs: Message[]) {
    const postIds = [...new Set(msgs.filter(m => m.shared_post_id).map(m => m.shared_post_id as number))]
    const missingIds = postIds.filter(id => !sharedPosts[id])
    if (missingIds.length === 0) return

    const { data: postsData } = await supabase
      .from('posts')
      .select('id, user_id, content, image_url, image_urls')
      .in('id', missingIds)

    if (!postsData || postsData.length === 0) return

    const userIds = [...new Set(postsData.map(p => p.user_id))]
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds)

    const profileMap: Record<string, { username: string; avatar_url: string | null }> = {}
    for (const p of profilesData || []) profileMap[p.id] = { username: p.username, avatar_url: p.avatar_url }

    const newMap: Record<number, SharedPost> = {}
    for (const p of postsData) {
      const imageUrls: string[] = p.image_urls?.length ? p.image_urls : p.image_url ? [p.image_url] : []
      newMap[p.id] = {
        id: p.id,
        username: profileMap[p.user_id]?.username || '?',
        avatar_url: profileMap[p.user_id]?.avatar_url ?? null,
        content: p.content || '',
        image_url: p.image_url ?? null,
        image_urls: imageUrls,
      }
    }
    setSharedPosts(prev => ({ ...prev, ...newMap }))
  }

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login'; return }
    setMyId(user.id)

    // Check mutual follow
    const [{ data: iFollow }, { data: theyFollow }] = await Promise.all([
      supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', otherId).maybeSingle(),
      supabase.from('follows').select('id').eq('follower_id', otherId).eq('following_id', user.id).maybeSingle(),
    ])
    setCanMessage(!!(iFollow && theyFollow))

    const { data: profile } = await supabase
      .from('profiles').select('id, username, avatar_url').eq('id', otherId).maybeSingle()
    setOtherProfile(profile)

    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })

    setMessages(msgs || [])
    if (msgs && msgs.length > 0) loadSharedPosts(msgs)

    // Mark messages as read
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('sender_id', otherId)
      .eq('receiver_id', user.id)
      .eq('read', false)
  }

  async function sendMessage() {
    if (!text.trim() || !myId || sending) return
    setSending(true)

    const { data, error } = await supabase.from('messages').insert({
      sender_id: myId,
      receiver_id: otherId,
      content: text.trim(),
      read: false,
    }).select().single()

    if (!error && data) {
      setMessages(prev => [...prev, data])
      setText('')
    }
    setSending(false)
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Real-time subscription
  useEffect(() => {
    if (!myId) return

    const channel = supabase
      .channel(`messages-${myId}-${otherId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${myId}`,
      }, (payload) => {
        const msg = payload.new as Message
        if (msg.sender_id === otherId) {
          setMessages(prev => [...prev, msg])
          if (msg.shared_post_id) loadSharedPosts([msg])
          supabase.from('messages').update({ read: true }).eq('id', msg.id)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [myId, otherId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => { load() }, [otherId])

  const grouped = groupByDate(messages)

  return (
    <div className="flex flex-col h-screen bg-black text-white">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-black shrink-0">
        <button
          onClick={() => window.history.back()}
          className="text-zinc-400 hover:text-white transition-colors mr-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <a href={otherProfile ? `/user/${otherProfile.username}` : '#'} className="flex items-center gap-3 flex-1 min-w-0">
          {otherProfile?.avatar_url ? (
            <img src={otherProfile.avatar_url} alt={otherProfile.username} className="w-9 h-9 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-sm font-bold shrink-0">
              {(otherProfile?.username || '?').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{otherProfile?.username || '…'}</p>
          </div>
        </a>

        <a href={otherProfile ? `/user/${otherProfile.username}` : '#'} className="text-zinc-400 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </a>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {grouped.map((group) => (
          <div key={group.date}>
            {/* Date separator */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-zinc-800" />
              <span className="text-xs text-zinc-500 shrink-0">{group.date}</span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>

            <div className="space-y-1">
              {group.messages.map((msg, i) => {
                const isMe = msg.sender_id === myId
                const prev = group.messages[i - 1]
                const next = group.messages[i + 1]
                const samePrev = prev?.sender_id === msg.sender_id
                const sameNext = next?.sender_id === msg.sender_id

                const br = isMe
                  ? `${samePrev ? 'rounded-tr-sm' : 'rounded-tr-2xl'} ${sameNext ? 'rounded-br-sm' : 'rounded-br-2xl'} rounded-tl-2xl rounded-bl-2xl`
                  : `${samePrev ? 'rounded-tl-sm' : 'rounded-tl-2xl'} ${sameNext ? 'rounded-bl-sm' : 'rounded-bl-2xl'} rounded-tr-2xl rounded-br-2xl`

                const sharedPost = msg.shared_post_id ? sharedPosts[msg.shared_post_id] : null

                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[72%] text-sm leading-relaxed ${br} ${
                      msg.shared_post_id ? 'overflow-hidden' : 'px-4 py-2.5'
                    } ${
                      isMe
                        ? 'bg-blue-500 text-white'
                        : 'bg-zinc-800 text-zinc-100'
                    }`}>
                      {msg.shared_post_id ? (
                        <a
                          href={sharedPost ? `/post/${sharedPost.id}` : '#'}
                          className="block hover:opacity-90 transition-opacity"
                        >
                          {!sharedPost ? (
                            <div className="px-4 py-3 text-xs text-zinc-300">Post indisponível</div>
                          ) : (
                            <div className="bg-black/20">
                              {sharedPost.image_urls.length > 0 && (
                                <img
                                  src={sharedPost.image_urls[0]}
                                  alt="Post compartilhado"
                                  className="w-full max-h-48 object-cover"
                                  loading="lazy"
                                />
                              )}
                              <div className="px-3 py-2.5 flex gap-2">
                                {sharedPost.avatar_url ? (
                                  <img src={sharedPost.avatar_url} alt={sharedPost.username} className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5" />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                                    {sharedPost.username.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold">@{sharedPost.username}</p>
                                  {sharedPost.content && (
                                    <p className={`text-xs mt-0.5 line-clamp-2 ${isMe ? 'text-blue-100' : 'text-zinc-400'}`}>
                                      {sharedPost.content}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </a>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      )}
                      {(!sameNext) && (
                        <p className={`text-[10px] mt-1 ${msg.shared_post_id ? 'px-3 pb-2' : ''} ${isMe ? 'text-blue-200 text-right' : 'text-zinc-500'}`}>
                          {formatTime(msg.created_at)}
                          {isMe && (
                            <span className="ml-1">
                              {msg.read ? '✓✓' : '✓'}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {messages.length === 0 && otherProfile && (
          <div className="flex flex-col items-center py-12 text-center">
            {otherProfile.avatar_url ? (
              <img src={otherProfile.avatar_url} alt={otherProfile.username} className="w-20 h-20 rounded-full object-cover mb-4 border-2 border-zinc-800" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-2xl font-bold mb-4">
                {(otherProfile.username || '?').slice(0, 2).toUpperCase()}
              </div>
            )}
            <p className="font-semibold text-base">{otherProfile.username}</p>
            <p className="text-zinc-500 text-sm mt-1">Comece uma conversa!</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 py-3 border-t border-zinc-800 bg-black">
        {!canMessage ? (
          <p className="text-center text-xs text-zinc-500 py-2">
            Vocês precisam se seguir mutuamente para trocar mensagens.
          </p>
        ) : (
          <div className="flex items-end gap-3">
            <div className="flex-1 bg-zinc-900 border border-zinc-700 rounded-3xl px-4 py-2.5 flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Mensagem…"
                rows={1}
                className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none max-h-32"
                style={{ height: 'auto' }}
                onInput={(e) => {
                  const t = e.currentTarget
                  t.style.height = 'auto'
                  t.style.height = t.scrollHeight + 'px'
                }}
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={!text.trim() || sending}
              className="shrink-0 w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        )}
      </div>

    </div>
  )
}
