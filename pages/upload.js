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
  const [smuleFetching, setSmuleFetching] = useState(false)
  
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
      setErrors({ smuleUrl: 'Введите URL записи Smule' })
      return
    }

    setSmuleFetching(true)
    setErrors({})

    try {
      const response = await fetch('/api/smule-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordingUrl: smuleUrl })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка импорта')
      }

      // Скачиваем аудио файл
      let audioFile = null
      try {
        const audioResponse = await fetch(data.audioUrl, {
          mode: 'cors',
          credentials: 'omit'
        })
        
        if (!audioResponse.ok) {
          throw new Error('Не удалось загрузить аудио')
        }
        
        const audioBlob = await audioResponse.blob()
        audioFile = new File([audioBlob], `${data.title}.m4a`, { type: 'audio/mp4' })
      } catch (audioError) {
        console.error('Ошибка загрузки аудио:', audioError)
        // Показываем пользователю прямую ссылку
        alert(`⚠️ Автозагрузка не удалась.\n\nСкачайте аудио вручную:\n${data.audioUrl}\n\nПотом загрузите через "Загрузить файл"`)
        setSmuleFetching(false)
        return
      }

      // Скачиваем обложку если есть
      let coverFile = null
      if (data.coverUrl) {
        try {
          const coverResponse = await fetch(data.coverUrl, {
            mode: 'cors',
            credentials: 'omit'
          })
          
          if (coverResponse.ok) {
            const coverBlob = await coverResponse.blob()
            coverFile = new File([coverBlob], `${data.title}-cover.jpg`, { type: 'image/jpeg' })
            
            // Создаём превью обложки
            const reader = new FileReader()
            reader.onloadend = () => {
              setCoverPreview(reader.result)
            }
            reader.readAsDataURL(coverFile)
          }
        } catch (err) {
          console.error('Ошибка загрузки обложки:', err)
          // Обложка не критична, продолжаем
        }
      }

      // Заполняем форму
      setFormData({
        ...formData,
        title: data.title || '',
        description: `Исполнитель: ${data.performerName || 'Неизвестен'}\nОригинальный трек: ${data.artist || 'Неизвестен'}`,
        file: audioFile,
        coverImage: coverFile,
        trackType: 'cover',
        originalTitle: data.artist || ''
      })

      alert('✅ Трек успешно импортирован со Smule!')
    } catch (error) {
      console.error('Ошибка импорта со Smule:', error)
      
      // Показываем более информативное сообщение
      const errorMsg = error.message.includes('CORS') 
        ? 'Smule блокирует прямую загрузку. Скачайте файл вручную и загрузите через "Загрузить файл"'
        : error.message
      
      setErrors({ smuleUrl: `❌ ${errorMsg}` })
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
          {/* Переключатель режима загрузки */}
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
                  background: uploadMode === 'file' 
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                    : 'transparent',
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
                  background: uploadMode === 'smule' 
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                    : 'transparent',
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

          {/* Блок импорта со Smule */}
          {uploadMode === 'smule' && (
            <div style={{ 
              background: '#f7fafc', 
              padding: '1.5rem', 
              borderRadius: '8px', 
              marginBottom: '2rem',
              border: '2px dashed #cbd5e0'
            }}>
              <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#2d3748' }}>
                🎵 Импорт записи со Smule
              </h3>
              <p style={{ color: '#718096', marginBottom: '1rem', fontSize: '0.9rem' }}>
                Вставьте ссылку на запись со Smule (например: https://www.smule.com/sing-recording/...)
              </p>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '1rem' }}>
                <input
                  type="text"
                  value={smuleUrl}
                  onChange={(e) => setSmuleUrl(e.target.value)}
                  placeholder="https://www.smule.com/sing-recording/..."
                  disabled={smuleFetching || uploading}
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '6px',
                    fontSize: '1rem'
                  }}
                />
                <button
                  type="button"
                  onClick={handleSmuleImport}
                  disabled={smuleFetching || uploading || !smuleUrl}
                  style={{
                    padding: '12px 24px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    cursor: (smuleFetching || uploading || !smuleUrl) ? 'not-allowed' : 'pointer',
                    opacity: (smuleFetching || uploading || !smuleUrl) ? 0.5 : 1
                  }}
                >
                  {smuleFetching ? '⏳ Загрузка...' : '✨ Импорт'}
                </button>
              </div>
              {errors.smuleUrl && (
                <div style={{ color: '#e53e3e', fontSize: '0.9rem', marginTop: '8px' }}>
                  ❌ {errors.smuleUrl}
                </div>
              )}
              <div style={{ 
                background: 'white', 
                padding: '12px', 
                borderRadius: '6px', 
                fontSize: '0.85rem',
                color: '#4a5568',
                marginBottom: '12px'
              }}>
                <strong>ℹ️ Как это работает:</strong>
                <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                  <li>Найдите свою запись на Smule.com</li>
                  <li>Скопируйте URL записи из адресной строки</li>
                  <li>Вставьте сюда и нажмите "Импорт"</li>
                  <li>Трек и обложка загрузятся автоматически!</li>
                </ol>
              </div>
              <div style={{ 
                background: '#fff5e5', 
                padding: '12px', 
                borderRadius: '6px', 
                fontSize: '0.85rem',
                color: '#c05621',
                border: '1px solid #fbd38d'
              }}>
                <strong>⚠️ Если автоимпорт не работает:</strong>
                <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                  <li>Откройте запись на Smule.com в браузере</li>
                  <li>Скачайте аудио вручную (обычно кнопка "Download" или через DevTools)</li>
                  <li>Вернитесь сюда и используйте вкладку "📁 Загрузить файл"</li>
                </ol>
                <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem' }}>
                  💡 <strong>Совет:</strong> Для скачивания через DevTools: F12 → Network → обновите страницу → найдите .m4a файл → Save
                </p>
              </div>
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

          {uploadMode === 'file' && (
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
          )}

          {uploadMode === 'smule' && formData.file && (
            <div style={{ 
              background: '#f0fff4', 
              padding: '12px', 
              borderRadius: '6px', 
              marginBottom: '1rem',
              border: '1px solid #9ae6b4'
            }}>
              <p style={{ color: '#22543d', margin: 0, fontSize: '0.9rem' }}>
                ✅ Трек импортирован: <strong>{formData.file.name}</strong> ({(formData.file.size / 1024 / 1024).toFixed(2)} МБ)
              </p>
            </div>
          )}

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