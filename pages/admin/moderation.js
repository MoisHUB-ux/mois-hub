import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Header from '@components/Header'
import Footer from '@components/Footer'
import { supabase } from '../../lib/supabase'
import styles from '@styles/Moderation.module.css'

export default function Moderation() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tracks, setTracks] = useState([])
  const [filter, setFilter] = useState('pending') // pending, approved, rejected, all
  const [audioElement, setAudioElement] = useState(null)
  const [currentPlaying, setCurrentPlaying] = useState(null)

  useEffect(() => {
    checkAdminAccess()

    const audio = new Audio()
    setAudioElement(audio)

    return () => {
      audio.pause()
      audio.src = ''
    }
  }, [])

  useEffect(() => {
    if (isAdmin) {
      loadTracks()
    }
  }, [isAdmin, filter])

  const checkAdminAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user) {
        router.push('/login')
        return
      }

      setUser(session.user)

      // Проверяем, является ли пользователь админом
      const { data: adminData, error } = await supabase
        .from('admins')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (error || !adminData) {
        alert('У вас нет доступа к панели модерации')
        router.push('/')
        return
      }

      setIsAdmin(true)
    } catch (error) {
      console.error('Ошибка проверки доступа:', error)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const loadTracks = async () => {
    try {
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
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error

      setTracks(data || [])
    } catch (error) {
      console.error('Ошибка загрузки треков:', error)
    }
  }

  const handleStatusChange = async (trackId, newStatus) => {
    try {
      const { error } = await supabase
        .from('tracks')
        .update({ status: newStatus })
        .eq('id', trackId)

      if (error) throw error

      alert(`✅ Статус трека изменён на: ${newStatus}`)
      loadTracks()
    } catch (error) {
      console.error('Ошибка изменения статуса:', error)
      alert('❌ Ошибка при изменении статуса')
    }
  }

  const handleDelete = async (trackId, fileUrl) => {
    if (!confirm('Вы уверены, что хотите удалить этот трек?')) {
      return
    }

    try {
      // Удаляем запись из БД
      const { error: dbError } = await supabase
        .from('tracks')
        .delete()
        .eq('id', trackId)

      if (dbError) throw dbError

      // Удаляем файл из Storage (опционально)
      try {
        const fileName = fileUrl.split('/tracks/')[1]
        if (fileName) {
          await supabase.storage
            .from('tracks')
            .remove([fileName])
        }
      } catch (storageError) {
        console.warn('Не удалось удалить файл из Storage:', storageError)
      }

      alert('✅ Трек удалён')
      loadTracks()
    } catch (error) {
      console.error('Ошибка удаления:', error)
      alert('❌ Ошибка при удалении трека')
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
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatFileSize = (bytes) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' МБ'
  }

  if (loading) {
    return (
      <div className="container">
        <Head>
          <title>Модерация треков | MOIS Hub</title>
        </Head>
        <Header title="MOIS Hub" />
        <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p>Проверка доступа...</p>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="container">
      <Head>
        <title>Модерация треков | MOIS Hub</title>
      </Head>

      <Header title="MOIS Hub" />

      <main className={styles.main}>
        <div className={styles.header}>
          <h1>🛡️ Панель модерации</h1>
          <p>Управление треками платформы</p>
        </div>

        <div className={styles.filters}>
          <button
            onClick={() => setFilter('pending')}
            className={`${styles.filterButton} ${filter === 'pending' ? styles.active : ''}`}
          >
            ⏳ На модерации ({tracks.filter(t => t.status === 'pending').length})
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`${styles.filterButton} ${filter === 'approved' ? styles.active : ''}`}
          >
            ✅ Одобрено
          </button>
          <button
            onClick={() => setFilter('rejected')}
            className={`${styles.filterButton} ${filter === 'rejected' ? styles.active : ''}`}
          >
            ❌ Отклонено
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`${styles.filterButton} ${filter === 'all' ? styles.active : ''}`}
          >
            📋 Все треки
          </button>
        </div>

        <div className={styles.stats}>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>{tracks.length}</span>
            <span className={styles.statLabel}>Всего треков</span>
          </div>
        </div>

        {tracks.length === 0 ? (
          <div className={styles.empty}>
            <h2>Треки не найдены</h2>
            <p>В этой категории пока нет треков</p>
          </div>
        ) : (
          <div className={styles.tracksList}>
            {tracks.map((track) => (
              <div key={track.id} className={styles.trackCard}>
                <div className={styles.trackInfo}>
                  <div className={styles.trackHeader}>
                    <h3>{track.title}</h3>
                    <span className={`${styles.statusBadge} ${styles[track.status]}`}>
                      {track.status === 'pending' ? '⏳ На модерации' : 
                       track.status === 'approved' ? '✅ Одобрено' : 
                       '❌ Отклонено'}
                    </span>
                  </div>

                  <div className={styles.author}>
                    <span>👤 {track.profiles?.username || 'Неизвестный автор'}</span>
                    {track.profiles?.smule_verified && <span>✅</span>}
                    <span className={styles.level}>⭐ Ур. {track.profiles?.author_level || 1}</span>
                  </div>

                  {track.description && (
                    <p className={styles.description}>{track.description}</p>
                  )}

                  <div className={styles.meta}>
                    <span>🎵 Жанр: {track.genre}</span>
                    <span>📅 {formatDate(track.created_at)}</span>
                    <span>📦 {formatFileSize(track.file_size)}</span>
                    <span>▶️ {track.plays_count || 0} прослушиваний</span>
                  </div>
                </div>

                <div className={styles.actions}>
                  <button
                    onClick={() => handlePlay(track)}
                    className={styles.playButton}
                  >
                    {currentPlaying?.id === track.id ? '⏸️' : '▶️'}
                  </button>

                  <a
                    href={track.file_url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.downloadButton}
                  >
                    💾
                  </a>

                  {track.status !== 'approved' && (
                    <button
                      onClick={() => handleStatusChange(track.id, 'approved')}
                      className={styles.approveButton}
                      title="Одобрить"
                    >
                      ✅ Одобрить
                    </button>
                  )}

                  {track.status !== 'rejected' && (
                    <button
                      onClick={() => handleStatusChange(track.id, 'rejected')}
                      className={styles.rejectButton}
                      title="Отклонить"
                    >
                      ❌ Отклонить
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(track.id, track.file_url)}
                    className={styles.deleteButton}
                    title="Удалить навсегда"
                  >
                    🗑️ Удалить
                  </button>
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