import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Header from '@components/Header'
import Footer from '@components/Footer'
import { supabase } from '../lib/supabase'
import styles from '@styles/Register.module.css'

export default function Register() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    accountType: 'author',
    smuleProfile: ''
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  // Функция валидации email
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value
    })

    // Валидация в реальном времени
    const newErrors = { ...errors }
    
    if (name === 'username') {
      if (value.length > 0 && value.length < 3) {
        newErrors.username = 'Никнейм должен быть не менее 3 символов'
      } else {
        delete newErrors.username
      }
    }
    
    if (name === 'email') {
      if (value.length > 0 && !validateEmail(value)) {
        newErrors.email = 'Введите корректный email (например: user@example.com)'
      } else {
        delete newErrors.email
      }
    }
    
    if (name === 'password') {
      if (value.length > 0 && value.length < 6) {
        newErrors.password = 'Пароль должен быть не менее 6 символов'
      } else {
        delete newErrors.password
      }
      
      // Проверяем совпадение паролей
      if (formData.confirmPassword && value !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Пароли не совпадают'
      } else {
        delete newErrors.confirmPassword
      }
    }
    
    if (name === 'confirmPassword') {
      if (value.length > 0 && value !== formData.password) {
        newErrors.confirmPassword = 'Пароли не совпадают'
      } else {
        delete newErrors.confirmPassword
      }
    }

    if (name === 'smuleProfile') {
      if (value.length > 0 && !value.startsWith('https://')) {
        newErrors.smuleProfile = 'Ссылка должна начинаться с https://'
      } else {
        delete newErrors.smuleProfile
      }
    }

    setErrors(newErrors)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newErrors = {}

    // Финальная валидация перед отправкой
    if (!formData.username || formData.username.length < 3) {
      newErrors.username = 'Никнейм должен быть не менее 3 символов'
    }
    if (!formData.email || !validateEmail(formData.email)) {
      newErrors.email = 'Введите корректный email (например: user@example.com)'
    }
    if (!formData.password || formData.password.length < 6) {
      newErrors.password = 'Пароль должен быть не менее 6 символов'
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Пароли не совпадают'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)

    try {
      // Регистрация через Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            username: formData.username,
            account_type: formData.accountType,
            smule_profile: formData.smuleProfile || null
          }
        }
      })

      if (error) throw error

      console.log('Зарегистрирован пользователь:', data.user)
      console.log('Метаданные:', data.user?.user_metadata)

      alert('✅ Регистрация успешна! Проверьте email для подтверждения аккаунта.')
      router.push('/login')
      
    } catch (error) {
      console.error('Ошибка регистрации:', error)
      
      if (error.message.includes('already registered') || error.message.includes('User already registered')) {
        setErrors({ email: 'Этот email уже зарегистрирован' })
      } else if (error.message.includes('duplicate key')) {
        setErrors({ username: 'Этот никнейм уже занят' })
      } else if (error.message.includes('invalid')) {
        setErrors({ email: 'Введите корректный email адрес' })
      } else {
        setErrors({ general: error.message })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <Head>
        <title>Регистрация | MOIS Hub</title>
        <meta name="description" content="Присоединяйтесь к сообществу музыкантов" />
      </Head>

      <Header title="Добро пожаловать в MOIS Hub" />

      <main className={styles.main}>
        <div className={styles.intro}>
          <h2>Создайте аккаунт</h2>
          <p>Присоединяйтесь к сообществу музыкантов, делитесь своим творчеством и получайте обратную связь</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {errors.general && (
            <div style={{ color: '#e53e3e', marginBottom: '1rem', padding: '0.75rem', background: '#fff5f5', borderRadius: '6px' }}>
              {errors.general}
            </div>
          )}

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
              disabled={loading}
            />
            {errors.username && <span className={styles.error}>{errors.username}</span>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="email">Email *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={styles.input}
              placeholder="user@example.com"
              disabled={loading}
            />
            {errors.email && <span className={styles.error}>{errors.email}</span>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password">Пароль *</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={styles.input}
              placeholder="Минимум 6 символов"
              disabled={loading}
            />
            {errors.password && <span className={styles.error}>{errors.password}</span>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword">Подтвердите пароль *</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className={styles.input}
              disabled={loading}
            />
            {errors.confirmPassword && <span className={styles.error}>{errors.confirmPassword}</span>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="accountType">Тип аккаунта *</label>
            <select
              id="accountType"
              name="accountType"
              value={formData.accountType}
              onChange={handleChange}
              className={styles.input}
              disabled={loading}
            >
              <option value="author">Автор (выкладываю треки)</option>
              <option value="reviewer">Рецензент (оцениваю треки)</option>
              <option value="both">Автор и Рецензент</option>
            </select>
            <small className={styles.hint}>Вы сможете изменить это позже в настройках</small>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="smuleProfile">Профиль Smule (опционально)</label>
            <input
              type="url"
              id="smuleProfile"
              name="smuleProfile"
              value={formData.smuleProfile}
              onChange={handleChange}
              className={styles.input}
              placeholder="https://www.smule.com/username"
              disabled={loading}
            />
            {errors.smuleProfile && <span className={styles.error}>{errors.smuleProfile}</span>}
            <small className={styles.hint}>Для верификации и повышения доверия</small>
          </div>

          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>

          <div className={styles.footer}>
            <p>Уже есть аккаунт? <a href="/login">Войти</a></p>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  )
}