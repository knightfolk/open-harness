import { useState, useCallback } from 'react';
import * as api from '../utils/api';

interface Props {
  workingDir: string | null;
  onAskAboutScreenshot?: (screenshotBase64: string, url: string) => void;
}

export function BrowserPanel({ onAskAboutScreenshot }: Props) {
  const [url, setUrl] = useState('localhost:5173');
  const [preview, setPreview] = useState<api.BrowserPreviewInfo | null>(null);
  const [deepArtifact, setDeepArtifact] = useState<api.DeepBrowserArtifact | null>(null);
  const [health, setHealth] = useState<api.ServerHealthInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [deepLoading, setDeepLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  const handlePreview = useCallback(async () => {
    setLoading(true);
    setPreview(null);
    setDeepArtifact(null);
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

  const handleDeepCapture = useCallback(async () => {
    setDeepLoading(true);
    setDeepArtifact(null);
    try {
      const result = await api.captureDeepBrowser(url);
      setDeepArtifact(result);
      if (result.screenshotBase64) {
        setPreview({
          url: result.url,
          screenshotPath: result.screenshotPath || '',
          screenshotBase64: result.screenshotBase64,
          title: result.title,
          timestamp: result.capturedAt,
          errors: result.errors,
        });
      }
    } catch (err: any) {
      setDeepArtifact({
        url,
        status: 0,
        latencyMs: 0,
        contentType: '',
        contentLength: 0,
        bodyTextPreview: '',
        a11yNodes: [],
        scriptSources: [],
        stylesheetSources: [],
        errors: [{ type: 'error', message: err.message || 'Deep capture failed' }],
        capturedAt: new Date().toISOString(),
      });
    } finally {
      setDeepLoading(false);
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
          type="button"
          onClick={handleHealthCheck}
          disabled={checking}
          title="Health check"
          aria-label="Run browser health check"
          style={{
            width: 22, height: 22, borderRadius: '50%', border: 'none',
            background: health?.reachable ? 'var(--accent-success)' :
              health ? 'var(--accent-error)' : 'var(--bg-primary)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: '#fff',
          }}
        >
          <span aria-hidden="true">{checking ? '...' : health?.reachable ? '✓' : health ? '✗' : '?'}</span>
        </button>
        <input
          value={url}
          aria-label="Browser preview URL"
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
          type="button"
          onClick={handlePreview}
          disabled={loading}
          aria-label={`Preview ${url}`}
          style={{
            background: 'var(--accent-primary)', color: '#fff', border: 'none',
            borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
          }}
        >
          {loading ? '...' : 'Preview'}
        </button>
        <button
          type="button"
          onClick={handleDeepCapture}
          disabled={deepLoading}
          aria-label={`Deep capture ${url}`}
          style={{
            background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)',
            borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
          }}
        >
          {deepLoading ? '...' : 'Deep'}
        </button>
      </div>

      {/* Quick URLs */}
      <div
        role="group"
        aria-label="Quick browser preview URLs"
        style={{
          display: 'flex', gap: 4, padding: '4px 10px',
          borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-secondary)',
        }}
      >
        {quickUrls.map(qu => (
          <button
            key={qu}
            type="button"
            onClick={() => setUrl(qu)}
            aria-label={`Use ${qu}`}
            aria-pressed={url === qu}
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
      <div
        role="region"
        aria-label={`Browser preview for ${url}`}
        style={{
          flex: 1, background: '#1a1a2e', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'auto',
        }}
      >
        {loading && (
          <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
            <div className="typing-indicator" role="status" aria-live="polite" aria-label="Browser preview is loading">
              <div className="typing-dot" aria-hidden="true" />
              <div className="typing-dot" aria-hidden="true" />
              <div className="typing-dot" aria-hidden="true" />
            </div>
          </div>
        )}

        {preview?.screenshotBase64 && (
          <img
            src={`data:image/png;base64,${preview.screenshotBase64}`}
            alt={`Browser preview screenshot for ${url}`}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        )}

        {preview && !preview.screenshotBase64 && preview.errors.length === 0 && (
          <div role="status" aria-live="polite" style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 14, marginBottom: 4 }}>
              {preview.title || url}
            </div>
            <div style={{ fontSize: 11 }}>Page is reachable but no screenshot available</div>
          </div>
        )}

        {preview?.errors && preview.errors.length > 0 && (
          <div role="alert" style={{ textAlign: 'center', padding: 20 }}>
            {preview.errors.map((err, i) => (
              <div key={i} style={{
                color: err.type === 'error' ? 'var(--accent-error)' : 'var(--accent-warning)',
                fontSize: 12, marginBottom: 4,
              }}>
                <span aria-hidden="true">{err.type === 'error' ? '⚠️' : '⚡'}</span> {err.message}
              </div>
            ))}
          </div>
        )}

        {!preview && !loading && (
          <div role="status" aria-live="polite" style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 20 }}>
            <div style={{ fontSize: 13, marginBottom: 8 }}>No browser preview yet</div>
            <button
              type="button"
              onClick={handlePreview}
              aria-label={`Preview ${url}`}
              style={{
                background: 'var(--accent-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                padding: '6px 10px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Preview {url}
            </button>
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
              type="button"
              onClick={() => onAskAboutScreenshot(preview.screenshotBase64!, url)}
              aria-label="Ask AI about this browser screenshot"
              style={{
                background: 'var(--accent-primary)', color: '#fff', border: 'none',
                borderRadius: 3, padding: '2px 8px', fontSize: 10, cursor: 'pointer',
              }}
            >
              Ask AI about this
            </button>
          )}
          <button
            type="button"
            onClick={handleDeepCapture}
            aria-label={`Deep capture ${url}`}
            style={{
              background: 'none', border: '1px solid var(--border-primary)',
              borderRadius: 3, padding: '2px 8px', fontSize: 10,
              cursor: 'pointer', color: 'var(--text-tertiary)',
            }}
          >
            Deep capture
          </button>
        </div>
      )}

      {deepArtifact && (
        <div style={{
          padding: '8px 10px',
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-primary)',
          fontSize: 11,
          color: 'var(--text-secondary)',
          maxHeight: 180,
          overflow: 'auto',
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <span style={{ color: deepArtifact.status >= 200 && deepArtifact.status < 400 ? 'var(--accent-success)' : 'var(--accent-error)' }}>
              HTTP {deepArtifact.status || 'n/a'}
            </span>
            <span>{deepArtifact.latencyMs}ms</span>
            <span>{deepArtifact.domStructure?.interactiveElements.length || 0} interactive</span>
            <span>{deepArtifact.resourceHealth?.filter((entry) => !entry.ok).length || 0} resource failures</span>
            <span>{deepArtifact.errors.length} issue{deepArtifact.errors.length === 1 ? '' : 's'}</span>
          </div>
          {deepArtifact.domStructure?.headings.length ? (
            <div style={{ marginBottom: 6 }}>
              {deepArtifact.domStructure.headings.slice(0, 4).map((heading, index) => (
                <div key={`${heading.level}:${heading.text}:${index}`} style={{ color: 'var(--text-tertiary)' }}>
                  H{heading.level} {heading.text}
                </div>
              ))}
            </div>
          ) : null}
          {deepArtifact.bodyTextPreview && (
            <div style={{ color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
              {deepArtifact.bodyTextPreview.slice(0, 360)}
            </div>
          )}
          {deepArtifact.errors.slice(0, 4).map((err, index) => (
            <div key={`${err.type}:${index}`} style={{ marginTop: 4, color: err.type === 'error' ? 'var(--accent-error)' : 'var(--accent-warning)' }}>
              {err.type}: {err.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
