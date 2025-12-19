export const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/flac',
  'audio/aac',
  'audio/ogg',
  'audio/webm'
]

export const MAX_AUDIO_SIZE = 50 * 1024 * 1024  // 50 MB

export function validateAudioFile(file) {
  const errors = []

  if (!file) {
    errors.push('Файл не выбран')
    return { valid: false, errors }
  }

  if (!ALLOWED_AUDIO_TYPES.includes(file.type)) {
    errors.push('Неподдерживаемый формат аудио')
  }

  if (file.size > MAX_AUDIO_SIZE) {
    errors.push('Размер файла превышает 50 МБ')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}