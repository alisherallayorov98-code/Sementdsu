export default function Paginator({ total, page, setPage, pageSize = 100 }) {
  if (total <= pageSize) return null;
  const totalPages = Math.ceil(total / pageSize);
  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px', fontSize: 13, color: '#555', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
      <span style={{ color: '#888' }}>
        {from}–{to} / <b>{total}</b> ta qator
      </span>
      <button
        onClick={() => setPage(1)}
        disabled={page === 1}
        style={{ padding: '4px 8px', fontSize: 12, cursor: page === 1 ? 'default' : 'pointer', border: '1px solid #ccc', borderRadius: 4, background: page === 1 ? '#f5f5f5' : '#fff', color: page === 1 ? '#bbb' : '#333' }}
      >«</button>
      <button
        onClick={() => setPage(p => Math.max(1, p - 1))}
        disabled={page === 1}
        style={{ padding: '4px 10px', fontSize: 12, cursor: page === 1 ? 'default' : 'pointer', border: '1px solid #ccc', borderRadius: 4, background: page === 1 ? '#f5f5f5' : '#fff', color: page === 1 ? '#bbb' : '#333' }}
      >‹ Oldingi</button>
      <span style={{ fontSize: 12, fontWeight: 'bold', color: '#01579b' }}>
        {page} / {totalPages}
      </span>
      <button
        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
        disabled={page === totalPages}
        style={{ padding: '4px 10px', fontSize: 12, cursor: page === totalPages ? 'default' : 'pointer', border: '1px solid #ccc', borderRadius: 4, background: page === totalPages ? '#f5f5f5' : '#fff', color: page === totalPages ? '#bbb' : '#333' }}
      >Keyingi ›</button>
      <button
        onClick={() => setPage(totalPages)}
        disabled={page === totalPages}
        style={{ padding: '4px 8px', fontSize: 12, cursor: page === totalPages ? 'default' : 'pointer', border: '1px solid #ccc', borderRadius: 4, background: page === totalPages ? '#f5f5f5' : '#fff', color: page === totalPages ? '#bbb' : '#333' }}
      >»</button>
    </div>
  );
}
