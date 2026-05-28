export function BrowserPanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* URL bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', background: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border-primary)',
      }}>
        <div style={{
          flex: 1, padding: '4px 10px', background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)',
          fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
          color: 'var(--text-tertiary)',
        }}>
          localhost:5173
        </div>
      </div>
      {/* Browser viewport */}
      <div style={{
        flex: 1, background: '#fff', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        color: '#666', fontSize: 13, position: 'relative',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🌐</div>
          <div style={{ color: '#999' }}>Browser preview</div>
          <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>Enter a URL to preview</div>
        </div>
      </div>
    </div>
  );
}
