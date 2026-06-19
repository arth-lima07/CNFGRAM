'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function login() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    setLoading(false)
    if (error) {
      alert(error.message)
      return
    }
    alert('Login realizado com sucesso!')
    router.push('/feed')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
      <div className="flex flex-col gap-3 w-80 bg-zinc-900 p-6 rounded-xl">
        <h1 className="text-3xl font-bold text-center">
          CNFGRAM
        </h1>
        <p className="text-center text-zinc-400">
          Entrar na conta
        </p>
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
          onClick={login}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 p-2 rounded font-semibold"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="text-center text-sm text-zinc-400 mt-1">
          Não tem uma conta?{' '}
          <a href="/register" className="text-green-500 hover:text-green-400 font-medium">
            Criar conta
          </a>
        </p>
      </div>
    </main>
  )
}
