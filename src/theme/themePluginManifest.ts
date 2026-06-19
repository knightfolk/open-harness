import type { ThemeMode, ThemeQuality, ThemeTokens } from './themeTokens';

export const THEME_PLUGIN_SCHEMA_VERSION = '0.1.0';
export const THEME_PLUGIN_SCHEMA_PATH = 'docs/theme-plugin.schema.json';

const MANIFEST_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,127}$/;
const SHORT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const MODE_VALUES: ThemeMode[] = ['dark', 'light', 'high-contrast-dark', 'high-contrast-light'];
const PROVENANCE_SOURCES = ['builtin', 'local', 'generated', 'community', 'imported-vscode', 'imported-other'] as const;
const TRUST_VALUES = ['trusted', 'review-required', 'blocked'] as const;
const TARGET_VALUES = ['app', 'chat', 'sidebar', 'settings', 'right-panel'] as const;
const TEXTURE_RECIPE_VALUES = ['none', 'paper-grain', 'fine-grid', 'blueprint-grid', 'low-noise-matte', 'soft-glass', 'terminal-scanline', 'soft-marble', 'brushed-plaster', 'paper-fiber', 'frosted-noise'] as const;
const COLOR_TOKEN_PATTERN = /^(?:#[0-9a-fA-F]{3,4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|rgba?\([^)\n;]+\)|hsla?\([^)\n;]+\)|var\(--[a-zA-Z0-9_-]+\))$/;

interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export interface ThemePluginAuthor {
  name: string;
  url?: string;
  email?: string;
}

export interface ThemePluginProvenance {
  source: (typeof PROVENANCE_SOURCES)[number];
  trust: (typeof TRUST_VALUES)[number];
  homepage?: string;
  repository?: string;
  commit?: string;
  signature?: string;
  importedFrom?: string;
}

export interface ThemePluginCompatibility {
  openharness: string;
  schema: string;
  supportsBackgrounds?: boolean;
  supportsInputs?: boolean;
  supportsOutputs?: boolean;
}

export interface ThemePluginBackground {
  id: string;
  target: (typeof TARGET_VALUES)[number];
  assetId?: string;
  fallbackColor: string;
  fit?: 'cover' | 'contain' | 'tile' | 'stretch';
  position?: string;
  focalPoint?: { x: number; y: number };
  overlayColor?: string;
  overlayOpacity?: number;
  blur?: number;
  saturation?: number;
}

export interface ThemePluginContrastPair {
  foreground: string;
  background: string;
  minimumRatio: number;
  surface?: string;
}

export interface ThemePluginQuality extends ThemeQuality {
  contrastPairs: ThemePluginContrastPair[];
  reducedMotionSafe?: boolean;
  notes?: string;
}

export interface ThemePluginVariant {
  id: string;
  name: string;
  family: string;
  mode: ThemeMode;
  tags?: string[];
  preview?: {
    assetId?: string;
    swatches?: string[];
  };
  tokens: ThemeTokens;
  quality: ThemePluginQuality;
  backgrounds?: ThemePluginBackground[];
  componentOverrides?: Record<string, Record<string, unknown>>;
}

export interface ThemePluginManifest {
  schemaVersion: string;
  id: string;
  name: string;
  version: string;
  description: string;
  author: ThemePluginAuthor;
  license: string;
  provenance: ThemePluginProvenance;
  compatibility: ThemePluginCompatibility;
  variants: ThemePluginVariant[];
  inputs?: unknown[];
  outputs?: unknown[];
  assets?: unknown[];
  packs?: unknown[];
}

export interface ThemePluginManifestParseResult {
  ok: boolean;
  manifest?: ThemePluginManifest;
  errors: string[];
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function addIfDefined<T>(array: T[], item?: T): void {
  if (item !== undefined) array.push(item);
}

function ensureString(value: unknown, path: string, result: ValidationResult): string | undefined {
  if (typeof value !== 'string') {
    addIfDefined(result.errors, `${path} must be a string`);
    return undefined;
  }
  return value;
}

function ensureStringTrimmed(value: unknown, path: string, result: ValidationResult): string | undefined {
  const raw = ensureString(value, path, result);
  if (!raw) return undefined;
  const valueTrimmed = raw.trim();
  if (!valueTrimmed) {
    addIfDefined(result.errors, `${path} cannot be empty`);
    return undefined;
  }
  return valueTrimmed;
}

function ensureArray(value: unknown, path: string, result: ValidationResult): unknown[] | undefined {
  if (!Array.isArray(value)) {
    addIfDefined(result.errors, `${path} must be an array`);
    return undefined;
  }
  return value;
}

function ensureBoolean(value: unknown, path: string, result: ValidationResult): boolean | undefined {
  if (typeof value !== 'boolean') {
    addIfDefined(result.errors, `${path} must be true/false`);
    return undefined;
  }
  return value;
}

function ensureNonNegativeNumber(value: unknown, path: string, min: number, max: number, result: ValidationResult): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    addIfDefined(result.errors, `${path} must be a number`);
    return undefined;
  }
  if (value < min || value > max) {
    addIfDefined(result.errors, `${path} must be between ${min} and ${max}`);
    return undefined;
  }
  return value;
}

