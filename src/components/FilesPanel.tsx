import { useState, useEffect, useCallback } from 'react';
import { Folder, File, ChevronRight, ChevronDown, FolderOpen, GitBranch, ListChecks, Star, AlertCircle, Map as MapIcon, Search, Layers } from 'lucide-react';
import type { FileEntry, ProjectProfile } from '../utils/api';
import * as api from '../utils/api';

interface Props {
  workingDir: string | null;
  projectProfile?: ProjectProfile | null;
}

export function FilesPanel({ workingDir, projectProfile }: Props) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [repoMap, setRepoMap] = useState<api.RepoMapSummary | null>(null);
  const [repoMapLoading, setRepoMapLoading] = useState(false);
  const [repoMapOpen, setRepoMapOpen] = useState(true);
  const [symbolQuery, setSymbolQuery] = useState('');
  const [symbolResults, setSymbolResults] = useState<api.RepoSymbolMatch[] | null>(null);
  const [symbolLoading, setSymbolLoading] = useState(false);
  const [packOpen, setPackOpen] = useState(false);
  const [selectedPack, setSelectedPack] = useState<api.ContextPackName>('feature');
  const [contextPack, setContextPack] = useState<api.ContextPack | null>(null);
  const [contextPackLoading, setContextPackLoading] = useState(false);

  const loadRepoMap = useCallback(async (dir: string) => {
    setRepoMapLoading(true);
    try {
      const map = await api.getRepoMap(dir);
      setRepoMap(map);
    } catch (err) {
      console.warn('[repoMap] failed:', err);
    } finally {
      setRepoMapLoading(false);
    }
  }, []);

  const runSymbolSearch = useCallback(async () => {
    if (!workingDir || !symbolQuery.trim()) return;
    setSymbolLoading(true);
    try {
      const res = await api.searchSymbols(workingDir, symbolQuery.trim());
      setSymbolResults(res.matches);
    } catch (err) {
      console.warn('[symbols] failed:', err);
      setSymbolResults([]);
    } finally {
      setSymbolLoading(false);
    }
  }, [workingDir, symbolQuery]);

  const loadContextPack = useCallback(async (pack: api.ContextPackName) => {
    if (!workingDir) return;
    setContextPackLoading(true);
    try {
      const cp = await api.getContextPack(workingDir, pack);
      setContextPack(cp);
    } catch (err) {
      console.warn('[contextPack] failed:', err);
    } finally {
      setContextPackLoading(false);
    }
  }, [workingDir]);

  const loadDir = useCallback(async (dirPath: string) => {
    if (!workingDir) return;
    setLoading(true);
    try {
      const result = await api.listDirectory(dirPath, workingDir);
      setEntries(result.entries);
    } catch (err) {
      console.error('Failed to load directory:', err);
    } finally {
      setLoading(false);
    }
  }, [workingDir]);



  useEffect(() => {
    if (!workingDir) { setEntries([]); setRepoMap(null); setSymbolResults(null); setContextPack(null); return; }
    loadDir(workingDir);
    loadRepoMap(workingDir);
  }, [workingDir, loadDir, loadRepoMap]);

  const toggleDir = useCallback(async (dirPath: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) next.delete(dirPath);
      else next.add(dirPath);
      return next;
    });
  }, []);

  const handleFileClick = useCallback(async (filePath: string) => {
    setSelectedFile(filePath);
    try {
      const result = await api.readFile(filePath, workingDir);
      setFileContent(result.content);
    } catch (err) {
      console.error('Failed to read file:', err);
      setFileContent('Error loading file');
    }
  }, [workingDir]);

  if (!workingDir) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📁</div>
        <div className="empty-state-text">Open a folder to browse files</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {projectProfile && (
        <div style={{ padding: 10, borderBottom: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
            <Star size={14} style={{ color: 'var(--accent-primary)' }} /> Project Cortex
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-secondary)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><GitBranch size={11} />{projectProfile.git.branch}</span>
            <span>{projectProfile.git.dirty ? `${projectProfile.git.changedFiles.length} changed` : 'clean'}</span>
            {projectProfile.packageManager && <span>{projectProfile.packageManager}</span>}
            {projectProfile.todoCount > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertCircle size={11} />{projectProfile.todoCount} TODO/FIXME</span>}
          </div>
          {(projectProfile.languages.length > 0 || projectProfile.frameworks.length > 0) && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {[...projectProfile.frameworks, ...projectProfile.languages].slice(0, 8).join(' · ')}
            </div>
          )}
          {Object.keys(projectProfile.validation).length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>
                <ListChecks size={12} /> Validation
              </div>
              {Object.entries(projectProfile.validation).map(([name, command]) => (
                <div key={name} style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace", padding: '2px 0' }}>
                  {name}: {command}
                </div>
              ))}
            </div>
          )}
          {projectProfile.importantFiles.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>Important files</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {projectProfile.importantFiles.slice(0, 8).map((file) => (
                  <button key={file} onClick={() => handleFileClick(`${projectProfile.root}/${file}`)} style={{ textAlign: 'left', background: 'none', border: 0, padding: '2px 0', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>{file}</button>
                ))}
              </div>
            </div>
          )}
          {projectProfile.git.changedFiles.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>Changed files</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>
                {projectProfile.git.changedFiles.slice(0, 6).join('\\n')}
              </div>
            </div>
          )}
          {projectProfile.instructions.agentsMd && (
            <details style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 600 }}>Repo instructions</summary>
              <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto', margin: '6px 0 0', fontFamily: "'JetBrains Mono', monospace" }}>{projectProfile.instructions.agentsMd.slice(0, 1600)}</pre>
            </details>
          )}
        </div>
      )}

      {/* Repo map (Milestone 11) */}
      {workingDir && (
        <div style={{ borderBottom: '1px solid var(--border-primary)', padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setRepoMapOpen((v) => !v)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
              <MapIcon size={13} style={{ color: 'var(--accent-primary)' }} /> Repo Map
              {repoMap && <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500 }}>{repoMap.indexedFiles} files · {repoMap.routeCount} routes · {repoMap.componentCount} components</span>}
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{repoMapOpen ? '−' : '+'}</span>
          </div>
          {repoMapOpen && (
            <>
              {repoMapLoading && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Indexing repository…</div>}
              {repoMap && !repoMapLoading && (
                <>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {repoMap.entryPoints.length > 0 && <span>Entries: {repoMap.entryPoints.slice(0, 3).join(', ')}</span>}
                    {repoMap.entryPoints.length > 0 && repoMap.languages.length > 0 && <span> · </span>}
                    {repoMap.languages.length > 0 && <span>{repoMap.languages.slice(0, 4).join(', ')}</span>}
                  </div>
                  {repoMap.topFiles.length > 0 && (
                    <details>
                      <summary style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>Top {Math.min(10, repoMap.topFiles.length)} files</summary>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                        {repoMap.topFiles.slice(0, 10).map((f) => (
                          <button key={f.path} onClick={() => handleFileClick(`${repoMap.root}/${f.path}`)} style={{ textAlign: 'left', background: 'none', border: 0, padding: '2px 0', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} title={f.reasons.join(', ')}>
                            <span style={{ color: 'var(--accent-primary)' }}>·</span> {f.path} <span style={{ color: 'var(--text-tertiary)' }}>· {f.score.toFixed(0)}</span>
                          </button>
                        ))}
                      </div>
                    </details>
                  )}
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <Search size={11} style={{ color: 'var(--text-tertiary)' }} />
                    <input
                      type="text"
                      placeholder="Find symbol (e.g. App, buildPrompt, getRepoMap)"
                      value={symbolQuery}
                      onChange={(e) => setSymbolQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') runSymbolSearch(); }}
                      style={{ flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 4, padding: '4px 6px', color: 'var(--text-primary)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
                    />
                    <button onClick={runSymbolSearch} disabled={!symbolQuery.trim() || symbolLoading} style={{ background: 'var(--accent-primary)', color: 'var(--bg-primary)', border: 0, borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>{symbolLoading ? '…' : 'Go'}</button>
                  </div>
                  {symbolResults && (
                    <div style={{ maxHeight: 160, overflow: 'auto' }}>
                      {symbolResults.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>No symbols matched.</div>}
                      {symbolResults.slice(0, 12).map((m, i) => (
                        <button key={i} onClick={() => handleFileClick(`${repoMap.root}/${m.file}`)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 0, padding: '3px 0', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
                          <span style={{ color: 'var(--accent-primary)' }}>{m.kind}</span> {m.name} <span style={{ color: 'var(--text-tertiary)' }}>→ {m.file}:{m.line}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div style={{ borderTop: '1px dashed var(--border-primary)', paddingTop: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setPackOpen((v) => !v)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                        <Layers size={12} style={{ color: 'var(--accent-primary)' }} /> Context Pack
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{packOpen ? '−' : '+'}</span>
                    </div>
                    {packOpen && (
                      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {(['bugfix', 'feature', 'review', 'docs', 'ui-smoke'] as api.ContextPackName[]).map((p) => (
                            <button key={p} onClick={() => { setSelectedPack(p); loadContextPack(p); }} style={{ background: selectedPack === p ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: selectedPack === p ? 'var(--bg-primary)' : 'var(--text-secondary)', border: '1px solid var(--border-primary)', borderRadius: 4, padding: '3px 7px', fontSize: 10, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.4 }}>{p}</button>
                          ))}
                        </div>
                        {contextPackLoading && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Building context pack…</div>}
                        {contextPack && !contextPackLoading && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{contextPack.description}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace" }}>{contextPack.files.length} files · {contextPack.totalLines} lines · {contextPack.budgetTokens} tokens</div>
                            <div style={{ maxHeight: 180, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {contextPack.files.map((f) => (
                                <button key={f} onClick={() => handleFileClick(`${repoMap.root}/${f}`)} style={{ textAlign: 'left', background: 'none', border: 0, padding: '2px 0', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} title={contextPack.reasons[f]}>
                                  <span style={{ color: 'var(--accent-primary)' }}>·</span> {f}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* File tree */}
      <div style={{ flex: fileContent ? 0.4 : 1, overflow: 'auto', padding: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, padding: '4px 8px 8px' }}>
          {workingDir}
        </div>
        {loading ? (
          <div style={{ padding: 12, color: 'var(--text-tertiary)', fontSize: 12 }}>Loading...</div>
        ) : (
          <DirectoryEntries
            entries={entries}
            expandedDirs={expandedDirs}
            onToggleDir={toggleDir}
            onFileClick={handleFileClick}
            selectedFile={selectedFile}
            depth={0}
          />
        )}
      </div>

      {/* File preview */}
      {fileContent && (
        <div style={{ flex: 0.6, borderTop: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            padding: '6px 10px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
            color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)',
            borderBottom: '1px solid var(--border-primary)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>{selectedFile?.split('/').pop()}</span>
            <button onClick={() => { setFileContent(null); setSelectedFile(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 12 }}>✕</button>
          </div>
          <pre style={{ flex: 1, padding: 10, overflow: 'auto', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-secondary)', margin: 0 }}>
            {fileContent}
          </pre>
        </div>
      )}
    </div>
  );
}

function DirectoryEntries({ entries, expandedDirs, onToggleDir, onFileClick, selectedFile, depth }: {
  entries: FileEntry[];
  expandedDirs: Set<string>;
  onToggleDir: (path: string) => void;
  onFileClick: (path: string) => void;
  selectedFile: string | null;
  depth: number;
}) {
  return (
    <>
      {entries.map((entry) => (
        <div key={entry.path}>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 8px 4px ' + (8 + depth * 16) + 'px',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              fontSize: 12, color: entry.type === 'directory' ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: selectedFile === entry.path ? 'var(--accent-primary-muted)' : 'transparent',
              fontFamily: "'JetBrains Mono', monospace",
            }}
            onClick={() => entry.type === 'directory' ? onToggleDir(entry.path) : onFileClick(entry.path)}
            onMouseEnter={(e) => { if (selectedFile !== entry.path) e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { if (selectedFile !== entry.path) e.currentTarget.style.background = 'transparent'; }}
          >
            {entry.type === 'directory' ? (
              <>
                {expandedDirs.has(entry.path) ? <ChevronDown size={12} style={{ flexShrink: 0 }} /> : <ChevronRight size={12} style={{ flexShrink: 0 }} />}
                {expandedDirs.has(entry.path) ? <FolderOpen size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} /> : <Folder size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />}
              </>
            ) : (
              <>
                <span style={{ width: 12 }} />
                <File size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              </>
            )}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
          </div>
        </div>
      ))}
    </>
  );
}
