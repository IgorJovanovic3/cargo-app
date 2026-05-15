function Pagination({ currentPage, totalPages, onPageChange }) {
  const pages = []
  const maxVisible = 5
  
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2))
  let endPage = Math.min(totalPages, startPage + maxVisible - 1)
  
  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1)
  }
  
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i)
  }
  
  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '20px' }}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        style={{
          padding: '6px 12px',
          background: currentPage === 1 ? '#ccc' : '#667eea',
          border: 'none',
          borderRadius: '6px',
          cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
        }}
      >
        ◀ Prethodna
      </button>
      
      {pages.map(page => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          style={{
            padding: '6px 12px',
            background: currentPage === page ? '#667eea' : '#f0f0f0',
            color: currentPage === page ? 'white' : '#333',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          {page}
        </button>
      ))}
      
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        style={{
          padding: '6px 12px',
          background: currentPage === totalPages ? '#ccc' : '#667eea',
          border: 'none',
          borderRadius: '6px',
          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
        }}
      >
        Sledeća ▶
      </button>
    </div>
  )
}

export default Pagination