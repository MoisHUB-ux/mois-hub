import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Header from '@components/Header'
import Footer from '@components/Footer'
import { supabase } from '../lib/supabase'
import { Toast } from '../lib/toast'
import { ErrorHandler } from '../lib/errorHandler'
import styles from '@styles/Register.module.css'

export default function Settings() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [formData, setFormData] = useState({
    username: '',
    smuleNickname: '',
    bio: ''
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user) {
        router.push('/login')
        return
      }

      setUser(session.user)
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      setProfile(profileData)
      setFormData({
        username: profileData.username || '',
        smuleNickname: profileData.smule_nickname || '',
        bio: profileData.bio || ''
      })
    } catch (error) {
      console.error('Ошибка загрузки профиля:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value
    })

    if (errors[name]) {
      const newErrors = { ...errors }
      delete newErrors[name]
      setErrors(newErrors)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const newErrors = {}

    if (!formData.username || formData.username.length < 3) {
      newErrors.username = 'Никнейм должен быть не менее 3 символов'
    }

    if (formData.smuleNickname && !/^[a-zA-Z0-9_]+$/.test(formData.smuleNickname)) {
      newErrors.smuleNickname = 'Ник может содержать только буквы, цифры и подчёркивания'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setSaving(true)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: formData.username,
          smule_nickname: formData.smuleNickname || null,
          bio: formData.bio || null
        })
        .eq('id', user.id)

      if (error) throw error

      Toast.success('✅ Профиль успешно обновлён!')
      
      // Обновляем локальное состояние
      setProfile({
        ...profile,
        username: formData.username,
        smule_nickname: formData.smuleNickname,
        bio: formData.bio
      })
    } catch (error) {
      ErrorHandler.handle(error, 'updateProfile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container">
        <Head>
          <title>Настройки | MOIS Hub</title>
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
        <title>Настройки профиля | MOIS Hub</title>
      </Head>

      <Header title="Настройки" />

      <main className={styles.main}>
        <div className={styles.intro}>
          <h2>⚙️ Настройки профиля</h2>
          <p>Обновите информацию о себе</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="username">Никнейм *</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className={styles.input}
              placeholder="ВашНикнейм"
              disabled={saving}
            />
            {errors.username && <span className={styles.error}>{errors.username}</span>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="smuleNickname">Ник в Smule (опционально)</label>
            <input
              type="text"
              id="smuleNickname"
              name="smuleNickname"
              value={formData.smuleNickname}
              onChange={handleChange}
              className={styles.input}
              placeholder="username"
              disabled={saving}
            />
            {errors.smuleNickname && <span className={styles.error}>{errors.smuleNickname}</span>}
            <small className={styles.hint}>Ваш ник из Smule. Ссылка будет: smule.com/{formData.smuleNickname || 'ваш_ник'}</small>
            {formData.smuleNickname && (
              <small className={styles.hint}>
                <a 
                  href={`https://www.smule.com/${formData.smuleNickname}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: '#667eea' }}
                >
                  Проверить профиль Smule →
                </a>
              </small>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="bio">О себе (опционально)</label>
            <textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              className={styles.textarea}
              placeholder="Расскажите о себе..."
              rows="4"
              disabled={saving}
            />
            <small className={styles.hint}>Максимум 500 символов</small>
          </div>

          <button type="submit" className={styles.button} disabled={saving}>
            {saving ? 'Сохранение...' : '💾 Сохранить изменения'}
          </button>

          <div className={styles.footer}>
            <p><a href="/">← Вернуться на главную</a></p>
          </div>
        </form>

        <div style={{ 
          marginTop: '40px', 
          padding: '20px', 
          background: '#fff3cd', 
          borderRadius: '8px',
          border: '1px solid #ffc107'
        }}>
          <h3 style={{ marginTop: 0 }}>🔐 Смена пароля</h3>
          <p>Для смены пароля используйте функцию "Забыли пароль?" на странице входа. Мы отправим ссылку для сброса на вашу почту.</p>
          <p><strong>Email аккаунта:</strong> {user?.email}</p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
