/**
 * Converte uma URL de imagem para base64 usando a API proxy
 * Útil para evitar problemas de CORS ao gerar PDFs
 */
export async function urlToBase64(url: string): Promise<string | null> {
  if (!url || url.startsWith('data:')) return url

  // URLs do Firebase Storage sempre dão CORS no browser — vai direto pro proxy
  const useProxyFirst = url.includes('firebasestorage.googleapis.com')

  if (!useProxyFirst) {
    try {
      const res = await fetch(url, { cache: 'no-store' })
      const blob = await res.blob()
      const reader = new FileReader()
      const dataUrl: string = await new Promise(resolve => {
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
      return dataUrl
    } catch {
      // Fallback para proxy abaixo
    }
  }

  // Usa a API proxy (server-side fetch sem restrição de CORS)
  try {
    const proxyRes = await fetch(`/api/image-proxy?url=${encodeURIComponent(url)}`)
    if (proxyRes.ok) {
      const { dataUrl } = await proxyRes.json()
      return dataUrl || null
    }
  } catch (err) {
    console.error('Erro ao converter imagem para base64:', url, err)
  }
  return null
}

/**
 * Converte um array de URLs de imagem para base64
 * Retorna as URLs originais caso a conversão falhe
 */
export async function convertLogosToBase64(urls: string[]): Promise<string[]> {
  const results = await Promise.all(
    urls.map(async url => {
      const base64 = await urlToBase64(url)
      return base64 || url // Retorna a URL original se falhar
    })
  )
  return results
}
