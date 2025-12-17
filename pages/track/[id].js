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
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [showLyrics, setShowLyrics] = useState(false)
  const [showInfo, setShowInfo] = useState(true)
  const [repeat, setRepeat] = useState(false)
  const [audioElement, setAudioElement] = useState(null)
  const [newReview, setNewReview] = useState(null)
  const [canReview, setCanReview] = useState(false)

  useEffect(() => {
    checkUser()
    const audio = new Audio()
    setAudioElement(audio)
    return () => { audio.pause(); audio.src = '' }
  }, [])

  useEffect(() => { if (id) loadTrack() }, [id])

  useEffect(() => {
    if (!audioElement || !track?.file_url) return
    audioElement.src = track.file_url
    audioElement.volume = volume
    
    const onMetadata = () => setDuration(audioElement.duration)
    const onTimeUpdate = () => setCurrentTime(audioElement.currentTime)
    const onEnded = () => {
      if (repeat) { audioElement.currentTime = 0; audioElement.play() }
      else { setIsPlaying(false); setCurrentTime(0) }
    }
    
    audioElement.addEventListener('loadedmetadata', onMetadata)
    audioElement.addEventListener('timeupdate', onTimeUpdate)
    audioElement.addEventListener('ended', onEnded)
    
    return () => {
      audioElement.removeEventListener('loadedmetadata', onMetadata)
      audioElement.removeEventListener('timeupdate', onTimeUpdate)
      audioElement.removeEventListener('ended', onEnded)
    }
  }, [audioElement, track, repeat])

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    setCurrentUser(session?.user || null)
  }

  const loadTrack = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('tracks')
        .select(`*, profiles:author_id (id, username, author_level, smule_verified)`)
        .eq('id', id)
        .single()
      if (error) throw error
      setTrack(data)
    } catch (error) {
      console.error('Ошибка:', error)
      if (error.code === 'PGRST116') router.push('/tracks')
    } finally {
      setLoading(false)
    }
  }

  const togglePlay = () => {
    if (!audioElement) return
    if (isPlaying) { audioElement.pause(); setIsPlaying(false) }
    else { audioElement.play(); setIsPlaying(true) }
  }

  const handleSeek = (e) => {
    if (!audioElement) return
    audioElement.currentTime = parseFloat(e.target.value)
  }

  const handleVolumeChange = (e) => {
    const v = parseFloat(e.target.value)
    if (audioElement) audioElement.volume = v
    setVolume(v)
  }

  const skip = (s) => {
    if (!audioElement) return
    audioElement.currentTime = Math.max(0, Math.min(audioElement.duration, audioElement.currentTime + s))
  }

  const formatTime = (s) => {
    if (isNaN(s)) return '0:00'
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`
  }

  const formatDate = (d) => new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

  if (loading) return (
    <div className="container">
      <Header title="MOIS Hub" />
      <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Загрузка...</p>
      </main>
      <Footer />
    </div>
  )

  if (!track) return (
    <div className="container">
      <Header title="MOIS Hub" />
      <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Трек не найден</p>
      </main>
      <Footer />
    </div>
  )

  return (
    <div className="container">
      <Head><title>{track.title} | MOIS Hub</title></Head>
      <Header title="MOIS Hub" />
      <main className={styles.main}>
        <a href="/tracks" className={styles.backLink}>← Назад</a>

        <div className={styles.contentGrid}>
          <div className={styles.playerSection}>
            {track.cover_url ? (
              <img src={track.cover_url} alt="" className={styles.coverImage} />
            ) : (
              <div className={styles.coverPlaceholder}><span className={styles.coverIcon}>🎵</span></div>
            )}
            
            <h1 className={styles.trackTitle}>{track.title}</h1>
            <div className={styles.artistName}>{track.profiles?.username} {track.profiles?.smule_verified && '✅'}</div>
            <div className={styles.genreBadge}>{track.genre}</div>

            <div className={styles.progressSection}>
              <span className={styles.timeLabel}>{formatTime(currentTime)}</span>
              <input type="range" min="0" max={duration || 0} value={currentTime} onChange={handleSeek} className={styles.progressBar} />
              <span className={styles.timeLabel}>{formatTime(duration)}</span>
            </div>

            <div className={styles.controls}>
              <button onClick={() => skip(-10)} className={styles.controlButton}>⏪</button>
              <button onClick={togglePlay} className={styles.playButtonLarge}>{isPlaying ? '⏸️' : '▶️'}</button>
              <button onClick={() => skip(10)} className={styles.controlButton}>⏩</button>
            </div>

            <div className={styles.secondaryControls}>
              <button onClick={() => setRepeat(!repeat)} className={`${styles.iconButton} ${repeat ? styles.active : ''}`}>🔁</button>
              <div className={styles.volumeControl}>
                <span>{volume === 0 ? '🔇' : '🔊'}</span>
                <input type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolumeChange} className={styles.volumeSlider} />
              </div>
              <a href={track.file_url} download className={styles.iconButton}>💾</a>
            </div>
          </div>

          <div className={styles.contentSection}>
            <div className={styles.tabs}>
              <button onClick={() => { setShowInfo(true); setShowLyrics(false) }} className={`${styles.tab} ${showInfo ? styles.activeTab : ''}`}>📝 Информация</button>
              {track.lyrics && <button onClick={() => { setShowLyrics(true); setShowInfo(false) }} className={`${styles.tab} ${showLyrics ? styles.activeTab : ''}`}>🎤 Текст</button>}
            </div>

            {showInfo && (
              <div className={styles.tabContent}>
                {track.description && <div className={styles.descriptionBlock}><h3>Описание</h3><p>{track.description}</p></div>}
                <div className={styles.statsGrid}>
                  <div className={styles.statCard}><span className={styles.statIcon}>▶️</span><span className={styles.statValue}>{track.plays_count || 0}</span><span className={styles.statLabel}>прослушиваний</span></div>
                  <div className={styles.statCard}><span className={styles.statIcon}>📅</span><span className={styles.statValue}>{formatDate(track.created_at)}</span><span className={styles.statLabel}>загружено</span></div>
                </div>
              </div>
            )}

            {showLyrics && track.lyrics && (
              <div className={styles.tabContent}>
                <div className={styles.lyricsBlock}><pre className={styles.lyricsText}>{track.lyrics}</pre></div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.reviewsSection}>
          <h2 className={styles.sectionTitle}>💬 Рецензии</h2>
          {currentUser && track.status === 'approved' && <ReviewForm trackId={track.id} onReviewAdded={() => loadTrack()} />}
          {!currentUser && <div className={styles.loginPrompt}><a href="/login">Войдите</a>, чтобы оставить рецензию</div>}
          <ReviewsList trackId={track.id} newReview={newReview} />
        </div>
      </main>
      <Footer />
    </div>
  )
}