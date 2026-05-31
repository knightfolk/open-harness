import { useState, useEffect } from 'react';
import {
  Zap, Brain, FolderOpen, ArrowRight, ArrowLeft, Check,
  Wifi, WifiOff, Loader, Sparkles, Rocket, ChevronDown,
} from 'lucide-react';
import * as api from '../utils/api';

// ── Provider presets for quick connect ──
interface OnboardingProvider {
  id: string;
  name: string;
  color: string;
  desc: string;
  baseURL: string;
  placeholder: string;
  isLocal?: boolean;
}

const QUICK_PROVIDERS: OnboardingProvider[] = [
  { id: 'openai', name: 'OpenAI', color: '#10a37f', desc: 'GPT-4.1, o3, o4-mini', baseURL: 'https://api.openai.com/v1', placeholder: 'sk-...' },
  { id: 'minimax', name: 'MiniMax', color: '#6366f1', desc: 'M2.7 — fast & affordable', baseURL: 'https://api.minimax.io/v1', placeholder: 'sk-cp-...' },
  { id: 'deepseek', name: 'DeepSeek', color: '#4a9eff', desc: 'V4, V4 Flash, R2', baseURL: 'https://api.deepseek.com/v1', placeholder: 'sk-...' },
  { id: 'ollama', name: 'Ollama', color: '#6b7280', desc: 'Free local models', baseURL: 'http://localhost:11434/v1', placeholder: '(no key needed)', isLocal: true },
];

