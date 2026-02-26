import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Game engine architecture: imperative mutable state objects (officeState, editorState)
      // are passed as props and mutated directly — this is by design, not a React anti-pattern
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off', // game engine reads refs during render for frame-synced positioning
      'react-hooks/set-state-in-effect': 'off', // effects sync external state with React state
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      eqeqeq: 'warn',
    },
  },
)
