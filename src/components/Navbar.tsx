'use client'

import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function Navbar() {
  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <nav className="sticky top-0 z-50 bg-zinc-950 border-b border-zinc-800">
      <div className="max-w-2xl mx-auto flex justify-between items-center p-4">
        <h1 className="font-bold text-xl">
          CNFGRAM
        </h1>

        <div className="flex gap-4 items-center">
          <Link href="/feed">
            🏠 Feed
          </Link>
<a href="/search">
  🔍 Buscar
</a>
          <Link href="/perfil">
            👤 Perfil
          </Link>

          <button
            onClick={logout}
            className="bg-red-600 px-3 py-1 rounded"
          >
            Sair
          </button>
        </div>
      </div>
    </nav>
  )
}