const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

const isValidEndpoint = (value: string) => /^\/[A-Za-z0-9/_-]+(\?[^\s#]*)?$/.test(value)

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' })
  }

  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfiguration: TMDB_API_KEY is missing.' })
  }

  const endpointParam = req.query?.endpoint
  const endpoint = Array.isArray(endpointParam) ? endpointParam[0] : endpointParam

  if (!endpoint || typeof endpoint !== 'string' || !isValidEndpoint(endpoint)) {
    return res.status(400).json({
      error: 'Invalid endpoint. Expected a TMDB path like /trending/all/week or /movie/123/videos.',
    })
  }

  try {
    const target = new URL(`${TMDB_BASE_URL}${endpoint}`)
    target.searchParams.set('api_key', apiKey)

    if (!target.searchParams.has('language')) {
      target.searchParams.set('language', 'en-US')
    }

    if (!target.searchParams.has('page')) {
      target.searchParams.set('page', '1')
    }

    const upstream = await fetch(target.toString())
    const rawBody = await upstream.text()

    let parsedBody: unknown
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : {}
    } catch {
      return res.status(502).json({
        error: 'TMDB returned a non-JSON response.',
        upstreamStatus: upstream.status,
      })
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: 'TMDB request failed.',
        upstreamStatus: upstream.status,
        details: parsedBody,
      })
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=300')
    return res.status(200).json(parsedBody)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error.'
    return res.status(500).json({ error: 'Failed to fetch from TMDB.', details: message })
  }
}
