import { useState, useEffect } from 'react';
import {
  Zap, Brain, FolderOpen, ArrowRight, ArrowLeft, Check,
  Wifi, Loader, Sparkles, Rocket, ChevronDown,
  MessageCircle, Shield, ShieldCheck, ShieldAlert, Cpu, Sun, Moon,
  CheckCircle2, Circle, X, Container, Eye,
} from 'lucide-react';
import * as api from '../utils/api';

// ── Provider catalog (shared with onboarding) ──────────
interface OnboardingProvider {
  id: string;
  name: string;
  type?: 'openai-compatible' | 'anthropic' | 'google' | 'local';
  color: string;
  desc: string;
  baseURL: string;
  placeholder: string;
  isLocal?: boolean;
  defaultKey?: string;
  quickConnect?: boolean;
}

const QUICK_PROVIDERS: OnboardingProvider[] = [
  { id: 'openai', name: 'OpenAI', color: '#10a37f', desc: 'GPT-4.1, o3, o4-mini', baseURL: 'https://api.openai.com/v1', placeholder: 'sk-...', quickConnect: true },
  { id: 'minimax', name: 'MiniMax', color: '#6366f1', desc: 'M2.7, M3 — fast & affordable', baseURL: 'https://api.minimax.io/v1', placeholder: 'sk-cp-...', quickConnect: true },
  { id: 'anthropic', name: 'Anthropic', type: 'anthropic', color: '#d97706', desc: 'Claude Sonnet, Haiku, Opus', baseURL: 'https://api.anthropic.com/v1', placeholder: 'sk-ant-...', quickConnect: true },
  { id: 'google', name: 'Google Gemini', type: 'google', color: '#4285f4', desc: 'Gemini 2.5 Pro/Flash', baseURL: 'https://generativelanguage.googleapis.com/v1beta', placeholder: 'AIza...', quickConnect: true },
  { id: 'ollama', name: 'Ollama', type: 'local', color: '#6b7280', desc: 'Free local models', baseURL: 'http://localhost:11434/v1', placeholder: '(no key needed)', isLocal: true, quickConnect: true },
];

