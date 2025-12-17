import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Header from '@components/Header'
import Footer from '@components/Footer'
import { supabase } from '../lib/supabase'
import styles from '@styles/Home.module.css'

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [recentTracks, setRecentTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentPlaying, setCurrentPlaying] = useState(null)
  const [audioElement, setAudioElement] = useState(null)

  useEffect(() => {
    checkUser()
    loadRecentTracks()

    const audio = new Audio()
    setAudioElement(audio)

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user)
        loadProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
      }
    })

    return () => {
      authListener?.subscription?.unsubscribe()
      audio.pause()
      audio.src = ''
    }
  }, [])

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        setUser(session.user)
        await loadProfile(session.user.id)
      }
    } catch (error) {
      console.error('Ошибка проверки пользователя:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setProfile(data)
    } catch (error) {
      console.error('Ошибка загрузки профиля:', error)
    }
  }

  const loadRecentTracks = async () => {
    try {
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
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(6)

      if (error) throw error

      setRecentTracks(data || [])
    } catch (error) {
      console.error('Ошибка загрузки треков:', error)
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
      month: 'long'
    })
  }

  if (loading) {
    return (
      <div className="container">
        <Head>
          <title>MOIS Hub - Платформа для музыкантов</title>
        </Head>
        <Header title="MOIS Hub" />
        <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p>Загрузка...</p>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="container">
      <Head>
        <title>MOIS Hub - Платформа для музыкантов</title>
        <meta name="description" content="Загружайте треки, получайте рецензии и участвуйте в конкурсах" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Header title="MOIS Hub" />

      <main className={styles.main}>
        {/* Hero секция */}
        <section className={styles.hero}>
          <h1>🎵 Добро пожаловать в MOIS Hub!</h1>
          <p className={styles.heroSubtitle}>
            Платформа для музыкантов: выкладывайте треки, получайте рецензии и участвуйте в конкурсах
          </p>
          
          {user && profile ? (
            <div className={styles.userWelcome}>
              <p>Привет, <a href={`/profile/${profile.username}`}>{profile.username}</a>! 👋</p>
              <div className={styles.quickActions}>
                <a href="/upload" className={styles.primaryButton}>
                  📤 Загрузить трек
                </a>
                <a href={`/profile/${profile.username}`} className={styles.secondaryButton}>
                  👤 Мой профиль
                </a>
              </div>
            </div>
          ) : (
            <div className={styles.authButtons}>
              <a href="/register" className={styles.primaryButton}>
                Зарегистрироваться
              </a>
              <a href="/login" className={styles.secondaryButton}>
                Войти
              </a>
            </div>
          )}
        </section>

        {/* Последние треки */}
        <section className={styles.recentTracks}>
          <div className={styles.sectionHeader}>
            <h2>🔥 Недавно добавленные треки</h2>
            <a href="/tracks" className={styles.viewAll}>Все треки →</a>
          </div>

          {recentTracks.length === 0 ? (
            <div className={styles.emptyState}>
              <p>😔 Пока нет треков</p>
              <a href="/upload" className={styles.uploadLink}>
                Загрузите первый трек!
              </a>
            </div>
          ) : (
            <div className={styles.tracksGrid}>
              {recentTracks.map(track => (
                <div key={track.id} className={styles.trackCard}>
                  <div className={styles.trackHeader}>
                    <h3>{track.title}</h3>
                    <span className={styles.genre}>{track.genre}</span>
                  </div>

                  <a 
                    href={`/profile/${track.profiles?.username}`}
                    className={styles.author}
                  >
                    👤 {track.profiles?.username || 'Неизвестный'}
                    {track.profiles?.smule_verified && ' ✅'}
                  </a>

                  <div className={styles.trackMeta}>
                    <span>📅 {formatDate(track.created_at)}</span>
                    <span>▶️ {track.plays_count || 0}</span>
                  </div>

                  <button
                    onClick={() => handlePlay(track)}
                    className={styles.playButton}
                  >
                    {currentPlaying?.id === track.id ? '⏸️ Пауза' : '▶️ Играть'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Возможности платформы */}
        <section className={styles.features}>
          <h2>✨ Возможности платформы</h2>
          <div className={styles.featuresGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>📤</div>
              <h3>Загружайте треки</h3>
              <p>Делитесь своими песнями и каверами с сообществом</p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>💬</div>
              <h3>Получайте рецензии</h3>
              <p>Конструктивная обратная связь от других музыкантов</p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>⭐</div>
              <h3>Прокачивайте уровень</h3>
              <p>Система XP и уровней для авторов и рецензентов</p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🏆</div>
              <h3>Участвуйте в конкурсах</h3>
              <p>Регулярные музыкальные челленджи и призы</p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>✅</div>
              <h3>Верификация Smule</h3>
              <p>Подтвердите профиль через Smule аккаунт</p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🎧</div>
              <h3>Слушайте онлайн</h3>
              <p>Встроенный плеер для прослушивания треков</p>
            </div>
          </div>
        </section>

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
