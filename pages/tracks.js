import { useState, useEffect } from 'react'
import Head from 'next/head'
import Header from '@components/Header'
import Footer from '@components/Footer'
import { supabase } from '../lib/supabase'
import { ErrorHandler } from '../lib/errorHandler'
import { Toast } from '../lib/toast'
import styles from '@styles/Tracks.module.css'

const TRACKS_PER_PAGE = 10

export default function Tracks() {
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentPlaying, setCurrentPlaying] = useState(null)
  const [audioElement, setAudioElement] = useState(null)
  const [filter, setFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalTracks, setTotalTracks] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    loadTracks()

    const audio = new Audio()
    
    const handleKeyPress = (e) => {
      if (e.code === 'Space' && currentPlaying) {
        e.preventDefault()
        handlePlay(currentPlaying)
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    setAudioElement(audio)

    return () => {
      audio.pause()
      audio.src = ''
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, []) // Убрали loadTracks из зависимостей

  useEffect(() => {
    setCurrentPage(1)
    loadTracks(1)
  }, [filter])

  const loadTracks = async (page = currentPage, showToast = false) => {
    try {
      setLoading(true)

      let countQuery = supabase
        .from('tracks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')

      if (filter !== 'all') {
        countQuery = countQuery.eq('track_type', filter)
      }

      const { count } = await countQuery

      setTotalTracks(count || 0)

      const from = (page - 1) * TRACKS_PER_PAGE
      const to = from + TRACKS_PER_PAGE - 1

      let query = supabase
        .from('tracks')
        .select(`
          *,
          profiles:author_id (
            id,
            username,
            author_level,
            smule_verified
          )
        `)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .range(from, to)

      if (filter !== 'all') {
        query = query.eq('track_type', filter)
      }

      const { data, error } = await query

      if (error) {
        ErrorHandler.handle(error, 'loadTracks')
        return
      }

      setTracks(data || [])
      setHasMore((data || []).length === TRACKS_PER_PAGE)
      setCurrentPage(page)
      
      // Показываем toast только при явном запросе
      if (showToast && data && data.length > 0) {
        Toast.success(`Загружено треков: ${data.length}`)
      }
    } catch (error) {
      ErrorHandler.handle(error, 'loadTracks')
    } finally {
      setLoading(false)
    }
  }

  const handlePlay = (track) => {
    if (!audioElement) return

    if (currentPlaying?.id === track.id) {
      audioElement.pause()
      setCurrentPlaying(null)
    } else {
      audioElement.src = track.file_url
      audioElement.play()
      setCurrentPlaying(track)
      updatePlayCount(track.id)
    }
  }

  const updatePlayCount = async (trackId) => {
    try {
      const { error } = await supabase
        .rpc('increment_plays_count', { track_id: trackId })

      if (error) {
        ErrorHandler.handle(error, 'updatePlayCount')
      }
    } catch (error) {
      ErrorHandler.handle(error, 'updatePlayCount')
    }
  }

  const handlePageChange = (newPage) => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    loadTracks(newPage, true) // Показываем toast при смене страницы
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatFileSize = (bytes) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' МБ'
  }

  const totalPages = Math.ceil(totalTracks / TRACKS_PER_PAGE)

  return (
    <div className="container">
      <Head>
        <title>Лента треков | MOIS Hub</title>
        <meta name="description" content="Слушайте треки от сообщества музыкантов" />
      </Head>

      <Header title="MOIS Hub" />

      <main className={styles.main}>
        <div className={styles.header}>
          <h1>🎵 Лента треков</h1>
          <p>Слушайте треки от талантливых музыкантов сообщества</p>
        </div>

        <div className={styles.filters}>
          <label htmlFor="track-type-filter">Тип:</label>
          <select
            id="track-type-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={styles.filterSelect}
            aria-label="Выберите тип трека"
          >
            <option value="all">Все треки</option>
            <option value="original">Оригиналы</option>
            <option value="cover">Каверы</option>
          </select>
          <span className={styles.trackCount}>
            {totalTracks} {totalTracks === 1 ? 'трек' : 'треков'}
          </span>
        </div>

        {loading ? (
          <div className={styles.loading} role="status" aria-live="polite">
            <p>Загрузка треков...</p>
          </div>
        ) : tracks.length === 0 ? (
          <div className={styles.empty}>
            <h2>😔 Треки не найдены</h2>
            <p>Пока нет одобренных треков в этой категории</p>
            <a href="/upload" className={styles.uploadLink}>
              📤 Загрузить свой трек
            </a>
          </div>
        ) : (
          <>
            <div className={styles.tracksList} role="list">
              {tracks.map((track, index) => (
                <div 
                  key={track.id} 
                  className={styles.trackCard}
                  role="listitem"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handlePlay(track)
                    }
                  }}
                >
                  <div className={styles.trackInfo}>
                    <div className={styles.trackHeader}>
                      <a 
                        href={`/track/${track.id}`} 
                        style={{ textDecoration: 'none', color: 'inherit' }}
                        aria-label={`Открыть страницу трека ${track.title}`}
                      >
                        <h3>
                          {track.track_type === 'cover' && '🎤 '}
                          {track.title}
                        </h3>
                      </a>
                      {track.track_type === 'cover' && track.original_title && (
                        <p style={{ 
                          fontSize: '0.85rem', 
                          color: '#718096', 
                          marginTop: '4px',
                          fontStyle: 'italic'
                        }}>
                          Кавер на: {track.original_title}
                        </p>
                      )}
                    </div>

                    {track.tags && track.tags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                        {track.tags.map((tag, i) => (
                          <span key={i} style={{ 
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                            color: 'white', 
                            padding: '4px 10px', 
                            borderRadius: '12px', 
                            fontSize: '0.8rem',
                            fontWeight: '500'
                          }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className={styles.author}>
                      <a 
                        href={`/profile/${track.profiles?.username}`}
                        className={styles.authorLink}
                        style={{ textDecoration: 'none', color: 'inherit' }}
                        aria-label={`Профиль автора ${track.profiles?.username || 'Неизвестный автор'}`}
                      >
                        <span>👤 {track.profiles?.username || 'Неизвестный автор'}</span>
                        {track.profiles?.smule_verified && (
                          <span className={styles.verified} aria-label="Верифицированный автор">✅</span>
                        )}
                        <span className={styles.level} aria-label={`Уровень ${track.profiles?.author_level || 1}`}>
                          ⭐ Ур. {track.profiles?.author_level || 1}
                        </span>
                      </a>
                    </div>

                    {track.description && (
                      <p className={styles.description}>{track.description}</p>
                    )}

                    <div className={styles.meta}>
                      <span aria-label={`Дата публикации: ${formatDate(track.created_at)}`}>
                        📅 {formatDate(track.created_at)}
                      </span>
                      <span aria-label={`Прослушиваний: ${track.plays_count || 0}`}>
                        ▶️ {track.plays_count || 0} прослушиваний
                      </span>
                      <span aria-label={`Рецензий: ${track.reviews_count || 0}`}>
                        💬 {track.reviews_count || 0} рецензий
                      </span>
                      <span aria-label={`Размер файла: ${formatFileSize(track.file_size)}`}>
                        📦 {formatFileSize(track.file_size)}
                      </span>
                    </div>
                  </div>

                  <div className={styles.trackActions}>
                    <button
                      onClick={() => handlePlay(track)}
                      className={`${styles.playButton} ${
                        currentPlaying?.id === track.id ? styles.playing : ''
                      }`}
                      aria-label={
                        currentPlaying?.id === track.id 
                          ? `Поставить на паузу ${track.title}` 
                          : `Воспроизвести ${track.title}`
                      }
                      aria-pressed={currentPlaying?.id === track.id}
                    >
                      {currentPlaying?.id === track.id ? '⏸️ Пауза' : '▶️ Играть'}
                    </button>

                    <a
                      href={track.file_url}
                      download
                      className={styles.downloadButton}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Скачать трек ${track.title}`}
                    >
                      💾 Скачать
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {/* Пагинация */}
            {totalPages > 1 && (
              <div className={styles.pagination} role="navigation" aria-label="Пагинация треков">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={styles.paginationButton}
                  aria-label="Предыдущая страница"
                >
                  ← Назад
                </button>

                <div className={styles.paginationPages}>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                    // Показываем только ближайшие страницы
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 2 && page <= currentPage + 2)
                    ) {
                      return (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className={`${styles.paginationButton} ${
                            page === currentPage ? styles.active : ''
                          }`}
                          aria-label={`Страница ${page}`}
                          aria-current={page === currentPage ? 'page' : undefined}
                        >
                          {page}
                        </button>
                      )
                    } else if (
                      page === currentPage - 3 ||
                      page === currentPage + 3
                    ) {
                      return <span key={page} className={styles.paginationEllipsis}>...</span>
                    }
                    return null
                  })}
                </div>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={styles.paginationButton}
                  aria-label="Следующая страница"
                >
                  Вперёд →
                </button>
              </div>
            )}
          </>
        )}

        {currentPlaying && (
          <div 
            className={styles.nowPlaying}
            role="region"
            aria-label="Сейчас играет"
            aria-live="polite"
          >
            <div className={styles.nowPlayingContent}>
              <span className={styles.nowPlayingIcon} aria-hidden="true">🎵</span>
              <div>
                <div className={styles.nowPlayingTitle}>{currentPlaying.title}</div>
                <div className={styles.nowPlayingArtist}>
                  {currentPlaying.profiles?.username}
                </div>
              </div>
            </div>
            <button
              onClick={() => handlePlay(currentPlaying)}
              className={styles.nowPlayingButton}
              aria-label="Поставить на паузу"
            >
              ⏸️
            </button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}