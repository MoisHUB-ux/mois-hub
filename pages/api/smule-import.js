import Smule from 'smule-api'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { recordingUrl } = req.body

  if (!recordingUrl) {
    return res.status(400).json({ error: 'Recording URL is required' })
  }

  try {
    // Извлекаем ID записи из URL
    // URL формата: https://www.smule.com/recording/.../{recording_key}
    let recordingKey = recordingUrl

    // Если это полный URL, извлекаем ключ
    if (recordingUrl.includes('smule.com')) {
      const urlParts = recordingUrl.split('/')
      recordingKey = urlParts[urlParts.length - 1]
    }

    // Получаем информацию о записи
    const smule = new Smule()
    const recording = await smule.getRecording(recordingKey)

    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' })
    }

    // Возвращаем данные
    res.status(200).json({
      title: recording.title || 'Untitled',
      artist: recording.artist || '',
      performerName: recording.performer?.username || '',
      performerId: recording.performer?.account_id || '',
      audioUrl: recording.web_url || recording.media_url,
      coverUrl: recording.cover_url || recording.art_url,
      createdAt: recording.created_at,
      type: recording.type, // solo, duet, group
      app_uid: recording.app_uid // Для дополнительной идентификации
    })

  } catch (error) {
    console.error('Smule API Error:', error)
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Recording not found' })
    }

    res.status(500).json({ 
      error: 'Failed to fetch recording from Smule',
      details: error.message 
    })
  }
}
