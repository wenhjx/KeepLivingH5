# Keep Living - 2D 割草生存游戏 (H5)

一款基于 Phaser 3 + TypeScript + Vite 构建的 2D 割草类生存游戏，支持 PC 和移动端多端游玩。

## 技术栈

- **游戏引擎**: Phaser 3.80+
- **语言**: TypeScript 5.4+
- **构建工具**: Vite 5.2+
- **物理引擎**: Arcade Physics (Phaser 内置)

## 项目结构

```
Keep Living H5/
├── public/                    # 静态资源
│   └── assets/
│       ├── images/            # 图片素材
│       │   ├── characters/    # 角色
│       │   ├── enemies/       # 怪物
│       │   ├── weapons/       # 武器
│       │   ├── effects/       # 特效
│       │   ├── ui/            # UI
│       │   └── tiles/         # 地图瓦片
│       ├── audio/             # 音频
│       └── data/              # JSON 配置数据
├── src/
│   ├── main.ts                # 游戏入口
│   ├── game/                  # 游戏核心
│   │   ├── GameConfig.ts      # 全局配置
│   │   └── GameManager.ts     # 全局管理器(单例)
│   ├── scenes/                # 场景
│   │   ├── BootScene.ts       # 启动场景
│   │   ├── PreloadScene.ts    # 预加载场景
│   │   ├── MainMenuScene.ts   # 主菜单
│   │   ├── GameScene.ts       # 游戏主场景
│   │   ├── UIScene.ts         # UI叠加场景
│   │   └── GameOverScene.ts   # 结算场景
│   ├── entities/              # 实体
│   │   ├── Player.ts          # 玩家
│   │   ├── Enemy.ts           # 敌人(含AI)
│   │   ├── Bullet.ts          # 子弹
│   │   ├── Pickup.ts          # 拾取物
│   │   └── Weapon.ts          # 武器系统
│   ├── systems/               # 系统
│   │   ├── InputManager.ts    # 输入管理(PC+触屏)
│   │   ├── ObjectPool.ts      # 对象池
│   │   ├── WaveManager.ts     # 波次管理
│   │   ├── CollisionSystem.ts # 碰撞系统
│   │   ├── SaveSystem.ts      # 存档系统
│   │   └── AudioManager.ts    # 音频管理
│   ├── ui/                    # UI组件
│   │   ├── HUD.ts             # 抬头显示
│   │   ├── VirtualJoystick.ts # 虚拟摇杆
│   │   ├── HealthBar.ts       # 血条
│   │   └── UpgradePanel.ts    # 升级面板
│   ├── data/                  # 数据配置
│   │   ├── weapons.ts         # 武器配置
│   │   ├── enemies.ts         # 敌人配置
│   │   ├── waves.ts           # 波次配置
│   │   └── upgrades.ts        # 升级配置
│   ├── utils/                 # 工具类
│   │   ├── EventBus.ts        # 事件总线
│   │   ├── MathUtils.ts       # 数学工具
│   │   └── Logger.ts          # 日志
│   └── types/                 # 类型定义
│       └── index.ts
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 `http://localhost:5173`

### 构建生产版本

```bash
npm run build
```

产物输出到 `dist/` 目录

### 预览生产版本

```bash
npm run preview
```

## 核心特性

### 多端适配
- **PC端**: WASD/方向键移动，鼠标瞄准
- **移动端**: 虚拟摇杆触屏操作，自适应UI
- **画质分级**: 自动检测设备性能，低/中/高三档画质

### 游戏系统
- **割草核心**: 大量同屏怪物，对象池优化性能
- **武器系统**: 多种武器类型（远程/近战/AOE/召唤）
- **升级系统**: Roguelike 升级选择，每级随机3选项
- **波次系统**: 递增难度，每5波Boss
- **存档系统**: 本地存档 + 云端同步预留接口

### 性能优化
- **对象池**: 敌人/子弹/拾取物/粒子全部池化
- **画质分级**: 同屏怪数、粒子数、分辨率动态调整
- **物理优化**: Arcade 物理，圆形碰撞体

## 操作说明

### PC端
- `W/A/S/D` 或 `方向键`: 移动
- `鼠标`: 瞄准（自动攻击最近敌人）
- `ESC`: 暂停
- `空格`: 攻击（备用）

### 移动端
- 左侧虚拟摇杆: 移动
- 自动攻击最近敌人

## 开发指南

### 添加新武器
1. 在 `src/data/weapons.ts` 中添加武器配置
2. 在 `src/entities/Weapon.ts` 的 `loadDefaultWeapons` 中注册
3. 在 `src/data/upgrades.ts` 中添加对应的升级选项

### 添加新敌人
1. 在 `src/data/enemies.ts` 中添加敌人配置
2. 在 `src/entities/Enemy.ts` 中添加对应的 AI 行为（如需要）
3. 在 `src/systems/WaveManager.ts` 的 `buildSpawnTable` 中配置出现波次

### 添加新场景
1. 在 `src/scenes/` 下创建场景类，继承 `Phaser.Scene`
2. 在 `src/main.ts` 的 `scene` 数组中注册

## 素材说明

当前项目为框架代码，素材目录为空占位。实际开发时需要：
1. 将图片素材放入 `public/assets/images/` 对应子目录
2. 将音频素材放入 `public/assets/audio/`
3. 在 `src/scenes/PreloadScene.ts` 中确认资源 key 与文件名对应

缺失素材不会导致游戏崩溃，会在控制台输出警告。

## 后续扩展建议

- [ ] 账号登录系统（后端 API）
- [ ] 云端存档同步
- [ ] 更多武器和敌人类型
- [ ] 成就系统
- [ ] 每日挑战模式
- [ ] 排行榜
- [ ] 音效和背景音乐
- [ ] 粒子特效优化
- [ ] 新手教程

## License

MIT
