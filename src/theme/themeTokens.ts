export type ThemeMode = 'dark' | 'light' | 'high-contrast-dark' | 'high-contrast-light';

export type ThemeInputValue = string | number | boolean;

export interface ThemeColorTokens {
  accentPrimary: string;
  accentPrimaryHover: string;
  accentPrimaryMuted: string;
  accentSuccess: string;
  accentSuccessMuted: string;
  accentWarning: string;
  accentWarningMuted: string;
  accentError: string;
  accentErrorMuted: string;
  accentInfo: string;
  accentInfoMuted: string;
  selectionBackground?: string;
  focusRing?: string;
}

export interface ThemeSurfaceTokens {
  primary: string;
  secondary: string;
  tertiary: string;
  elevated: string;
  hover: string;
  active: string;
}

export interface ThemeTextTokens {
  primary: string;
  secondary: string;
  tertiary: string;
  inverse: string;
  link?: string;
}

export interface ThemeBorderTokens {
  primary: string;
  secondary: string;
  accent: string;
  focus?: string;
}

export interface ThemeIntentTokens {
  success: string;
  successMuted: string;
  warning: string;
  warningMuted: string;
  error: string;
  errorMuted: string;
  info: string;
  infoMuted: string;
}

export interface ThemeChatTokens {
  userBubble: string;
  userBubbleText: string;
  assistantBubble: string;
  assistantBubbleText: string;
}

export interface ThemeCodeTokens {
  background: string;
  border: string;
  foreground?: string;
  keyword?: string;
  string?: string;
  comment?: string;
  diffAdded?: string;
  diffRemoved?: string;
}

export interface ThemeShadowTokens {
  sm: string;
  md: string;
  lg: string;
}

export interface ThemeEffectTokens {
  material?: 'solid' | 'frosted-glass' | 'classic-bevel' | 'paper-grain' | 'crt' | 'blueprint-grid' | 'photo-lab' | 'custom';
  backdropBlur?: number;
  surfaceOpacity?: number;
  borderStyle?: 'flat' | 'hairline' | 'beveled' | 'double' | 'inset' | 'glow';
  borderContrast?: number;
  glowOpacity?: number;
  grainOpacity?: number;
  scanlineOpacity?: number;
  gridOpacity?: number;
  reducedTransparencyFallback?: {
    surfaceColor: string;
    borderColor: string;
    shadow: string;
  };
}

export interface ThemeQuality {
  contrastPairs: ThemeContrastPair[];
  reducedMotionSafe?: boolean;
  notes?: string;
}

export interface ThemeContrastPair {
  foreground: string;
  background: string;
  minimumRatio: number;
  surface?: string;
}

export interface ThemeContrastCheck {
  foreground: string;
  background: string;
  minimumRatio: number;
  actualRatio: number;
}

export interface ThemeTokens {
  color: ThemeColorTokens;
  surface: ThemeSurfaceTokens;
  text: ThemeTextTokens;
  border: ThemeBorderTokens;
  intent: ThemeIntentTokens;
  chat: ThemeChatTokens;
  code: ThemeCodeTokens;
  shadow: ThemeShadowTokens;
  effects?: ThemeEffectTokens;
  quality?: ThemeQuality;
}

type Rgb = [number, number, number];

function parseHexValue(component: string): number {
  return Number.parseInt(component, 16);
}

function parseColorPart(value: string): number | null {
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? num : null;
}

function parseHexColor(color: string): Rgb | null {
  const hex = color.trim().replace('#', '');
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;

  if (hex.length === 3) {
    const r = parseHexValue(hex.slice(0, 1).repeat(2));
    const g = parseHexValue(hex.slice(1, 2).repeat(2));
    const b = parseHexValue(hex.slice(2, 3).repeat(2));
    return [r, g, b];
  }

  if (hex.length === 4) {
    const r = parseHexValue(hex.slice(0, 1).repeat(2));
    const g = parseHexValue(hex.slice(1, 2).repeat(2));
    const b = parseHexValue(hex.slice(2, 3).repeat(2));
    return [r, g, b];
  }

  if (hex.length === 6 || hex.length === 8) {
    const r = parseHexValue(hex.slice(0, 2));
    const g = parseHexValue(hex.slice(2, 4));
    const b = parseHexValue(hex.slice(4, 6));
    return [r, g, b];
  }
  return null;
}

function parseRgbColor(color: string): Rgb | null {
  const match = color.trim().match(/^rgba?\(\s*([^)]+)\)$/i);
  if (!match) return null;
  const parts = match[1].split(',').map((part) => part.trim());
  if (parts.length < 3) return null;
  const r = parseColorPart(parts[0]);
  const g = parseColorPart(parts[1]);
  const b = parseColorPart(parts[2]);
  if (r == null || g == null || b == null) return null;
  return [r, g, b];
}

function parseThemeColor(color: string): Rgb | null {
  if (color.startsWith('#')) return parseHexColor(color);
  if (color.toLowerCase().startsWith('rgb')) return parseRgbColor(color);
  return null;
}

function channelToLinear(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function relativeLuminance(rgb: Rgb): number {
  return 0.2126 * channelToLinear(rgb[0]) + 0.7152 * channelToLinear(rgb[1]) + 0.0722 * channelToLinear(rgb[2]);
}

export function getContrastRatio(colorA: string, colorB: string): number | null {
  const rgbA = parseThemeColor(colorA);
  const rgbB = parseThemeColor(colorB);
  if (!rgbA || !rgbB) return null;
  const lumA = relativeLuminance(rgbA);
  const lumB = relativeLuminance(rgbB);
  const light = Math.max(lumA, lumB);
  const dark = Math.min(lumA, lumB);
  return Number(((light + 0.05) / (dark + 0.05)).toFixed(2));
}

export function checkContrastPair(pair: ThemeContrastPair): ThemeContrastCheck | null {
  const ratio = getContrastRatio(pair.foreground, pair.background);
  if (ratio == null) return null;
  return {
    foreground: pair.foreground,
    background: pair.background,
    minimumRatio: pair.minimumRatio,
    actualRatio: ratio,
  };
}

export function checkContrastPairs(pairs: ThemeContrastPair[]): ThemeContrastCheck[] {
  return pairs
    .map((pair) => checkContrastPair(pair))
    .filter((entry): entry is ThemeContrastCheck => entry !== null);
}
