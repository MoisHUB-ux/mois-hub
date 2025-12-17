import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Header from '@components/Header'
import Footer from '@components/Footer'
import { supabase } from '../lib/supabase'
import styles from '@styles/Register.module.css'

export default function Login() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

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

    const newErrors = { ...errors }
    
    if (name === 'email') {
      if (value.length > 0 && !validateEmail(value)) {
        newErrors.email = 'Введите корректный email'
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
    }

    setErrors(newErrors)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    setErrors({})
    
    const newErrors = {}

    if (!formData.email || !validateEmail(formData.email)) {
      newErrors.email = 'Введите корректный email'
    }
    if (!formData.password || formData.password.length < 6) {
      newErrors.password = 'Пароль должен быть не менее 6 символов'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)

    // Оборачиваем в try-catch сразу
    let result
    try {
      result = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      })
    } catch (err) {
      console.error('Catch ошибка:', err)
      setErrors({ general: 'Произошла ошибка подключения' })
      setLoading(false)
      return
    }

    const { data, error } = result

    if (error) {
      console.error('Supabase ошибка:', error)
      
      if (error.message.includes('Invalid login credentials')) {
        setErrors({ general: 'Неверный email или пароль' })
      } else if (error.message.includes('Email not confirmed')) {
        setErrors({ general: 'Подтвердите email перед входом. Проверьте почту и перейдите по ссылке из письма.' })
      } else {
        setErrors({ general: error.message || 'Ошибка входа' })
      }
      setLoading(false)
      return
    }

    console.log('Успешный вход:', data.user)
    router.push('/')
  }

  return (
    <div className="container">
      <Head>
        <title>Вход | MOIS Hub</title>
        <meta name="description" content="Войдите в свой аккаунт" />
      </Head>

      <Header title="С возвращением!" />

      <main className={styles.main}>
        <div className={styles.intro}>
          <h2>Вход в аккаунт</h2>
          <p>Войдите, чтобы продолжить создавать музыку и получать фидбек</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {errors.general && (
            <div style={{ 
              color: '#e53e3e', 
              marginBottom: '1rem', 
              padding: '0.75rem', 
              background: '#fff5f5', 
              borderRadius: '6px',
              border: '1px solid #fc8181'
            }}>
              {errors.general}
            </div>
          )}

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
              autoComplete="email"
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
              placeholder="Введите пароль"
              disabled={loading}
              autoComplete="current-password"
            />
            {errors.password && <span className={styles.error}>{errors.password}</span>}
          </div>

          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? 'Вход...' : 'Войти'}
          </button>

          <div className={styles.footer}>
            <p>Нет аккаунта? <a href="/register">Зарегистрироваться</a></p>
            <p><a href="/reset-password" style={{ fontSize: '0.9rem', opacity: 0.8 }}>Забыли пароль?</a></p>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  )
}