function ensureRecord(value: unknown, path: string, result: ValidationResult): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    addIfDefined(result.errors, `${path} must be an object`);
    return undefined;
  }
  return value;
}

function ensureColor(value: unknown, path: string, result: ValidationResult): string | undefined {
  const candidate = ensureStringTrimmed(value, path, result);
  if (!candidate) return undefined;
  if (!COLOR_TOKEN_PATTERN.test(candidate)) {
    addIfDefined(result.errors, `${path} must be a CSS color token`);
    return undefined;
  }
  return candidate;
}

function ensureRequiredKeys(value: Record<string, unknown>, keys: string[], path: string, result: ValidationResult): void {
  for (const key of keys) {
    if (!(key in value)) {
      addIfDefined(result.errors, `${path}.${key} is required`);
    }
  }
}

function isMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && MODE_VALUES.includes(value as ThemeMode);
}

function isProvenanceSource(value: unknown): value is ThemePluginProvenance['source'] {
  return typeof value === 'string' && (PROVENANCE_SOURCES as readonly string[]).includes(value);
}

function isTrustValue(value: unknown): value is ThemePluginProvenance['trust'] {
  return typeof value === 'string' && (TRUST_VALUES as readonly string[]).includes(value);
}

function isTarget(value: unknown): value is ThemePluginBackground['target'] {
  return typeof value === 'string' && (TARGET_VALUES as readonly string[]).includes(value);
}

function isTextureRecipe(value: unknown): boolean {
  return typeof value === 'string' && (TEXTURE_RECIPE_VALUES as readonly string[]).includes(value);
}

function validateManifestId(id: string, path: string, result: ValidationResult): void {
  if (!MANIFEST_ID_PATTERN.test(id)) {
    addIfDefined(result.errors, `${path} must match ${MANIFEST_ID_PATTERN}`);
  }
}

function validateShortId(id: string, path: string, result: ValidationResult): void {
  if (!SHORT_ID_PATTERN.test(id)) {
    addIfDefined(result.errors, `${path} must match ${SHORT_ID_PATTERN}`);
  }
}

