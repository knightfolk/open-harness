import { useState, useEffect, useCallback } from 'react';
import { Save, Download, Archive, Loader, FileText, RefreshCw } from 'lucide-react';
import * as api from '../utils/api';

interface Props {
  workingDir: string | null;
}

export function ProjectMemoryPanel({ workingDir }: Props) {
  const [memory, setMemory] = useState<api.ProjectMemoryInfo | null>(null);
  const [draft, setDraft] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workingDir) { setMemory(null); setDraft(''); return; }
    setLoading(true);
    setError(null);
    try {
      const m = await api.getProjectMemory(workingDir);
      setMemory(m);
      setDraft(m.memoryMd);
      setDirty(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to load project memory');
      setMemory(null);
    } finally {
      setLoading(false);
    }
  }, [workingDir]);

  useEffect(() => { refresh(); }, [refresh]);

  const save = async () => {
    if (!workingDir) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.updateProjectMemory(workingDir, draft);
      setInfo('Saved');
      setDirty(false);
      await refresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!workingDir) return;
    setArchiving(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.archiveProjectMemory(workingDir);
      setInfo(`Archived snapshot at ${res.archivedAt}`);
    } catch (err: any) {
      setError(err?.message || 'Archive failed');
    } finally {
      setArchiving(false);
    }
  };

  const exportMemory = async () => {
    if (!workingDir) return;
    try {
      const md = await api.exportProjectMemory(workingDir);
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `openharness-memory.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || 'Export failed');
    }
  };

  if (!workingDir) {
    return (
      <div className="projmem-empty">
        <FileText size={18} />
        <div>Open a folder to view and edit project memory.</div>
      </div>
    );
  }

  return (
    <div className="projmem-root">
      <div className="projmem-toolbar">
        <div className="projmem-title">
          <FileText size={13} style={{ color: 'var(--accent-primary)' }} />
          <span>Project memory</span>
          {memory && <span className="projmem-charcount">{draft.length} chars</span>}
        </div>
        <div className="projmem-actions">
          <button className="btn btn-ghost btn-small" onClick={refresh} disabled={loading} title="Reload from disk">
            <RefreshCw size={11} className={loading ? 'spin' : ''} />
          </button>
          <button className="btn btn-secondary btn-small" onClick={exportMemory} disabled={!memory} title="Download as Markdown">
            <Download size={11} /> Export
          </button>
          <button className="btn btn-secondary btn-small" onClick={archive} disabled={archiving || !memory} title="Snapshot current memory to a timestamped file">
            {archiving ? <Loader size={11} className="spin" /> : <Archive size={11} />} Archive
          </button>
          <button className="btn btn-primary btn-small" onClick={save} disabled={!dirty || saving || !memory} title="Save changes to memory.md">
            {saving ? <Loader size={11} className="spin" /> : <Save size={11} />} Save
          </button>
        </div>
      </div>
      {error && <div className="projmem-banner projmem-banner-error">{error}</div>}
      {info && <div className="projmem-banner projmem-banner-ok">{info}</div>}
      {loading && !memory ? (
        <div className="projmem-empty"><Loader size={18} className="spin" /> Loading memory…</div>
      ) : (
        <textarea
          className="projmem-textarea"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setDirty(true); }}
          placeholder="# Project memory\n\nNotes the assistant should remember about this project.\nUse Markdown."
          rows={20}
        />
      )}
      {memory?.updatedAt && (
        <div className="projmem-foot">
          Last updated {new Date(memory.updatedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
