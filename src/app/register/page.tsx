'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function RegisterPage() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function register() {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })

    if (error) {
      alert(error.message)
      return
    }

    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          username: username,
          guilda: '',
          bio: ''
        })

      if (profileError) {
        alert(profileError.message)
        return
      }
    }

    alert('Conta criada com sucesso!')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
      <div className="flex flex-col gap-3 w-80 bg-zinc-900 p-6 rounded-xl">
        <h1 className="text-3xl font-bold text-center">
          CNFGRAM
        </h1>

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="p-2 rounded bg-zinc-800 border border-zinc-700"
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="p-2 rounded bg-zinc-800 border border-zinc-700"
        />

        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="p-2 rounded bg-zinc-800 border border-zinc-700"
        />

        <button
          onClick={register}
          className="bg-green-600 hover:bg-green-700 p-2 rounded font-semibold"
        >
          Criar Conta
        </button>
      </div>
    </main>
  )
}