function validateTokens(tokens: unknown, path: string, result: ValidationResult): void {
  const tokenObject = ensureRecord(tokens, path, result);
  if (!tokenObject) return;

  const colorTokenObj = ensureRecord(tokenObject.color, `${path}.color`, result);
  if (colorTokenObj) {
    ensureRequiredKeys(colorTokenObj, [
      'accentPrimary',
      'accentPrimaryHover',
      'accentPrimaryMuted',
      'accentSuccess',
      'accentSuccessMuted',
      'accentWarning',
      'accentWarningMuted',
      'accentError',
      'accentErrorMuted',
      'accentInfo',
      'accentInfoMuted',
    ], `${path}.color`, result);
    for (const [key, value] of Object.entries(colorTokenObj)) {
      if ([
        'accentPrimary',
        'accentPrimaryHover',
        'accentPrimaryMuted',
        'accentSuccess',
        'accentSuccessMuted',
        'accentWarning',
        'accentWarningMuted',
        'accentError',
        'accentErrorMuted',
        'accentInfo',
        'accentInfoMuted',
        'focusRing',
        'selectionBackground',
      ].includes(key)) {
        ensureColor(value, `${path}.color.${key}`, result);
      } else {
        addIfDefined(result.warnings, `${path}.color includes unknown token "${key}"`);
      }
    }
  }

  const surfaceTokenObj = ensureRecord(tokenObject.surface, `${path}.surface`, result);
  if (surfaceTokenObj) {
    ensureRequiredKeys(surfaceTokenObj, ['primary', 'secondary', 'tertiary', 'elevated', 'hover', 'active'], `${path}.surface`, result);
    for (const [key, value] of Object.entries(surfaceTokenObj)) {
      if (['primary', 'secondary', 'tertiary', 'elevated', 'hover', 'active'].includes(key)) {
        ensureColor(value, `${path}.surface.${key}`, result);
      }
    }
  }

  const textTokenObj = ensureRecord(tokenObject.text, `${path}.text`, result);
  if (textTokenObj) {
    ensureRequiredKeys(textTokenObj, ['primary', 'secondary', 'tertiary', 'inverse'], `${path}.text`, result);
    for (const [key, value] of Object.entries(textTokenObj)) {
      if (['primary', 'secondary', 'tertiary', 'inverse', 'link'].includes(key)) {
        ensureColor(value, `${path}.text.${key}`, result);
      }
    }
  }

  const borderTokenObj = ensureRecord(tokenObject.border, `${path}.border`, result);
  if (borderTokenObj) {
    ensureRequiredKeys(borderTokenObj, ['primary', 'secondary', 'accent'], `${path}.border`, result);
    for (const [key, value] of Object.entries(borderTokenObj)) {
      if (['primary', 'secondary', 'accent', 'focus'].includes(key)) {
        ensureColor(value, `${path}.border.${key}`, result);
      }
    }
  }

  const intentTokenObj = ensureRecord(tokenObject.intent, `${path}.intent`, result);
  if (intentTokenObj) {
    ensureRequiredKeys(intentTokenObj, [
      'success', 'successMuted', 'warning', 'warningMuted', 'error', 'errorMuted', 'info', 'infoMuted',
    ], `${path}.intent`, result);
    for (const [key, value] of Object.entries(intentTokenObj)) {
      if ([
        'success', 'successMuted', 'warning', 'warningMuted', 'error', 'errorMuted', 'info', 'infoMuted',
      ].includes(key)) {
        ensureColor(value, `${path}.intent.${key}`, result);
      }
    }
  }

  const chatTokenObj = ensureRecord(tokenObject.chat, `${path}.chat`, result);
  if (chatTokenObj) {
    ensureRequiredKeys(chatTokenObj, ['userBubble', 'userBubbleText', 'assistantBubble', 'assistantBubbleText'], `${path}.chat`, result);
    for (const [key, value] of Object.entries(chatTokenObj)) {
      if (['userBubble', 'userBubbleText', 'assistantBubble', 'assistantBubbleText'].includes(key)) {
        ensureColor(value, `${path}.chat.${key}`, result);
      }
    }
  }

  const codeTokenObj = ensureRecord(tokenObject.code, `${path}.code`, result);
  if (codeTokenObj) {
    ensureRequiredKeys(codeTokenObj, ['background', 'border'], `${path}.code`, result);
    for (const [key, value] of Object.entries(codeTokenObj)) {
      if ([
        'background', 'border', 'foreground', 'keyword', 'string', 'comment', 'diffAdded', 'diffRemoved',
      ].includes(key)) {
        ensureColor(value, `${path}.code.${key}`, result);
      }
    }
  }

  const shadowTokenObj = ensureRecord(tokenObject.shadow, `${path}.shadow`, result);
  if (shadowTokenObj) {
    ensureRequiredKeys(shadowTokenObj, ['sm', 'md', 'lg'], `${path}.shadow`, result);
    for (const [key, value] of Object.entries(shadowTokenObj)) {
      if (['sm', 'md', 'lg'].includes(key)) {
        ensureString(value, `${path}.shadow.${key}`, result);
      }
    }
  }

  if ('effects' in tokenObject) {
    const effectTokenObj = ensureRecord(tokenObject.effects, `${path}.effects`, result);
    if (effectTokenObj) {
      for (const [key, value] of Object.entries(effectTokenObj)) {
        if (key === 'textureRecipe') {
          if (!isTextureRecipe(value)) {
            addIfDefined(result.errors, `${path}.effects.textureRecipe must be one of: ${TEXTURE_RECIPE_VALUES.join(', ')}`);
          }
        } else if (key === 'textureOpacity') {
          ensureNonNegativeNumber(value, `${path}.effects.textureOpacity`, 0, 0.18, result);
        }
      }
    }
  }
}

