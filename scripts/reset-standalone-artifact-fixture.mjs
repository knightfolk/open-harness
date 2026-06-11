#!/usr/bin/env node
import { mkdirSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const evalDir = join(root, 'test-fixtures', 'standalone-artifact-eval');

rmSync(evalDir, { recursive: true, force: true });
mkdirSync(evalDir, { recursive: true });

console.log(`Reset standalone artifact fixture at ${evalDir}`);
