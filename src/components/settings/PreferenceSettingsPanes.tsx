import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Check, Loader, MessageCircle, Moon, Plus, Trash2 } from 'lucide-react';
import type { ThemeTextureRecipe } from '../../theme/themeTokens';
import * as api from '../../utils/api';
import {
  getThemeById,
  getThemesByMode,
  getInstalledThemePluginManifests,
  importThemePluginFromJson,
  isSystemThemePreference,
  resolveThemeId,
  SYSTEM_THEME_ID,
} from '../../theme/builtins';

function PaneTitle({ children }: { children: ReactNode }) {
  return <div className="settings-pane-title">{children}</div>;
}

function PaneDesc({ children }: { children: ReactNode }) {
  return <div className="settings-pane-desc">{children}</div>;
}

export function PersonalityPane({ personalityText, onChange }: any) {
  const presets = [
    { id: 'professional', label: 'Professional', text: 'You are a professional software engineering assistant. Be thorough, well-structured, and prioritize code quality and best practices.' },
    { id: 'concise', label: 'Concise', text: 'Be brief and direct. Show code, skip preamble. Focus on what changed and why.' },
    { id: 'detailed', label: 'Detailed', text: 'Provide a concise rationale. Include relevant context, alternatives considered, and tradeoffs when useful. Teach while you code.' },
    { id: 'creative', label: 'Creative', text: 'Think outside the box. Suggest unconventional approaches when appropriate. Prioritize elegance and developer experience.' },
  ];
  return (
    <>
      <PaneTitle>Agent Personality</PaneTitle>
      <PaneDesc>Customize how the AI assistant communicates. Choose a preset or write your own instructions.</PaneDesc>
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {presets.map((p) => (
            <button key={p.id} className="settings-mini-button" style={personalityText === p.text ? { background: 'var(--accent-primary)', color: 'white' } : {}}
              onClick={() => onChange(personalityText === p.text ? '' : p.text)}>
              <MessageCircle size={11} /> {p.label}
            </button>
          ))}
        </div>
        <textarea className="personality-textarea" placeholder="E.g., Be concise and direct. Focus on code quality over explanation." value={personalityText} onChange={(e) => onChange(e.target.value)} rows={6} />
      </div>
    </>
  );
}

const emptyPersonalizationProfile: api.PersonalizationProfile = {
  enabled: false,
  updatedAt: null,
  responseStyle: '',
  likes: [],
  dislikes: [],
  workflowStyle: '',
  promptingStyle: '',
  modelPreferences: '',
  toolPreferences: '',
  projectPreferences: '',
  neverDo: [],
  compactSummary: '',
};

function listToText(items: string[]): string {
  return items.join('\n');
}

function textToList(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim().replace(/^[-*]\s*/, ''))
    .filter(Boolean);
}

