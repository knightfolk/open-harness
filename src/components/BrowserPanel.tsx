import { useState, useCallback } from 'react';
import * as api from '../utils/api';

interface Props {
  workingDir: string | null;
  onAskAboutScreenshot?: (screenshotBase64: string, url: string) => void;
}

export function BrowserPanel({ onAskAboutScreenshot }: Props) {
  const [url, setUrl] = useState('localhost:5173');
  const [preview, setPreview] = useState<api.BrowserPreviewInfo | null>(null);
  const [health, setHealth] = useState<api.ServerHealthInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  const handlePreview = useCallback(async () => {
    setLoading(true);
    setPreview(null);
    try {
      const result = await api.captureBrowserPreview(url);
      setPreview(result);
    } catch (err: any) {
      setPreview({
        url,
        screenshotPath: '',
        timestamp: new Date().toISOString(),
        errors: [{ type: 'error', message: err.message }],
      });
    } finally {
      setLoading(false);
    }
  }, [url]);

  const handleHealthCheck = useCallback(async () => {
    setChecking(true);
    try {
      const result = await api.checkServerHealth(url);
      setHealth(result);
    } catch {
      setHealth({ reachable: false, latencyMs: 0 });
    } finally {
      setChecking(false);
    }
  }, [url]);

  const quickUrls = ['localhost:5173', 'localhost:3000', 'localhost:4173', 'localhost:3001'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* URL bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', background: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border-primary)',
      }}>
        <button
          onClick={handleHealthCheck}
          disabled={checking}
          title="Health check"
          style={{
            width: 22, height: 22, borderRadius: '50%', border: 'none',
            background: health?.reachable ? 'var(--accent-success)' :
              health ? 'var(--accent-error)' : 'var(--bg-primary)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: '#fff',
          }}
        >
          {checking ? '...' : health?.reachable ? '✓' : health ? '✗' : '?'}
        </button>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handlePreview()}
          style={{
            flex: 1, padding: '4px 10px', background: 'var(--bg-primary)',
            border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
            color: 'var(--text-primary)', outline: 'none',
          }}
        />
        <button
          onClick={handlePreview}
          disabled={loading}
          style={{
            background: 'var(--accent-primary)', color: '#fff', border: 'none',
            borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
          }}
        >
          {loading ? '...' : 'Preview'}
        </button>
      </div>

      {/* Quick URLs */}
      <div style={{
        display: 'flex', gap: 4, padding: '4px 10px',
        borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-secondary)',
      }}>
        {quickUrls.map(qu => (
          <button
            key={qu}
            onClick={() => setUrl(qu)}
            style={{
              background: url === qu ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: url === qu ? '#fff' : 'var(--text-tertiary)',
              border: '1px solid var(--border-primary)', borderRadius: 3,
              padding: '1px 6px', fontSize: 9, cursor: 'pointer',
            }}
          >
            {qu.replace('localhost:', ':')}
          </button>
        ))}
      </div>

      {/* Browser viewport */}
      <div style={{
        flex: 1, background: '#1a1a2e', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'auto',
      }}>
        {loading && (
          <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
            <div className="typing-indicator">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}

        {preview?.screenshotBase64 && (
          <img
            src={`data:image/png;base64,${preview.screenshotBase64}`}
            alt="Preview"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        )}

        {preview && !preview.screenshotBase64 && preview.errors.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 14, marginBottom: 4 }}>
              {preview.title || url}
            </div>
            <div style={{ fontSize: 11 }}>Page is reachable but no screenshot available</div>
          </div>
        )}

        {preview?.errors && preview.errors.length > 0 && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            {preview.errors.map((err, i) => (
              <div key={i} style={{
                color: err.type === 'error' ? 'var(--accent-error)' : 'var(--accent-warning)',
                fontSize: 12, marginBottom: 4,
              }}>
                {err.type === 'error' ? '⚠️' : '⚡'} {err.message}
              </div>
            ))}
          </div>
        )}

        {!preview && !loading && (
          <div style={{ textAlign: 'center', color: '#666' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🌐</div>
            <div style={{ color: '#999' }}>Browser preview</div>
            <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>
              Enter a localhost URL and press Preview
            </div>
          </div>
        )}
      </div>

      {/* Footer with actions */}
      {preview && (
        <div style={{
          display: 'flex', gap: 8, padding: '4px 10px',
          background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-primary)',
          fontSize: 11,
        }}>
          {preview.title && (
            <span style={{ color: 'var(--text-tertiary)', flex: 1 }}>{preview.title}</span>
          )}
          {onAskAboutScreenshot && preview.screenshotBase64 && (
            <button
              onClick={() => onAskAboutScreenshot(preview.screenshotBase64!, url)}
              style={{
                background: 'var(--accent-primary)', color: '#fff', border: 'none',
                borderRadius: 3, padding: '2px 8px', fontSize: 10, cursor: 'pointer',
              }}
            >
              Ask AI about this
            </button>
          )}
          <button
            onClick={handleHealthCheck}
            style={{
              background: 'none', border: '1px solid var(--border-primary)',
              borderRadius: 3, padding: '2px 8px', fontSize: 10,
              cursor: 'pointer', color: 'var(--text-tertiary)',
            }}
          >
            Smoke check
          </button>
        </div>
      )}
    </div>
  );
}
