'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Navbar() {
  const pathname = usePathname()
  const [unreadCount, setUnreadCount] = useState(0)
  const [myId, setMyId] = useState<string | null>(null)

  async function loadUnread() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyId(user.id)

    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('read', false)

    setUnreadCount(count || 0)
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  useEffect(() => { loadUnread() }, [pathname])

  useEffect(() => {
    if (!myId) return
    const channel = supabase
      .channel('navbar-unread')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${myId}`,
      }, () => loadUnread())
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${myId}`,
      }, () => loadUnread())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [myId])

  const links = [
    { href: '/feed',   label: '🏠 Feed' },
    { href: '/search', label: '🔍 Buscar' },
    { href: '/perfil', label: '👤 Perfil' },
  ]

  return (
    <nav className="sticky top-0 z-50 bg-zinc-950 border-b border-zinc-800">
      <div className="max-w-2xl mx-auto flex justify-between items-center p-4">
        <h1 className="font-bold text-xl">CNFGRAM</h1>

        <div className="flex gap-4 items-center">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`text-sm transition-colors ${
                pathname === href ? 'text-white font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {label}
            </Link>
          ))}

          {/* DM */}
          <Link
            href="/chat"
            className={`relative text-sm transition-colors ${
              pathname.startsWith('/chat') ? 'text-white font-semibold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            💬 Mensagens
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-zinc-950">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>

          <button
            onClick={logout}
            className="bg-red-600 hover:bg-red-700 transition-colors px-3 py-1 rounded text-sm"
          >
            Sair
          </button>
        </div>
      </div>
    </nav>
  )
}
