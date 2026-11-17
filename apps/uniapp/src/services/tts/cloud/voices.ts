export interface BaiduVoice {
  per: number
  name: string
  library: '基础' | '精品' | '臻品'
}

/** 发音人列表可在设置页选择；取值以百度文档为准，可继续追加 */
export const BAIDU_VOICES: BaiduVoice[] = [
  { per: 0, name: '度小宇', library: '基础' },
  { per: 1, name: '度小美', library: '基础' },
  { per: 3, name: '度逍遥', library: '基础' },
  { per: 4, name: '度丫丫', library: '基础' },
  { per: 5, name: '度小娇', library: '精品' },
  { per: 103, name: '度米朵', library: '精品' },
  { per: 106, name: '度博文', library: '精品' },
  { per: 110, name: '度小童', library: '精品' },
  { per: 111, name: '度小萌', library: '精品' },
]
