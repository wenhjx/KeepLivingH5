/**
 * 背景纹理配置（数据驱动，可扩展）
 *
 * 每一关对应一套背景纹理（bgId 默认 = 关卡 id），每套含 classic / pixel 双主题参数。
 * 以后新增区域只需：
 *   1. 在本文件追加一个 BackgroundConfig 条目（bgId = 新关卡 id）；
 *   2. 游戏逻辑不写死，GameScene.drawBackground 按当前关卡 id 自动查找。
 * 查找失败时回退到 meadow（草原）纹理，保证新区域即使忘记配背景也不会白屏。
 */
export interface BackgroundDetailStyle {
  /** 细节颜色（草丛/碎石/冰裂纹） */
  detailColor: number;
  /** 细节数量（越大越密） */
  detailCount: number;
  /** 细节长度范围 [min, max] */
  detailLen: [number, number];
  /** 细节透明度范围 [min, max] */
  detailAlpha: [number, number];
  /** 光点颜色 */
  sparkleColor: number;
  /** 光点透明度 */
  sparkleAlpha: number;
  /** 光点数量 */
  sparkleCount: number;
  /** 光点半径 */
  sparkleRadius: number;
}

export interface BackgroundClassicStyle {
  /** 大色块颜色池（柔和明暗） */
  patchColors: number[];
  /** 色块透明度范围 [min, max] */
  patchAlpha: [number, number];
  /** 色块网格单元尺寸（px） */
  patchSize: number;
  detail: BackgroundDetailStyle;
}

export interface BackgroundPixelStyle {
  /** 像素块颜色池 */
  patchColors: number[];
  /** 像素块尺寸（px） */
  cellSize: number;
  detail: BackgroundDetailStyle;
}

export interface BackgroundConfig {
  /** 背景 id（通常与关卡 id 一致：meadow/ruins/tundra...） */
  id: string;
  /** 展示名（调试/文档用） */
  name: string;
  /** 底色（铺满全图） */
  baseColor: number;
  /** 经典主题（柔和渐变风格） */
  classic: BackgroundClassicStyle;
  /** 像素主题（块状风格） */
  pixel: BackgroundPixelStyle;
}

/** 全部背景纹理注册表（key = 关卡 id） */
export const BACKGROUNDS: Record<string, BackgroundConfig> = {
  // ========== 草原：暗色霓虹草地（C 风格，夜晚新手村） ==========
  meadow: {
    id: 'meadow',
    name: '草原',
    baseColor: 0x0e1410,
    classic: {
      patchColors: [0x162318, 0x1a2a1c, 0x13201a, 0x18251b],
      patchAlpha: [0.5, 0.9],
      patchSize: 64,
      detail: {
        detailColor: 0x2f6b33,
        detailCount: 1100,
        detailLen: [4, 13],
        detailAlpha: [0.35, 0.85],
        sparkleColor: 0x8cffaa,
        sparkleAlpha: 0.5,
        sparkleCount: 90,
        sparkleRadius: 1.5,
      },
    },
    pixel: {
      patchColors: [0x1a2a1c, 0x141e16, 0x1f3322],
      cellSize: 32,
      detail: {
        detailColor: 0x2f6b33,
        detailCount: 420,
        detailLen: [4, 10],
        detailAlpha: [0.5, 1],
        sparkleColor: 0x8cffaa,
        sparkleAlpha: 0.6,
        sparkleCount: 36,
        sparkleRadius: 1.5,
      },
    },
  },

  // ========== 废墟：暗色碎石地（灰褐 + 暗红余烬光点） ==========
  ruins: {
    id: 'ruins',
    name: '废墟',
    baseColor: 0x141110,
    classic: {
      patchColors: [0x241c16, 0x1e1814, 0x2a2118, 0x1a1612],
      patchAlpha: [0.5, 0.9],
      patchSize: 64,
      detail: {
        detailColor: 0x4a3c2c,
        detailCount: 1000,
        detailLen: [3, 10],
        detailAlpha: [0.3, 0.7],
        sparkleColor: 0xff8c5a,
        sparkleAlpha: 0.35,
        sparkleCount: 70,
        sparkleRadius: 1.4,
      },
    },
    pixel: {
      patchColors: [0x241c16, 0x1c1712, 0x2a2118],
      cellSize: 32,
      detail: {
        detailColor: 0x4a3c2c,
        detailCount: 380,
        detailLen: [3, 8],
        detailAlpha: [0.4, 0.8],
        sparkleColor: 0xff8c5a,
        sparkleAlpha: 0.45,
        sparkleCount: 30,
        sparkleRadius: 1.4,
      },
    },
  },

  // ========== 冰原：深蓝冰面（冰裂纹 + 蓝白光点） ==========
  tundra: {
    id: 'tundra',
    name: '冰原',
    baseColor: 0x0e141c,
    classic: {
      patchColors: [0x141f2b, 0x101a24, 0x182636, 0x12202e],
      patchAlpha: [0.5, 0.9],
      patchSize: 64,
      detail: {
        detailColor: 0x3d5a6e,
        detailCount: 900,
        detailLen: [5, 16],
        detailAlpha: [0.3, 0.65],
        sparkleColor: 0xa0dcff,
        sparkleAlpha: 0.5,
        sparkleCount: 80,
        sparkleRadius: 1.5,
      },
    },
    pixel: {
      patchColors: [0x141f2b, 0x101a24, 0x182636],
      cellSize: 32,
      detail: {
        detailColor: 0x3d5a6e,
        detailCount: 340,
        detailLen: [4, 12],
        detailAlpha: [0.4, 0.75],
        sparkleColor: 0xa0dcff,
        sparkleAlpha: 0.6,
        sparkleCount: 32,
        sparkleRadius: 1.5,
      },
    },
  },
};

/** 按关卡 id 取背景配置（缺失回退草原，保证新区域不白屏） */
export const getBackgroundByLevelId = (levelId: string): BackgroundConfig =>
  BACKGROUNDS[levelId] ?? BACKGROUNDS.meadow;
