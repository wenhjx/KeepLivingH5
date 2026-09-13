/** 最小化 ESLint 配置：只约束空行数量（Prettier 管格式、ESLint 管风格约束的分工） */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  ignorePatterns: ['dist', 'node_modules', 'public'],
  rules: {
    // 最多 1 个连续空行；文件末尾 1 个、开头 0 个
    'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 1, maxBOF: 0 }],
  },
};
