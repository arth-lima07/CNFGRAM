'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'

type User = {
  id: string
  username: string
  avatar_url: string | null
}

export default function SearchPage() {
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<User[]>([])

  async function searchUsers(value: string) {
    setSearch(value)

    if (!value.trim()) {
      setUsers([])
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .ilike('username', `%${value}%`)
      .limit(20)

    if (error) {
      console.error(error)
      return
    }

    setUsers(data || [])
  }

  useEffect(() => {
    searchUsers('')
  }, [])

  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="max-w-2xl mx-auto p-4">

          <h1 className="text-3xl font-bold mb-6">
            Buscar Usuários
          </h1>

          <input
            type="text"
            placeholder="Digite um username..."
            value={search}
            onChange={(e) =>
              searchUsers(e.target.value)
            }
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 mb-6"
          />

          <div className="space-y-3">

            {users.map((user) => (
              <a
                key={user.id}
                href={`/user/${user.username}`}
                className="bg-zinc-900 rounded-xl p-4 flex items-center gap-4 hover:bg-zinc-800 transition"
              >

                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.username}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center">
                    👤
                  </div>
                )}

                <div>
                  <p className="font-bold">
                    @{user.username}
                  </p>
                </div>

              </a>
            ))}

          </div>

        </div>
      </main>
    </>
  )
}