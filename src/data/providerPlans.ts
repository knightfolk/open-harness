export type ProviderAccessMode = 'api-key' | 'subscription';

export interface ProviderPlanOption {
  id: string;
  label: string;
  accessMode: ProviderAccessMode;
  description: string;
}

export interface ProviderPlanCatalogEntry {
  providerId: string;
  label: string;
  sourceLabel: string;
  sourceUrl: string;
  plans: ProviderPlanOption[];
}

const STANDARD_API_PLANS: ProviderPlanOption[] = [
  {
    id: 'pay-as-you-go',
    label: 'Pay as you go',
    accessMode: 'api-key',
    description: 'Usage-based API billing; per-token model prices apply.',
  },
  {
    id: 'enterprise',
    label: 'Enterprise / committed use',
    accessMode: 'api-key',
    description: 'Custom contract, committed spend, reserved capacity, or higher limits.',
  },
];

export const PROVIDER_PLAN_CATALOG: ProviderPlanCatalogEntry[] = [
  {
    providerId: 'openai',
    label: 'OpenAI',
    sourceLabel: 'OpenAI API pricing and rate-limit usage tiers',
    sourceUrl: 'https://openai.com/api/pricing/',
    plans: [
      { id: 'usage-tier-1', label: 'API usage tier 1', accessMode: 'api-key', description: 'Entry API tier; rate limits depend on account trust and payment history.' },
      { id: 'usage-tier-2', label: 'API usage tier 2', accessMode: 'api-key', description: 'Higher monthly spend/rate-limit tier after successful billing history.' },
      { id: 'usage-tier-3', label: 'API usage tier 3', accessMode: 'api-key', description: 'Higher API limit tier for sustained paid usage.' },
      { id: 'usage-tier-4-plus', label: 'API tier 4+', accessMode: 'api-key', description: 'High-volume API usage tier; check the OpenAI dashboard for exact limits.' },
      { id: 'priority', label: 'Priority processing', accessMode: 'api-key', description: 'Usage-based API with reliable high-speed processing where available.' },
      { id: 'scale-enterprise', label: 'Scale / Enterprise', accessMode: 'api-key', description: 'Reserved capacity, data residency, SLA, or custom enterprise terms.' },
    ],
  },
  {
    providerId: 'anthropic',
    label: 'Anthropic',
    sourceLabel: 'Anthropic API usage tiers',
    sourceUrl: 'https://support.anthropic.com/en/articles/8243635-our-approach-to-api-rate-limits',
    plans: [
      { id: 'tier-1', label: 'API tier 1', accessMode: 'api-key', description: 'Organization-level API usage tier with entry rate limits.' },
      { id: 'tier-2', label: 'API tier 2', accessMode: 'api-key', description: 'Higher spend and rate limits; advanced automatically by usage thresholds.' },
      { id: 'tier-3', label: 'API tier 3', accessMode: 'api-key', description: 'Higher-volume API tier; exact limits are shown in Anthropic Console.' },
      { id: 'tier-4', label: 'API tier 4', accessMode: 'api-key', description: 'Top documented automatic API tier; check Console for RPM/ITPM/OTPM.' },
      { id: 'enterprise', label: 'Enterprise', accessMode: 'api-key', description: 'Custom commercial terms, controls, and support.' },
    ],
  },
  {
    providerId: 'google',
    label: 'Google Gemini',
    sourceLabel: 'Gemini API pricing',
    sourceUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    plans: [
      { id: 'free', label: 'Free API tier', accessMode: 'api-key', description: 'Lower rate limits and free quota for testing in Google AI Studio.' },
      { id: 'paid', label: 'Paid API tier', accessMode: 'api-key', description: 'Billing-enabled Gemini API with higher limits and paid model/tool access.' },
      { id: 'enterprise', label: 'Google Cloud / Vertex enterprise', accessMode: 'api-key', description: 'Cloud billing, enterprise controls, and negotiated terms.' },
    ],
  },
  {
    providerId: 'minimax',
    label: 'MiniMax',
    sourceLabel: 'MiniMax Token Plan and M3 model page',
    sourceUrl: 'https://platform.minimax.io/docs/guides/pricing-token-plan',
    plans: [
      { id: 'api-payg', label: 'API pay as you go', accessMode: 'api-key', description: 'Direct MiniMax API key; per-model token pricing applies.' },
      { id: 'token-plan-standard', label: 'Token Plan Standard', accessMode: 'subscription', description: 'Subscription token plan; useful when costs should be treated as quota-backed.' },
      { id: 'token-plan-pro', label: 'Token Plan Pro', accessMode: 'subscription', description: 'Higher MiniMax token-plan quota for M3/M2 family usage.' },
      { id: 'token-plan-team', label: 'Token Plan Team', accessMode: 'subscription', description: 'Team subscription token plan with larger shared quotas.' },
    ],
  },
  {
    providerId: 'mistral',
    label: 'Mistral',
    sourceLabel: 'Mistral pricing',
    sourceUrl: 'https://mistral.ai/pricing/',
    plans: [
      { id: 'api-payg', label: 'La Plateforme API', accessMode: 'api-key', description: 'Per-million-token API billing for hosted Mistral models and tools.' },
      { id: 'free', label: 'Free subscription', accessMode: 'subscription', description: 'Limited Mistral app/Vibe access; not equivalent to token-billed API use.' },
      { id: 'pro', label: 'Pro subscription', accessMode: 'subscription', description: 'More access for Vibe/chat/code workflows under fair-use limits.' },
      { id: 'team', label: 'Team subscription', accessMode: 'subscription', description: 'Collaborative workspace plan with larger per-user resources.' },
      { id: 'enterprise', label: 'Enterprise', accessMode: 'subscription', description: 'Custom enterprise plan, deployment, SSO, and support.' },
    ],
  },
  {
    providerId: 'openrouter',
    label: 'OpenRouter',
    sourceLabel: 'OpenRouter pricing',
    sourceUrl: 'https://openrouter.ai/pricing',
    plans: [
      { id: 'credits', label: 'Credits / pay as you go', accessMode: 'api-key', description: 'OpenRouter credits with provider/model pass-through pricing.' },
      { id: 'byok', label: 'BYOK', accessMode: 'api-key', description: 'Bring your own provider keys; free monthly request allowance then platform fee.' },
      { id: 'enterprise', label: 'Enterprise', accessMode: 'api-key', description: 'Custom volume, annual commit, prepayment credits, and invoicing.' },
    ],
  },
  {
    providerId: 'deepseek',
    label: 'DeepSeek',
    sourceLabel: 'DeepSeek model pricing',
    sourceUrl: 'https://api-docs.deepseek.com/quick_start/pricing',
    plans: STANDARD_API_PLANS,
  },
  {
    providerId: 'zhipu',
    label: 'Z.AI / Zhipu',
    sourceLabel: 'Z.AI pricing',
    sourceUrl: 'https://docs.z.ai/guides/overview/pricing',
    plans: [
      { id: 'api-payg', label: 'API pay as you go', accessMode: 'api-key', description: 'Usage-based GLM API pricing; some Flash models may be free.' },
      { id: 'coding-plan-pro', label: 'Coding Plan Pro', accessMode: 'subscription', description: 'Subscription coding-plan access where available; quotas and model access vary.' },
      { id: 'coding-plan-max', label: 'Coding Plan Max', accessMode: 'subscription', description: 'Higher coding-plan level where available; validate model access before routing.' },
    ],
  },
  {
    providerId: 'moonshot',
    label: 'Moonshot / Kimi',
    sourceLabel: 'Kimi API billing and pricing',
    sourceUrl: 'https://www.kimi.com/help/kimi-api/api-billing-and-finance',
    plans: [
      { id: 'api-payg', label: 'API pay as you go', accessMode: 'api-key', description: 'Moonshot/Kimi API key with usage-based model pricing.' },
      { id: 'subscription', label: 'Kimi subscription', accessMode: 'subscription', description: 'Consumer/subscription access; verify whether your tool endpoint honors it.' },
      { id: 'enterprise', label: 'Enterprise', accessMode: 'api-key', description: 'Custom API terms or enterprise support.' },
    ],
  },
  {
    providerId: 'alibaba',
    label: 'Alibaba Qwen / DashScope',
    sourceLabel: 'DashScope pricing',
    sourceUrl: 'https://help.aliyun.com/zh/model-studio/billing-for-model-studio',
    plans: [
      { id: 'api-payg', label: 'DashScope API pay as you go', accessMode: 'api-key', description: 'Alibaba Cloud/DashScope API key with usage-based Qwen pricing.' },
      { id: 'free-quota', label: 'Free quota / trial', accessMode: 'api-key', description: 'Trial or free quota where available on the Alibaba Cloud account.' },
      { id: 'enterprise', label: 'Enterprise', accessMode: 'api-key', description: 'Committed enterprise billing through Alibaba Cloud.' },
    ],
  },
  {
    providerId: 'xai',
    label: 'xAI',
    sourceLabel: 'xAI API pricing',
    sourceUrl: 'https://docs.x.ai/docs/models',
    plans: STANDARD_API_PLANS,
  },
];

export function providerPlanCatalogFor(providerId?: string, providerName?: string): ProviderPlanCatalogEntry | undefined {
  const id = (providerId || '').toLowerCase();
  const name = (providerName || '').toLowerCase();
  return PROVIDER_PLAN_CATALOG.find((entry) =>
    id === entry.providerId ||
    id.includes(entry.providerId) ||
    name.includes(entry.label.toLowerCase().split(' ')[0])
  );
}

export function defaultProviderPlan(providerId?: string, providerName?: string): ProviderPlanOption {
  return providerPlanCatalogFor(providerId, providerName)?.plans[0] || STANDARD_API_PLANS[0];
}

export function providerPlanLabel(providerId?: string, planId?: string, providerName?: string): string {
  const catalog = providerPlanCatalogFor(providerId, providerName);
  return catalog?.plans.find((plan) => plan.id === planId)?.label || planId || defaultProviderPlan(providerId, providerName).label;
}