export function PersonalizationPane() {
  const [profile, setProfile] = useState<api.PersonalizationProfile>(emptyPersonalizationProfile);
  const [profilePath, setProfilePath] = useState('');
  const [likesText, setLikesText] = useState('');
  const [dislikesText, setDislikesText] = useState('');
  const [neverDoText, setNeverDoText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const hydrate = useCallback((nextProfile: api.PersonalizationProfile, path: string) => {
    setProfile(nextProfile);
    setProfilePath(path);
    setLikesText(listToText(nextProfile.likes));
    setDislikesText(listToText(nextProfile.dislikes));
    setNeverDoText(listToText(nextProfile.neverDo));
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.getPersonalization()
      .then((result) => {
        if (cancelled) return;
        hydrate(result.profile, result.path);
      })
      .catch(() => {
        if (!cancelled) setStatus('Could not load personalization profile');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [hydrate]);

  const updateField = (field: keyof api.PersonalizationProfile, value: string | boolean) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const result = await api.updatePersonalization({
        ...profile,
        likes: textToList(likesText),
        dislikes: textToList(dislikesText),
        neverDo: textToList(neverDoText),
      });
      hydrate(result.profile, result.path);
      setStatus('Saved encrypted profile');
    } catch {
      setStatus('Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const approved = window.confirm('Delete the encrypted personalization profile from this machine?');
    if (!approved) return;
    setSaving(true);
    setStatus(null);
    try {
      const result = await api.deletePersonalization();
      hydrate(result.profile, result.path);
      setStatus('Deleted profile');
    } catch {
      setStatus('Could not delete profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PaneTitle>Personalization</PaneTitle>
      <PaneDesc>Encrypted local preferences for response style, workflow fit, and model/tool defaults.</PaneDesc>
      <div className="settings-card" style={{ marginTop: 16 }}>
        <label className="settings-toggle-row">
          <input
            type="checkbox"
            checked={profile.enabled}
            onChange={(event) => updateField('enabled', event.target.checked)}
            disabled={loading || saving}
          />
          <span>Use personalization in model prompts</span>
        </label>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5, marginTop: 8 }}>
          Stored at {profilePath || '~/.openharness/personalization.enc.json'}
        </div>
      </div>
      <div className="add-provider-card" style={{ marginTop: 16 }}>
        <div className="add-provider-grid">
          <label>Compact summary
            <textarea className="personality-textarea" rows={4} value={profile.compactSummary} onChange={(event) => updateField('compactSummary', event.target.value)} placeholder="Concise style, validation proof, preferred workflow..." />
          </label>
          <label>Response style
            <textarea className="personality-textarea" rows={3} value={profile.responseStyle} onChange={(event) => updateField('responseStyle', event.target.value)} />
          </label>
          <label>Likes
            <textarea className="personality-textarea" rows={4} value={likesText} onChange={(event) => setLikesText(event.target.value)} placeholder="One preference per line" />
          </label>
          <label>Dislikes
            <textarea className="personality-textarea" rows={4} value={dislikesText} onChange={(event) => setDislikesText(event.target.value)} placeholder="One preference per line" />
          </label>
          <label>Workflow style
            <textarea className="personality-textarea" rows={3} value={profile.workflowStyle} onChange={(event) => updateField('workflowStyle', event.target.value)} />
          </label>
          <label>Prompting style
            <textarea className="personality-textarea" rows={3} value={profile.promptingStyle} onChange={(event) => updateField('promptingStyle', event.target.value)} />
          </label>
          <label>Model preferences
            <textarea className="personality-textarea" rows={3} value={profile.modelPreferences} onChange={(event) => updateField('modelPreferences', event.target.value)} />
          </label>
          <label>Tool preferences
            <textarea className="personality-textarea" rows={3} value={profile.toolPreferences} onChange={(event) => updateField('toolPreferences', event.target.value)} />
          </label>
          <label>Project preferences
            <textarea className="personality-textarea" rows={3} value={profile.projectPreferences} onChange={(event) => updateField('projectPreferences', event.target.value)} />
          </label>
          <label>Never do
            <textarea className="personality-textarea" rows={4} value={neverDoText} onChange={(event) => setNeverDoText(event.target.value)} placeholder="One rule per line" />
          </label>
        </div>
        {status && <div className={`test-result ${/could not/i.test(status) ? 'error' : 'success'}`}>{status}</div>}
        <div className="add-provider-actions">
          <button className="settings-mini-button" onClick={handleDelete} disabled={saving || loading}>
            <Trash2 size={11} /> Delete
          </button>
          <button className="settings-mini-button" style={{ background: 'var(--accent-primary)', color: 'white' }} onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader size={11} className="spin" /> : <Check size={11} />}
            {saving ? 'Saving...' : 'Save encrypted profile'}
          </button>
        </div>
      </div>
    </>
  );
}

function textureLabel(recipe?: string, opacity?: number): string {
  if (!recipe || recipe === 'none' || !opacity) return 'Texture: none';
  const label = recipe
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  return `Texture: ${label} · ${Math.round(opacity * 100)}%`;
}

const TEXTURE_OPTIONS: Array<{ id: ThemeTextureRecipe; label: string; desc: string }> = [
  { id: 'none', label: 'None', desc: 'Clean flat shell' },
  { id: 'low-noise-matte', label: 'Calm matte', desc: 'Quiet default surface' },
  { id: 'soft-marble', label: 'Soft marble', desc: 'Subtle cloudy paper' },
  { id: 'brushed-plaster', label: 'Brushed plaster', desc: 'Fine directional sweep' },
  { id: 'paper-fiber', label: 'Paper fiber', desc: 'Soft woven flecks' },
  { id: 'frosted-noise', label: 'Frosted noise', desc: 'Light diffuse grain' },
  { id: 'paper-grain', label: 'Paper grain', desc: 'Classic speckle' },
  { id: 'fine-grid', label: 'Fine grid', desc: 'Technical linework' },
  { id: 'blueprint-grid', label: 'Blueprint grid', desc: 'Structured drafting grid' },
  { id: 'terminal-scanline', label: 'Scanline', desc: 'CRT-style bands' },
  { id: 'soft-glass', label: 'Soft glass', desc: 'Gentle diagonal sheen' },
];

export function ThemePane({ activeTheme, textureOpacityOverride, textureRecipeOverride, onSelectTheme, onTextureOpacityOverrideChange, onTextureRecipeOverrideChange, onThemePluginManifestsChange, onRemoveTheme }: any) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resolvedActiveTheme = resolveThemeId(activeTheme);
  const usingSystemTheme = isSystemThemePreference(activeTheme);
  const hasRepair = !isSystemThemePreference(activeTheme) && activeTheme !== resolvedActiveTheme;
  const activeThemeDetails = getThemeById(resolvedActiveTheme);
  const baseTextureRecipe = activeThemeDetails?.tokens.effects?.textureRecipe || 'none';
  const effectiveTextureRecipe = textureRecipeOverride || baseTextureRecipe;
  const baseTextureOpacity = activeThemeDetails?.tokens.effects?.textureOpacity ?? 0;
  const effectiveTextureOpacity = textureOpacityOverride ?? baseTextureOpacity;
  const effectiveTexturePercent = Math.round(effectiveTextureOpacity * 100);
  const textureGuidanceId = 'theme-texture-opacity-guidance';
  const [importFeedback, setImportFeedback] = useState<{ kind: 'error' | 'success'; message: string; details?: string[] } | null>(null);
  const themeGroups = [
    { mode: 'dark', label: 'Dark themes', themes: getThemesByMode('dark') },
    { mode: 'light', label: 'Light themes', themes: getThemesByMode('light') },
  ] as const;

  const handleImportThemes = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportFeedback(null);
    try {
      const payload = await file.text();
      const importResult = importThemePluginFromJson(payload);
      if (!importResult.ok || importResult.errors.length > 0) {
        setImportFeedback({
          kind: 'error',
          message: `Theme import failed: ${importResult.errors[0] || 'unknown error'}`,
          details: importResult.errors.slice(1),
        });
      } else {
        onThemePluginManifestsChange(getInstalledThemePluginManifests());
        const imported = importResult.importedThemeIds.length > 0
          ? importResult.importedThemeIds
            .map((id) => `${id} (${getThemeById(id)?.label || id})`)
            .join(', ')
          : 'No themes';
        setImportFeedback({
          kind: 'success',
          message: `Imported ${importResult.importedThemeIds.length} theme variant(s).`,
          details: [imported, ...importResult.warnings],
        });
      }
    } catch (error) {
      setImportFeedback({
        kind: 'error',
        message: 'Could not read theme manifest file.',
        details: [error instanceof Error ? error.message : 'Unknown error'],
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const showImportPicker = () => fileInputRef.current?.click();

  return (
    <>
      <PaneTitle>Theme</PaneTitle>
      <PaneDesc>Choose a colorway. Changes apply instantly.</PaneDesc>
      <div style={{ marginTop: 16 }}>
        <div className="settings-card" style={{ marginBottom: 14, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>System appearance</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                Follow macOS by default, or pick a specific theme below.
              </div>
            </div>
            <button
              className={`settings-mini-button ${usingSystemTheme ? 'active' : ''}`}
              onClick={() => onSelectTheme(SYSTEM_THEME_ID)}
            >
              {usingSystemTheme ? <Check size={11} /> : <Moon size={11} />}
              System
            </button>
          </div>
        </div>
        {hasRepair && (
          <div style={{ color: 'var(--accent-warning)', fontSize: 12, marginBottom: 12 }}>
            Saved theme "{activeTheme}" is unavailable. Reverted to "{resolvedActiveTheme}".
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            Import a validated theme manifest (.json) to add community themes.
          </div>
          <button className="settings-mini-button" onClick={showImportPicker}>
            <Plus size={11} /> Import theme
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImportThemes}
          style={{ display: 'none' }}
        />
        <div className="settings-card" style={{ marginBottom: 14, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Texture style</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                Pick a generated texture, then tune its strength with the slider.
              </div>
            </div>
            <button
              className="settings-mini-button"
              disabled={textureRecipeOverride === null}
              onClick={() => onTextureRecipeOverrideChange(null)}
            >
              Reset
            </button>
          </div>
          <div className="theme-texture-grid">
            {TEXTURE_OPTIONS.map((texture) => (
              <button
                key={texture.id}
                className={`theme-texture-option ${effectiveTextureRecipe === texture.id ? 'active' : ''}`}
                onClick={() => onTextureRecipeOverrideChange(texture.id)}
              >
                <span className="theme-texture-preview" data-texture-preview={texture.id} />
                <span className="theme-texture-copy">
                  <span className="theme-texture-label">{texture.label}</span>
                  <span className="theme-texture-desc">{texture.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="settings-card" style={{ marginBottom: 14, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Texture opacity</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                {textureOpacityOverride === null
                  ? `Using ${activeThemeDetails?.label || resolvedActiveTheme} default (${Math.round(baseTextureOpacity * 100)}%).`
                  : 'Using a custom shell-wide texture intensity.'}
              </div>
            </div>
            <button
              className="settings-mini-button"
              disabled={textureOpacityOverride === null}
              onClick={() => onTextureOpacityOverrideChange(null)}
            >
              Reset
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 42px', gap: 10, alignItems: 'center' }}>
            <input
              type="range"
              min={0}
              max={18}
              step={1}
              value={effectiveTexturePercent}
              onChange={(event) => onTextureOpacityOverrideChange(Number(event.target.value) / 100)}
              aria-label="Theme texture opacity"
              aria-valuetext={`${effectiveTexturePercent}% shell texture opacity`}
              aria-describedby={textureGuidanceId}
            />
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {effectiveTexturePercent}%
            </div>
          </div>
          <div id={textureGuidanceId} style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.4 }}>
            Textures are shell-only. When reduced transparency is requested, textures and blur are disabled and glass surfaces use each theme's solid fallback colors.
          </div>
        </div>
        {importFeedback && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: importFeedback.kind === 'error' ? 'var(--accent-error)' : 'var(--accent-success)', fontSize: 12 }}>
              {importFeedback.message}
            </div>
            {importFeedback.details && importFeedback.details.length > 0 && (
              <ul style={{ margin: '6px 0 0', paddingLeft: 20, color: 'var(--text-tertiary)', fontSize: 11 }}>
                {importFeedback.details.filter(Boolean).map((line) => (
                  <li key={`${importFeedback.kind}-${line}`}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {themeGroups.map((group) => (
          <div key={group.mode} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-tertiary)', marginBottom: 8 }}>
              {group.label}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
              {group.themes.map((t) => (
                <button key={t.id} className={`settings-card ${!usingSystemTheme && resolvedActiveTheme === t.id ? 'active' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    padding: '10px 12px',
                    border: !usingSystemTheme && resolvedActiveTheme === t.id ? '2px solid var(--accent-primary)' : undefined,
                    position: 'relative',
                  }}
                  onClick={() => onSelectTheme(t.id)}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: t.color, flexShrink: 0 }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{t.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {textureLabel(t.tokens.effects?.textureRecipe, t.tokens.effects?.textureOpacity)}
                    </div>
                    {!usingSystemTheme && resolvedActiveTheme === t.id && <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Active</div>}
                  </div>
                  {!t.tags?.includes('builtin') && (
                    <button
                      className="settings-mini-button"
                      title={`Remove ${t.label}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveTheme(t.id);
                      }}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: 8,
                        minWidth: 'auto',
                        padding: '2px 6px',
                      }}
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
