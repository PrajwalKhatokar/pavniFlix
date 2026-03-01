import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

const isValidEndpoint = (value: string) => /^\/[A-Za-z0-9/_-]+(\?[^\s#]*)?$/.test(value)

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiKey = env.TMDB_API_KEY || process.env.TMDB_API_KEY

  return {
    plugins: [
      react(),
      {
        name: 'tmdb-dev-api',
        configureServer(server) {
          server.middlewares.use('/api/tmdb', async (req: any, res: any) => {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')

            if (req.method !== 'GET') {
              res.statusCode = 405
              res.end(JSON.stringify({ error: 'Method not allowed. Use GET.' }))
              return
            }

            if (!apiKey) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: 'Server misconfiguration: TMDB_API_KEY is missing.' }))
              return
            }

            const url = new URL(req.url || '', 'http://localhost')
            const endpoint = url.searchParams.get('endpoint')

            if (!endpoint || !isValidEndpoint(endpoint)) {
              res.statusCode = 400
              res.end(
                JSON.stringify({
                  error: 'Invalid endpoint. Expected a TMDB path like /trending/all/week or /movie/123/videos.',
                }),
              )
              return
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
                res.statusCode = 502
                res.end(
                  JSON.stringify({
                    error: 'TMDB returned a non-JSON response.',
                    upstreamStatus: upstream.status,
                  }),
                )
                return
              }

              res.statusCode = upstream.status
              res.end(JSON.stringify(parsedBody))
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Unknown server error.'
              res.statusCode = 500
              res.end(JSON.stringify({ error: 'Failed to fetch from TMDB.', details: message }))
            }
          })
        },
      },
    ],
  }
})
