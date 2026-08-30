export default function ProductCard({ product }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>{product.name}</h3>
        {product.category && (
          <span className="badge pending" style={{ whiteSpace: 'nowrap' }}>{product.category}</span>
        )}
      </div>
      {product.description && (
        <p style={{ color: '#6B7280', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
          {product.description}
        </p>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1677C8' }}>
          ₹{product.price_rupees ?? (product.price / 100)}
        </span>
        <span style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>
          Stock: {product.stock}
        </span>
      </div>
    </div>
  );
}
