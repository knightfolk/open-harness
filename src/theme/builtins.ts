import type { ThemeInputValue, ThemeMode, ThemeTokens } from './themeTokens';
import {
  checkContrastPairs,
  type ThemeContrastCheck,
  type ThemeQuality,
} from './themeTokens';

export const FALLBACK_THEME_ID = 'midnight';
const DEFAULT_EFFECTS = {
  material: 'solid' as const,
  backdropBlur: 0,
  surfaceOpacity: 1,
  borderStyle: 'flat' as const,
  borderContrast: 1,
  glowOpacity: 0,
  grainOpacity: 0,
  scanlineOpacity: 0,
  gridOpacity: 0,
};

export interface BuiltinTheme {
  id: string;
  label: string;
  group: 'dark' | 'light';
  mode: ThemeMode;
  family: string;
  color: string;
  tokens: ThemeTokens;
  tags: string[];
  quality: ThemeQuality;
}

export type ThemeRegistry = ReadonlyArray<BuiltinTheme>;

const BUILTIN_THEME_REGISTRY: ThemeRegistry = [
  {
    id: 'midnight',
    label: 'Midnight',
    family: 'Midnight',
    group: 'dark',
    mode: 'dark',
    color: '#6366f1',
    tags: ['builtin'],
    quality: {
      contrastPairs: [
        { foreground: '#e8eaed', background: '#0d0f11', minimumRatio: 4.5 },
        { foreground: '#9aa0a8', background: '#141619', minimumRatio: 3 },
        { foreground: '#6366f1', background: '#0d0f11', minimumRatio: 3 },
      ],
      reducedMotionSafe: true,
    },
    tokens: {
      color: {
        accentPrimary: '#6366f1',
        accentPrimaryHover: '#818cf8',
        accentPrimaryMuted: 'rgba(99, 102, 241, 0.15)',
        accentSuccess: '#22c55e',
        accentSuccessMuted: 'rgba(34, 197, 94, 0.15)',
        accentWarning: '#f59e0b',
        accentWarningMuted: 'rgba(245, 158, 11, 0.15)',
        accentError: '#ef4444',
        accentErrorMuted: 'rgba(239, 68, 68, 0.15)',
        accentInfo: '#3b82f6',
        accentInfoMuted: 'rgba(59, 130, 246, 0.15)',
        focusRing: '#6366f1',
        selectionBackground: 'rgba(99, 102, 241, 0.16)',
      },
      surface: {
        primary: '#0d0f11',
        secondary: '#141619',
        tertiary: '#1a1d22',
        elevated: '#1e2128',
        hover: '#252830',
        active: '#2a2d36',
      },
      text: {
        primary: '#e8eaed',
        secondary: '#9aa0a8',
        tertiary: '#6b7280',
        inverse: '#0d0f11',
        link: '#818cf8',
      },
      border: {
        primary: '#2a2d36',
        secondary: '#1e2128',
        accent: '#3d4150',
        focus: '#6366f1',
      },
      intent: {
        success: '#22c55e',
        successMuted: 'rgba(34, 197, 94, 0.15)',
        warning: '#f59e0b',
        warningMuted: 'rgba(245, 158, 11, 0.15)',
        error: '#ef4444',
        errorMuted: 'rgba(239, 68, 68, 0.15)',
        info: '#3b82f6',
        infoMuted: 'rgba(59, 130, 246, 0.15)',
      },
      chat: {
        userBubble: '#6366f1',
        userBubbleText: '#ffffff',
        assistantBubble: '#1e2128',
        assistantBubbleText: '#e8eaed',
      },
      code: {
        background: '#0d0f11',
        border: '#2a2d36',
        foreground: '#e8eaed',
        keyword: '#818cf8',
        string: '#34d399',
        comment: '#6366f1',
        diffAdded: '#22c55e',
        diffRemoved: '#ef4444',
      },
      shadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
        md: '0 4px 12px rgba(0, 0, 0, 0.4)',
        lg: '0 8px 24px rgba(0, 0, 0, 0.5)',
      },
      effects: {
        ...DEFAULT_EFFECTS,
        reducedTransparencyFallback: {
          surfaceColor: '#1e2128',
          borderColor: '#2a2d36',
          shadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
        },
      },
    },
  },
  {
    id: 'charcoal',
    label: 'Charcoal',
    family: 'Charcoal',
    group: 'dark',
    mode: 'dark',
    color: '#a1a1aa',
    tags: ['builtin'],
    quality: {
      contrastPairs: [
        { foreground: '#e4e4e7', background: '#111113', minimumRatio: 4.5 },
        { foreground: '#a1a1aa', background: '#111113', minimumRatio: 3 },
        { foreground: '#3f3f46', background: '#27272a', minimumRatio: 3 },
      ],
      reducedMotionSafe: true,
    },
    tokens: {
      color: {
        accentPrimary: '#a1a1aa',
        accentPrimaryHover: '#d4d4d8',
        accentPrimaryMuted: 'rgba(161, 161, 170, 0.15)',
        accentSuccess: '#22c55e',
        accentSuccessMuted: 'rgba(34, 197, 94, 0.15)',
        accentWarning: '#f59e0b',
        accentWarningMuted: 'rgba(245, 158, 11, 0.15)',
        accentError: '#ef4444',
        accentErrorMuted: 'rgba(239, 68, 68, 0.15)',
        accentInfo: '#60a5fa',
        accentInfoMuted: 'rgba(96, 165, 250, 0.15)',
        focusRing: '#a1a1aa',
        selectionBackground: 'rgba(161, 161, 170, 0.16)',
      },
      surface: {
        primary: '#111113',
        secondary: '#18181b',
        tertiary: '#1f1f23',
        elevated: '#27272a',
        hover: '#2e2e32',
        active: '#35353a',
      },
      text: {
        primary: '#e4e4e7',
        secondary: '#a1a1aa',
        tertiary: '#71717a',
        inverse: '#111113',
        link: '#d4d4d8',
      },
      border: {
        primary: '#2e2e32',
        secondary: '#1f1f23',
        accent: '#42424a',
        focus: '#a1a1aa',
      },
      intent: {
        success: '#22c55e',
        successMuted: 'rgba(34, 197, 94, 0.15)',
        warning: '#f59e0b',
        warningMuted: 'rgba(245, 158, 11, 0.15)',
        error: '#ef4444',
        errorMuted: 'rgba(239, 68, 68, 0.15)',
        info: '#60a5fa',
        infoMuted: 'rgba(96, 165, 250, 0.15)',
      },
      chat: {
        userBubble: '#3f3f46',
        userBubbleText: '#ffffff',
        assistantBubble: '#27272a',
        assistantBubbleText: '#e4e4e7',
      },
      code: {
        background: '#09090b',
        border: '#27272a',
        foreground: '#e4e4e7',
        keyword: '#d4d4d8',
        string: '#86efac',
        comment: '#a1a1aa',
        diffAdded: '#22c55e',
        diffRemoved: '#ef4444',
      },
      shadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.35)',
        md: '0 4px 12px rgba(0, 0, 0, 0.45)',
        lg: '0 8px 24px rgba(0, 0, 0, 0.55)',
      },
      effects: {
        ...DEFAULT_EFFECTS,
        reducedTransparencyFallback: {
          surfaceColor: '#27272a',
          borderColor: '#2e2e32',
          shadow: '0 1px 2px rgba(0, 0, 0, 0.35)',
        },
      },
    },
  },
  {
    id: 'forest',
    label: 'Forest',
    family: 'Forest',
    group: 'dark',
    mode: 'dark',
    color: '#10b981',
    tags: ['builtin'],
    quality: {
      contrastPairs: [
        { foreground: '#dceee4', background: '#0a110e', minimumRatio: 4.5 },
        { foreground: '#8db9a0', background: '#0f1a14', minimumRatio: 3 },
        { foreground: '#10b981', background: '#0a110e', minimumRatio: 4 },
      ],
      reducedMotionSafe: true,
    },
    tokens: {
      color: {
        accentPrimary: '#10b981',
        accentPrimaryHover: '#34d399',
        accentPrimaryMuted: 'rgba(16, 185, 129, 0.15)',
        accentSuccess: '#22c55e',
        accentSuccessMuted: 'rgba(34, 197, 94, 0.15)',
        accentWarning: '#f59e0b',
        accentWarningMuted: 'rgba(245, 158, 11, 0.15)',
        accentError: '#ef4444',
        accentErrorMuted: 'rgba(239, 68, 68, 0.15)',
        accentInfo: '#3b82f6',
        accentInfoMuted: 'rgba(59, 130, 246, 0.15)',
        focusRing: '#10b981',
        selectionBackground: 'rgba(16, 185, 129, 0.16)',
      },
      surface: {
        primary: '#0a110e',
        secondary: '#0f1a14',
        tertiary: '#14231b',
        elevated: '#1a2b22',
        hover: '#213628',
        active: '#284030',
      },
      text: {
        primary: '#dceee4',
        secondary: '#8db9a0',
        tertiary: '#5f8a70',
        inverse: '#0a110e',
        link: '#34d399',
      },
      border: {
        primary: '#1e3028',
        secondary: '#14231b',
        accent: '#2f4d3a',
        focus: '#10b981',
      },
      intent: {
        success: '#22c55e',
        successMuted: 'rgba(34, 197, 94, 0.15)',
        warning: '#f59e0b',
        warningMuted: 'rgba(245, 158, 11, 0.15)',
        error: '#ef4444',
        errorMuted: 'rgba(239, 68, 68, 0.15)',
        info: '#3b82f6',
        infoMuted: 'rgba(59, 130, 246, 0.15)',
      },
      chat: {
        userBubble: '#10b981',
        userBubbleText: '#ffffff',
        assistantBubble: '#1a2b22',
        assistantBubbleText: '#dceee4',
      },
      code: {
        background: '#0a110e',
        border: '#1e3028',
        foreground: '#dceee4',
        keyword: '#34d399',
        string: '#6ee7b7',
        comment: '#8db9a0',
        diffAdded: '#22c55e',
        diffRemoved: '#ef4444',
      },
      shadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.35)',
        md: '0 4px 12px rgba(0, 0, 0, 0.45)',
        lg: '0 8px 24px rgba(0, 0, 0, 0.55)',
      },
      effects: {
        ...DEFAULT_EFFECTS,
        reducedTransparencyFallback: {
          surfaceColor: '#1a2b22',
          borderColor: '#1e3028',
          shadow: '0 1px 2px rgba(0, 0, 0, 0.35)',
        },
      },
    },
  },
  {
    id: 'crimson',
    label: 'Crimson',
    family: 'Crimson',
    group: 'dark',
    mode: 'dark',
    color: '#f43f5e',
    tags: ['builtin'],
    quality: {
      contrastPairs: [
        { foreground: '#eedde1', background: '#110a0c', minimumRatio: 4.5 },
        { foreground: '#b98a94', background: '#1a0f12', minimumRatio: 3 },
        { foreground: '#f43f5e', background: '#110a0c', minimumRatio: 4 },
      ],
      reducedMotionSafe: true,
    },
    tokens: {
      color: {
        accentPrimary: '#f43f5e',
        accentPrimaryHover: '#fb7185',
        accentPrimaryMuted: 'rgba(244, 63, 94, 0.15)',
        accentSuccess: '#22c55e',
        accentSuccessMuted: 'rgba(34, 197, 94, 0.15)',
        accentWarning: '#f59e0b',
        accentWarningMuted: 'rgba(245, 158, 11, 0.15)',
        accentError: '#ef4444',
        accentErrorMuted: 'rgba(239, 68, 68, 0.15)',
        accentInfo: '#3b82f6',
        accentInfoMuted: 'rgba(59, 130, 246, 0.15)',
        focusRing: '#f43f5e',
        selectionBackground: 'rgba(244, 63, 94, 0.16)',
      },
      surface: {
        primary: '#110a0c',
        secondary: '#1a0f12',
        tertiary: '#231519',
        elevated: '#2b1b1f',
        hover: '#362226',
        active: '#40292e',
      },
      text: {
        primary: '#eedde1',
        secondary: '#b98a94',
        tertiary: '#8a5f6a',
        inverse: '#110a0c',
        link: '#fb7185',
      },
      border: {
        primary: '#302024',
        secondary: '#231519',
        accent: '#4d3036',
        focus: '#f43f5e',
      },
      intent: {
        success: '#22c55e',
        successMuted: 'rgba(34, 197, 94, 0.15)',
        warning: '#f59e0b',
        warningMuted: 'rgba(245, 158, 11, 0.15)',
        error: '#ef4444',
        errorMuted: 'rgba(239, 68, 68, 0.15)',
        info: '#3b82f6',
        infoMuted: 'rgba(59, 130, 246, 0.15)',
      },
      chat: {
        userBubble: '#f43f5e',
        userBubbleText: '#ffffff',
        assistantBubble: '#2b1b1f',
        assistantBubbleText: '#eedde1',
      },
      code: {
        background: '#110a0c',
        border: '#302024',
        foreground: '#eedde1',
        keyword: '#fb7185',
        string: '#fda4af',
        comment: '#b98a94',
        diffAdded: '#22c55e',
        diffRemoved: '#ef4444',
      },
      shadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.35)',
        md: '0 4px 12px rgba(0, 0, 0, 0.45)',
        lg: '0 8px 24px rgba(0, 0, 0, 0.55)',
      },
      effects: {
        ...DEFAULT_EFFECTS,
        reducedTransparencyFallback: {
          surfaceColor: '#2b1b1f',
          borderColor: '#302024',
          shadow: '0 1px 2px rgba(0, 0, 0, 0.35)',
        },
      },
    },
  },
  {
    id: 'daylight',
    label: 'Daylight',
    family: 'Daylight',
    group: 'light',
    mode: 'light',
    color: '#6366f1',
    tags: ['builtin'],
    quality: {
      contrastPairs: [
        { foreground: '#1a1d22', background: '#f8f9fa', minimumRatio: 7 },
        { foreground: '#4a5568', background: '#f1f3f5', minimumRatio: 4.5 },
        { foreground: '#6366f1', background: '#f8f9fa', minimumRatio: 4 },
      ],
      reducedMotionSafe: true,
    },
    tokens: {
      color: {
        accentPrimary: '#6366f1',
        accentPrimaryHover: '#4f46e5',
        accentPrimaryMuted: 'rgba(99, 102, 241, 0.12)',
        accentSuccess: '#16a34a',
        accentSuccessMuted: 'rgba(22, 163, 74, 0.12)',
        accentWarning: '#d97706',
        accentWarningMuted: 'rgba(217, 119, 6, 0.12)',
        accentError: '#dc2626',
        accentErrorMuted: 'rgba(220, 38, 38, 0.12)',
        accentInfo: '#2563eb',
        accentInfoMuted: 'rgba(37, 99, 235, 0.12)',
        focusRing: '#6366f1',
        selectionBackground: 'rgba(99, 102, 241, 0.16)',
      },
      surface: {
        primary: '#f8f9fa',
        secondary: '#f1f3f5',
        tertiary: '#e9ecef',
        elevated: '#ffffff',
        hover: '#e4e7eb',
        active: '#dce0e5',
      },
      text: {
        primary: '#1a1d22',
        secondary: '#4a5568',
        tertiary: '#718096',
        inverse: '#f8f9fa',
        link: '#4f46e5',
      },
      border: {
        primary: '#d0d5dd',
        secondary: '#e4e7eb',
        accent: '#b0b8c4',
        focus: '#6366f1',
      },
      intent: {
        success: '#16a34a',
        successMuted: 'rgba(22, 163, 74, 0.12)',
        warning: '#d97706',
        warningMuted: 'rgba(217, 119, 6, 0.12)',
        error: '#dc2626',
        errorMuted: 'rgba(220, 38, 38, 0.12)',
        info: '#2563eb',
        infoMuted: 'rgba(37, 99, 235, 0.12)',
      },
      chat: {
        userBubble: '#6366f1',
        userBubbleText: '#ffffff',
        assistantBubble: '#e9ecef',
        assistantBubbleText: '#1a1d22',
      },
      code: {
        background: '#f1f3f5',
        border: '#d0d5dd',
        foreground: '#1a1d22',
        keyword: '#4f46e5',
        string: '#16a34a',
        comment: '#6b7280',
        diffAdded: '#16a34a',
        diffRemoved: '#dc2626',
      },
      shadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.06)',
        md: '0 4px 12px rgba(0, 0, 0, 0.08)',
        lg: '0 8px 24px rgba(0, 0, 0, 0.10)',
      },
      effects: {
        ...DEFAULT_EFFECTS,
        reducedTransparencyFallback: {
          surfaceColor: '#ffffff',
          borderColor: '#d0d5dd',
          shadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
        },
      },
    },
  },
  {
    id: 'silver',
    label: 'Silver',
    family: 'Silver',
    group: 'light',
    mode: 'light',
    color: '#3b82f6',
    tags: ['builtin'],
    quality: {
      contrastPairs: [
        { foreground: '#1e293b', background: '#f4f6f8', minimumRatio: 7 },
        { foreground: '#475569', background: '#edf0f4', minimumRatio: 4.5 },
        { foreground: '#3b82f6', background: '#f4f6f8', minimumRatio: 4 },
      ],
      reducedMotionSafe: true,
    },
    tokens: {
      color: {
        accentPrimary: '#3b82f6',
        accentPrimaryHover: '#2563eb',
        accentPrimaryMuted: 'rgba(59, 130, 246, 0.12)',
        accentSuccess: '#16a34a',
        accentSuccessMuted: 'rgba(22, 163, 74, 0.12)',
        accentWarning: '#d97706',
        accentWarningMuted: 'rgba(217, 119, 6, 0.12)',
        accentError: '#dc2626',
        accentErrorMuted: 'rgba(220, 38, 38, 0.12)',
        accentInfo: '#6366f1',
        accentInfoMuted: 'rgba(99, 102, 241, 0.12)',
        focusRing: '#3b82f6',
        selectionBackground: 'rgba(59, 130, 246, 0.16)',
      },
      surface: {
        primary: '#f4f6f8',
        secondary: '#edf0f4',
        tertiary: '#e3e8ee',
        elevated: '#ffffff',
        hover: '#dae1e9',
        active: '#d1d9e2',
      },
      text: {
        primary: '#1e293b',
        secondary: '#475569',
        tertiary: '#64748b',
        inverse: '#f4f6f8',
        link: '#2563eb',
      },
      border: {
        primary: '#c8d2dc',
        secondary: '#dce3eb',
        accent: '#a8b8c8',
        focus: '#3b82f6',
      },
      intent: {
        success: '#16a34a',
        successMuted: 'rgba(22, 163, 74, 0.12)',
        warning: '#d97706',
        warningMuted: 'rgba(217, 119, 6, 0.12)',
        error: '#dc2626',
        errorMuted: 'rgba(220, 38, 38, 0.12)',
        info: '#6366f1',
        infoMuted: 'rgba(99, 102, 241, 0.12)',
      },
      chat: {
        userBubble: '#3b82f6',
        userBubbleText: '#ffffff',
        assistantBubble: '#e3e8ee',
        assistantBubbleText: '#1e293b',
      },
      code: {
        background: '#edf0f4',
        border: '#c8d2dc',
        foreground: '#1e293b',
        keyword: '#2563eb',
        string: '#16a34a',
        comment: '#64748b',
        diffAdded: '#16a34a',
        diffRemoved: '#dc2626',
      },
      shadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.06)',
        md: '0 4px 12px rgba(0, 0, 0, 0.08)',
        lg: '0 8px 24px rgba(0, 0, 0, 0.10)',
      },
      effects: {
        ...DEFAULT_EFFECTS,
        reducedTransparencyFallback: {
          surfaceColor: '#ffffff',
          borderColor: '#c8d2dc',
          shadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
        },
      },
    },
  },
  {
    id: 'sage',
    label: 'Sage',
    family: 'Sage',
    group: 'light',
    mode: 'light',
    color: '#10b981',
    tags: ['builtin'],
    quality: {
      contrastPairs: [
        { foreground: '#1a2e23', background: '#f4f7f5', minimumRatio: 7 },
        { foreground: '#3d5e4a', background: '#edf2ef', minimumRatio: 4.5 },
        { foreground: '#10b981', background: '#f4f7f5', minimumRatio: 4 },
      ],
      reducedMotionSafe: true,
    },
    tokens: {
      color: {
        accentPrimary: '#10b981',
        accentPrimaryHover: '#059669',
        accentPrimaryMuted: 'rgba(16, 185, 129, 0.12)',
        accentSuccess: '#16a34a',
        accentSuccessMuted: 'rgba(22, 163, 74, 0.12)',
        accentWarning: '#d97706',
        accentWarningMuted: 'rgba(217, 119, 6, 0.12)',
        accentError: '#dc2626',
        accentErrorMuted: 'rgba(220, 38, 38, 0.12)',
        accentInfo: '#3b82f6',
        accentInfoMuted: 'rgba(59, 130, 246, 0.12)',
        focusRing: '#10b981',
        selectionBackground: 'rgba(16, 185, 129, 0.16)',
      },
      surface: {
        primary: '#f4f7f5',
        secondary: '#edf2ef',
        tertiary: '#e2ebe6',
        elevated: '#ffffff',
        hover: '#d8e4dd',
        active: '#ceddd5',
      },
      text: {
        primary: '#1a2e23',
        secondary: '#3d5e4a',
        tertiary: '#5f8a6e',
        inverse: '#f4f7f5',
        link: '#059669',
      },
      border: {
        primary: '#c2d4cb',
        secondary: '#d5e2db',
        accent: '#a4c4b2',
        focus: '#10b981',
      },
      intent: {
        success: '#16a34a',
        successMuted: 'rgba(22, 163, 74, 0.12)',
        warning: '#d97706',
        warningMuted: 'rgba(217, 119, 6, 0.12)',
        error: '#dc2626',
        errorMuted: 'rgba(220, 38, 38, 0.12)',
        info: '#3b82f6',
        infoMuted: 'rgba(59, 130, 246, 0.12)',
      },
      chat: {
        userBubble: '#10b981',
        userBubbleText: '#ffffff',
        assistantBubble: '#e2ebe6',
        assistantBubbleText: '#1a2e23',
      },
      code: {
        background: '#edf2ef',
        border: '#c2d4cb',
        foreground: '#1a2e23',
        keyword: '#059669',
        string: '#16a34a',
        comment: '#5f8a6e',
        diffAdded: '#16a34a',
        diffRemoved: '#dc2626',
      },
      shadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.06)',
        md: '0 4px 12px rgba(0, 0, 0, 0.08)',
        lg: '0 8px 24px rgba(0, 0, 0, 0.10)',
      },
      effects: {
        ...DEFAULT_EFFECTS,
        reducedTransparencyFallback: {
          surfaceColor: '#ffffff',
          borderColor: '#c2d4cb',
          shadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
        },
      },
    },
  },
  {
    id: 'blush',
    label: 'Blush',
    family: 'Blush',
    group: 'light',
    mode: 'light',
    color: '#f43f5e',
    tags: ['builtin'],
    quality: {
      contrastPairs: [
        { foreground: '#2e1a20', background: '#f9f5f6', minimumRatio: 7 },
        { foreground: '#5e3a44', background: '#f3eeef', minimumRatio: 4.5 },
        { foreground: '#f43f5e', background: '#f9f5f6', minimumRatio: 4 },
      ],
      reducedMotionSafe: true,
    },
    tokens: {
      color: {
        accentPrimary: '#f43f5e',
        accentPrimaryHover: '#e11d48',
        accentPrimaryMuted: 'rgba(244, 63, 94, 0.12)',
        accentSuccess: '#16a34a',
        accentSuccessMuted: 'rgba(22, 163, 74, 0.12)',
        accentWarning: '#d97706',
        accentWarningMuted: 'rgba(217, 119, 6, 0.12)',
        accentError: '#dc2626',
        accentErrorMuted: 'rgba(220, 38, 38, 0.12)',
        accentInfo: '#3b82f6',
        accentInfoMuted: 'rgba(59, 130, 246, 0.12)',
        focusRing: '#f43f5e',
        selectionBackground: 'rgba(244, 63, 94, 0.16)',
      },
      surface: {
        primary: '#f9f5f6',
        secondary: '#f3eeef',
        tertiary: '#eae2e4',
        elevated: '#ffffff',
        hover: '#e2d7da',
        active: '#dbcccf',
      },
      text: {
        primary: '#2e1a20',
        secondary: '#5e3a44',
        tertiary: '#8a5f6a',
        inverse: '#f9f5f6',
        link: '#e11d48',
      },
      border: {
        primary: '#d4c4c9',
        secondary: '#e2d7da',
        accent: '#c4a8ae',
        focus: '#f43f5e',
      },
      intent: {
        success: '#16a34a',
        successMuted: 'rgba(22, 163, 74, 0.12)',
        warning: '#d97706',
        warningMuted: 'rgba(217, 119, 6, 0.12)',
        error: '#dc2626',
        errorMuted: 'rgba(220, 38, 38, 0.12)',
        info: '#3b82f6',
        infoMuted: 'rgba(59, 130, 246, 0.12)',
      },
      chat: {
        userBubble: '#f43f5e',
        userBubbleText: '#ffffff',
        assistantBubble: '#eae2e4',
        assistantBubbleText: '#2e1a20',
      },
      code: {
        background: '#f3eeef',
        border: '#d4c4c9',
        foreground: '#2e1a20',
        keyword: '#e11d48',
        string: '#16a34a',
        comment: '#8a5f6a',
        diffAdded: '#16a34a',
        diffRemoved: '#dc2626',
      },
      shadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.06)',
        md: '0 4px 12px rgba(0, 0, 0, 0.08)',
        lg: '0 8px 24px rgba(0, 0, 0, 0.10)',
      },
      effects: {
        ...DEFAULT_EFFECTS,
        reducedTransparencyFallback: {
          surfaceColor: '#ffffff',
          borderColor: '#d4c4c9',
          shadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
        },
      },
    },
  },
];

