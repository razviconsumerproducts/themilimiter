import type { MetadataRoute } from 'next'

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://millimetre.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['/', '/platform', '/features', '/templates', '/use-cases', '/pricing', '/about', '/faq', '/demo']
  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '/' ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : 0.7,
  }))
}
