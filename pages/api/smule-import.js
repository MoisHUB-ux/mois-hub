export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { recordingUrl, cookie } = req.body

  if (!recordingUrl) {
    return res.status(400).json({ error: 'Recording URL is required' })
  }

  if (!cookie) {
    return res.status(400).json({ error: 'Session cookie is required' })
  }

  try {
    // Извлекаем ID записи из URL
    let recordingKey = recordingUrl
    if (recordingUrl.includes('smule.com')) {
      const urlParts = recordingUrl.split('/')
      recordingKey = urlParts[urlParts.length - 1]
    }

    // Формируем URL для API Smule
    const apiUrl = `https://www.smule.com/api/performances/key/${recordingKey}/`
    
    console.log('Fetching from Smule API with auth:', apiUrl)

    // Делаем запрос с cookie пользователя
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.smule.com/',
        'Cookie': cookie
      }
    })

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ error: 'Recording not found' })
      }
      throw new Error(`Smule API returned ${response.status}`)
    }

    const data = await response.json()

    // Извлекаем данные из ответа
    const recording = data.performance || data

    // Получаем URL аудио (Smule использует разные форматы)
    let audioUrl = recording.web_url || recording.video_media_url || recording.video_media_mp4_url
    
    // Если не нашли прямую ссылку, пробуем альтернативный формат
    if (!audioUrl && recording.media_url) {
      audioUrl = recording.media_url
    }
    
    // Если всё ещё нет, формируем из recording_key
    if (!audioUrl) {
      audioUrl = `https://c-fa.smule.com/${recordingKey}.m4a`
    }

    // Получаем обложку
    let coverUrl = recording.cover_url || recording.art_url
    if (!coverUrl && recording.web_url) {
      // Пробуем извлечь thumbnail
      coverUrl = recording.web_url.replace('.m4a', '.jpg')
    }

    // Извлекаем информацию об исполнителе
    const performer = recording.owner || recording.performers?.[0] || {}
    
    // Возвращаем данные
    res.status(200).json({
      title: recording.title || recording.song_name || 'Untitled',
      artist: recording.artist || recording.song_info?.artist_name || '',
      performerName: performer.handle || performer.account_id || 'Unknown',
      performerId: performer.account_id || '',
      audioUrl: audioUrl,
      coverUrl: coverUrl,
      createdAt: recording.created_at || new Date().toISOString(),
      type: recording.type || 'solo',
      app_uid: recording.app_uid || recordingKey
    })

  } catch (error) {
    console.error('Smule API Error:', error)
    
    // Если прямой API не работает, пробуем альтернативный метод
    try {
      const recordingKey = recordingUrl.includes('smule.com') 
        ? recordingUrl.split('/').pop() 
        : recordingUrl

      // Возвращаем минимальные данные с прямыми ссылками на CDN Smule
      res.status(200).json({
        title: 'Smule Recording',
        artist: 'Unknown Artist',
        performerName: 'Unknown',
        performerId: '',
        audioUrl: `https://c-fa.smule.com/${recordingKey}.m4a`,
        coverUrl: `https://c-fa.smule.com/${recordingKey}.jpg`,
        createdAt: new Date().toISOString(),
        type: 'solo',
        app_uid: recordingKey
      })
    } catch (fallbackError) {
      res.status(500).json({ 
        error: 'Failed to fetch recording from Smule',
        details: error.message,
        hint: 'Smule API может быть временно недоступен или требует авторизацию'
      })
    }
  }
}