const THEME_BY_ID = new Map(BUILTIN_THEME_REGISTRY.map((entry) => [entry.id, entry]));

export function getBuiltinThemes(): ThemeRegistry {
  return BUILTIN_THEME_REGISTRY;
}

export function getBuiltinTheme(id: string): BuiltinTheme | undefined {
  return THEME_BY_ID.get(id);
}

export function resolveThemeId(themeId: string | undefined | null): string {
  if (!themeId) return FALLBACK_THEME_ID;
  const normalized = themeId.trim();
  return THEME_BY_ID.has(normalized) ? normalized : FALLBACK_THEME_ID;
}

export function getThemesByMode(mode: BuiltinTheme['mode']): BuiltinTheme[] {
  return BUILTIN_THEME_REGISTRY.filter((theme) => theme.mode === mode);
}

function toPx(value: number): string {
  return `${value}px`;
}

function themeTokensToCssVars(theme: BuiltinTheme): Record<string, string> {
  return {
    '--bg-primary': theme.tokens.surface.primary,
    '--bg-secondary': theme.tokens.surface.secondary,
    '--bg-tertiary': theme.tokens.surface.tertiary,
    '--bg-elevated': theme.tokens.surface.elevated,
    '--bg-hover': theme.tokens.surface.hover,
    '--bg-active': theme.tokens.surface.active,
    '--border-primary': theme.tokens.border.primary,
    '--border-secondary': theme.tokens.border.secondary,
    '--border-accent': theme.tokens.border.accent,
    '--text-primary': theme.tokens.text.primary,
    '--text-secondary': theme.tokens.text.secondary,
    '--text-tertiary': theme.tokens.text.tertiary,
    '--text-inverse': theme.tokens.text.inverse,
    '--accent-primary': theme.tokens.color.accentPrimary,
    '--accent-primary-hover': theme.tokens.color.accentPrimaryHover,
    '--accent-primary-muted': theme.tokens.color.accentPrimaryMuted,
    '--accent-success': theme.tokens.intent.success,
    '--accent-success-muted': theme.tokens.intent.successMuted,
    '--accent-warning': theme.tokens.intent.warning,
    '--accent-warning-muted': theme.tokens.intent.warningMuted,
    '--accent-error': theme.tokens.intent.error,
    '--accent-error-muted': theme.tokens.intent.errorMuted,
    '--accent-info': theme.tokens.intent.info,
    '--accent-info-muted': theme.tokens.intent.infoMuted,
    '--user-bubble': theme.tokens.chat.userBubble,
    '--user-bubble-text': theme.tokens.chat.userBubbleText,
    '--assistant-bubble': theme.tokens.chat.assistantBubble,
    '--assistant-bubble-text': theme.tokens.chat.assistantBubbleText,
    '--code-bg': theme.tokens.code.background,
    '--code-border': theme.tokens.code.border,
    '--shadow-sm': theme.tokens.shadow.sm,
    '--shadow-md': theme.tokens.shadow.md,
    '--shadow-lg': theme.tokens.shadow.lg,
    '--text-link': theme.tokens.text.link || theme.tokens.color.accentPrimary,
    '--theme-material': theme.tokens.effects?.material || DEFAULT_EFFECTS.material,
    '--theme-backdrop-blur': toPx(theme.tokens.effects?.backdropBlur ?? DEFAULT_EFFECTS.backdropBlur),
    '--theme-surface-opacity': String(theme.tokens.effects?.surfaceOpacity ?? DEFAULT_EFFECTS.surfaceOpacity),
    '--theme-border-style': theme.tokens.effects?.borderStyle || DEFAULT_EFFECTS.borderStyle,
    '--theme-border-contrast': String(theme.tokens.effects?.borderContrast ?? DEFAULT_EFFECTS.borderContrast),
    '--theme-glow-opacity': String(theme.tokens.effects?.glowOpacity ?? DEFAULT_EFFECTS.glowOpacity),
    '--theme-grain-opacity': String(theme.tokens.effects?.grainOpacity ?? DEFAULT_EFFECTS.grainOpacity),
    '--theme-scanline-opacity': String(theme.tokens.effects?.scanlineOpacity ?? DEFAULT_EFFECTS.scanlineOpacity),
    '--theme-grid-opacity': String(theme.tokens.effects?.gridOpacity ?? DEFAULT_EFFECTS.gridOpacity),
    '--theme-reduced-transparency-surface': theme.tokens.effects?.reducedTransparencyFallback?.surfaceColor
      || theme.tokens.surface.elevated,
    '--theme-reduced-transparency-border': theme.tokens.effects?.reducedTransparencyFallback?.borderColor
      || theme.tokens.border.primary,
    '--theme-reduced-transparency-shadow': theme.tokens.effects?.reducedTransparencyFallback?.shadow
      || theme.tokens.shadow.md,
    '--theme-id': theme.id,
    '--theme-mode': theme.mode,
  };
}

