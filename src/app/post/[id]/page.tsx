import type { Metadata } from 'next'
import PostClient from './PostClient'

export const dynamic = 'force-dynamic'

const SITE_URL = 'https://cnfgram-kmni.vercel.app'
const SITE_NAME = 'CNFGRAM'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

type PostRow = {
  id: number
  user_id: string
  username: string
  content: string | null
  image_url: string | null
  image_urls: string[] | null
}

type ProfileRow = {
  avatar_url: string | null
}

// Busca os dados crus do post direto na REST API do Supabase (sem o client-js,
// que é pensado pra rodar no browser). Usado tanto pelas meta tags quanto,
// se precisar, por outras necessidades futuras de SSR desta página.
async function fetchPostForMeta(postId: number): Promise<{ post: PostRow; avatarUrl: string | null } | null> {
  if (!Number.isFinite(postId)) return null

  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  }

  const postRes = await fetch(
    `${SUPABASE_URL}/rest/v1/posts?id=eq.${postId}&select=id,user_id,username,content,image_url,image_urls&limit=1`,
    { headers, cache: 'no-store' }
  )
  if (!postRes.ok) return null

  const posts: PostRow[] = await postRes.json()
  const post = posts[0]
  if (!post) return null

  let avatarUrl: string | null = null
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${post.user_id}&select=avatar_url&limit=1`,
    { headers, cache: 'no-store' }
  )
  if (profileRes.ok) {
    const profiles: ProfileRow[] = await profileRes.json()
    avatarUrl = profiles[0]?.avatar_url ?? null
  }

  return { post, avatarUrl }
}

function buildDescription(content: string | null): string {
  const fallback = 'Veja este post no CNFGRAM.'
  if (!content) return fallback
  const trimmed = content.trim().replace(/\s+/g, ' ')
  if (!trimmed) return fallback
  return trimmed.length > 200 ? `${trimmed.slice(0, 197)}…` : trimmed
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const postId = Number(params.id)
  const data = await fetchPostForMeta(postId)

  if (!data) {
    return {
      title: `Post não encontrado · ${SITE_NAME}`,
      description: 'Este post não existe ou foi removido.',
    }
  }

  const { post, avatarUrl } = data
  const title = `@${post.username} no ${SITE_NAME}`
  const description = buildDescription(post.content)
  const imageUrl = post.image_urls?.[0] || post.image_url || avatarUrl || undefined
  const pageUrl = `${SITE_URL}/post/${post.id}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: SITE_NAME,
      type: 'article',
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
    twitter: {
      card: imageUrl ? 'summary_large_image' : 'summary',
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
    alternates: {
      canonical: pageUrl,
    },
  }
}

export default function Page({ params }: { params: { id: string } }) {
  const postId = Number(params.id)
  return <PostClient postId={postId} />
}
