'use client'

import Navbar from '@/components/Navbar'
import StoriesBar from '@/components/StoriesBar'

// Este é só um EXEMPLO de como plugar a StoriesBar no topo do seu feed existente.
// Copie a linha <StoriesBar /> para dentro do seu page.tsx real do feed,
// logo abaixo da <Navbar /> e antes da lista de posts.

export default function FeedPageExample() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="max-w-2xl mx-auto">
          <StoriesBar />

          {/* ...resto do seu feed (lista de posts) continua aqui... */}
        </div>
      </main>
    </>
  )
}
