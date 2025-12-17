import { useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from '@styles/ReviewForm.module.css'

export default function ReviewForm({ trackId, onReviewAdded }) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [hoveredRating, setHoveredRating] = useState(0)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!comment.trim()) {
      alert('❌ Пожалуйста, напишите комментарий')
      return
    }

    if (comment.length < 20) {
      alert('❌ Комментарий должен быть не менее 20 символов')
      return
    }

    try {
      setLoading(true)

      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user) {
        alert('❌ Необходимо войти в систему')
        return
      }

      // Создаём рецензию
      const { data, error } = await supabase
        .from('reviews')
        .insert([
          {
            track_id: trackId,
            reviewer_id: session.user.id,
            rating: rating,
            comment: comment.trim()
          }
        ])
        .select(`
          *,
          profiles:reviewer_id (
            id,
            username,
            reviewer_level,
            smule_verified
          )
        `)
        .single()

      if (error) {
        if (error.code === '23505') {
          alert('❌ Вы уже оставили рецензию на этот трек')
        } else if (error.message.includes('author_id')) {
          alert('❌ Нельзя рецензировать свои собственные треки')
        } else {
          throw error
        }
        return
      }

      alert('✅ Рецензия добавлена! Вы получили +5 XP')
      setComment('')
      setRating(5)
      
      if (onReviewAdded) {
        onReviewAdded(data)
      }

    } catch (error) {
      console.error('Ошибка добавления рецензии:', error)
      alert('❌ Ошибка при добавлении рецензии')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h3 className={styles.title}>💬 Оставить рецензию</h3>
      
      <div className={styles.ratingSection}>
        <label>Оценка:</label>
        <div className={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className={styles.star}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              onClick={() => setRating(star)}
            >
              {star <= (hoveredRating || rating) ? '⭐' : '☆'}
            </button>
          ))}
          <span className={styles.ratingText}>
            {rating} из 5
          </span>
        </div>
      </div>

      <div className={styles.commentSection}>
        <label htmlFor="comment">Комментарий (минимум 20 символов):</label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Напишите конструктивную рецензию: что понравилось, что можно улучшить..."
          rows={6}
          maxLength={1000}
          required
          className={styles.textarea}
        />
        <div className={styles.charCount}>
          {comment.length} / 1000 символов
          {comment.length > 0 && comment.length < 20 && (
            <span className={styles.warning}>
              {' '}(ещё {20 - comment.length})
            </span>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || comment.length < 20}
        className={styles.submitButton}
      >
        {loading ? '⏳ Отправка...' : '📝 Отправить рецензию (+5 XP)'}
      </button>

      <p className={styles.hint}>
        💡 За рецензию вы получите +5 XP рецензента
      </p>
    </form>
  )
}
