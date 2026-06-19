import { useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Container,
  Loader,
  PlayCircle,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  X,
} from 'lucide-react';
import * as api from '../../utils/api';

function PaneTitle({ children }: { children: React.ReactNode }) { return <div className="settings-pane-title">{children}</div>; }
function PaneDesc({ children }: { children: React.ReactNode }) { return <div className="settings-pane-desc">{children}</div>; }

export function DockerMCPPane({ mcpServers, mcpStatus, onRefresh }: { mcpServers: any[]; mcpStatus: any[]; onRefresh: () => Promise<void> }) {
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [readiness, setReadiness] = useState<any>(null);
  const [busy, setBusy] = useState<'start' | 'stop' | 'restart' | 'readiness' | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const dockerMcp = mcpServers.find((s: any) => s.builtIn);
  const dockerStatus = mcpStatus.find((s: any) => s.id === 'docker-mcp');
  const isRunning = dockerStatus?.running ?? false;
  const toolCount = dockerStatus?.toolCount ?? 0;
  const usableToolCount = dockerStatus?.usableToolCount ?? toolCount;
  const blockedToolCount = dockerStatus?.blockedToolCount ?? 0;
  const tools = dockerStatus?.tools ?? [];

  const refreshReadiness = async () => {
    setBusy('readiness');
    try {
      const r = await api.getDockerReadiness();
      setReadiness(r);
    } catch { /* ignore */ }
    setBusy(null);
  };

  useEffect(() => { refreshReadiness(); }, []);

  const handleStart = async () => {
    setBusy('start'); setFeedback(null);
    try { await api.startMCPServer('docker-mcp'); setFeedback('Docker MCP started.'); await onRefresh(); }
    catch (e: any) { setFeedback(e.message || 'Failed to start'); }
    setBusy(null);
  };
  const handleStop = async () => {
    setBusy('stop'); setFeedback(null);
    try { await api.stopMCPServer('docker-mcp'); setFeedback('Docker MCP stopped.'); await onRefresh(); }
    catch (e: any) { setFeedback(e.message || 'Failed to stop'); }
    setBusy(null);
  };
  const handleRestart = async () => {
    setBusy('restart'); setFeedback(null);
    try { await api.restartMCPServer('docker-mcp'); setFeedback('Docker MCP restarted.'); await onRefresh(); }
    catch (e: any) { setFeedback(e.message || 'Failed to restart'); }
    setBusy(null);
  };

  if (!dockerMcp) return <><PaneTitle>Docker MCP</PaneTitle><PaneDesc>No Docker MCP configured.</PaneDesc></>;

  const ready = readiness?.dockerInstalled && readiness?.daemonRunning && readiness?.dockerMcpAvailable && readiness?.profileReady;
  const readyLabel = !readiness ? 'Checking…' : ready ? 'Ready' : !readiness.dockerInstalled ? 'Not installed' : !readiness.daemonRunning ? 'Daemon stopped' : !readiness.dockerMcpAvailable ? 'MCP Toolkit missing' : 'Profile not ready';

  return (
    <>
      <PaneTitle>Docker MCP</PaneTitle>
      <PaneDesc>Containerized tool execution via Docker MCP server. Provides browser automation, code search, sequential thinking, and more.</PaneDesc>

      <div className="provider-card" style={{ marginTop: 16 }}>
        <div className="provider-card-header">
          <div className="provider-logo"><Container size={14} /></div>
          <div className="provider-title-block">
            <div className="provider-title-row">
              <span className="provider-name">Docker readiness</span>
              <span className={`provider-status ${ready ? 'ready' : 'missing'}`}>{readyLabel}</span>
            </div>
            <div className="provider-meta">
              {readiness?.version && <>Docker {readiness.version} · </>}
              {readiness?.mcpVersion && <>MCP {readiness.mcpVersion}</>}
              {!readiness && 'Probing local Docker…'}
            </div>
          </div>
        </div>
        {readiness?.hints && readiness.hints.length > 0 && (
          <div style={{ padding: '8px 0', borderTop: '1px solid var(--border-primary)' }}>
            {readiness.hints.map((h: string, i: number) => (
              <div key={i} style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>· {h}</div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, padding: '8px 0', borderTop: '1px solid var(--border-primary)' }}>
          <button className="settings-mini-button" onClick={refreshReadiness} disabled={busy === 'readiness'}>
            <RefreshCw size={11} className={busy === 'readiness' ? 'spin' : ''} /> Recheck
          </button>
        </div>
      </div>

      <div className="provider-card" style={{ marginTop: 12 }}>
        <div className="provider-card-header">
          <div className="provider-logo"><Server size={14} /></div>
          <div className="provider-title-block">
            <div className="provider-title-row">
              <span className="provider-name">{dockerMcp.name}</span>
              <span className={`provider-status ${isRunning ? 'ready' : 'missing'}`}>{isRunning ? 'Running' : 'Stopped'}</span>
            </div>
            <div className="provider-meta">
              {dockerMcp.endpoint}
              {toolCount > 0 && (
                <span style={{ marginLeft: 8, color: 'var(--accent-primary)', fontWeight: 600 }}>
                  {usableToolCount} usable tools
                </span>
              )}
              {blockedToolCount > 0 && (
                <span style={{ marginLeft: 8, color: 'var(--text-tertiary)' }}>
                  {blockedToolCount} blocked by trust mode
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="provider-actions-row" style={{ display: 'flex', gap: 6, padding: '8px 0', borderTop: '1px solid var(--border-primary)' }}>
          {!isRunning && <button className="settings-mini-button" onClick={handleStart} disabled={busy === 'start' || !ready}>
            <PlayCircle size={11} /> {busy === 'start' ? 'Starting…' : 'Start'}
          </button>}
          {isRunning && <button className="settings-mini-button" onClick={handleStop} disabled={busy === 'stop'}>
            <X size={11} /> {busy === 'stop' ? 'Stopping…' : 'Stop'}
          </button>}
          <button className="settings-mini-button" onClick={handleRestart} disabled={busy === 'restart' || !ready}>
            <RefreshCw size={11} className={busy === 'restart' ? 'spin' : ''} /> {busy === 'restart' ? 'Restarting…' : 'Restart'}
          </button>
          {feedback && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', alignSelf: 'center' }}>{feedback}</span>}
        </div>
        {isRunning && toolCount > 0 && (
          <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 8 }}>
            <button onClick={() => setToolsExpanded(!toolsExpanded)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--accent-primary)', padding: '4px 0' }}>
              {toolsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {toolsExpanded ? 'Hide tools' : 'Show tool policy'}
            </button>
            {toolsExpanded && (
              <div style={{ maxHeight: 280, overflowY: 'auto', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {tools.map((tool: any) => (
                  <div key={tool.name} style={{ padding: '4px 0', fontSize: 11, display: 'flex', gap: 8, borderBottom: '1px solid var(--border-primary)', opacity: tool.allowed === false ? 0.55 : 1 }}>
                    <code style={{ color: tool.allowed === false ? 'var(--text-tertiary)' : 'var(--accent-primary)', flexShrink: 0, fontSize: 11 }}>{tool.name}</code>
                    {tool.allowed === false && <span style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>blocked</span>}
                    <span style={{ color: 'var(--text-tertiary)', lineHeight: 1.3 }}>{tool.description?.slice(0, 120)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export function CuratedMCPPane() {
  const [catalog, setCatalog] = useState<api.CuratedMcpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const list = await api.getCuratedMcpServers();
      setCatalog(list);
    } catch (e: any) { setError(e.message || 'Failed to load catalog'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleInstall = async (id: string) => {
    setInstalling(id); setError(null);
    try { await api.installCuratedMcpServer(id); await load(); }
    catch (e: any) { setError(e.message || 'Install failed'); }
    finally { setInstalling(null); }
  };

  const filtered = catalog.filter((s) =>
    !query || s.name.toLowerCase().includes(query.toLowerCase()) || s.description.toLowerCase().includes(query.toLowerCase()) || s.category.includes(query.toLowerCase())
  );

  const grouped = filtered.reduce<Record<string, api.CuratedMcpServer[]>>((acc, s) => {
    (acc[s.category] ||= []).push(s); return acc;
  }, {});

  return (
    <>
      <PaneTitle>Curated MCP Tools</PaneTitle>
      <PaneDesc>One-click install for safe, free MCP servers. Each card shows what the server can access.</PaneDesc>

      <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          className="onboarding-input"
          style={{ flex: 1 }}
          placeholder="Search by name, description, or category (files, git, web, database, memory, browser, thinking)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="settings-mini-button" onClick={load}><RefreshCw size={11} /> Refresh</button>
      </div>

      {error && <div className="onboarding-result error" style={{ marginTop: 12 }}>{error}</div>}

      {loading ? (
        <div style={{ marginTop: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}><Loader size={16} className="spin" /> Loading catalog…</div>
      ) : (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {Object.entries(grouped).map(([cat, servers]) => (
            <div key={cat}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>{cat}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {servers.map((s) => (
                  <div key={s.id} className="provider-card">
                    <div className="provider-card-header">
                      <div className="provider-logo"><Server size={14} /></div>
                      <div className="provider-title-block">
                        <div className="provider-title-row">
                          <span className="provider-name">{s.name}</span>
                          {s.installed
                            ? <span className="provider-status ready">Installed</span>
                            : <span className={`provider-status ${s.requiresTrustMode === 'chat-only' || s.requiresTrustMode === 'read-only' ? 'ready' : 'missing'}`}>{s.requiresTrustMode === 'chat-only' || s.requiresTrustMode === 'read-only' ? 'Safe' : 'Trust required'}</span>}
                        </div>
                        <div className="provider-meta">{s.tagline}</div>
                      </div>
                    </div>
                    <div style={{ padding: '6px 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45, borderTop: '1px solid var(--border-primary)' }}>
                      {s.description}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--border-primary)' }}>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Permissions:</span>
                      <span style={{ fontSize: 10, color: 'var(--accent-primary)', fontFamily: 'monospace' }}>{s.permissionSummary}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>·</span>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Needs: {s.requiresTrustMode}</span>
                    </div>
                    {s.installHint && (
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '4px 0', borderTop: '1px solid var(--border-primary)' }}>
                        {s.installHint}
                      </div>
                    )}
                    <div className="provider-actions-row" style={{ padding: '8px 0', borderTop: '1px solid var(--border-primary)' }}>
                      {s.installed ? (
                        <span style={{ fontSize: 11, color: 'var(--accent-success)' }}><Check size={11} /> Available — see Custom Servers to remove</span>
                      ) : (
                        <button className="settings-mini-button" onClick={() => handleInstall(s.id)} disabled={installing === s.id}>
                          {installing === s.id ? <><Loader size={11} className="spin" /> Installing…</> : <><Plus size={11} /> Install</>}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function CustomMCPServersPane({ mcpServers, onRemove }: any) {
  const custom = mcpServers.filter((s: any) => !s.builtIn);
  return (
    <>
      <PaneTitle>Custom MCP Servers</PaneTitle>
      <PaneDesc>Additional Model Context Protocol servers for tools, resources, and prompts. Bearer tokens are stored locally and masked in Settings.</PaneDesc>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {custom.map((server: any) => (
          <div key={server.id} className="provider-card">
            <div className="provider-card-header">
              <div className="provider-logo"><Server size={14} /></div>
              <div className="provider-title-block">
                <div className="provider-title-row">
                  <span className="provider-name">{server.name}</span>
                  <span className={`provider-status ${server.enabled ? 'ready' : 'missing'}`}>{server.enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div className="provider-meta">
                  {server.authType === 'bearer'
                    ? server.authConfigured ? 'Bearer token stored locally' : 'Bearer token missing'
                    : 'No auth token'} • {server.endpoint}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.45, padding: '6px 0', borderTop: '1px solid var(--border-primary)' }}>
              {server.endpoint?.startsWith('stdio://')
                ? 'stdio transport runs a local command when started; keep it scoped to tools you trust.'
                : 'HTTP transport sends tool calls to the configured endpoint; use bearer auth for private gateways.'}
            </div>
            <div className="provider-actions-row">
              <button
                className="settings-mini-button"
                style={{ marginLeft: 'auto', color: 'var(--accent-error)', background: 'var(--accent-error-muted)' }}
                onClick={() => onRemove(server.id)}
                aria-label={`Remove MCP server ${server.name}`}
              >
                <Trash2 size={11} /> Remove
              </button>
            </div>
          </div>
        ))}
        {custom.length === 0 && (
          <div className="settings-card" style={{ textAlign: 'center', padding: '24px 12px' }}>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No custom MCP servers configured</div>
          </div>
        )}
      </div>
    </>
  );
}

export function AddMCPServerPane({ onAdd, onDone }: any) {
  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [authType, setAuthType] = useState('none');
  const [authToken, setAuthToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim() || !endpoint.trim()) { setError('Name and endpoint are required'); return; }
    setSaving(true); setError('');
    try { await onAdd({ name: name.trim(), endpoint: endpoint.trim(), authType, authToken }); onDone(); }
    catch (e: any) { setError(e.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PaneTitle>Add MCP Server</PaneTitle>
      <PaneDesc>Connect a Model Context Protocol server via stdio or HTTP transport. Use bearer auth only for private HTTP gateways; local stdio commands run on this machine.</PaneDesc>
      <div className="add-provider-card" style={{ marginTop: 16, maxWidth: 440 }}>
        <div className="settings-card" style={{ marginBottom: 12, padding: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Connection checklist</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            Prefer curated servers when possible. For custom servers, confirm the endpoint scheme, the trust mode needed for its tools, and whether a bearer token is required before starting it.
          </div>
        </div>
        <div className="add-provider-grid">
          <label>Server name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-tools-server" /></label>
          <label>Endpoint<input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="stdio://./my-server or http://..." /></label>
          <label>Auth type
            <select value={authType} onChange={(e) => setAuthType(e.target.value)}>
              <option value="none">None</option>
              <option value="bearer">Bearer token</option>
            </select>
          </label>
          {authType === 'bearer' && (
            <label>Auth token<input type="password" value={authToken} onChange={(e) => setAuthToken(e.target.value)} placeholder="Bearer token" /></label>
          )}
        </div>
        {error && <div className="test-result error">{error}</div>}
        <div className="add-provider-actions">
          <button className="settings-mini-button" onClick={onDone}>Cancel</button>
          <button className="settings-mini-button" style={{ background: 'var(--accent-primary)', color: 'white' }} onClick={handleSave} disabled={saving}>
            {saving ? <Loader size={11} className="spin" /> : <Check size={11} />}
            {saving ? 'Saving...' : 'Add Server'}
          </button>
        </div>
      </div>
    </>
  );
}
