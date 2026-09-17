/** 通用 ESLint 规范（基于 typescript-eslint 官方 recommended 基线 + 项目自定义约束）
 *  分工：Prettier 管格式，ESLint 管风格/正确性；空行规则保留在此处统一约束。
 *  参考：https://typescript-eslint.io/users/configs/（eslint:recommended + plugin:@typescript-eslint/recommended）
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  ignorePatterns: ['dist', 'node_modules', 'public', 'scripts/.audit.cjs'],
  rules: {
    /* ---- 空行约束（项目原规则，保留） ---- */
    // 最多 1 个连续空行；文件末尾 1 个、开头 0 个
    'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 1, maxBOF: 0 }],

    /* ---- 通用正确性（eslint:recommended 之外的常用增强） ---- */
    'eqeqeq': ['error', 'always', { null: 'ignore' }], // 恒等比较；x != null 的 null 检查豁免
    'curly': ['error', 'multi-line'],         // 单行 if/for 允许无括号；多行必须带大括号
    'prefer-const': 'error',                  // 不再赋值的 let 必须用 const
    'no-console': 'warn',                     // 保留 console 但提示（调试面板用）
    'no-empty': ['error', { allowEmptyCatch: true }], // 允许空 catch
    'no-var': 'error',                        // 禁用 var

    /* ---- TypeScript 规则 ---- */
    // 未使用变量：由 TS 接管；允许 _ 前缀忽略（回调占位参数）
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    // any：项目历史遗留较多，先降为 warn 逐步收敛（业务新代码应避免新增 any）
    '@typescript-eslint/no-explicit-any': 'warn',
    // 非空断言 !：项目大量使用（Phaser 场景对象），保持允许
    '@typescript-eslint/no-non-null-assertion': 'off',
    // this 别名：链式游标/回调兼容模式（如弹射链 source = this），允许
    '@typescript-eslint/no-this-alias': 'off',
    // 显式返回类型：Phaser 场景类方法繁多，不强求
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    // 空接口：允许（游戏内常作占位/分组类型）
    '@typescript-eslint/no-empty-interface': 'off',
    // 类型断言风格：宽松
    '@typescript-eslint/consistent-type-assertions': 'off',
    // 命名规范不强制（游戏项目大量中文语境命名）
    '@typescript-eslint/naming-convention': 'off',
  },
};
