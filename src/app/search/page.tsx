'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'

type User = {
  id: string
  username: string
  bio: string | null
  guilda: string | null
  avatar_url: string | null
}

export default function SearchPage() {
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)

  async function searchUsers(value: string) {
    setSearch(value)
    setLoading(true)

    const query = supabase
      .from('profiles')
      .select('id, username, bio, guilda, avatar_url')
      .limit(20)

    const { data, error } = value.trim()
      ? await query.ilike('username', `%${value}%`)
      : await query.order('username')

    if (error) { console.error(error); setLoading(false); return }

    setUsers(data || [])
    setLoading(false)
  }

  useEffect(() => { searchUsers('') }, [])

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="max-w-2xl mx-auto p-4">

          <h1 className="text-2xl font-bold mb-5">Buscar usuários</h1>

          <div className="relative mb-5">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Digite um username…"
              value={search}
              onChange={(e) => searchUsers(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-zinc-600"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <svg className="animate-spin w-5 h-5 text-zinc-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-zinc-600">
              <p className="text-3xl mb-2">🔍</p>
              <p className="text-sm">{search ? 'Nenhum usuário encontrado.' : 'Comece digitando para buscar.'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {users.filter(u => !!u.username).map((user) => (
                <a
                  key={user.id}
                  href={`/user/${user.username}`}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4 hover:bg-zinc-800 transition-colors"
                >
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.username}
                      className="w-12 h-12 rounded-full object-cover border border-zinc-700 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-sm font-bold shrink-0">
                      {(user.username || '?').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">@{user.username}</p>
                    {user.guilda && <p className="text-xs text-zinc-500 mt-0.5">⚔️ {user.guilda}</p>}
                    {user.bio && <p className="text-xs text-zinc-500 mt-0.5 truncate">{user.bio}</p>}
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-zinc-600 ml-auto shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </a>
              ))}
            </div>
          )}

        </div>
      </main>
    </>
  )
}
