'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function HomeIcon({ active }: { active: boolean }) {
  return active ? (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path d="M9.5 22.5v-7h5v7a1 1 0 0 0 1 1H19a1 1 0 0 0 1-1v-9.5h1.7a.5.5 0 0 0 .33-.87L12.67 1.6a1 1 0 0 0-1.34 0L2 12.13a.5.5 0 0 0 .33.87H4v9.5a1 1 0 0 0 1 1h3.5a1 1 0 0 0 1-1z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V19a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <circle cx="11" cy="11" r="7.5" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function MessageIcon({ active }: { active: boolean }) {
  return active ? (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path d="M12.003 1.131c-6.627 0-11.999 4.823-11.999 10.769 0 3.337 1.69 6.32 4.34 8.296a.6.6 0 0 1 .238.46l.06 1.97a.6.6 0 0 0 .84.53l2.2-.97a.6.6 0 0 1 .42-.02c1.24.34 2.56.52 3.9.52 6.627 0 11.999-4.822 11.999-10.786S18.63 1.131 12.003 1.131z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M12 21c-.78 0-1.55-.18-2.36-.5l-2.2.97a1.1 1.1 0 0 1-1.54-.97l-.06-2.1A9.4 9.4 0 0 1 2 11.4C2 6.21 6.5 2 12 2s10 4.21 10 9.4S17.5 21 12 21z" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  )
}

// Mesmo conceito de vidro fumê usado no feed (glass-card) e na barra de stories
// (stories-glass): blur pesado por baixo, usando a foto do próprio usuário como
// fonte do desfoque, com um degradê escurecendo por cima pra manter o contraste
// dos ícones e textos da navbar.
const NAVBAR_GLASS_STYLE = `
.navbar-glass {
  backdrop-filter: blur(22px) saturate(130%);
  -webkit-backdrop-filter: blur(22px) saturate(130%);
  background-color: rgba(9, 9, 11, 0.55);
  isolation: isolate;
}
.navbar-glass::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background-image: var(--bg-image, none);
  background-size: cover;
  background-position: center;
  filter: blur(30px) brightness(0.4) saturate(1.1);
  transform: scale(1.3);
  opacity: 0.55;
}
.navbar-glass::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  background: linear-gradient(
    180deg,
    rgba(9, 9, 11, 0.55) 0%,
    rgba(9, 9, 11, 0.75) 50%,
    rgba(9, 9, 11, 0.9) 100%
  );
  pointer-events: none;
}
.navbar-glass > * {
  position: relative;
  z-index: 1;
}
`

export default function Navbar() {
  const pathname = usePathname()
  const [unreadCount, setUnreadCount] = useState(0)
  const [myId, setMyId] = useState<string | null>(null)
  const [myAvatar, setMyAvatar] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  async function loadUnread() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyId(user.id)

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single()

    setMyAvatar(myProfile?.avatar_url || null)

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

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const isActive = (href: string) => pathname === href || (href !== '/feed' && pathname.startsWith(href))

  const navItem = (href: string, label: string, icon: React.ReactNode, badge?: number) => (
    <Link
      href={href}
      className={`relative flex items-center gap-4 px-3 py-2.5 rounded-xl transition-colors group ${
        isActive(href) ? 'text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'
      }`}
    >
      <span className="relative shrink-0">
        {icon}
        {!!badge && badge > 0 && (
          <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[10px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center border-2 border-black leading-none">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      <span className={`hidden xl:inline text-[15px] ${isActive(href) ? 'font-semibold' : 'font-normal'}`}>
        {label}
      </span>
    </Link>
  )

  return (
    <>
      <style>{NAVBAR_GLASS_STYLE}</style>
      <nav
        className="navbar-glass fixed left-0 top-0 z-50 h-screen w-[72px] xl:w-[244px] border-r border-white/10 flex flex-col px-3 py-6 transition-all"
        style={{ '--bg-image': myAvatar ? `url(${myAvatar})` : 'none' } as React.CSSProperties}
      >
      {/* Logo */}
      <Link href="/feed" className="px-3 mb-8 block">
        <span className="hidden xl:inline font-bold text-2xl tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
          CNFGRAM
        </span>
        <span className="xl:hidden flex items-center justify-center w-8 h-8 text-2xl">📸</span>
      </Link>

      {/* Main links */}
      <div className="flex flex-col gap-1 flex-1">
        {navItem('/feed', 'Início', <HomeIcon active={isActive('/feed')} />)}
        {navItem('/search', 'Buscar', <SearchIcon />)}
        {navItem('/chat', 'Mensagens', <MessageIcon active={isActive('/chat')} />, unreadCount)}
        {navItem('/criar', 'Criar', <PlusIcon />)}
        {navItem('/perfil', 'Perfil', <ProfileBubble avatarUrl={myAvatar} />)}
      </div>

      {/* More / profile menu */}
      <div className="relative" ref={menuRef}>
        {menuOpen && (
          <div className="navbar-glass absolute bottom-full left-0 mb-2 w-56 border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1.5">
            <Link
              href="/perfil"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-2.5 text-sm text-zinc-200 hover:bg-white/5 transition-colors"
            >
              Ver perfil
            </Link>
            <button
              onClick={logout}
              className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 transition-colors border-t border-white/10"
            >
              Sair
            </button>
          </div>
        )}
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="w-full flex items-center gap-4 px-3 py-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <span className="shrink-0"><MoreIcon /></span>
          <span className="hidden xl:inline text-[15px]">Mais</span>
        </button>
      </div>
      </nav>
    </>
  )
}

function ProfileBubble({ avatarUrl }: { avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      <div className="w-6 h-6 rounded-full border-[1.5px] border-current overflow-hidden shrink-0">
        <img src={avatarUrl} alt="Meu perfil" className="w-full h-full object-cover" />
      </div>
    )
  }
  return (
    <div className="w-6 h-6 rounded-full border-[1.5px] border-current overflow-hidden flex items-center justify-center">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <circle cx="12" cy="8" r="4" /><path d="M4 21v-1a8 8 0 0 1 16 0v1" />
      </svg>
    </div>
  )
}
