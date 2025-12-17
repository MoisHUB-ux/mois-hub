import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'

export default function Header({ title }) {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    checkUser()

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user)
        await checkAdminStatus(session.user.id)
      } else {
        setUser(null)
        setIsAdmin(false)
      }
    })

    return () => {
      authListener?.subscription?.unsubscribe()
    }
  }, [])

  const checkUser = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        setUser(session.user)
        await checkAdminStatus(session.user.id)
      } else {
        setUser(null)
        setIsAdmin(false)
      }
    } catch (error) {
      console.error('Ошибка проверки пользователя:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkAdminStatus = async (userId) => {
    try {
      // Загружаем профиль
      const { data: profileData } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .single()
      
      if (profileData) {
        setProfile(profileData)
      }

      // Проверяем админа
      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .eq('user_id', userId)
        .single()
      
      if (data && !error) {
        setIsAdmin(true)
      } else {
        setIsAdmin(false)
      }
    } catch (error) {
      console.error('Ошибка проверки админа:', error)
      setIsAdmin(false)
    }
  }

  const handleUploadClick = () => {
    if (!user) {
      router.push('/login')
    } else {
      router.push('/upload')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsAdmin(false)
    router.push('/login')
  }

  return (
    <header style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      padding: '1rem 2rem',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <a href="/" style={{ textDecoration: 'none', color: 'white' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>
            {title || 'MOIS Hub'}
          </h1>
        </a>

        <nav style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <a href="/" style={{
            color: 'white',
            textDecoration: 'none',
            fontWeight: '500',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            transition: 'background 0.2s',
            fontSize: '0.95rem'
          }}
          onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={(e) => e.target.style.background = 'transparent'}
          >
            Главная
          </a>

          <a href="/tracks" style={{
            color: 'white',
            textDecoration: 'none',
            fontWeight: '500',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            transition: 'background 0.2s',
            fontSize: '0.95rem'
          }}
          onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={(e) => e.target.style.background = 'transparent'}
          >
            🎵 Треки
          </a>

          {!loading && isAdmin && (
            <a href="/admin/moderation" style={{
              color: 'white',
              textDecoration: 'none',
              fontWeight: '600',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              transition: 'background 0.2s',
              fontSize: '0.95rem',
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.3)'
            }}
            onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.25)'}
            onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.15)'}
            >
              🛡️ Модерация
            </a>
          )}

          {user && profile && (
            <a href={`/profile/${profile.username}`} style={{
              color: 'white',
              textDecoration: 'none',
              fontWeight: '500',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              transition: 'background 0.2s',
              fontSize: '0.95rem'
            }}
            onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.target.style.background = 'transparent'}
            >
              👤 Профиль
            </a>
          )}

          <button
            onClick={handleUploadClick}
            style={{
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '2px solid white',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.9rem',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'white'
              e.target.style.color = '#667eea'
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255,255,255,0.2)'
              e.target.style.color = 'white'
            }}
          >
            📤 Загрузить
          </button>

          {user ? (
            <button
              onClick={handleLogout}
              style={{
                background: 'transparent',
                color: 'white',
                border: '1px solid white',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                fontWeight: '500',
                cursor: 'pointer',
                fontSize: '0.9rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255,255,255,0.1)'
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent'
              }}
            >
              Выйти
            </button>
          ) : (
            <>
              <a href="/login" style={{
                color: 'white',
                textDecoration: 'none',
                fontWeight: '500',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                transition: 'background 0.2s',
                fontSize: '0.9rem'
              }}
              onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
              onMouseLeave={(e) => e.target.style.background = 'transparent'}
              >
                Войти
              </a>
              <a href="/register" style={{
                background: 'white',
                color: '#667eea',
                textDecoration: 'none',
                fontWeight: '600',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                transition: 'all 0.2s',
                fontSize: '0.9rem'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#f0f0f0'
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'white'
              }}
              >
                Регистрация
              </a>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
