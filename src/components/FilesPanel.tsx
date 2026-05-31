import { useState, useEffect, useCallback } from 'react';
import { Folder, File, ChevronRight, ChevronDown, FolderOpen, GitBranch, ListChecks, Star, AlertCircle } from 'lucide-react';
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

  const loadDir = useCallback(async (dirPath: string) => {
    setLoading(true);
    try {
      const result = await api.listDirectory(dirPath);
      setEntries(result.entries);
    } catch (err) {
      console.error('Failed to load directory:', err);
    } finally {
      setLoading(false);
    }
  }, []);



  useEffect(() => {
    if (!workingDir) { setEntries([]); return; }
    loadDir(workingDir);
  }, [workingDir, loadDir]);

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
      const result = await api.readFile(filePath);
      setFileContent(result.content);
    } catch (err) {
      console.error('Failed to read file:', err);
      setFileContent('Error loading file');
    }
  }, []);

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
