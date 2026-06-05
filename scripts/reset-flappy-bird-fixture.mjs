#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const templateDir = join(root, 'test-fixtures', 'flappy-bird-template');
const evalDir = join(root, 'test-fixtures', 'flappy-bird-eval');

if (!existsSync(templateDir)) {
  throw new Error(`Missing template fixture: ${templateDir}`);
}

rmSync(evalDir, { recursive: true, force: true });
mkdirSync(dirname(evalDir), { recursive: true });
cpSync(templateDir, evalDir, { recursive: true });

console.log(`Reset Flappy Bird fixture at ${evalDir}`);
