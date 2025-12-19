import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Header from '@components/Header'
import Footer from '@components/Footer'
import { supabase } from '../lib/supabase'
import { rateLimit } from '../lib/rateLimiter'
import { validateAudioFile } from '../lib/fileValidation'
import styles from '@styles/Upload.module.css'

export default function Upload() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  
  const [uploadMode, setUploadMode] = useState('file') // 'file' or 'smule'
  const [smuleUrl, setSmuleUrl] = useState('')
  const [smuleCookie, setSmuleCookie] = useState('')
  const [smuleFetching, setSmuleFetching] = useState(false)
  const [showCookieHelp, setShowCookieHelp] = useState(false)
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    tags: '',
    trackType: 'original',
    originalTitle: '',
    file: null,
    coverImage: null,
    lyrics: ''
  })
  const [errors, setErrors] = useState({})
  const [coverPreview, setCoverPreview] = useState(null)

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

      if (profileData?.account_type === 'reviewer') {
        alert('Только авторы могут загружать треки. Измените тип аккаунта в настройках.')
        router.push('/')
      }
    } catch (error) {
      console.error('Ошибка проверки пользователя:', error)
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

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    
    if (!file) return

    const newErrors = {}

    // Проверяем MIME-тип И расширение (для мобильных)
    const allowedExtensions = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'webm']
    const fileExtension = file.name.split('.').pop().toLowerCase()
    const isAudio = file.type.includes('audio') || allowedExtensions.includes(fileExtension)

    if (!isAudio) {
      newErrors.file = 'Выберите аудио файл (MP3, WAV, OGG, M4A, AAC)'
    }

    if (file.size > 50 * 1024 * 1024) {
      newErrors.file = 'Размер файла не должен превышать 50 МБ'
    }

    if (file.size === 0) {
      newErrors.file = 'Файл пустой или повреждён'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      e.target.value = ''
      return
    }

    setFormData({
      ...formData,
      file: file
    })

    if (errors.file) {
      const newErrors = { ...errors }
      delete newErrors.file
      setErrors(newErrors)
    }
  }

  const handleCoverChange = (e) => {
    const file = e.target.files[0]
    
    if (!file) return

    const newErrors = {}

    if (!file.type.includes('image')) {
      newErrors.coverImage = 'Выберите изображение (JPG, PNG, GIF и т.д.)'
    }

    if (file.size > 5 * 1024 * 1024) {
      newErrors.coverImage = 'Размер изображения не должен превышать 5 МБ'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      e.target.value = ''
      return
    }

    setFormData({
      ...formData,
      coverImage: file
    })

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setCoverPreview(reader.result)
    }
    reader.readAsDataURL(file)

    if (errors.coverImage) {
      const newErrors = { ...errors }
      delete newErrors.coverImage
      setErrors(newErrors)
    }
  }

  const handleSmuleImport = async () => {
    if (!smuleUrl) {
      alert('❌ Введите URL записи Smule')
      return
    }

    if (!smuleCookie) {
      alert('⚠️ Добавьте ваш session cookie для доступа к Smule API')
      setShowCookieHelp(true)
      return
    }

    setSmuleFetching(true)

    try {
      const response = await fetch('/api/smule-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          recordingUrl: smuleUrl,
          cookie: smuleCookie 
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка импорта')
      }

      // Скачиваем аудио
      const audioResponse = await fetch(data.audioUrl)
      if (!audioResponse.ok) throw new Error('Не удалось загрузить аудио')
      
      const audioBlob = await audioResponse.blob()
      const audioFile = new File([audioBlob], `${data.title}.m4a`, { type: 'audio/mp4' })

      // Скачиваем обложку
      let coverFile = null
      if (data.coverUrl) {
        try {
          const coverResponse = await fetch(data.coverUrl)
          if (coverResponse.ok) {
            const coverBlob = await coverResponse.blob()
            coverFile = new File([coverBlob], `${data.title}-cover.jpg`, { type: 'image/jpeg' })
            
            const reader = new FileReader()
            reader.onloadend = () => setCoverPreview(reader.result)
            reader.readAsDataURL(coverFile)
          }
        } catch (err) {
          console.error('Ошибка загрузки обложки:', err)
        }
      }

      // Заполняем форму
      setFormData({
        ...formData,
        title: data.title || '',
        description: `Исполнитель: ${data.performerName || 'Неизвестен'}\nОригинал: ${data.artist || 'Неизвестен'}`,
        file: audioFile,
        coverImage: coverFile,
        trackType: 'cover',
        originalTitle: data.artist || ''
      })

      alert('✅ Трек успешно импортирован!')
      setUploadMode('file') // Переключаем на режим файла
    } catch (error) {
      console.error('Ошибка импорта:', error)
      alert(`❌ ${error.message}`)
    } finally {
      setSmuleFetching(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    setErrors({})
    const newErrors = {}

    // Rate limiting
    const rateLimitResult = rateLimit(user.id, 5, 60000)
    if (!rateLimitResult.success) {
      const waitMinutes = Math.ceil((rateLimitResult.resetTime - Date.now()) / 60000)
      newErrors.general = `Слишком много загрузок. Подождите ${waitMinutes} мин.`
      setErrors(newErrors)
      return
    }

    // Валидация названия
    if (!formData.title || formData.title.length < 3) {
      newErrors.title = 'Название должно быть не менее 3 символов'
    }

    // Валидация для каверов
    if (formData.trackType === 'cover' && !formData.originalTitle) {
      newErrors.originalTitle = 'Укажите название оригинала для кавера'
    }

    // Валидация файла
    if (!formData.file) {
      newErrors.file = 'Выберите аудио файл'
    } else {
      const validation = validateAudioFile(formData.file)
      if (!validation.valid) {
        newErrors.file = validation.errors.join(', ')
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      // Upload audio file
      const fileExt = formData.file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('tracks')
        .upload(fileName, formData.file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      setUploadProgress(30)

      const { data: { publicUrl } } = supabase.storage
        .from('tracks')
        .getPublicUrl(fileName)

      setUploadProgress(50)

      // Upload cover image if provided
      let coverUrl = null
      if (formData.coverImage) {
        const coverExt = formData.coverImage.name.split('.').pop()
        const coverFileName = `covers/${user.id}/${Date.now()}.${coverExt}`
        
        const { data: coverUploadData, error: coverUploadError } = await supabase.storage
          .from('tracks')
          .upload(coverFileName, formData.coverImage, {
            cacheControl: '3600',
            upsert: false
          })

        if (coverUploadError) {
          console.error('Ошибка загрузки обложки:', coverUploadError)
        } else {
          const { data: { publicUrl: coverPublicUrl } } = supabase.storage
            .from('tracks')
            .getPublicUrl(coverFileName)
          coverUrl = coverPublicUrl
        }
      }

      setUploadProgress(75)

      // Обрабатываем теги: разделяем по пробелам и убираем пустые
      const tagsArray = formData.tags
        .split(' ')
        .map(tag => tag.trim().toLowerCase())
        .filter(tag => tag.length > 0)
        .map(tag => tag.startsWith('#') ? tag : `#${tag}`)

      const { data: trackData, error: dbError } = await supabase
        .from('tracks')
        .insert([
          {
            author_id: user.id,
            title: formData.title,
            description: formData.description || null,
            tags: tagsArray,
            track_type: formData.trackType,
            original_title: formData.trackType === 'cover' ? formData.originalTitle : null,
            file_url: publicUrl,
            file_size: formData.file.size,
            cover_url: coverUrl,
            lyrics: formData.lyrics || null,
            status: 'pending'
          }
        ])
        .select()
        .single()

      if (dbError) throw dbError

      setUploadProgress(100)

      await supabase.rpc('increment_profile_stats', {
        profile_id: user.id,
        tracks_delta: 1,
        xp_delta: 10
      })

      alert('✅ Трек успешно загружен! Ожидает модерации.')
      router.push('/')

    } catch (error) {
      console.error('Ошибка загрузки:', error)
      setErrors({ general: error.message || 'Ошибка при загрузке трека' })
      setUploadProgress(0)
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="container">
        <Head>
          <title>Загрузка трека | MOIS Hub</title>
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
        <title>Загрузить трек | MOIS Hub</title>
        <meta name="description" content="Загрузите свой трек" />
      </Head>

      <Header title="Загрузить трек" />

      <main className={styles.main}>
        <div className={styles.intro}>
          <h2>Загрузите свой трек</h2>
          <p>Поделитесь своим творчеством с сообществом и получите фидбек</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Переключатель режима */}
          <div style={{ marginBottom: '2rem', borderBottom: '2px solid #e2e8f0' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                type="button"
                onClick={() => setUploadMode('file')}
                disabled={uploading}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  border: 'none',
                  background: uploadMode === 'file' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                  color: uploadMode === 'file' ? 'white' : '#718096',
                  fontWeight: '600',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  borderRadius: '8px 8px 0 0',
                  fontSize: '1rem',
                  transition: 'all 0.3s',
                  position: 'relative',
                  bottom: '-2px'
                }}
              >
                📁 Загрузить файл
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('smule')}
                disabled={uploading}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  border: 'none',
                  background: uploadMode === 'smule' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                  color: uploadMode === 'smule' ? 'white' : '#718096',
                  fontWeight: '600',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  borderRadius: '8px 8px 0 0',
                  fontSize: '1rem',
                  transition: 'all 0.3s',
                  position: 'relative',
                  bottom: '-2px'
                }}
              >
                🎤 Импорт со Smule
              </button>
            </div>
          </div>

          {/* Smule импорт */}
          {uploadMode === 'smule' && (
            <div style={{ background: '#f7fafc', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '2px dashed #cbd5e0' }}>
              <h3 style={{ marginTop: 0, color: '#2d3748' }}>🎵 Импорт со Smule</h3>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2d3748' }}>
                  URL записи *
                </label>
                <input
                  type="text"
                  value={smuleUrl}
                  onChange={(e) => setSmuleUrl(e.target.value)}
                  placeholder="https://www.smule.com/recording/..."
                  disabled={smuleFetching}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '6px',
                    fontSize: '1rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#2d3748' }}>
                  Cookies * (все cookies со Smule.com)
                  <button 
                    type="button"
                    onClick={() => setShowCookieHelp(!showCookieHelp)}
                    style={{ 
                      marginLeft: '8px', 
                      background: 'none', 
                      border: 'none', 
                      color: '#667eea', 
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    {showCookieHelp ? '▼' : '▶'} Как получить?
                  </button>
                </label>
                <textarea
                  value={smuleCookie}
                  onChange={(e) => setSmuleCookie(e.target.value)}
                  placeholder="session=...; user_id=...; _csrf=...; (вставьте все cookies из браузера)"
                  disabled={smuleFetching}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                    resize: 'vertical'
                  }}
                />
              </div>

              {showCookieHelp && (
                <div style={{ 
                  background: '#e6f7ff', 
                  padding: '16px', 
                  borderRadius: '8px', 
                  marginBottom: '1rem',
                  border: '1px solid #91d5ff'
                }}>
                  <strong>📖 Как получить cookies (ПОЛНЫЕ):</strong>
                  <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '0.9rem' }}>
                    <li>Откройте <a href="https://www.smule.com" target="_blank" rel="noopener">smule.com</a> и войдите в аккаунт</li>
                    <li>Откройте DevTools: <code>F12</code> → вкладка <strong>Network</strong></li>
                    <li>Обновите страницу (<code>F5</code>), кликните на любой запрос</li>
                    <li>Во вкладке <strong>Headers</strong> найдите <strong>Request Headers</strong></li>
                    <li>Найдите строку <strong>Cookie:</strong> и скопируйте ВСЁ значение после неё</li>
                    <li>Должно выглядеть так: <code style={{fontSize: '0.75rem'}}>session=...; user_id=...; _csrf=...</code></li>
                    <li>Вставьте всю строку cookies сюда</li>
                  </ol>
                  <div style={{ background: '#fff', padding: '12px', borderRadius: '6px', marginTop: '12px', border: '1px solid #d9d9d9' }}>
                    <strong>💡 Альтернативный способ (проще):</strong>
                    <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '0.85rem' }}>
                      <li>Откройте консоль браузера (<code>F12</code> → <strong>Console</strong>)</li>
                      <li>Вставьте и выполните: <code style={{background: '#f5f5f5', padding: '2px 6px'}}>document.cookie</code></li>
                      <li>Скопируйте весь результат и вставьте сюда</li>
                    </ol>
                  </div>
                  <p style={{ margin: '12px 0 0 0', fontSize: '0.85rem', color: '#595959' }}>
                    🔒 <strong>Безопасность:</strong> Cookies используются только для одного запроса и не сохраняются
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleSmuleImport}
                disabled={smuleFetching || !smuleUrl || !smuleCookie}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  fontSize: '1rem',
                  cursor: (smuleFetching || !smuleUrl || !smuleCookie) ? 'not-allowed' : 'pointer',
                  opacity: (smuleFetching || !smuleUrl || !smuleCookie) ? 0.5 : 1
                }}
              >
                {smuleFetching ? '⏳ Загрузка...' : '✨ Импортировать трек'}
              </button>
            </div>
          )}

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

          {uploading && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ 
                background: '#e2e8f0', 
                borderRadius: '8px', 
                height: '8px', 
                overflow: 'hidden' 
              }}>
                <div style={{ 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                  height: '100%', 
                  width: `${uploadProgress}%`,
                  transition: 'width 0.3s'
                }} />
              </div>
              <p style={{ 
                textAlign: 'center', 
                marginTop: '0.5rem', 
                color: '#718096', 
                fontSize: '0.9rem' 
              }}>
                Загрузка... {uploadProgress}%
              </p>
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="title">Название трека *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className={styles.input}
              placeholder="Моя песня"
              disabled={uploading}
            />
            {errors.title && <span className={styles.error}>{errors.title}</span>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="description">Описание (опционально)</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className={styles.textarea}
              placeholder="Расскажите о вашем треке..."
              rows="4"
              disabled={uploading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="trackType">Тип трека *</label>
            <select
              id="trackType"
              name="trackType"
              value={formData.trackType}
              onChange={handleChange}
              className={styles.input}
              disabled={uploading}
            >
              <option value="original">Оригинальный трек</option>
              <option value="cover">Кавер</option>
            </select>
          </div>

          {formData.trackType === 'cover' && (
            <div className={styles.formGroup}>
              <label htmlFor="originalTitle">Название оригинала *</label>
              <input
                type="text"
                id="originalTitle"
                name="originalTitle"
                value={formData.originalTitle}
                onChange={handleChange}
                className={styles.input}
                placeholder="Исполнитель - Название песни"
                disabled={uploading}
              />
              <small className={styles.hint}>Укажите автора и название оригинальной песни</small>
              {errors.originalTitle && <span className={styles.error}>{errors.originalTitle}</span>}
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="tags">Теги *</label>
            <div style={{ 
              background: '#f7fafc', 
              padding: '10px 12px', 
              borderRadius: '6px', 
              marginBottom: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#4a5568' }}>
                💡 Пишите через <strong>#слово пробел</strong> — Пример: <code style={{ background: '#fff', padding: '2px 6px', borderRadius: '4px' }}>#pop #love #romantic</code>
              </p>
            </div>
            <input
              type="text"
              id="tags"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              className={styles.input}
              placeholder="pop love romantic"
              disabled={uploading}
            />
            {formData.tags && (
              <div style={{ marginTop: '8px' }}>
                <p style={{ fontSize: '0.85rem', color: '#718096', marginBottom: '6px' }}>Предпросмотр тегов:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {formData.tags.split(' ').filter(t => t.trim()).map((tag, i) => (
                    <span key={i} style={{ 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                      color: 'white', 
                      padding: '4px 10px', 
                      borderRadius: '12px', 
                      fontSize: '0.85rem',
                      fontWeight: '500'
                    }}>
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="file">Аудио файл * (макс. 50 МБ)</label>
            <input
              type="file"
              id="file"
              name="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm"
              onChange={handleFileChange}
              className={styles.fileInput}
              disabled={uploading}
            />
            {formData.file && (
              <p style={{ color: '#48bb78', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                ✓ Выбран: {formData.file.name} ({(formData.file.size / 1024 / 1024).toFixed(2)} МБ)
              </p>
            )}
            {errors.file && <span className={styles.error}>{errors.file}</span>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="coverImage">Обложка трека (опционально, макс. 5 МБ)</label>
            <input
              type="file"
              id="coverImage"
              name="coverImage"
              accept="image/*"
              onChange={handleCoverChange}
              className={styles.fileInput}
              disabled={uploading}
            />
            {coverPreview && (
              <div style={{ marginTop: '1rem' }}>
                <img 
                  src={coverPreview} 
                  alt="Предпросмотр обложки" 
                  style={{ 
                    maxWidth: '200px', 
                    maxHeight: '200px', 
                    borderRadius: '8px',
                    objectFit: 'cover',
                    border: '2px solid #e2e8f0'
                  }} 
                />
              </div>
            )}
            {formData.coverImage && (
              <p style={{ color: '#48bb78', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                ✓ Выбрана обложка: {formData.coverImage.name}
              </p>
            )}
            {errors.coverImage && <span className={styles.error}>{errors.coverImage}</span>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="lyrics">Текст песни (опционально)</label>
            <textarea
              id="lyrics"
              name="lyrics"
              value={formData.lyrics}
              onChange={handleChange}
              className={styles.textarea}
              placeholder="Введите текст песни..."
              rows="8"
              disabled={uploading}
            />
            <p style={{ fontSize: '0.85rem', color: '#718096', marginTop: '0.5rem' }}>
              Добавьте текст песни, чтобы слушатели могли следить за словами
            </p>
          </div>

          <button type="submit" className={styles.button} disabled={uploading}>
            {uploading ? 'Загрузка...' : 'Загрузить трек'}
          </button>

          <div className={styles.footer}>
            <p><a href="/">← Вернуться на главную</a></p>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  )
}