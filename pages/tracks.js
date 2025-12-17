import { useState, useEffect } from 'react'
import Head from 'next/head'
import Header from '@components/Header'
import Footer from '@components/Footer'
import { supabase } from '../lib/supabase'
import styles from '@styles/Tracks.module.css'

export default function Tracks() {
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentPlaying, setCurrentPlaying] = useState(null)
  const [audioElement, setAudioElement] = useState(null)
  const [filter, setFilter] = useState('all') // all, pop, rock, etc.

  useEffect(() => {
    loadTracks()

    // Создаём аудио элемент
    const audio = new Audio()
    setAudioElement(audio)

    return () => {
      audio.pause()
      audio.src = ''
    }
  }, [])

  useEffect(() => {
    loadTracks()
  }, [filter])

  const loadTracks = async () => {
    try {
      setLoading(true)

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

      if (filter !== 'all') {
        query = query.eq('genre', filter)
      }

      const { data, error } = await query

      if (error) throw error

      setTracks(data || [])
    } catch (error) {
      console.error('Ошибка загрузки треков:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePlay = (track) => {
    if (!audioElement) return

    if (currentPlaying?.id === track.id) {
      // Пауза текущего трека
      audioElement.pause()
      setCurrentPlaying(null)
    } else {
      // Воспроизведение нового трека
      audioElement.src = track.file_url
      audioElement.play()
      setCurrentPlaying(track)

      // Обновляем счётчик прослушиваний
      updatePlayCount(track.id)
    }
  }

  const updatePlayCount = async (trackId) => {
    try {
      const { data } = await supabase
        .from('tracks')
        .select('plays_count')
        .eq('id', trackId)
        .single()

      await supabase
        .from('tracks')
        .update({ plays_count: (data?.plays_count || 0) + 1 })
        .eq('id', trackId)
    } catch (error) {
      console.error('Ошибка обновления счётчика:', error)
    }
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

  const genres = [
    { value: 'all', label: 'Все жанры' },
    { value: 'pop', label: 'Pop' },
    { value: 'rock', label: 'Rock' },
    { value: 'hip-hop', label: 'Hip-Hop' },
    { value: 'electronic', label: 'Electronic' },
    { value: 'jazz', label: 'Jazz' },
    { value: 'classical', label: 'Classical' },
    { value: 'rnb', label: 'R&B' },
    { value: 'country', label: 'Country' },
    { value: 'reggae', label: 'Reggae' },
    { value: 'blues', label: 'Blues' },
    { value: 'folk', label: 'Folk' },
    { value: 'metal', label: 'Metal' },
    { value: 'other', label: 'Другое' }
  ]

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
          <label htmlFor="genre-filter">Фильтр по жанру:</label>
          <select
            id="genre-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={styles.filterSelect}
          >
            {genres.map(genre => (
              <option key={genre.value} value={genre.value}>
                {genre.label}
              </option>
            ))}
          </select>
          <span className={styles.trackCount}>
            {tracks.length} {tracks.length === 1 ? 'трек' : 'треков'}
          </span>
        </div>

        {loading ? (
          <div className={styles.loading}>
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
          <div className={styles.tracksList}>
            {tracks.map((track) => (
              <div key={track.id} className={styles.trackCard}>
                <div className={styles.trackInfo}>
                  <div className={styles.trackHeader}>
                    <a href={`/track/${track.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <h3>{track.title}</h3>
                    </a>
                    <span className={styles.genre}>
                      {genres.find(g => g.value === track.genre)?.label || track.genre}
                    </span>
                  </div>

                  <div className={styles.author}>
                    <a 
                      href={`/profile/${track.profiles?.username}`}
                      className={styles.authorLink}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <span>👤 {track.profiles?.username || 'Неизвестный автор'}</span>
                      {track.profiles?.smule_verified && (
                        <span className={styles.verified}>✅</span>
                      )}
                      <span className={styles.level}>
                        ⭐ Ур. {track.profiles?.author_level || 1}
                      </span>
                    </a>
                  </div>

                  {track.description && (
                    <p className={styles.description}>{track.description}</p>
                  )}

                  <div className={styles.meta}>
                    <span>📅 {formatDate(track.created_at)}</span>
                    <span>▶️ {track.plays_count || 0} прослушиваний</span>
                    <span>💬 {track.reviews_count || 0} рецензий</span>
                    <span>📦 {formatFileSize(track.file_size)}</span>
                  </div>
                </div>

                <div className={styles.trackActions}>
                  <button
                    onClick={() => handlePlay(track)}
                    className={`${styles.playButton} ${
                      currentPlaying?.id === track.id ? styles.playing : ''
                    }`}
                  >
                    {currentPlaying?.id === track.id ? '⏸️ Пауза' : '▶️ Играть'}
                  </button>

                  <a
                    href={track.file_url}
                    download
                    className={styles.downloadButton}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    💾 Скачать
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {currentPlaying && (
          <div className={styles.nowPlaying}>
            <div className={styles.nowPlayingContent}>
              <span className={styles.nowPlayingIcon}>🎵</span>
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