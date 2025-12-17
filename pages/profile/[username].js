import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Header from '@components/Header'
import Footer from '@components/Footer'
import { supabase } from '../../lib/supabase'
import styles from '@styles/Profile.module.css'

export default function Profile() {
  const router = useRouter()
  const { username } = router.query
  const [currentUser, setCurrentUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [isOwnProfile, setIsOwnProfile] = useState(false)
  const [currentPlaying, setCurrentPlaying] = useState(null)
  const [audioElement, setAudioElement] = useState(null)

  useEffect(() => {
    checkCurrentUser()

    const audio = new Audio()
    setAudioElement(audio)

    return () => {
      audio.pause()
      audio.src = ''
    }
  }, [])

  useEffect(() => {
    if (username) {
      loadProfile()
    }
  }, [username])

  const checkCurrentUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      setCurrentUser(session?.user || null)
    } catch (error) {
      console.error('Ошибка проверки пользователя:', error)
    }
  }

  const loadProfile = async () => {
    try {
      setLoading(true)

      // Загружаем профиль по username
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single()

      if (profileError) throw profileError

      setProfile(profileData)

      // Проверяем, это профиль текущего пользователя?
      if (currentUser && currentUser.id === profileData.id) {
        setIsOwnProfile(true)
      }

      // Загружаем треки пользователя (только approved для чужих профилей)
      let tracksQuery = supabase
        .from('tracks')
        .select('*')
        .eq('author_id', profileData.id)
        .order('created_at', { ascending: false })

      // Если это не свой профиль, показываем только approved треки
      if (!currentUser || currentUser.id !== profileData.id) {
        tracksQuery = tracksQuery.eq('status', 'approved')
      }

      const { data: tracksData, error: tracksError } = await tracksQuery

      if (tracksError) throw tracksError

      setTracks(tracksData || [])

    } catch (error) {
      console.error('Ошибка загрузки профиля:', error)
      if (error.code === 'PGRST116') {
        alert('Пользователь не найден')
        router.push('/')
      }
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
    }
  }

  const handleDeleteTrack = async (trackId, fileUrl) => {
    if (!confirm('Вы уверены, что хотите удалить этот трек?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('tracks')
        .delete()
        .eq('id', trackId)

      if (error) throw error

      alert('✅ Трек удалён')
      loadProfile()
    } catch (error) {
      console.error('Ошибка удаления:', error)
      alert('❌ Ошибка при удалении трека')
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

  const getStatusBadge = (status) => {
    const badges = {
      pending: { text: '⏳ На модерации', color: '#fef3c7', textColor: '#92400e' },
      approved: { text: '✅ Одобрено', color: '#d1fae5', textColor: '#065f46' },
      rejected: { text: '❌ Отклонено', color: '#fee2e2', textColor: '#991b1b' }
    }
    return badges[status] || badges.pending
  }

  if (loading) {
    return (
      <div className="container">
        <Head>
          <title>Загрузка профиля... | MOIS Hub</title>
        </Head>
        <Header title="MOIS Hub" />
        <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p>Загрузка профиля...</p>
        </main>
        <Footer />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="container">
        <Head>
          <title>Профиль не найден | MOIS Hub</title>
        </Head>
        <Header title="MOIS Hub" />
        <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <h2>😔 Профиль не найден</h2>
            <p>Пользователь с таким именем не существует</p>
            <a href="/" style={{ color: '#667eea', fontWeight: 600 }}>← Вернуться на главную</a>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="container">
      <Head>
        <title>{profile.username} | MOIS Hub</title>
        <meta name="description" content={`Профиль ${profile.username} на MOIS Hub`} />
      </Head>

      <Header title="MOIS Hub" />

      <main className={styles.main}>
        {/* Шапка профиля */}
        <div className={styles.profileHeader}>
          <div className={styles.avatar}>
            {profile.username.charAt(0).toUpperCase()}
          </div>
          
          <div className={styles.profileInfo}>
            <h1 className={styles.username}>
              {profile.username}
              {profile.smule_verified && <span className={styles.verified}>✅</span>}
            </h1>
            
            <div className={styles.accountType}>
              {profile.account_type === 'author' ? '🎤 Автор' : 
               profile.account_type === 'reviewer' ? '💬 Рецензент' : 
               '🎤💬 Автор и Рецензент'}
            </div>

            {profile.smule_profile && (
              <a 
                href={profile.smule_profile} 
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.smuleLink}
              >
                🎵 Профиль Smule
              </a>
            )}
          </div>

          {isOwnProfile && (
            <div className={styles.editButton}>
              <button onClick={() => alert('Редактирование профиля — скоро!')}>
                ⚙️ Настройки
              </button>
            </div>
          )}
        </div>

        {/* Статистика */}
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statNumber}>{tracks.length}</div>
            <div className={styles.statLabel}>Треков</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statNumber}>{profile.total_reviews || 0}</div>
            <div className={styles.statLabel}>Рецензий</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statNumber}>{profile.author_level}</div>
            <div className={styles.statLabel}>Уровень автора</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statNumber}>{profile.author_xp}</div>
            <div className={styles.statLabel}>XP автора</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statNumber}>{profile.reviewer_level}</div>
            <div className={styles.statLabel}>Уровень рецензента</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statNumber}>{profile.reviewer_xp}</div>
            <div className={styles.statLabel}>XP рецензента</div>
          </div>
        </div>

        {/* Треки пользователя */}
        <div className={styles.tracksSection}>
          <h2>🎵 Треки {isOwnProfile ? '(ваши)' : `от ${profile.username}`}</h2>
          
          {tracks.length === 0 ? (
            <div className={styles.emptyTracks}>
              <p>😔 {isOwnProfile ? 'Вы ещё не загрузили ни одного трека' : 'Пользователь пока не загружал треки'}</p>
              {isOwnProfile && (
                <a href="/upload" className={styles.uploadButton}>
                  📤 Загрузить первый трек
                </a>
              )}
            </div>
          ) : (
            <div className={styles.tracksList}>
              {tracks.map(track => {
                const statusBadge = getStatusBadge(track.status)
                return (
                  <div key={track.id} className={styles.trackCard}>
                    <div className={styles.trackInfo}>
                      <h3>{track.title}</h3>
                      
                      {isOwnProfile && (
                        <span 
                          className={styles.statusBadge}
                          style={{ 
                            background: statusBadge.color, 
                            color: statusBadge.textColor 
                          }}
                        >
                          {statusBadge.text}
                        </span>
                      )}

                      <div className={styles.trackMeta}>
                        <span>🎵 {track.genre}</span>
                        <span>📅 {formatDate(track.created_at)}</span>
                        <span>▶️ {track.plays_count || 0}</span>
                        <span>💬 {track.reviews_count || 0}</span>
                      </div>

                      {track.description && (
                        <p className={styles.trackDescription}>{track.description}</p>
                      )}
                    </div>

                    <div className={styles.trackActions}>
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

                      {isOwnProfile && (
                        <button
                          onClick={() => handleDeleteTrack(track.id, track.file_url)}
                          className={styles.deleteButton}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {currentPlaying && (
          <div className={styles.nowPlaying}>
            <div className={styles.nowPlayingContent}>
              <span className={styles.nowPlayingIcon}>🎵</span>
              <div>
                <div className={styles.nowPlayingTitle}>{currentPlaying.title}</div>
                <div className={styles.nowPlayingArtist}>{profile.username}</div>
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