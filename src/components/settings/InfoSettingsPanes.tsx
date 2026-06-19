import { useCallback, useEffect, useState } from 'react';
import { Download, Loader, RefreshCw } from 'lucide-react';
import * as api from '../../utils/api';

function PaneTitle({ children }: { children: React.ReactNode }) {
  return <div className="settings-pane-title">{children}</div>;
}

function PaneDesc({ children }: { children: React.ReactNode }) {
  return <div className="settings-pane-desc">{children}</div>;
}

export function ChatSettingsPane() {
  const [settings, setSettings] = useState({ streamResponses: true, showToolCalls: true, autoScroll: true, soundEffects: false });
  const toggle = (key: keyof typeof settings) => setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  const items = [
    { key: 'streamResponses' as const, label: 'Stream responses', desc: 'Show text as it generates' },
    { key: 'showToolCalls' as const, label: 'Show tool calls', desc: 'Display agent tool usage inline' },
    { key: 'autoScroll' as const, label: 'Auto-scroll', desc: 'Follow new messages automatically' },
    { key: 'soundEffects' as const, label: 'Sound effects', desc: 'Play sounds on completion' },
  ];

  return (
    <>
      <PaneTitle>Chat Settings</PaneTitle>
      <PaneDesc>Configure chat behavior and display preferences.</PaneDesc>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((item) => (
          <div key={item.key} className="settings-item">
            <div>
              <div className="settings-item-label">{item.label}</div>
              <div className="settings-item-desc">{item.desc}</div>
            </div>
            <div className={`toggle ${settings[item.key] ? 'active' : ''}`} onClick={() => toggle(item.key)} />
          </div>
        ))}
      </div>
    </>
  );
}

export function ReleaseNotesPane() {
  const [notes, setNotes] = useState<api.ReleaseNotesPayload | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.getReleaseNotes()
      .then((result) => {
        if (!cancelled) setNotes(result);
      })
      .catch(() => {
        if (!cancelled) setStatus('Could not load release notes');
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <PaneTitle>Release Notes</PaneTitle>
      <PaneDesc>Patch notes by release, including the update shown after first launch.</PaneDesc>
      {status && <div className="test-result error">{status}</div>}
      <div className="release-notes-list">
        {(notes?.releases || []).map((release) => (
          <section className="settings-card release-note-card" key={`${release.version}-${release.title}`}>
            <div className="release-note-header">
              <div>
                <div className="release-note-title">{release.title}</div>
                <div className="release-note-meta">
                  {release.date || `Version ${release.version}`}{release.current ? ' · Current' : ''}
                </div>
              </div>
            </div>
            <ul className="release-note-items">
              {release.notes.map((note, index) => <li key={`${release.version}-${index}`}>{note}</li>)}
            </ul>
          </section>
        ))}
        {!notes && !status && <div className="settings-card">Loading release notes...</div>}
      </div>
    </>
  );
}

export function CrashReportsPane() {
  const [summary, setSummary] = useState<api.CrashReportSummary | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const refresh = useCallback(() => {
    setStatus(null);
    api.getCrashReports()
      .then(setSummary)
      .catch(() => setStatus('Could not load crash report sources'));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const exportReport = async () => {
    setExporting(true);
    setStatus(null);
    try {
      await api.downloadCrashReportBundle();
      setStatus('Crash report exported');
    } catch {
      setStatus('Could not export crash report');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PaneTitle>Crash Reports</PaneTitle>
      <PaneDesc>Review local crash artifacts and export a redacted report when you choose to send one.</PaneDesc>
      <div className="settings-card crash-report-boundary">
        {(summary?.privacyBoundary || [
          'Reports are generated locally and are not uploaded automatically.',
          'Text snippets are redacted before export.',
        ]).map((item) => <div key={item}>{item}</div>)}
      </div>
      <div className="add-provider-actions" style={{ marginTop: 12 }}>
        <button className="settings-mini-button" onClick={refresh}>
          <RefreshCw size={11} /> Refresh
        </button>
        <button className="settings-mini-button" onClick={exportReport} disabled={exporting}>
          {exporting ? <Loader size={11} className="spin" /> : <Download size={11} />}
          {exporting ? 'Exporting...' : 'Export report'}
        </button>
      </div>
      {status && <div className={`test-result ${/could not/i.test(status) ? 'error' : 'success'}`}>{status}</div>}
      <div className="crash-report-grid">
        {(summary?.sources || []).map((source) => (
          <div className="settings-card crash-source-card" key={source.id}>
            <div className="crash-source-title">{source.label}</div>
            <div className="crash-source-meta">{source.exists ? `${source.fileCount} file${source.fileCount === 1 ? '' : 's'}` : 'Not found'}</div>
            <div className="crash-source-path">{source.path}</div>
          </div>
        ))}
      </div>
      <div className="settings-section-header" style={{ marginTop: 16 }}>
        <div className="settings-section-title">Recent crash/log files</div>
      </div>
      <div className="release-notes-list">
        {(summary?.recentFiles || []).map((file) => (
          <section className="settings-card crash-file-card" key={`${file.path}-${file.modifiedAt}`}>
            <div className="release-note-header">
              <div>
                <div className="release-note-title">{file.name}</div>
                <div className="release-note-meta">{file.sourceLabel} · {formatFileSize(file.sizeBytes)} · {new Date(file.modifiedAt).toLocaleString()}</div>
              </div>
              <span className="crash-kind-pill">{file.kind}</span>
            </div>
            <div className="crash-source-path">{file.path}</div>
            {file.preview && <pre className="crash-preview">{file.preview}</pre>}
          </section>
        ))}
        {summary && summary.recentFiles.length === 0 && <div className="settings-card">No crash or error log files found yet.</div>}
        {!summary && !status && <div className="settings-card">Loading crash report sources...</div>}
      </div>
    </>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AboutPane({ configPath }: { configPath?: string }) {
  const displayConfigPath = configPath || '(not reported by server)';

  return (
    <>
      <PaneTitle>About OpenHarness</PaneTitle>
      <PaneDesc>A source-available, agent-first, optimized harness for routing, evaluating, and coordinating coding agents.</PaneDesc>
      <div className="settings-card" style={{ marginTop: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>OpenHarness</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>Version 1.0.0</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          An Electron + React + Express harness for agent-first workflows with MCP tool integration, model routing, and multi-panel operations.
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <div style={{ marginBottom: 4, fontWeight: 600 }}>Active config file</div>
          <div style={{ padding: '6px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 6, wordBreak: 'break-all' }}>
            {displayConfigPath}
          </div>
          <button
            className="settings-mini-button"
            onClick={() => {
              if (!configPath) return;
              navigator.clipboard?.writeText(configPath).catch(() => {});
            }}
            style={{ marginTop: 6 }}
            title="Copy active config path"
            disabled={!configPath}
          >
            Copy config path
          </button>
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>
          <div>• 8 built-in themes (4 dark + 4 light)</div>
          <div>• OpenAI-compatible provider support</div>
          <div>• Docker MCP integration with 34+ tools</div>
          <div>• 7 agent roles with model recommendations</div>
        </div>
      </div>
    </>
  );
}
