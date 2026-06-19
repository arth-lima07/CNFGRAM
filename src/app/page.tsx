'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    async function init() {
      // Verifica se está logado
      const { data: { session } } = await supabase.auth.getSession()

      // Aguarda a splash aparecer por 1.8s antes de redirecionar
      await new Promise(res => setTimeout(res, 1800))

      // Fade out
      setVisible(false)

      await new Promise(res => setTimeout(res, 400))

      if (session) {
        router.replace('/feed')
      } else {
        router.replace('/login')
      }
    }

    init()
  }, [])

  return (
    <main
      className="min-h-screen bg-black flex flex-col items-center justify-center transition-opacity duration-400"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.4s ease' }}
    >
      {/* Logo pulsando */}
      <div
        style={{
          animation: 'pulse-glow 1.6s ease-in-out infinite',
        }}
      >
        <img
          src="/logo.png"
          alt="CNFGRAM"
          className="w-52 h-52 object-contain drop-shadow-2xl"
        />
      </div>

      {/* Barra de loading */}
      <div className="mt-10 w-40 h-0.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-500 to-red-500 rounded-full"
          style={{ animation: 'loading-bar 1.8s ease-in-out forwards' }}
        />
      </div>

      <style jsx global>{`
        @keyframes pulse-glow {
          0%, 100% { transform: scale(1);   filter: drop-shadow(0 0 18px rgba(34,197,94,0.4)); }
          50%       { transform: scale(1.05); filter: drop-shadow(0 0 32px rgba(239,68,68,0.5)); }
        }
        @keyframes loading-bar {
          0%   { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </main>
  )
}
