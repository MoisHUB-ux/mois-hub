import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import styles from '@styles/ReviewsList.module.css'

export default function ReviewsList({ trackId, newReview }) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [userLikes, setUserLikes] = useState(new Set())

  useEffect(() => {
    checkUser()
    loadReviews()
  }, [trackId])

  useEffect(() => {
    if (newReview) {
      setReviews([newReview, ...reviews])
    }
  }, [newReview])

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      setCurrentUser(session?.user || null)
    } catch (error) {
      console.error('Ошибка проверки пользователя:', error)
    }
  }

  const loadReviews = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          profiles:reviewer_id (
            id,
            username,
            reviewer_level,
            smule_verified
          )
        `)
        .eq('track_id', trackId)
        .order('created_at', { ascending: false })

      if (error) throw error

      setReviews(data || [])

      // Загружаем лайки текущего пользователя
      if (currentUser) {
        const reviewIds = data.map(r => r.id)
        const { data: likesData } = await supabase
          .from('review_likes')
          .select('review_id')
          .eq('user_id', currentUser.id)
          .in('review_id', reviewIds)

        if (likesData) {
          setUserLikes(new Set(likesData.map(l => l.review_id)))
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки рецензий:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLike = async (reviewId) => {
    if (!currentUser) {
      alert('❌ Необходимо войти, чтобы лайкать рецензии')
      return
    }

    try {
      const isLiked = userLikes.has(reviewId)

      if (isLiked) {
        // Убираем лайк
        const { error } = await supabase
          .from('review_likes')
          .delete()
          .eq('review_id', reviewId)
          .eq('user_id', currentUser.id)

        if (error) throw error

        setUserLikes(prev => {
          const newSet = new Set(prev)
          newSet.delete(reviewId)
          return newSet
        })

        setReviews(reviews.map(r => 
          r.id === reviewId ? { ...r, likes_count: (r.likes_count || 0) - 1 } : r
        ))
      } else {
        // Ставим лайк
        const { error } = await supabase
          .from('review_likes')
          .insert([{ review_id: reviewId, user_id: currentUser.id }])

        if (error) throw error

        setUserLikes(prev => new Set([...prev, reviewId]))

        setReviews(reviews.map(r => 
          r.id === reviewId ? { ...r, likes_count: (r.likes_count || 0) + 1 } : r
        ))
      }
    } catch (error) {
      console.error('Ошибка при лайке:', error)
      alert('❌ Ошибка при обработке лайка')
    }
  }

  const handleDelete = async (reviewId) => {
    if (!confirm('Вы уверены, что хотите удалить свою рецензию?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId)

      if (error) throw error

      alert('✅ Рецензия удалена')
      setReviews(reviews.filter(r => r.id !== reviewId))
    } catch (error) {
      console.error('Ошибка удаления:', error)
      alert('❌ Ошибка при удалении рецензии')
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'только что'
    if (diffMins < 60) return `${diffMins} мин. назад`
    if (diffHours < 24) return `${diffHours} ч. назад`
    if (diffDays < 7) return `${diffDays} д. назад`
    
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const renderStars = (rating) => {
    return (
      <div className={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} className={styles.star}>
            {star <= rating ? '⭐' : '☆'}
          </span>
        ))}
      </div>
    )
  }

  const getAverageRating = () => {
    if (reviews.length === 0) return 0
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0)
    return (sum / reviews.length).toFixed(1)
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <h3>Загрузка рецензий...</h3>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>💬 Рецензии ({reviews.length})</h3>
        {reviews.length > 0 && (
          <div className={styles.avgRating}>
            <span className={styles.avgNumber}>{getAverageRating()}</span>
            <span className={styles.avgStars}>
              {renderStars(Math.round(getAverageRating()))}
            </span>
          </div>
        )}
      </div>

      {reviews.length === 0 ? (
        <div className={styles.empty}>
          <p>😔 Пока нет рецензий на этот трек</p>
          <p>Будьте первым!</p>
        </div>
      ) : (
        <div className={styles.reviewsList}>
          {reviews.map((review) => (
            <div key={review.id} className={styles.reviewCard}>
              <div className={styles.reviewHeader}>
                <div className={styles.reviewerInfo}>
                  <a 
                    href={`/profile/${review.profiles?.username}`}
                    className={styles.reviewerName}
                  >
                    {review.profiles?.username || 'Неизвестный'}
                    {review.profiles?.smule_verified && ' ✅'}
                  </a>
                  <span className={styles.reviewerLevel}>
                    💬 Ур. {review.profiles?.reviewer_level || 1}
                  </span>
                </div>

                <div className={styles.reviewMeta}>
                  {renderStars(review.rating)}
                  <span className={styles.reviewDate}>
                    {formatDate(review.created_at)}
                  </span>
                </div>
              </div>

              <p className={styles.reviewComment}>{review.comment}</p>

              <div className={styles.reviewFooter}>
                <button
                  onClick={() => handleLike(review.id)}
                  className={`${styles.likeButton} ${userLikes.has(review.id) ? styles.liked : ''}`}
                  disabled={!currentUser}
                  title={currentUser ? (userLikes.has(review.id) ? 'Убрать лайк' : 'Лайкнуть') : 'Войдите, чтобы лайкать'}
                >
                  {userLikes.has(review.id) ? '❤️' : '🤍'} {review.likes_count || 0}
                </button>

                {currentUser && currentUser.id === review.reviewer_id && (
                  <button
                    onClick={() => handleDelete(review.id)}
                    className={styles.deleteButton}
                  >
                    🗑️ Удалить
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
