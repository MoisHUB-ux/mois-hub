import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Header from '@components/Header'
import Footer from '@components/Footer'
import { supabase } from '../lib/supabase'
import styles from '@styles/Upload.module.css'

export default function Upload() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    genre: 'pop',
    file: null,
    coverImage: null,
    lyrics: ''
  })
  const [errors, setErrors] = useState({})
  const [coverPreview, setCoverPreview] = useState(null)

  const genres = [
    'pop', 'rock', 'hip-hop', 'electronic', 'jazz', 'classical',
    'rnb', 'country', 'reggae', 'blues', 'folk', 'metal', 'other'
  ]

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

    if (!file.type.includes('audio')) {
      newErrors.file = 'Выберите аудио файл (MP3, WAV, OGG и т.д.)'
    }

    if (file.size > 50 * 1024 * 1024) {
      newErrors.file = 'Размер файла не должен превышать 50 МБ'
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    setErrors({})
    const newErrors = {}

    if (!formData.title || formData.title.length < 3) {
      newErrors.title = 'Название должно быть не менее 3 символов'
    }
    if (!formData.file) {
      newErrors.file = 'Выберите аудио файл'
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
          // Continue without cover if upload fails
        } else {
          const { data: { publicUrl: coverPublicUrl } } = supabase.storage
            .from('tracks')
            .getPublicUrl(coverFileName)
          coverUrl = coverPublicUrl
        }
      }

      setUploadProgress(75)

      const { data: trackData, error: dbError } = await supabase
        .from('tracks')
        .insert([
          {
            author_id: user.id,
            title: formData.title,
            description: formData.description || null,
            genre: formData.genre,
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

      await supabase
        .from('profiles')
        .update({
          total_tracks: profile.total_tracks + 1,
          author_xp: profile.author_xp + 10
        })
        .eq('id', user.id)

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
            <label htmlFor="genre">Жанр *</label>
            <select
              id="genre"
              name="genre"
              value={formData.genre}
              onChange={handleChange}
              className={styles.input}
              disabled={uploading}
            >
              {genres.map(genre => (
                <option key={genre} value={genre}>
                  {genre.charAt(0).toUpperCase() + genre.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="file">Аудио файл * (макс. 50 МБ)</label>
            <input
              type="file"
              id="file"
              name="file"
              accept="audio/*"
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