function validateContrastPairs(pairs: unknown, path: string, result: ValidationResult): void {
  const entries = ensureArray(pairs, path, result);
  if (!entries) return;
  if (entries.length === 0) {
    addIfDefined(result.errors, `${path} must contain at least one contrast pair`);
    return;
  }
  entries.forEach((entry, index) => {
    const pair = ensureRecord(entry, `${path}[${index}]`, result);
    if (!pair) return;
    ensureRequiredKeys(pair, ['foreground', 'background', 'minimumRatio'], `${path}[${index}]`, result);
    ensureColor(pair.foreground, `${path}[${index}].foreground`, result);
    ensureColor(pair.background, `${path}[${index}].background`, result);
    const ratio = ensureNonNegativeNumber(pair.minimumRatio, `${path}[${index}].minimumRatio`, 1, 21, result);
    if (ratio === undefined) return;
    if (ratio < 1 || ratio > 21) {
      addIfDefined(result.errors, `${path}[${index}].minimumRatio must be between 1 and 21`);
    }
  });
}

function validateVariant(variant: unknown, index: number, result: ValidationResult): void {
  const path = `$.variants[${index}]`;
  const obj = ensureRecord(variant, path, result);
  if (!obj) return;

  const id = ensureStringTrimmed(obj.id, `${path}.id`, result);
  const name = ensureStringTrimmed(obj.name, `${path}.name`, result);
  const family = ensureStringTrimmed(obj.family, `${path}.family`, result);
  const mode = obj.mode;
  if (!isMode(mode)) {
    addIfDefined(result.errors, `${path}.mode must be one of: ${MODE_VALUES.join(', ')}`);
  }
  if (id) validateShortId(id, `${path}.id`, result);
  if (name) {
    if (name.length > 120) {
      addIfDefined(result.errors, `${path}.name must be at most 120 characters`);
    }
  }
  if (family && family.length > 80) {
    addIfDefined(result.errors, `${path}.family must be at most 80 characters`);
  }

  const tokens = obj.tokens;
  validateTokens(tokens, `${path}.tokens`, result);

  const quality = ensureRecord(obj.quality, `${path}.quality`, result);
  if (quality) {
    validateContrastPairs(quality.contrastPairs, `${path}.quality.contrastPairs`, result);
  }

  const backgrounds = obj.backgrounds ? ensureArray(obj.backgrounds, `${path}.backgrounds`, result) : undefined;
  if (backgrounds) {
    backgrounds.forEach((background, backgroundIndex) => {
      const bgPath = `${path}.backgrounds[${backgroundIndex}]`;
      const backgroundObj = ensureRecord(background, bgPath, result);
      if (!backgroundObj) return;
      const backgroundId = ensureStringTrimmed(backgroundObj.id, `${bgPath}.id`, result);
      if (backgroundId) validateShortId(backgroundId, bgPath + '.id', result);
      if (!isTarget(backgroundObj.target)) {
        addIfDefined(result.errors, `${bgPath}.target must be app|chat|sidebar|settings|right-panel`);
      }
      ensureColor(backgroundObj.fallbackColor, `${bgPath}.fallbackColor`, result);
      if (backgroundObj.overlayColor !== undefined) {
        ensureColor(backgroundObj.overlayColor, `${bgPath}.overlayColor`, result);
      }
      if (backgroundObj.overlayOpacity !== undefined) {
        ensureNonNegativeNumber(backgroundObj.overlayOpacity, `${bgPath}.overlayOpacity`, 0, 1, result);
      }
      if (backgroundObj.blur !== undefined) {
        ensureNonNegativeNumber(backgroundObj.blur, `${bgPath}.blur`, 0, 40, result);
      }
      if (backgroundObj.saturation !== undefined) {
        ensureNonNegativeNumber(backgroundObj.saturation, `${bgPath}.saturation`, 0, 2, result);
      }
    });
  }
}

export function parseThemePluginManifest(raw: string): ThemePluginManifestParseResult {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      errors: [`Invalid JSON: ${(error as Error).message}`],
      warnings: [],
    };
  }
  return validateThemePluginManifest(payload);
}