export function applyTheme(themeId: string, _resolvedInputs?: Record<string, ThemeInputValue>): string {
  const resolvedThemeId = resolveThemeId(themeId);
  const theme = THEME_BY_ID.get(resolvedThemeId);
  if (!theme) return FALLBACK_THEME_ID;

  const style = document.documentElement.style;
  for (const [name, value] of Object.entries(themeTokensToCssVars(theme)).sort(([left], [right]) => {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  })) {
    style.setProperty(name, value);
  }
  document.documentElement.setAttribute('data-theme', resolvedThemeId);
  return resolvedThemeId;
}

export function validateBuiltins(): Array<{ themeId: string; violations: ThemeContrastCheck[] }> {
  return BUILTIN_THEME_REGISTRY.map((theme) => {
    const checks = checkContrastPairs(theme.quality.contrastPairs);
    const failures = checks.filter((check) => check.actualRatio < check.minimumRatio);
    if (failures.length > 0) {
      console.warn(
        `[theme-plugin] Contrast regression in ${theme.id}: ${failures
          .map((entry) => `${entry.foreground} on ${entry.background} is ${entry.actualRatio} < ${entry.minimumRatio}`)
          .join(', ')}`
      );
    }
    return {
      themeId: theme.id,
      violations: failures,
    };
  });
}

if (import.meta.env.DEV) {
  validateBuiltins();
}
