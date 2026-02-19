module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    '@typescript-eslint/recommended-requiring-type-checking',
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  rules: {
    // Allow console in extension code
    'no-console': 'off',
    // Allow any for Chrome API types
    '@typescript-eslint/no-explicit-any': 'off',
    // Allow non-null assertions for DOM elements (we handle with guards)
    '@typescript-eslint/no-non-null-assertion': 'off',
    // Allow unused vars in some cases
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    // Strict TypeScript rules
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
  },
  ignorePatterns: [
    'dist/',
    '.output/',
    'node_modules/',
    '*.config.js',
    '*.config.ts',
  ],
};
