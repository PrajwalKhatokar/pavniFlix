import { useEffect, useMemo, useState } from 'react'

type Movie = {
  id: number
  title?: string
  name?: string
  media_type?: 'movie' | 'tv'
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  vote_average?: number
  release_date?: string
  first_air_date?: string
}

type RowConfig = {
  key: string
  title: string
  endpoint: string
}

type RowData = {
  title: string
  movies: Movie[]
}

const IMAGE_BASE = 'https://image.tmdb.org/t/p/original'
const POSTER_BASE = 'https://image.tmdb.org/t/p/w500'

const ROWS: RowConfig[] = [
  { key: 'trending', title: 'Trending Now', endpoint: '/trending/all/week' },
  { key: 'top-rated', title: 'Top Rated', endpoint: '/movie/top_rated' },
  { key: 'now-playing', title: 'Now Playing', endpoint: '/movie/now_playing' },
  { key: 'action', title: 'Action Thrillers', endpoint: '/discover/movie?with_genres=28' },
  { key: 'comedy', title: 'Comedy Hits', endpoint: '/discover/movie?with_genres=35' },
  { key: 'sci-fi', title: 'Sci-Fi & Fantasy', endpoint: '/discover/movie?with_genres=878' },
]

const iconItems = ['\u2315', '\u2302', '\u2318', '\u25ad', '\u2197', '+', '\u267a']

const fetchFromServerApi = async <T,>(endpoint: string): Promise<T> => {
  const response = await fetch(`/api/tmdb?endpoint=${encodeURIComponent(endpoint)}`)
  const rawBody = await response.text()

  let parsedBody: unknown
  try {
    parsedBody = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    throw new Error(`Server returned non-JSON response (${response.status}).`)
  }

  if (!response.ok) {
    const maybeObject = typeof parsedBody === 'object' && parsedBody !== null ? parsedBody : {}
    const message = 'error' in maybeObject && typeof maybeObject.error === 'string' ? maybeObject.error : 'Request failed.'
    throw new Error(`${message} (${response.status})`)
  }

  return parsedBody as T
}

const getMovieTitle = (movie: Movie) => movie.title || movie.name || 'Untitled'

const getPoster = (movie: Movie) =>
  movie.poster_path ? `${POSTER_BASE}${movie.poster_path}` : 'https://placehold.co/500x750/121212/e5e5e5?text=No+Poster'

const getHeroBackdrop = (movie?: Movie) =>
  movie?.backdrop_path
    ? `${IMAGE_BASE}${movie.backdrop_path}`
    : 'https://placehold.co/1920x1080/121212/f5f5f5?text=PavniFlix'

