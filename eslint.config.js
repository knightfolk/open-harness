import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const commonRules = {
  '@typescript-eslint/no-explicit-any': 'off',
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  'preserve-caught-error': 'off',
  'no-empty': 'off',
}

export default defineConfig([
  globalIgnores(['dist', 'dist-server', 'OpenHarnessApp/.build', 'OpenHarnessApp/Sources/OpenHarnessApp/Resources/dist']),
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      ...commonRules,
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
    },
  },
  {
    files: ['server/**/*.ts', 'scripts/**/*.ts', 'vite.config.ts'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      ...commonRules,
    },
  },
  {
    files: ['shared/**/*.cjs', 'eslint.config.js'],
    extends: [
      js.configs.recommended,
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-empty': 'off',
    },
  },
])
