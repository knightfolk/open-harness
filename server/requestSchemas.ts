import type express from 'express';

type ParseSuccess<T> = { ok: true; value: T };
type ParseFailure = { ok: false; error: string };
type ParseResult<T> = ParseSuccess<T> | ParseFailure;
type FieldParser<T> = (value: unknown, key: string) => ParseResult<T>;

type SchemaShape = Record<string, FieldParser<any>>;
type SchemaOutput<T extends SchemaShape> = {
  [K in keyof T]: T[K] extends FieldParser<infer U> ? U : never;
};

export interface RequestSchema<T> {
  parse(input: unknown): ParseResult<T>;
}

export function objectSchema<T extends SchemaShape>(fields: T): RequestSchema<SchemaOutput<T>> {
  return {
    parse(input: unknown): ParseResult<SchemaOutput<T>> {
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return { ok: false, error: 'Request body must be an object' };
      }
      const source = input as Record<string, unknown>;
      const parsed: Record<string, unknown> = {};
      for (const [key, parser] of Object.entries(fields)) {
        const result = parser(source[key], key);
        if (!result.ok) return result;
        parsed[key] = result.value;
      }
      return { ok: true, value: parsed as SchemaOutput<T> };
    },
  };
}

export function parseBody<T>(
  req: express.Request,
  res: express.Response,
  schema: RequestSchema<T>,
): T | null {
  const result = schema.parse(req.body);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return null;
  }
  return result.value;
}

export function optionalString(options: { trim?: boolean; max?: number; allowEmpty?: boolean } = {}): FieldParser<string | undefined> {
  return (value, key) => {
    if (value === undefined || value === null) return { ok: true, value: undefined };
    if (typeof value !== 'string') return { ok: false, error: `${key} must be a string` };
    const next = options.trim === false ? value : value.trim();
    if (!options.allowEmpty && next.length === 0) return { ok: true, value: undefined };
    if (options.max !== undefined && next.length > options.max) return { ok: false, error: `${key} is too long` };
    return { ok: true, value: next };
  };
}

export function requiredString(options: { trim?: boolean; max?: number } = {}): FieldParser<string> {
  return (value, key) => {
    const result = optionalString({ ...options, allowEmpty: false })(value, key);
    if (!result.ok) return result;
    if (!result.value) return { ok: false, error: `${key} is required` };
    return { ok: true, value: result.value };
  };
}

export function requiredNonBlankString(options: { max?: number } = {}): FieldParser<string> {
  return (value, key) => {
    if (typeof value !== 'string') return { ok: false, error: `${key} is required` };
    if (!value.trim()) return { ok: false, error: `${key} is required` };
    if (options.max !== undefined && value.length > options.max) return { ok: false, error: `${key} is too long` };
    return { ok: true, value };
  };
}

export function optionalEnum<T extends readonly string[]>(values: T): FieldParser<T[number] | undefined> {
  return (value, key) => {
    if (value === undefined || value === null || value === '') return { ok: true, value: undefined };
    if (typeof value !== 'string' || !values.includes(value)) {
      return { ok: false, error: `${key} must be one of: ${values.join(', ')}` };
    }
    return { ok: true, value };
  };
}

export function optionalArray(options: { max?: number } = {}): FieldParser<unknown[] | undefined> {
  return (value, key) => {
    if (value === undefined || value === null) return { ok: true, value: undefined };
    if (!Array.isArray(value)) return { ok: false, error: `${key} must be an array` };
    if (options.max !== undefined && value.length > options.max) return { ok: false, error: `${key} has too many entries` };
    return { ok: true, value };
  };
}

export function optionalRecord(): FieldParser<Record<string, unknown> | undefined> {
  return (value, key) => {
    if (value === undefined || value === null) return { ok: true, value: undefined };
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, error: `${key} must be an object` };
    }
    return { ok: true, value: value as Record<string, unknown> };
  };
}

export function optionalStringArray(options: { max?: number; itemMax?: number } = {}): FieldParser<string[] | undefined> {
  return (value, key) => {
    const result = optionalArray({ max: options.max })(value, key);
    if (!result.ok) return result;
    if (!result.value) return { ok: true, value: undefined };
    const parsed: string[] = [];
    for (const [index, entry] of result.value.entries()) {
      if (typeof entry !== 'string') return { ok: false, error: `${key}[${index}] must be a string` };
      const next = entry.trim();
      if (!next) return { ok: false, error: `${key}[${index}] is required` };
      if (options.itemMax !== undefined && next.length > options.itemMax) {
        return { ok: false, error: `${key}[${index}] is too long` };
      }
      parsed.push(next);
    }
    return { ok: true, value: parsed };
  };
}

export function requiredStringArray(options: { max?: number; itemMax?: number } = {}): FieldParser<string[]> {
  return (value, key) => {
    const result = optionalStringArray(options)(value, key);
    if (!result.ok) return result;
    if (!result.value || result.value.length === 0) return { ok: false, error: `${key} is required` };
    return { ok: true, value: result.value };
  };
}

export function requiredArray(options: { max?: number } = {}): FieldParser<unknown[]> {
  return (value, key) => {
    const result = optionalArray(options)(value, key);
    if (!result.ok) return result;
    if (!result.value || result.value.length === 0) return { ok: false, error: `${key} is required` };
    return { ok: true, value: result.value };
  };
}

export function optionalBoolean(): FieldParser<boolean | undefined> {
  return (value, key) => {
    if (value === undefined || value === null) return { ok: true, value: undefined };
    if (typeof value !== 'boolean') return { ok: false, error: `${key} must be a boolean` };
    return { ok: true, value };
  };
}

export function optionalNumber(options: { min?: number; max?: number } = {}): FieldParser<number | undefined> {
  return (value, key) => {
    if (value === undefined || value === null || value === '') return { ok: true, value: undefined };
    if (typeof value !== 'number' || !Number.isFinite(value)) return { ok: false, error: `${key} must be a number` };
    if (options.min !== undefined && value < options.min) return { ok: false, error: `${key} is too small` };
    if (options.max !== undefined && value > options.max) return { ok: false, error: `${key} is too large` };
    return { ok: true, value };
  };
}

export function optionalInteger(options: { min?: number; max?: number } = {}): FieldParser<number | undefined> {
  return (value, key) => {
    const result = optionalNumber(options)(value, key);
    if (!result.ok || result.value === undefined) return result;
    if (!Number.isInteger(result.value)) return { ok: false, error: `${key} must be an integer` };
    return result;
  };
}
