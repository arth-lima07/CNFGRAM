'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'

type Conversation = {
  user_id: string
  username: string
  avatar_url: string | null
  last_message: string
  last_at: string
  unread: number
}

function formatDate(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}m`
  if (h < 24) return `${h}h`
  if (d < 7) return `${d}d`
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [myId, setMyId] = useState<string | null>(null)

  async function loadConversations() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login'; return }
    setMyId(user.id)

    // Get all users I follow AND who follow me (mutual = can DM)
    const [{ data: iFollow }, { data: followMe }] = await Promise.all([
      supabase.from('follows').select('following_id').eq('follower_id', user.id),
      supabase.from('follows').select('follower_id').eq('following_id', user.id),
    ])

    const iFollowIds = new Set((iFollow || []).map((f: any) => f.following_id))
    const followMeIds = new Set((followMe || []).map((f: any) => f.follower_id))
    const mutualIds = [...iFollowIds].filter(id => followMeIds.has(id))

    if (mutualIds.length === 0) { setLoading(false); return }

    // Get profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', mutualIds)

    if (!profiles) { setLoading(false); return }

    // Get last message for each conversation
    const convList: Conversation[] = []

    for (const profile of profiles) {
      const { data: msgs } = await supabase
        .from('messages')
        .select('content, created_at, sender_id, read')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${profile.id}),and(sender_id.eq.${profile.id},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: false })
        .limit(1)

      const last = msgs?.[0]

      // Count unread messages from this user
      const { count: unread } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', profile.id)
        .eq('receiver_id', user.id)
        .eq('read', false)

      convList.push({
        user_id: profile.id,
        username: profile.username,
        avatar_url: profile.avatar_url,
        last_message: last?.content || 'Nenhuma mensagem ainda',
        last_at: last?.created_at || '',
        unread: unread || 0,
      })
    }

    // Sort by last message date
    convList.sort((a, b) => {
      if (!a.last_at) return 1
      if (!b.last_at) return -1
      return new Date(b.last_at).getTime() - new Date(a.last_at).getTime()
    })

    setConversations(convList)
    setLoading(false)
  }

  useEffect(() => { loadConversations() }, [])

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-black text-white">
        <div className="max-w-xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-800">
            <h1 className="text-lg font-bold">Mensagens</h1>
            <button className="text-zinc-400 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <svg className="animate-spin w-6 h-6 text-zinc-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
              <div className="w-16 h-16 rounded-full border-2 border-zinc-600 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <p className="font-semibold text-base mb-1">Suas mensagens</p>
              <p className="text-zinc-500 text-sm">Você só pode trocar mensagens com quem te segue de volta.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/50">
              {conversations.map((conv) => (
                <a
                  key={conv.user_id}
                  href={`/chat/${conv.user_id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 transition-colors"
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {conv.avatar_url ? (
                      <img
                        src={conv.avatar_url}
                        alt={conv.username}
                        className="w-14 h-14 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-lg font-bold">
                        {(conv.username || '?').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    {conv.unread > 0 && (
                      <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-500 rounded-full border-2 border-black" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${conv.unread > 0 ? 'font-bold text-white' : 'font-medium text-white'}`}>
                      {conv.username}
                    </p>
                    <p className={`text-sm truncate mt-0.5 ${conv.unread > 0 ? 'text-white font-medium' : 'text-zinc-500'}`}>
                      {conv.last_message.length > 40 ? conv.last_message.slice(0, 40) + '…' : conv.last_message}
                    </p>
                  </div>

                  {/* Time + unread */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {conv.last_at && (
                      <span className="text-xs text-zinc-500">{formatDate(conv.last_at)}</span>
                    )}
                    {conv.unread > 0 && (
                      <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white">{conv.unread > 9 ? '9+' : conv.unread}</span>
                      </div>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