export function validateThemePluginManifest(payload: unknown): ThemePluginManifestParseResult {
  const result: ValidationResult = { errors: [], warnings: [] };

  const manifest = ensureRecord(payload, '$', result);
  if (!manifest) return { ok: false, errors: result.errors, warnings: result.warnings };

  const schemaVersion = ensureStringTrimmed(manifest.schemaVersion, '$.schemaVersion', result);
  const id = ensureStringTrimmed(manifest.id, '$.id', result);
  const name = ensureStringTrimmed(manifest.name, '$.name', result);
  const version = ensureStringTrimmed(manifest.version, '$.version', result);
  const description = ensureStringTrimmed(manifest.description, '$.description', result);
  const author = ensureRecord(manifest.author, '$.author', result);
  ensureStringTrimmed(manifest.license, '$.license', result);
  const provenance = ensureRecord(manifest.provenance, '$.provenance', result);
  const compatibility = ensureRecord(manifest.compatibility, '$.compatibility', result);

  if (schemaVersion && schemaVersion !== THEME_PLUGIN_SCHEMA_VERSION) {
    result.errors.push(`$.schemaVersion must be "${THEME_PLUGIN_SCHEMA_VERSION}"`);
  }

  if (id) validateManifestId(id, '$.id', result);
  if (name && name.length > 120) result.errors.push('$.name must be at most 120 characters');
  if (description && description.length > 500) result.errors.push('$.description must be at most 500 characters');

  if (version && !/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    result.errors.push('$.version must follow semver pattern (for example 1.2.3)');
  }

  const authorName = author ? ensureStringTrimmed(author.name, '$.author.name', result) : undefined;
  if (authorName && authorName.length > 120) result.errors.push('$.author.name must be at most 120 characters');
  if (author && author.url !== undefined) {
    const authorUrl = ensureStringTrimmed(author.url, '$.author.url', result);
    if (authorUrl) {
      try {
        new URL(authorUrl);
      } catch {
        result.errors.push('$.author.url must be a valid URL');
      }
    }
  }
  if (author && author.email !== undefined) {
    const email = ensureStringTrimmed(author.email, '$.author.email', result);
    if (email && email.length > 160) {
      result.errors.push('$.author.email must be at most 160 characters');
    }
  }

  if (provenance) {
    const source = provenance.source;
    const trust = provenance.trust;
    if (!isProvenanceSource(source)) {
      result.errors.push(`$.provenance.source must be one of: ${PROVENANCE_SOURCES.join(', ')}`);
    }
    if (!isTrustValue(trust)) {
      result.errors.push(`$.provenance.trust must be one of: ${TRUST_VALUES.join(', ')}`);
    }
    if (provenance.homepage !== undefined) {
      const homepage = ensureStringTrimmed(provenance.homepage, '$.provenance.homepage', result);
      if (homepage) {
        try {
          new URL(homepage);
        } catch {
          result.errors.push('$.provenance.homepage must be a valid URL');
        }
      }
    }
    if (provenance.repository !== undefined) {
      const repository = ensureStringTrimmed(provenance.repository, '$.provenance.repository', result);
      if (repository) {
        try {
          new URL(repository);
        } catch {
          result.errors.push('$.provenance.repository must be a valid URL');
        }
      }
    }
  }

  if (compatibility) {
    const compatOpenHarness = ensureStringTrimmed(compatibility.openharness, '$.compatibility.openharness', result);
    const compatSchema = ensureStringTrimmed(compatibility.schema, '$.compatibility.schema', result);
    if (compatSchema && compatSchema !== THEME_PLUGIN_SCHEMA_VERSION) {
      result.errors.push(`$.compatibility.schema must be "${THEME_PLUGIN_SCHEMA_VERSION}"`);
    }
    if (compatOpenHarness && compatOpenHarness.length === 0) {
      result.errors.push('$.compatibility.openharness cannot be empty');
    }
    if (compatibility.supportsBackgrounds !== undefined) {
      ensureBoolean(compatibility.supportsBackgrounds, '$.compatibility.supportsBackgrounds', result);
    }
    if (compatibility.supportsInputs !== undefined) {
      ensureBoolean(compatibility.supportsInputs, '$.compatibility.supportsInputs', result);
    }
    if (compatibility.supportsOutputs !== undefined) {
      ensureBoolean(compatibility.supportsOutputs, '$.compatibility.supportsOutputs', result);
    }
  }

  if (manifest.inputs !== undefined) ensureArray(manifest.inputs, '$.inputs', result);
  if (manifest.outputs !== undefined) ensureArray(manifest.outputs, '$.outputs', result);
  if (manifest.assets !== undefined) ensureArray(manifest.assets, '$.assets', result);
  if (manifest.packs !== undefined) ensureArray(manifest.packs, '$.packs', result);

  const variants = ensureArray(manifest.variants, '$.variants', result);
  if (variants) {
    if (variants.length === 0) {
      result.errors.push('$.variants must contain at least one theme variant');
    } else {
      variants.forEach((variant, index) => validateVariant(variant, index, result));
    }
  }

  const ok = result.errors.length === 0;
  return {
    ok,
    manifest: ok ? (manifest as unknown as ThemePluginManifest) : undefined,
    errors: result.errors,
    warnings: result.warnings,
  };
}
