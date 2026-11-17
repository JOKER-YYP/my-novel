/** 番茄小说风格阅读主题 */
export type ReaderThemeId = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type ReaderFontFamily = 'hand' | 'yahei' | 'song' | 'kai'

export type PageTurnMode = 'curl' | 'cover' | 'slide' | 'scroll' | 'none'

export interface ReaderTheme {
  id: ReaderThemeId
  name: string
  page: string
  content: string
  text: string
  muted: string
  accent: string
  swatch: string
  /** 设置里背景缩略图色 */
  preview: string
  /** 是否显示竹叶水印 */
  bamboo?: boolean
  panel: string
}

export const READER_THEMES: ReaderTheme[] = [
  {
    id: 1,
    name: '羊皮纸',
    page: '#c8b896',
    content: 'transparent',
    text: '#2c2416',
    muted: '#8a7d6a',
    accent: '#c47a3a',
    swatch: '#f5f2ea',
    preview: '#c8b896',
    bamboo: true,
    panel: '#f3efe6',
  },
  {
    id: 2,
    name: '竹影',
    page: '#c6b697',
    content: 'transparent',
    text: '#2a2418',
    muted: '#8a7f6e',
    accent: '#c47a3a',
    swatch: '#ebe4d4',
    preview: 'linear-gradient(135deg,#c6b697 60%,#a89470 100%)',
    bamboo: true,
    panel: '#f3efe6',
  },
  {
    id: 3,
    name: '护眼绿',
    page: '#cfe0c8',
    content: 'transparent',
    text: '#2a3328',
    muted: '#6a7a66',
    accent: '#5a8a4a',
    swatch: '#dcead6',
    preview: '#cfe0c8',
    panel: '#eef5ea',
  },
  {
    id: 4,
    name: '淡青',
    page: '#d4e2e6',
    content: 'transparent',
    text: '#243036',
    muted: '#6a7a82',
    accent: '#4a7a8a',
    swatch: '#e2ecef',
    preview: '#d4e2e6',
    panel: '#eef4f6',
  },
  {
    id: 5,
    name: '纯白',
    page: '#f7f7f7',
    content: 'transparent',
    text: '#222222',
    muted: '#888888',
    accent: '#c47a3a',
    swatch: '#ffffff',
    preview: '#ffffff',
    panel: '#ffffff',
  },
  {
    id: 6,
    name: '深灰',
    page: '#2b2b2b',
    content: 'transparent',
    text: '#bdbdbd',
    muted: '#888888',
    accent: '#c47a3a',
    swatch: '#3a3a3a',
    preview: '#2b2b2b',
    panel: '#1f1f1f',
  },
  {
    id: 7,
    name: '夜间',
    page: '#121212',
    content: 'transparent',
    text: '#9a9a9a',
    muted: '#6a6a6a',
    accent: '#c47a3a',
    swatch: '#1a1a1a',
    preview: '#121212',
    panel: '#1a1a1a',
  },
]

/** 设置面板「颜色」圆点（正文色） */
export const TEXT_COLOR_SWATCHES = [
  '#222222',
  '#3a342c',
  '#2f4a2f',
  '#2a3a4a',
  '#111111',
  '#666666',
  '#4a3a2a',
]

export function getReaderTheme(id: number): ReaderTheme {
  return READER_THEMES.find((t) => t.id === id) || READER_THEMES[1]!
}

export function fontFamilyCss(family: ReaderFontFamily): string {
  if (family === 'hand' || family === 'kai') {
    return 'Kaiti SC, STKaiti, KaiTi, "AR PL UKai CN", serif'
  }
  if (family === 'song') return 'Songti SC, STSong, SimSun, serif'
  return 'PingFang SC, Microsoft YaHei, sans-serif'
}

export function fontFamilyLabel(family: ReaderFontFamily): string {
  if (family === 'hand') return '手写楷体'
  if (family === 'kai') return '楷体'
  if (family === 'song') return '宋体'
  return '雅黑'
}

export const PAGE_TURN_OPTIONS: { id: PageTurnMode; label: string }[] = [
  { id: 'curl', label: '仿真' },
  { id: 'cover', label: '覆盖' },
  { id: 'slide', label: '平移' },
  { id: 'scroll', label: '上下' },
  { id: 'none', label: '无动画' },
]
