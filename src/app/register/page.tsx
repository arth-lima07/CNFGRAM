'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function RegisterPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function register() {
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })

    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          username: username.trim(),
          guilda: '',
          bio: ''
        })

      if (profileError) {
        alert(profileError.message)
        setLoading(false)
        return
      }
    }

    setLoading(false)
    alert('Conta criada com sucesso!')
    router.push('/login')
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
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 p-2 rounded font-semibold"
        >
          {loading ? 'Criando conta...' : 'Criar Conta'}
        </button>

        <p className="text-center text-sm text-zinc-400 mt-1">
          Já tem uma conta?{' '}
          <a href="/login" className="text-green-500 hover:text-green-400 font-medium">
            Entrar
          </a>
        </p>
      </div>
    </main>
  )
}
