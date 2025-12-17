import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Header from '@components/Header'
import Footer from '@components/Footer'
import ReviewForm from '@components/ReviewForm'
import ReviewsList from '@components/ReviewsList'
import { supabase } from '../../lib/supabase'
import styles from '@styles/TrackDetail.module.css'

export default function TrackDetail() {
  const router = useRouter()
  const { id } = router.query
  const [track, setTrack] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [currentPlaying, setCurrentPlaying] = useState(false)
  const [audioElement, setAudioElement] = useState(null)
  const [newReview, setNewReview] = useState(null)
  const [canReview, setCanReview] = useState(false)

  useEffect(() => {
    checkUser()

    const audio = new Audio()
    setAudioElement(audio)

    return () => {
      audio.pause()
      audio.src = ''
    }
  }, [])

  useEffect(() => {
    if (id) {
      loadTrack()
    }
  }, [id])

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      setCurrentUser(session?.user || null)
    } catch (error) {
      console.error('Ошибка проверки пользователя:', error)
    }
  }

  const loadTrack = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
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
        .eq('id', id)
        .single()

      if (error) throw error

      setTrack(data)

      // Проверяем, может ли текущий пользователь оставить рецензию
      if (currentUser && data.author_id !== currentUser.id) {
        const { data: existingReview } = await supabase
          .from('reviews')
          .select('id')
          .eq('track_id', id)
          .eq('reviewer_id', currentUser.id)
          .single()

        setCanReview(!existingReview)
      }

    } catch (error) {
      console.error('Ошибка загрузки трека:', error)
      if (error.code === 'PGRST116') {
        alert('Трек не найден')
        router.push('/tracks')
      }
    } finally {
      setLoading(false)
    }
  }

  const handlePlay = async () => {
    if (!audioElement || !track) return

    if (currentPlaying) {
      audioElement.pause()
      setCurrentPlaying(false)
    } else {
      audioElement.src = track.file_url
      audioElement.play()
      setCurrentPlaying(true)

      // Увеличиваем счётчик прослушиваний
      await supabase
        .from('tracks')
        .update({ plays_count: (track.plays_count || 0) + 1 })
        .eq('id', track.id)

      setTrack({ ...track, plays_count: (track.plays_count || 0) + 1 })
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

  const handleReviewAdded = (review) => {
    setNewReview(review)
    setCanReview(false)
    loadTrack() // Обновляем данные трека
  }

  if (loading) {
    return (
      <div className="container">
        <Head>
          <title>Загрузка... | MOIS Hub</title>
        </Head>
        <Header title="MOIS Hub" />
        <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p>Загрузка трека...</p>
        </main>
        <Footer />
      </div>
    )
  }

  if (!track) {
    return (
      <div className="container">
        <Head>
          <title>Трек не найден | MOIS Hub</title>
        </Head>
        <Header title="MOIS Hub" />
        <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <h2>😔 Трек не найден</h2>
            <a href="/tracks" style={{ color: '#667eea', fontWeight: 600 }}>← Вернуться к трекам</a>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="container">
      <Head>
        <title>{track.title} — {track.profiles?.username} | MOIS Hub</title>
        <meta name="description" content={track.description || `Трек ${track.title}`} />
      </Head>

      <Header title="MOIS Hub" />

      <main className={styles.main}>
        <a href="/tracks" className={styles.backLink}>← Назад к трекам</a>

        <div className={styles.trackHeader}>
          <div className={styles.trackInfo}>
            <h1>{track.title}</h1>
            <span className={styles.genre}>{track.genre}</span>
          </div>

          <a 
            href={`/profile/${track.profiles?.username}`}
            className={styles.author}
          >
            <span className={styles.avatar}>
              {track.profiles?.username?.charAt(0).toUpperCase()}
            </span>
            <div>
              <div className={styles.authorName}>
                {track.profiles?.username || 'Неизвестный'}
                {track.profiles?.smule_verified && ' ✅'}
              </div>
              <div className={styles.authorLevel}>
                ⭐ Ур. {track.profiles?.author_level || 1}
              </div>
            </div>
          </a>
        </div>

        <div className={styles.trackPlayer}>
          <button
            onClick={handlePlay}
            className={styles.playButton}
          >
            {currentPlaying ? '⏸️ Пауза' : '▶️ Играть'}
          </button>

          <a
            href={track.file_url}
            download
            target="_blank"
            rel="noopener noreferrer"
            className={styles.downloadButton}
          >
            💾 Скачать
          </a>
        </div>

        {track.description && (
          <div className={styles.description}>
            <h3>📝 Описание</h3>
            <p>{track.description}</p>
          </div>
        )}

        <div className={styles.stats}>
          <div className={styles.statItem}>
            <span className={styles.statIcon}>▶️</span>
            <span className={styles.statValue}>{track.plays_count || 0}</span>
            <span className={styles.statLabel}>прослушиваний</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statIcon}>💬</span>
            <span className={styles.statValue}>{track.reviews_count || 0}</span>
            <span className={styles.statLabel}>рецензий</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statIcon}>📅</span>
            <span className={styles.statValue}>{formatDate(track.created_at)}</span>
            <span className={styles.statLabel}>дата загрузки</span>
          </div>
        </div>

        {currentUser && canReview && track.status === 'approved' && (
          <ReviewForm trackId={track.id} onReviewAdded={handleReviewAdded} />
        )}

        {!currentUser && track.status === 'approved' && (
          <div className={styles.loginPrompt}>
            <p>💡 <a href="/login">Войдите</a>, чтобы оставить рецензию</p>
          </div>
        )}

        {currentUser && !canReview && track.author_id !== currentUser.id && (
          <div className={styles.alreadyReviewed}>
            <p>✅ Вы уже оставили рецензию на этот трек</p>
          </div>
        )}

        {currentUser && track.author_id === currentUser.id && (
          <div className={styles.ownTrack}>
            <p>💡 Это ваш трек. Вы не можете оставлять рецензии на свои треки.</p>
          </div>
        )}

        <ReviewsList trackId={track.id} newReview={newReview} />
      </main>

      <Footer />
    </div>
  )
}