const EXTENDED_PROVIDERS: OnboardingProvider[] = [
  { id: 'xai', name: 'xAI', color: '#1d9bf0', desc: 'Grok models via OpenAI-compatible API', baseURL: 'https://api.x.ai/v1', placeholder: 'xai-...' },
  { id: 'mistral', name: 'Mistral', color: '#f54e42', desc: 'Mistral Large, Codestral', baseURL: 'https://api.mistral.ai/v1', placeholder: '...' },
  { id: 'zhipu', name: 'Z.AI / Zhipu', color: '#3b5998', desc: 'GLM coding models', baseURL: 'https://api.z.ai/api/coding/paas/v4', placeholder: '...' },
  { id: 'openrouter', name: 'OpenRouter', color: '#6d28d9', desc: 'Gateway to many OpenAI-compatible models', baseURL: 'https://openrouter.ai/api/v1', placeholder: 'sk-or-...' },
  { id: 'qwen', name: 'Alibaba Qwen', color: '#ff6a00', desc: 'Qwen models via DashScope compatible mode', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', placeholder: 'sk-...' },
  { id: 'lmstudio', name: 'LM Studio', color: '#6b7280', desc: 'Free local models', baseURL: 'http://localhost:1234/v1', placeholder: '(no key needed)', isLocal: true },
];

interface Props {
  onComplete: (provider?: { name: string; type: string; apiKey: string; baseURL: string }) => void;
  onSkip: () => void;
}

export function OnboardingWizard({ onComplete, onSkip }: Props) {
  const [step, setStep] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [ollamaDetected, setOllamaDetected] = useState(false);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  // Detect Ollama on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
        if (res.ok) setOllamaDetected(true);
      } catch { /* not running */ }
    })();
  }, []);

  const provider = [...QUICK_PROVIDERS, ...EXTENDED_PROVIDERS].find(p => p.id === selectedProvider);

  const handleTestAndConnect = async () => {
    if (!provider) return;
    setTesting(true);
    setTestResult(null);

    try {
      // Add the provider
      const result = await api.addProvider({
        name: provider.name,
        type: provider.isLocal ? 'local' : 'openai-compatible',
        apiKey: provider.isLocal ? '' : apiKey,
        baseURL: provider.baseURL,
      });

      // Fetch models
      try {
        await api.fetchProviderModels(result.id, provider.isLocal ? undefined : apiKey);
      } catch { /* models fetch is optional */ }

      setTestResult({ ok: true, msg: `${provider.name} connected!` });

      // Get available models
      const models = await api.getModels();
      if (models.length > 0) {
        await api.updateConfig({ activeModel: models[0].id });
      }

      setTimeout(() => onComplete(result), 800);
    } catch (err: any) {
      setTestResult({ ok: false, msg: err.message || 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleOpenFolder = async () => {
    try {
      const path = await api.openFolderDialog();
      if (path) setFolderPath(path);
    } catch { /* dialog cancelled */ }
  };

  const handleFinish = () => {
    if (folderPath) {
      // Will be handled by parent
    }
    onComplete();
  };

  // ── Step 0: Welcome ──
  if (step === 0) {
    return (
      <div className="onboarding-root">
        <div className="onboarding-card" style={{ maxWidth: 480 }}>
          <div className="onboarding-icon-large">
            <Rocket size={32} />
          </div>
          <h1 className="onboarding-title">Welcome to CMDui</h1>
          <p className="onboarding-subtitle">
            Your open AI coding harness. Connect any model, code anything.
          </p>

          <div className="onboarding-features">
            <div className="onboarding-feature">
              <Zap size={16} style={{ color: 'var(--accent-primary)' }} />
              <span>Works with <strong>any AI model</strong> — OpenAI, Anthropic, local, free</span>
            </div>
            <div className="onboarding-feature">
              <Brain size={16} style={{ color: 'var(--accent-primary)' }} />
              <span><strong>Smart tools</strong> — read files, run commands, search code</span>
            </div>
            <div className="onboarding-feature">
              <FolderOpen size={16} style={{ color: 'var(--accent-primary)' }} />
              <span><strong>Your code, your keys</strong> — nothing leaves your machine</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
            <button className="onboarding-btn-primary" onClick={() => setStep(1)}>
              Get started <ArrowRight size={16} />
            </button>
            <button className="onboarding-btn-secondary" onClick={onSkip}>
              Skip setup
            </button>
          </div>

          <div className="onboarding-step-dots">
            <div className="onboarding-dot active" />
            <div className="onboarding-dot" />
            <div className="onboarding-dot" />
          </div>
        </div>
      </div>
    );
  }

  // ── Step 1: Connect AI ──
  if (step === 1) {
    return (
      <div className="onboarding-root">
        <div className="onboarding-card" style={{ maxWidth: 560 }}>
          <h2 className="onboarding-step-title">
            <Wifi size={20} /> Connect your first AI
          </h2>
          <p className="onboarding-step-subtitle">Pick a provider and enter your API key. You can add more later.</p>

          {ollamaDetected && (
            <div className="onboarding-tip">
              <Sparkles size={14} />
              <span><strong>Ollama detected!</strong> Free local models are available — select Ollama below to use them instantly.</span>
            </div>
          )}

          <div className="onboarding-providers">
            {QUICK_PROVIDERS.map(p => (
              <button
                key={p.id}
                className={`onboarding-provider-card ${selectedProvider === p.id ? 'selected' : ''}`}
                onClick={() => { setSelectedProvider(p.id); setApiKey(''); setTestResult(null); }}
              >
                <div className="onboarding-provider-dot" style={{ background: p.color }} />
                <div className="onboarding-provider-info">
                  <div className="onboarding-provider-name">
                    {p.name}
                    {p.id === 'ollama' && ollamaDetected && (
                      <span className="onboarding-badge-free">FREE · LOCAL</span>
                    )}
                  </div>
                  <div className="onboarding-provider-desc">{p.desc}</div>
                </div>
                {selectedProvider === p.id && <Check size={18} style={{ color: 'var(--accent-primary)' }} />}
              </button>
            ))}
          </div>

          {/* Extended providers */}
          {showMore && (
            <div className="onboarding-providers">
              {EXTENDED_PROVIDERS.map(p => (
                <button
                  key={p.id}
                  className={`onboarding-provider-card ${selectedProvider === p.id ? 'selected' : ''}`}
                  onClick={() => { setSelectedProvider(p.id); setApiKey(''); setTestResult(null); }}
                >
                  <div className="onboarding-provider-dot" style={{ background: p.color }} />
                  <div className="onboarding-provider-info">
                    <div className="onboarding-provider-name">
                      {p.name}
                      {p.isLocal && <span className="onboarding-badge-free">FREE · LOCAL</span>}
                    </div>
                    <div className="onboarding-provider-desc">{p.desc}</div>
                  </div>
                  {selectedProvider === p.id && <Check size={18} style={{ color: 'var(--accent-primary)' }} />}
                </button>
              ))}
            </div>
          )}

          {!showMore && (
            <button className="onboarding-show-more" onClick={() => setShowMore(true)}>
              <ChevronDown size={14} /> Show {EXTENDED_PROVIDERS.length} more providers (Z.AI, Qwen, Grok, Mistral...)
            </button>
          )}

          {/* API Key input */}
          {provider && !provider.isLocal && (
            <div className="onboarding-key-section">
              <label className="onboarding-label">API Key</label>
              <input
                className="onboarding-input"
                type="password"
                placeholder={provider.placeholder}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && apiKey.trim()) handleTestAndConnect(); }}
              />
            </div>
          )}

          {/* Test result */}
          {testResult && (
            <div className={`onboarding-result ${testResult.ok ? 'success' : 'error'}`}>
              {testResult.ok ? <Check size={16} /> : <WifiOff size={16} />}
              {testResult.msg}
            </div>
          )}

          <div className="onboarding-nav">
            <button className="onboarding-btn-back" onClick={() => setStep(0)}>
              <ArrowLeft size={16} /> Back
            </button>
            <button
              className="onboarding-btn-primary"
              disabled={!provider || (testing || (!provider.isLocal && !apiKey.trim()))}
              onClick={handleTestAndConnect}
            >
              {testing ? <><Loader size={16} className="spin" /> Testing...</> : <>Connect <ArrowRight size={16} /></>}
            </button>
          </div>

          <div className="onboarding-step-dots">
            <div className="onboarding-dot" />
            <div className="onboarding-dot active" />
            <div className="onboarding-dot" />
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Open Project ──
  if (step === 2) {
    return (
      <div className="onboarding-root">
        <div className="onboarding-card" style={{ maxWidth: 480 }}>
          <h2 className="onboarding-step-title">
            <FolderOpen size={20} /> Open a project
          </h2>
          <p className="onboarding-step-subtitle">
            Open a folder to give the AI context about your code. You can skip this and start fresh.
          </p>

          <div className="onboarding-folder-section">
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

          <div className="onboarding-quickstart">
            <button className="onboarding-quickstart-btn" onClick={() => handleFinish()}>
              <span>✨</span> Start with a blank project
            </button>
          </div>

          <div className="onboarding-nav">
            <button className="onboarding-btn-back" onClick={() => setStep(1)}>
              <ArrowLeft size={16} /> Back
            </button>
            <button className="onboarding-btn-primary" onClick={handleFinish}>
              {folderPath ? 'Open project' : "Let's go"} <ArrowRight size={16} />
            </button>
          </div>

          <div className="onboarding-step-dots">
            <div className="onboarding-dot" />
            <div className="onboarding-dot" />
            <div className="onboarding-dot active" />
          </div>
        </div>
      </div>
    );
  }

  return null;
}