function App() {
  const [rows, setRows] = useState<RowData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [trailerError, setTrailerError] = useState('')
  const [openingTrailer, setOpeningTrailer] = useState(false)
  const [openingTrailerId, setOpeningTrailerId] = useState<number | null>(null)

  useEffect(() => {
    const loadMovies = async () => {
      try {
        setLoading(true)
        setError('')
        const requests = ROWS.map(async (row) => {
          const data = await fetchFromServerApi<{ results?: Movie[] }>(row.endpoint)
          return {
            title: row.title,
            movies: (data.results || []).filter((m) => m.poster_path || m.backdrop_path).slice(0, 20),
          }
        })

        const resolvedRows = await Promise.all(requests)
        setRows(resolvedRows)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error while fetching TMDB data.'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    void loadMovies()
  }, [])

  const heroMovie = useMemo(() => rows[0]?.movies?.[0], [rows])
  const heroTitle = heroMovie ? getMovieTitle(heroMovie) : 'PavniFlix'
  const heroDescription =
    heroMovie?.overview?.slice(0, 190) ||
    'Watch blockbuster movies, trending stories, and binge-worthy titles inspired by a Netflix-style experience.'
  const heroMeta = heroMovie?.vote_average ? `IMDb ${heroMovie.vote_average.toFixed(1)}/10` : 'IMDb N/A'

  const openTrailerForMovie = async (movie: Movie) => {
    try {
      setOpeningTrailer(true)
      setOpeningTrailerId(movie.id)
      setTrailerError('')
      const mediaType = movie.media_type === 'tv' ? 'tv' : 'movie'
      const data = await fetchFromServerApi<{
        results?: Array<{
          site?: string
          key?: string
          type?: string
        }>
      }>(`/${mediaType}/${movie.id}/videos`)

      const youtubeVideos = (data.results || []).filter(
        (video) => video.site === 'YouTube' && video.key,
      )
      const picked =
        youtubeVideos.find((video) => video.type === 'Trailer') ||
        youtubeVideos.find((video) => video.type === 'Teaser') ||
        youtubeVideos[0]

      if (!picked?.key) {
        setTrailerError(`Trailer is not available for "${getMovieTitle(movie)}".`)
        return
      }

      window.open(`https://www.youtube.com/watch?v=${picked.key}`, '_blank', 'noopener,noreferrer')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown trailer error'
      setTrailerError(`Could not open trailer. ${message}`)
    } finally {
      setOpeningTrailer(false)
      setOpeningTrailerId(null)
    }
  }

  const openHeroTrailer = async () => {
    if (!heroMovie) return
    await openTrailerForMovie(heroMovie)
  }

  return (
    <div className="app-shell">
      <aside className="left-rail" aria-label="Quick menu">
        <div className="logo-mark">
          <span>P</span>
        </div>
        {iconItems.map((icon, index) => (
          <button key={`${icon}-${index}`} className="rail-icon" aria-label={`Icon ${index + 1}`}>
            {icon}
          </button>
        ))}
      </aside>

      <main className="content">
        <section
          className="hero"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.62) 50%, rgba(0,0,0,0.35) 100%), url(${getHeroBackdrop(heroMovie)})`,
          }}
        >
          <div className="hero-copy">
            <p className="series-tag">P SERIES</p>
            <h1>{heroTitle}</h1>
            <p className="meta">{heroMeta}</p>
            <p className="overview">{heroDescription}</p>
            <div className="hero-actions">
              <button className="play-btn" onClick={openHeroTrailer} disabled={openingTrailer}>
                {openingTrailer ? 'Opening...' : 'Play'}
              </button>
              <button className="secondary-btn" onClick={openHeroTrailer} disabled={openingTrailer}>
                {openingTrailer ? 'Opening...' : 'Watch Trailer'}
              </button>
            </div>
            {trailerError && <p className="status-text error">{trailerError}</p>}
          </div>
        </section>

        {loading && <p className="status-text">Loading movies from TMDB...</p>}
        {error && (
          <p className="status-text error">
            Could not fetch TMDB data. Check server env var/network.
            <br />
            <small>{error}</small>
          </p>
        )}

        {!loading &&
          !error &&
          rows.map((row) => (
            <section className="movie-row" key={row.title}>
              <h2>{row.title}</h2>
              <div className="poster-strip">
                {row.movies.map((movie) => (
                  <button
                    className="poster-card"
                    key={`${row.title}-${movie.id}`}
                    onClick={() => {
                      void openTrailerForMovie(movie)
                    }}
                    aria-label={`Open trailer for ${getMovieTitle(movie)}`}
                  >
                    <img
                      src={getPoster(movie)}
                      alt={getMovieTitle(movie)}
                      loading="lazy"
                      onError={(e) => {
                        const target = e.currentTarget
                        target.src = 'https://placehold.co/500x750/191919/e6e6e6?text=Image+Unavailable'
                      }}
                    />
                    <div className="card-overlay">
                      <p>
                        {openingTrailer && openingTrailerId === movie.id ? 'Opening trailer...' : getMovieTitle(movie)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
      </main>
    </div>
  )
}

export default App
