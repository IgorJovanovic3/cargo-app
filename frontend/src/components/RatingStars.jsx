import { useState } from 'react'

function RatingStars({ rating, onRatingChange, readonly = false, size = 24 }) {
  const [hoverRating, setHoverRating] = useState(0)

  const handleMouseEnter = (index) => {
    if (!readonly) setHoverRating(index)
  }

  const handleMouseLeave = () => {
    if (!readonly) setHoverRating(0)
  }

  const handleClick = (index) => {
    if (!readonly && onRatingChange) {
      onRatingChange(index)
    }
  }

  const getStarColor = (index) => {
    if (hoverRating >= index) return '#ffc107'
    if (rating >= index) return '#ffc107'
    return '#e4e5e9'
  }

  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          onMouseEnter={() => handleMouseEnter(star)}
          onMouseLeave={handleMouseLeave}
          onClick={() => handleClick(star)}
          style={{
            cursor: readonly ? 'default' : 'pointer',
            fontSize: `${size}px`,
            color: getStarColor(star),
            transition: 'color 0.2s'
          }}
        >
          ★
        </span>
      ))}
    </div>
  )
}

export default RatingStars