const EXTENDED_PROVIDERS: OnboardingProvider[] = [
  { id: 'deepseek', name: 'DeepSeek', color: '#4a9eff', desc: 'V4, V4 Flash, R2', baseURL: 'https://api.deepseek.com/v1', placeholder: 'sk-...' },
  { id: 'xai', name: 'xAI (Grok)', color: '#1d9bf0', desc: 'Grok models', baseURL: 'https://api.x.ai/v1', placeholder: 'xai-...' },
  { id: 'mistral', name: 'Mistral', color: '#f54e42', desc: 'Mistral Large, Codestral', baseURL: 'https://api.mistral.ai/v1', placeholder: '...' },
  { id: 'zhipu', name: 'Z.AI / Zhipu', color: '#3b5998', desc: 'GLM coding models', baseURL: 'https://api.z.ai/api/coding/paas/v4', placeholder: '...' },
  { id: 'openrouter', name: 'OpenRouter', color: '#6d28d9', desc: 'Gateway to many models', baseURL: 'https://openrouter.ai/api/v1', placeholder: 'sk-or-...' },
  { id: 'qwen', name: 'Alibaba Qwen', color: '#ff6a00', desc: 'Qwen via DashScope', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', placeholder: 'sk-...' },
  { id: 'lmstudio', name: 'LM Studio', type: 'local', color: '#6b7280', desc: 'Free local models', baseURL: 'http://localhost:1234/v1', placeholder: '(no key needed)', isLocal: true },
];

function providerType(provider: OnboardingProvider): 'openai-compatible' | 'anthropic' | 'google' | 'local' {
  return provider.type || (provider.isLocal ? 'local' : 'openai-compatible');
}

// ── Personality presets ────────────────────────────────
interface PersonalityPreset { id: string; label: string; text: string; }
const PERSONALITIES: PersonalityPreset[] = [
  { id: 'business', label: 'Business-only', text: 'You are a professional software engineering assistant. Be thorough, well-structured, and prioritize code quality and best practices.' },
  { id: 'concise', label: 'Concise', text: 'Be brief and direct. Show code, skip preamble. Focus on what changed and why.' },
  { id: 'detailed', label: 'Detailed', text: 'Provide a concise rationale. Include relevant context, alternatives considered, and tradeoffs when useful. Teach while you code.' },
  { id: 'chatty', label: 'Chatty', text: 'Be warm, friendly, and conversational. Use humor when it fits and explain things in plain English.' },
  { id: 'teacher', label: 'Helpful teacher', text: 'Explain the why behind every change. When you write code, teach the underlying patterns. Be patient and supportive.' },
  { id: 'creative', label: 'Creative', text: 'Think outside the box. Suggest unconventional approaches when appropriate. Prioritize elegance and developer experience.' },
];

const THEME_CHOICES = [
  { id: 'midnight', label: 'Midnight', group: 'dark', color: '#6366f1' },
  { id: 'charcoal', label: 'Charcoal', group: 'dark', color: '#a1a1aa' },
  { id: 'forest', label: 'Forest', group: 'dark', color: '#10b981' },
  { id: 'crimson', label: 'Crimson', group: 'dark', color: '#f43f5e' },
  { id: 'daylight', label: 'Daylight', group: 'light', color: '#6366f1' },
  { id: 'silver', label: 'Silver', group: 'light', color: '#3b82f6' },
  { id: 'sage', label: 'Sage', group: 'light', color: '#10b981' },
  { id: 'blush', label: 'Blush', group: 'light', color: '#f43f5e' },
];

// ── Trust mode options ─────────────────────────────────
const TRUST_OPTIONS: { id: 'chat-only' | 'read-only' | 'ask-before-write' | 'workspace-write'; label: string; icon: any; desc: string }[] = [
  { id: 'chat-only', label: 'Chat only', icon: MessageCircle, desc: 'AI can read files and chat. No commands, no edits. Safest option.' },
  { id: 'read-only', label: 'Read only', icon: Eye, desc: 'AI can run read-only commands and inspect files. No writes.' },
  { id: 'ask-before-write', label: 'Ask before writing', icon: ShieldAlert, desc: 'AI proposes changes, you approve every write. Balanced default.' },
  { id: 'workspace-write', label: 'Workspace write', icon: ShieldCheck, desc: 'AI can edit files inside the project. Most productive, less safe.' },
];

// ── Role buckets ───────────────────────────────────────
const ROLE_BUCKETS = [
  { id: 'coder', label: 'Coder', desc: 'Primary coding agent' },
  { id: 'reasoner', label: 'Reasoner', desc: 'Complex reasoning / planning' },
  { id: 'summarizer', label: 'Summarizer', desc: 'Text summarization' },
  { id: 'title', label: 'Title', desc: 'Short title generation' },
  { id: 'planner', label: 'Planner', desc: 'Task decomposition' },
  { id: 'reviewer', label: 'Reviewer', desc: 'Code review' },
  { id: 'worker', label: 'Worker', desc: 'Fast parallel tasks' },
];

interface OnboardingResult {
  providers: any[];
  activeModel: string;
  activeTheme: string;
  personality: string;
  trustMode: string;
  roleAssignments: Record<string, string>;
  folderPath: string | null;
}

interface Props {
  onComplete: (result: OnboardingResult) => void;
  onSkip: () => void;
}

export function OnboardingWizard({ onComplete, onSkip }: Props) {
  const [step, setStep] = useState(0);
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(new Set());
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string; models?: number }>>({});
  const [ollamaDetected, setOllamaDetected] = useState(false);
  const [lmstudioDetected, setLmstudioDetected] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [personality, setPersonality] = useState('');
  const [trustMode, setTrustMode] = useState<'chat-only' | 'read-only' | 'ask-before-write' | 'workspace-write'>('ask-before-write');
  const [optimizationPref, setOptimizationPref] = useState<string>('balanced');
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dockerReadiness, setDockerReadiness] = useState<api.DockerReadiness | null>(null);
  const [activeTheme, setActiveTheme] = useState('midnight');

  // Load saved onboarding step on mount
  useEffect(() => {
    (async () => {
      try {
        const cfg = await api.getConfig();
        const savedStep = (cfg as any).onboardingStep;
        if (typeof savedStep === 'number' && savedStep > 0 && savedStep <= 8) {
          setStep(savedStep);
        }
        if (typeof (cfg as any).activeTheme === 'string' && (cfg as any).activeTheme) {
          const themeId = (cfg as any).activeTheme as string;
          setActiveTheme(themeId);
          document.documentElement.setAttribute('data-theme', themeId);
        }
      } catch {}

    })();
  }, []);

  // Auto-detect local providers + docker readiness on mount
  useEffect(() => {
    (async () => {
      const localProviders = await api.discoverLocalProviders();
      setOllamaDetected(localProviders.some((p) => p.id === 'ollama' && p.reachable));
      setLmstudioDetected(localProviders.some((p) => p.id === 'lmstudio' && p.reachable));
      const readiness = await api.getDockerReadiness();
      if (readiness) setDockerReadiness(readiness);
    })();
  }, []);

  const allProviders = [...QUICK_PROVIDERS, ...EXTENDED_PROVIDERS];

  const toggleProvider = (id: string) => {
    setSelectedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTestAll = async () => {
    setTesting(true);
    setTestResults({});
    const next: Record<string, { ok: boolean; msg: string; models?: number }> = {};
    for (const id of selectedProviders) {
      const p = allProviders.find((x) => x.id === id);
      if (!p) continue;
      try {
        const result = await api.addProvider({
          id: p.id,
          name: p.name,
          type: providerType(p),
          apiKey: p.isLocal ? '' : (apiKeys[p.id] || ''),
          baseURL: p.baseURL,
        });
        try {
          const models = await api.fetchProviderModels(result.id, p.isLocal ? undefined : apiKeys[p.id]);
          next[p.id] = { ok: true, msg: `Connected (${models.length} models)`, models: models.length };
        } catch {
          next[p.id] = { ok: true, msg: 'Connected (models not fetched)' };
        }
      } catch (err: any) {
        next[p.id] = { ok: false, msg: err.message || 'Failed' };
      }
    }
    setTestResults(next);
    setTesting(false);
  };

  const handleOpenFolder = async () => {
    try {
      const path = await api.openFolderDialog();
      if (path) setFolderPath(path);
    } catch { /* dialog cancelled */ }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      // Save all selected providers in one batch (covers the case where the
      // user tested them one-by-one but some still need a key).
      const toSave = [...selectedProviders].map((id) => {
        const p = allProviders.find((x) => x.id === id)!;
        return {
          name: p.name,
          id: p.id,
          type: providerType(p),
          apiKey: p.isLocal ? '' : (apiKeys[p.id] || ''),
          baseURL: p.baseURL,
        };
      });
      if (toSave.length > 0) {
        try { await api.saveProvidersBatch(toSave); } catch { /* some may already exist; fall through */ }
      }

      // Get available models and pick active model
      const models = await api.getModels();
      const activeModel = models[0]?.id || '';

      // Build default role assignments (all -> active model; user can override later)
      const roleAssignments: Record<string, string> = {};
      if (activeModel) {
        for (const role of ROLE_BUCKETS) roleAssignments[role.id] = activeModel;
      }

      // Persist personality + trust + active model + role assignments
      await api.updateConfig({
        activeTheme,
        personality,
        activeModel,
        trustMode,
        roleAssignments: roleAssignments as any,
      });

      onComplete({
        providers: toSave,
        activeTheme,
        activeModel,
        personality,
        trustMode,
        roleAssignments,
        folderPath,
      });
    } catch {
      // Best-effort: still hand off to parent so they can refresh state.
      onComplete({
        providers: [],
        activeTheme,
        activeModel: '',
        personality,
        trustMode,
        roleAssignments: {},
        folderPath,
      });
    } finally {
      setSaving(false);
    }
  };

  const stepDots = (
    <div className="onboarding-step-dots">
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div key={i} className={`onboarding-dot ${i === step ? 'active' : ''}`} />
      ))}
    </div>
  );

  // ── Step 0: Welcome ──
  if (step === 0) {
    return (
      <div className="onboarding-root">
        <div className="onboarding-card" style={{ maxWidth: 520 }}>
          <div className="onboarding-icon-large">
            <Rocket size={32} />
          </div>
          <h1 className="onboarding-title">Welcome to OpenHarness</h1>
          <p className="onboarding-subtitle">
            Your open AI coding harness. Connect any model, pick an agent style, and start building.
          </p>

          <div className="onboarding-features">
            <div className="onboarding-feature">
              <Zap size={16} style={{ color: 'var(--accent-primary)' }} />
              <span>Works with <strong>any AI model</strong> — OpenAI, Anthropic, Google, local, free</span>
            </div>
            <div className="onboarding-feature">
              <Brain size={16} style={{ color: 'var(--accent-primary)' }} />
              <span><strong>Multi-provider setup</strong> — add as many providers as you have, in one pass</span>
            </div>
            <div className="onboarding-feature">
              <Container size={16} style={{ color: 'var(--accent-primary)' }} />
              <span><strong>Optional MCP tools</strong> — files, git, browser, SQLite, and more</span>
            </div>
            <div className="onboarding-feature">
              <Shield size={16} style={{ color: 'var(--accent-primary)' }} />
              <span><strong>Your code, your keys</strong> — pick the trust level that fits your work</span>
            </div>
          </div>

          {dockerReadiness && (
            <div className="onboarding-tip" style={{ marginTop: 16 }}>
              <Container size={14} />
              <span>
                {dockerReadiness.dockerMcpAvailable
                  ? 'Docker MCP Toolkit detected — Docker MCP will be available after setup.'
                  : dockerReadiness.dockerInstalled
                    ? 'Docker is installed but the MCP Toolkit is not — you can enable it later from Settings.'
                    : 'Docker is optional — you can enable it later from Settings.'}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
            <button className="onboarding-btn-primary" onClick={async () => { setStep(1); try { await api.updateConfig({ onboardingStep: 1 } as any); } catch {} }}>
              Get started <ArrowRight size={16} />
            </button>
            <button className="onboarding-btn-secondary" onClick={onSkip}>
              Skip setup
            </button>
          </div>
          {stepDots}
        </div>
      </div>
    );
  }

  // ── Step 1: Theme choice ──
  if (step === 1) {
    return (
      <div className="onboarding-root">
        <div className="onboarding-card" style={{ maxWidth: 620 }}>
          <h2 className="onboarding-step-title">
            <Sun size={20} /> Pick a theme
          </h2>
          <p className="onboarding-step-subtitle">Choose a UI theme first, then continue through setup.</p>

          {['dark', 'light'].map((group) => (
            <div key={group} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                {group === 'dark' ? 'Dark themes' : 'Light themes'}
              </div>
              <div className="onboarding-theme-grid">
                {THEME_CHOICES.filter((theme) => theme.group === group).map((theme) => {
                  const isSelected = activeTheme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      className={`onboarding-theme-card ${isSelected ? 'selected' : ''}`}
                      onClick={async () => {
                        setActiveTheme(theme.id);
                        document.documentElement.setAttribute('data-theme', theme.id);
                        try { await api.updateConfig({ activeTheme: theme.id } as any); } catch {}
                      }}
                    >
                      <div className="onboarding-theme-swatch" style={{ background: theme.color }} />
                      <div className="onboarding-theme-info">
                        <div className="onboarding-theme-label">{theme.label}</div>
                        {isSelected && <div className="onboarding-theme-active">Active</div>}
                      </div>
                      <Moon size={14} style={{ color: isSelected ? 'var(--accent-primary)' : 'var(--text-tertiary)' }} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="onboarding-nav">
            <button className="onboarding-btn-back" onClick={async () => { setStep(0); try { await api.updateConfig({ onboardingStep: 0 } as any); } catch {} }}>
              <ArrowLeft size={16} /> Back
            </button>
            <button className="onboarding-btn-primary" onClick={() => setStep(2)}>
              Continue <ArrowRight size={16} />
            </button>
          </div>
          {stepDots}
        </div>
      </div>
    );
  }

  // ── Step 2: Pick providers ──
  if (step === 2) {
    return (
      <div className="onboarding-root">
        <div className="onboarding-card" style={{ maxWidth: 620 }}>
          <h2 className="onboarding-step-title">
            <Cpu size={20} /> Which providers do you have?
          </h2>
          <p className="onboarding-step-subtitle">Check every provider you already have a key for. Local providers are free.</p>

          {(ollamaDetected || lmstudioDetected) && (
            <div className="onboarding-tip">
              <Sparkles size={14} />
              <span>
                {ollamaDetected && 'Ollama is running on this machine. '}
                {lmstudioDetected && 'LM Studio is running on this machine. '}
                Both are free and need no key.
              </span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            {QUICK_PROVIDERS.map((p) => {
              const detected = (p.id === 'ollama' && ollamaDetected) || (p.id === 'lmstudio' && lmstudioDetected);
              const selected = selectedProviders.has(p.id);
              return (
                <button
                  key={p.id}
                  className={`onboarding-provider-card ${selected ? 'selected' : ''}`}
                  onClick={() => toggleProvider(p.id)}
                >
                  <div className="onboarding-provider-dot" style={{ background: p.color }} />
                  <div className="onboarding-provider-info">
                    <div className="onboarding-provider-name">
                      {p.name}
                      {p.isLocal && <span className="onboarding-badge-free">FREE · LOCAL</span>}
                      {detected && <span className="onboarding-badge-detected">DETECTED</span>}
                    </div>
                    <div className="onboarding-provider-desc">{p.desc}</div>
                  </div>
                  {selected ? <CheckCircle2 size={18} style={{ color: 'var(--accent-primary)' }} /> : <Circle size={18} style={{ color: 'var(--text-tertiary)' }} />}
                </button>
              );
            })}
          </div>

          {showMore && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {EXTENDED_PROVIDERS.map((p) => {
                const detected = p.id === 'lmstudio' && lmstudioDetected;
                const selected = selectedProviders.has(p.id);
                return (
                  <button
                    key={p.id}
                    className={`onboarding-provider-card ${selected ? 'selected' : ''}`}
                    onClick={() => toggleProvider(p.id)}
                  >
                    <div className="onboarding-provider-dot" style={{ background: p.color }} />
                    <div className="onboarding-provider-info">
                      <div className="onboarding-provider-name">
                        {p.name}
                        {p.isLocal && <span className="onboarding-badge-free">FREE · LOCAL</span>}
                        {detected && <span className="onboarding-badge-detected">DETECTED</span>}
                      </div>
                      <div className="onboarding-provider-desc">{p.desc}</div>
                    </div>
                    {selected ? <CheckCircle2 size={18} style={{ color: 'var(--accent-primary)' }} /> : <Circle size={18} style={{ color: 'var(--text-tertiary)' }} />}
                  </button>
                );
              })}
            </div>
          )}

          {!showMore && (
            <button className="onboarding-show-more" onClick={() => setShowMore(true)}>
              <ChevronDown size={14} /> Show {EXTENDED_PROVIDERS.length} more providers (Z.AI, Qwen, Grok, Mistral...)
            </button>
          )}

          <div className="onboarding-nav">
            <button className="onboarding-btn-back" onClick={async () => { setStep(1); try { await api.updateConfig({ onboardingStep: 1 } as any); } catch {} }}>
              <ArrowLeft size={16} /> Back
            </button>
            <button
              className="onboarding-btn-primary"
              disabled={selectedProviders.size === 0}
              onClick={() => setStep(3)}
            >
              {selectedProviders.size > 0 ? `${selectedProviders.size} selected` : 'Select at least one'} <ArrowRight size={16} />
            </button>
          </div>
          {stepDots}
        </div>
      </div>
    );
  }

  // ── Step 3: Enter keys ──
  if (step === 3) {
    return (
      <div className="onboarding-root">
        <div className="onboarding-card" style={{ maxWidth: 560 }}>
          <h2 className="onboarding-step-title">
            <Wifi size={20} /> Add your API keys
          </h2>
          <p className="onboarding-step-subtitle">Paste the keys for the providers you picked. You can skip a key and add it later from Settings.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16, maxHeight: 360, overflowY: 'auto' }}>
            {[...selectedProviders].map((id) => {
              const p = allProviders.find((x) => x.id === id);
              if (!p) return null;
              if (p.isLocal) {
                return (
                  <div key={id} className="onboarding-key-row">
                    <div className="onboarding-provider-dot" style={{ background: p.color }} />
                    <div style={{ flex: 1 }}>
                      <div className="onboarding-provider-name">{p.name}</div>
                      <div className="onboarding-provider-desc">Local — no key needed</div>
                    </div>
                    <Check size={16} style={{ color: 'var(--accent-success)' }} />
                  </div>
                );
              }
              return (
                <div key={id} className="onboarding-key-row">
                  <div className="onboarding-provider-dot" style={{ background: p.color }} />
                  <div style={{ flex: 1 }}>
                    <div className="onboarding-provider-name">{p.name}</div>
                    <input
                      className="onboarding-input"
                      type="password"
                      placeholder={p.placeholder}
                      value={apiKeys[id] || ''}
                      onChange={(e) => setApiKeys((prev) => ({ ...prev, [id]: e.target.value }))}
                      style={{ marginTop: 6 }}
                    />
                  </div>
                  {testResults[id] && (
                    <div className={`onboarding-mini-result ${testResults[id].ok ? 'success' : 'error'}`}>
                      {testResults[id].ok ? <Check size={12} /> : <X size={12} />}
                      {testResults[id].msg}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button
              className="onboarding-btn-secondary"
              onClick={handleTestAll}
              disabled={testing || selectedProviders.size === 0}
            >
              {testing ? <><Loader size={14} className="spin" /> Testing...</> : <><CheckCircle2 size={14} /> Test all & save</>}
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', alignSelf: 'center' }}>
              Failures are saved as drafts — you can fix them in Settings.
            </span>
          </div>

          <div className="onboarding-nav">
            <button className="onboarding-btn-back" onClick={() => setStep(2)}>
              <ArrowLeft size={16} /> Back
            </button>
            <button className="onboarding-btn-primary" onClick={() => setStep(4)}>
              Continue <ArrowRight size={16} />
            </button>
          </div>
          {stepDots}
        </div>
      </div>
    );
  }

  // ── Step 4: Personality ──
  if (step === 4) {
    return (
      <div className="onboarding-root">
        <div className="onboarding-card" style={{ maxWidth: 540 }}>
          <h2 className="onboarding-step-title">
            <MessageCircle size={20} /> How should the default agent behave?
          </h2>
          <p className="onboarding-step-subtitle">Pick a style. You can change this any time from Settings.</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }}>
            {PERSONALITIES.map((p) => {
              const active = personality === p.text;
              return (
                <button
                  key={p.id}
                  className={`onboarding-pill-card ${active ? 'selected' : ''}`}
                  onClick={() => setPersonality(active ? '' : p.text)}
                >
                  <div className="onboarding-pill-label">{p.label}</div>
                </button>
              );
            })}
          </div>

          <textarea
            className="onboarding-textarea"
            placeholder="Or write your own personality instructions (optional)..."
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            rows={4}
            style={{ marginTop: 16 }}
          />

          <div className="onboarding-nav">
            <button className="onboarding-btn-back" onClick={() => setStep(3)}>
              <ArrowLeft size={16} /> Back
            </button>
            <button className="onboarding-btn-primary" onClick={() => setStep(5)}>
              Continue <ArrowRight size={16} />
            </button>
          </div>
          {stepDots}
        </div>
      </div>
    );
  }

  // ── Step 5: Trust mode ──
  if (step === 5) {
    return (
      <div className="onboarding-root">
        <div className="onboarding-card" style={{ maxWidth: 540 }}>
          <h2 className="onboarding-step-title">
            <Shield size={20} /> Pick a trust level
          </h2>
          <p className="onboarding-step-subtitle">Choose how much the AI is allowed to do without asking.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            {TRUST_OPTIONS.map((t) => {
              const active = trustMode === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  className={`onboarding-trust-card ${active ? 'selected' : ''}`}
                  onClick={() => setTrustMode(t.id)}
                >
                  <Icon size={18} style={{ color: active ? 'var(--accent-primary)' : 'var(--text-tertiary)' }} />
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.desc}</div>
                  </div>
                  {active && <Check size={16} style={{ color: 'var(--accent-primary)' }} />}
                </button>
              );
            })}
          </div>

          <div className="onboarding-nav">
            <button className="onboarding-btn-back" onClick={() => setStep(4)}>
              <ArrowLeft size={16} /> Back
            </button>
            <button className="onboarding-btn-primary" onClick={() => setStep(6)}>
              Continue <ArrowRight size={16} />
            </button>
          </div>
          {stepDots}
        </div>
      </div>
    );
  }

  // ── Step 6: Optimization preference ──
  if (step === 6) {
    return (
      <div className="onboarding-root">
        <div className="onboarding-card" style={{ maxWidth: 540 }}>
          <h2 className="onboarding-step-title">
            <Zap size={20} /> Pick your optimization preference
          </h2>
          <p className="onboarding-step-subtitle">This sets default model selections and auto-router candidates. You can change it anytime in Settings.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            {[
              { id: 'best-quality', label: 'Best Quality', desc: 'Use the most capable model for every task. Higher cost, best results.' },
              { id: 'balanced', label: 'Balanced', desc: 'Good quality at reasonable cost. The default — works for most users.' },
              { id: 'low-cost', label: 'Low Cost', desc: 'Prefer cheap, fast models for routine work. Escalate only when needed.' },
              { id: 'local-private', label: 'Local & Private', desc: 'Use local models when available. Most tasks stay on your machine.' },
            ].map((opt) => (
              <button
                key={opt.id}
                className={`onboarding-pill-card ${optimizationPref === opt.id ? 'selected' : ''}`}
                onClick={() => setOptimizationPref(opt.id)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: '12px 16px' }}
              >
                <div className="onboarding-pill-label" style={{ fontSize: 14 }}>{opt.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'left' }}>{opt.desc}</div>
              </button>
            ))}
          </div>

          <div className="onboarding-nav">
            <button className="onboarding-btn-back" onClick={() => setStep(5)}>
              <ArrowLeft size={16} /> Back
            </button>
            <button className="onboarding-btn-primary" onClick={() => setStep(7)}>
              Continue <ArrowRight size={16} />
            </button>
          </div>
          {stepDots}
        </div>
      </div>
    );
  }

  // ── Step 7: Project folder ──
  if (step === 7) {
    return (
      <div className="onboarding-root">
        <div className="onboarding-card" style={{ maxWidth: 480 }}>
          <h2 className="onboarding-step-title">
            <FolderOpen size={20} /> Open a project folder
          </h2>
          <p className="onboarding-step-subtitle">Give the AI context about your code. You can skip this and start from scratch.</p>

          <div style={{ marginTop: 16 }}>
            {folderPath ? (
              <div className="onboarding-folder-selected">
                <FolderOpen size={20} style={{ color: 'var(--accent-primary)' }} />
                <span className="onboarding-folder-path">{folderPath}</span>
                <button className="onboarding-btn-text" onClick={() => setFolderPath(null)}>Change</button>
              </div>
            ) : (
              <button className="onboarding-folder-btn" onClick={handleOpenFolder}>
                <FolderOpen size={20} />
                Choose folder...
              </button>
            )}
          </div>

          <div className="onboarding-divider">
            <span>or start from scratch</span>
          </div>

          <div className="onboarding-nav">
            <button className="onboarding-btn-back" onClick={() => setStep(6)}>
              <ArrowLeft size={16} /> Back
            </button>
            <button className="onboarding-btn-primary" onClick={() => setStep(8)}>
              {folderPath ? 'Open project' : "Let's go"} <ArrowRight size={16} />
            </button>
          </div>
          {stepDots}
        </div>
      </div>
    );
  }

  // ── Step 8: Final review ──
  if (step === 8) {
    return (
      <div className="onboarding-root">
        <div className="onboarding-card" style={{ maxWidth: 540 }}>
          <h2 className="onboarding-step-title">
            <CheckCircle2 size={20} /> Ready to go
          </h2>
          <p className="onboarding-step-subtitle">Here's what we're about to save.</p>

          <div className="onboarding-review">
            <div className="onboarding-review-section">
              <div className="onboarding-review-label">Providers ({selectedProviders.size})</div>
              <div className="onboarding-review-list">
                {[...selectedProviders].map((id) => {
                  const p = allProviders.find((x) => x.id === id);
                  if (!p) return null;
                  const tested = testResults[id];
                  return (
                    <div key={id} className="onboarding-review-row">
                      <div className="onboarding-provider-dot" style={{ background: p.color }} />
                      <span style={{ flex: 1 }}>{p.name}</span>
                      {p.isLocal ? (
                        <span className="onboarding-badge-free">LOCAL</span>
                      ) : tested ? (
                        <span className={tested.ok ? 'onboarding-badge-ok' : 'onboarding-badge-warn'}>
                          {tested.ok ? `OK${tested.models ? ` (${tested.models})` : ''}` : 'DRAFT'}
                        </span>
                      ) : (
                        <span className="onboarding-badge-warn">DRAFT</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="onboarding-review-section">
              <div className="onboarding-review-label">Personality</div>
              <div className="onboarding-review-value">
                {PERSONALITIES.find((p) => p.text === personality)?.label || (personality ? 'Custom' : 'Default')}
              </div>
            </div>

            <div className="onboarding-review-section">
              <div className="onboarding-review-label">Trust mode</div>
              <div className="onboarding-review-value">
                {TRUST_OPTIONS.find((t) => t.id === trustMode)?.label || trustMode}
              </div>
            </div>

            <div className="onboarding-review-section">
              <div className="onboarding-review-label">Theme</div>
              <div className="onboarding-review-value">
                {THEME_CHOICES.find((theme) => theme.id === activeTheme)?.label || activeTheme}
              </div>
            </div>

            <div className="onboarding-review-section">
              <div className="onboarding-review-label">Project</div>
              <div className="onboarding-review-value">
                {folderPath || 'Start from scratch'}
              </div>
            </div>

            {dockerReadiness && (
              <div className="onboarding-review-section">
                <div className="onboarding-review-label">Docker MCP</div>
                <div className="onboarding-review-value">
                  {dockerReadiness.dockerMcpAvailable
                    ? `Ready (${dockerReadiness.mcpVersion || 'installed'})`
                    : dockerReadiness.dockerInstalled
                      ? 'Installed — MCP Toolkit not active'
                      : 'Not installed — you can add it later'}
                </div>
              </div>
            )}
          </div>

          <div className="onboarding-nav">
            <button className="onboarding-btn-back" onClick={() => setStep(7)}>
              <ArrowLeft size={16} /> Back
            </button>
            <button className="onboarding-btn-primary" onClick={handleFinish} disabled={saving}>
              {saving ? <><Loader size={16} className="spin" /> Saving...</> : <>Finish setup <Check size={16} /></>}
            </button>
          </div>
          {stepDots}
        </div>
      </div>
    );
  }

  return null;
}
