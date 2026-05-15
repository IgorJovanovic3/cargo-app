function RatingHistogram({ histogram, totalReviews }) {
  const maxCount = Math.max(...Object.values(histogram), 1)
  const colors = {
    5: '#28a745',
    4: '#17a2b8',
    3: '#ffc107',
    2: '#fd7e14',
    1: '#dc3545'
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>📊 Raspodela ocena</h4>
      {[5, 4, 3, 2, 1].map(rating => (
        <div key={rating} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{ width: '35px', fontSize: '0.8rem' }}>
            <span style={{ color: colors[rating] }}>{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</span>
          </div>
          <div style={{ flex: 1, height: '20px', background: '#e9ecef', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{
              width: `${(histogram[rating] / maxCount) * 100}%`,
              height: '100%',
              background: colors[rating],
              transition: 'width 0.3s'
            }} />
          </div>
          <div style={{ width: '70px', fontSize: '0.75rem', textAlign: 'right' }}>
            {histogram[rating]} ({totalReviews > 0 ? Math.round(histogram[rating] / totalReviews * 100) : 0}%)
          </div>
        </div>
      ))}
    </div>
  )
}

export default RatingHistogram