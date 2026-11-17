<template>
  <view class="page" :style="pageStyle" @click="onPageTap">
    <!-- 竹叶水印 -->
    <view v-if="theme.bamboo" class="bamboo" aria-hidden="true">
      <view class="bamboo-stem" />
      <view class="bamboo-leaf l1" />
      <view class="bamboo-leaf l2" />
      <view class="bamboo-leaf l3" />
    </view>

    <!-- 沉浸顶栏 -->
    <view class="immersive-top" :style="{ color: theme.muted }">
      <view class="it-left" @click.stop="goBack">
        <text class="chev">‹</text>
        <text class="it-title">{{ chapterTitle }}</text>
      </view>
    </view>

    <scroll-view
      scroll-y
      class="body"
      :scroll-into-view="scrollInto"
      :scroll-with-animation="pageTurn === 'scroll'"
      @scroll="onScroll"
      @click.stop="onBodyClick"
    >
      <view class="status-pad" />
      <view v-if="loading" class="tip">加载正文…</view>
      <view v-else-if="error" class="tip err">{{ error }}</view>
      <view v-else id="top" class="article">
        <view
          v-for="(p, i) in paragraphs"
          :id="'p-' + i"
          :key="i"
          class="para"
          :style="paraStyle"
        >
          <text
            v-for="(seg, si) in splitPara(p)"
            :key="si"
            class="seg"
            :class="{ hl: isHighlight(seg) }"
          >{{ seg }}</text>
          <text v-if="bubbleOf(i)" class="bubble">{{ bubbleOf(i) }}</text>
        </view>

        <view class="chapter-end">
          <view class="ce-btn" @click.stop="prevChapter">上一章</view>
          <view class="ce-btn" @click.stop="nextChapter">下一章</view>
        </view>
      </view>
      <view class="footer-space" />
    </scroll-view>

    <!-- 沉浸底栏：进度 / 时间 -->
    <view class="immersive-bottom" :style="{ color: theme.muted }">
      <text>{{ readProgressLabel }}</text>
      <text>{{ clock }}</text>
    </view>

    <!-- 听书中：底部胶囊 -->
    <view
      v-if="player.panelOpen || (player.playing && player.book?.id === book?.id)"
      class="listen-pill"
      @click.stop="toggleListen"
    >
      <text class="pill-ico">{{ player.playing ? '❚❚' : '▶' }}</text>
      <text>{{ player.playing ? '暂停播放' : '继续播放' }}</text>
    </view>

    <!-- 未听书：听 FAB -->
    <view
      v-else
      class="listen-fab"
      @click.stop="openListen"
    >听</view>

    <!-- ===== 菜单展开：顶栏 ===== -->
    <view v-if="chromeOpen" class="chrome-mask" @click="closeAllPanels" />
    <view v-if="chromeOpen" class="top-chrome" :style="panelStyle" @click.stop>
      <view class="tc-row">
        <text class="chev" @click="goBack">‹</text>
        <text class="tc-shelf" @click="toggleShelf">{{ inShelf ? '已加书架' : '加入书架' }}</text>
        <view class="tc-icons">
          <text class="tc-ico" @click="goDetail">◎</text>
          <text class="tc-ico" @click="openCatalog">≡</text>
          <text class="tc-ico" @click="toastSoon">⌕</text>
          <text class="tc-ico" @click="openSetup">⋯</text>
        </view>
      </view>
    </view>

    <!-- ===== 底栏控制 ===== -->
    <view v-if="chromeOpen && !setupOpen && !catalogOpen" class="bottom-chrome" :style="panelStyle" @click.stop>
      <view class="nav-row">
        <text class="nav-link" @click="prevChapter">上一章</text>
        <slider
          class="nav-slider"
          :min="0"
          :max="Math.max(chapters.length - 1, 0)"
          :value="chapterIndex"
          activeColor="#5a5348"
          backgroundColor="#d8d0c2"
          block-size="16"
          @change="onSliderChange"
        />
        <text class="nav-link" @click="nextChapter">下一章</text>
      </view>
      <view class="tab-row">
        <view class="tab" @click="openCatalog">
          <text class="tab-ico">☰</text>
          <text>目录</text>
        </view>
        <view class="tab" @click="toggleNight">
          <text class="tab-ico">☾</text>
          <text>{{ themeId >= 6 ? '日间' : '夜间' }}</text>
        </view>
        <view class="tab on" @click="openSetup">
          <text class="tab-ico">⬡</text>
          <text>设置</text>
        </view>
        <view class="tab" @click="openListen">
          <text class="tab-ico">▶</text>
          <text>听书</text>
        </view>
      </view>
    </view>

    <!-- ===== 设置面板（番茄样式） ===== -->
    <view v-if="setupOpen" class="sheet" :style="panelStyle" @click.stop>
      <view class="sheet-handle" />
      <view class="set-row">
        <text class="set-lab">亮度</text>
        <slider class="flex1" :value="brightness" min="0" max="100" activeColor="#5a5348" @changing="onBright" />
        <view class="eye" :class="{ on: eyeCare }" @click="toggleEye">
          <text>👁 护眼</text>
        </view>
      </view>
      <view class="set-row">
        <text class="set-lab">字号</text>
        <view class="size-box">
          <text class="sz" @click="smaller">A-</text>
          <text class="sz-val">{{ fontSize }}</text>
          <text class="sz" @click="bigger">A+</text>
        </view>
        <view class="font-pill" @click="cycleFont">
          {{ fontFamilyLabel(fontFamily) }} ›
        </view>
      </view>
      <view class="set-row col">
        <text class="set-lab">颜色</text>
        <view class="swatches">
          <view
            v-for="(c, i) in TEXT_COLOR_SWATCHES"
            :key="i"
            class="swatch"
            :class="{ on: (textColor || theme.text) === c }"
            :style="{ background: c }"
            @click="setTextColor(c)"
          />
        </view>
      </view>
      <view class="set-row col">
        <text class="set-lab">背景</text>
        <scroll-view scroll-x class="bg-scroll">
          <view class="bg-row">
            <view
              v-for="t in READER_THEMES"
              :key="t.id"
              class="bg-card"
              :class="{ on: themeId === t.id }"
              :style="{ background: t.preview }"
              @click="setTheme(t.id)"
            >
              <text v-if="t.bamboo" class="bg-mark">竹</text>
            </view>
          </view>
        </scroll-view>
      </view>
      <view class="set-row col">
        <text class="set-lab">翻页</text>
        <view class="turn-row">
          <view
            v-for="opt in PAGE_TURN_OPTIONS"
            :key="opt.id"
            class="turn"
            :class="{ on: pageTurn === opt.id }"
            @click="setPageTurn(opt.id)"
          >{{ opt.label }}</view>
        </view>
      </view>
      <view class="set-row">
        <view class="more-btn" @click="toastSoon">间距设置</view>
        <view class="more-btn" @click="toastSoon">评论设置</view>
        <view class="more-btn" @click="toastSoon">更多 ›</view>
      </view>
      <view class="auto-read" @click="openListen">开启听书朗读 ▷</view>
      <view class="tab-row sheet-tabs">
        <view class="tab" @click="openCatalog"><text class="tab-ico">☰</text><text>目录</text></view>
        <view class="tab" @click="toggleNight"><text class="tab-ico">☾</text><text>夜间</text></view>
        <view class="tab on"><text class="tab-ico">⬡</text><text>设置</text></view>
        <view class="tab" @click="openListen"><text class="tab-ico">▶</text><text>听书</text></view>
      </view>
    </view>

    <!-- ===== 目录抽屉 ===== -->
    <view v-if="catalogOpen" class="catalog" :style="panelStyle" @click.stop>
      <view class="cat-search">⌕ 搜全文</view>
      <view class="cat-book" @click="goDetail">
        <image v-if="book?.cover" class="cat-cover" :src="book.cover" mode="aspectFill" />
        <view v-else class="cat-cover ph" />
        <view class="cat-meta">
          <view class="cat-title">{{ book?.title }}</view>
          <view class="cat-author">{{ book?.author }}</view>
          <text class="cat-detail">详情 ›</text>
        </view>
      </view>
      <view class="cat-tabs">
        <text class="on">目录</text>
        <text @click="goDetail">详情</text>
        <text @click="toastSoon">笔记</text>
      </view>
      <view class="cat-tools">
        <text>共 {{ chapters.length }} 章</text>
        <text @click="catalogReverse = !catalogReverse">{{ catalogReverse ? '正序' : '倒序' }}</text>
      </view>
      <scroll-view scroll-y class="cat-list" :scroll-into-view="'c-' + chapterIndex">
        <view
          v-for="item in catalogList"
          :id="'c-' + item.index"
          :key="item.chapter.id"
          class="cat-item"
          :class="{ cur: item.index === chapterIndex }"
          @click="jumpChapter(item.index)"
        >
          <view class="cat-item-title">
            <text v-if="item.index === chapterIndex" class="cur-mark">◆</text>
            {{ item.chapter.title }}
          </view>
          <view class="cat-item-sub">
            <text v-if="item.index === chapterIndex">读到本章</text>
            <text v-else>第 {{ item.index + 1 }} 章</text>
          </view>
        </view>
      </scroll-view>
      <view class="tab-row sheet-tabs">
        <view class="tab on"><text class="tab-ico">☰</text><text>目录</text></view>
        <view class="tab" @click="toggleNight"><text class="tab-ico">☾</text><text>夜间</text></view>
        <view class="tab" @click="openSetup"><text class="tab-ico">⬡</text><text>设置</text></view>
        <view class="tab" @click="openListen"><text class="tab-ico">▶</text><text>听书</text></view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { getBookDetail, getChapters, getContent } from '../../services/book'
import { askListenStartChapter } from '../../services/listen'
import { isDirectlyReadable, resolveReadableBook } from '../../services/readable'
import {
  PAGE_TURN_OPTIONS,
  READER_THEMES,
  TEXT_COLOR_SWATCHES,
  fontFamilyCss,
  fontFamilyLabel,
  getReaderTheme,
  type PageTurnMode,
  type ReaderFontFamily,
  type ReaderThemeId,
} from '../../services/reader/themes'
import type { BookItem, ChapterItem } from '../../sources/types'
import { getSourceById } from '../../sources/registry'
import { useBookshelfStore } from '../../stores/bookshelf'
import { usePlayerStore } from '../../stores/player'
import { useSettingsStore } from '../../stores/settings'
import { loadJson } from '../../utils/storage'

const settings = useSettingsStore()
const shelf = useBookshelfStore()
const player = usePlayerStore()

const book = ref<BookItem | null>(null)
const chapters = ref<ChapterItem[]>([])
const chapterIndex = ref(0)
const content = ref('')
const loading = ref(false)
const error = ref('')
const chromeOpen = ref(false)
const setupOpen = ref(false)
const catalogOpen = ref(false)
const catalogReverse = ref(false)
const scrollInto = ref('')
const scrollTopRatio = ref(0)
const clock = ref('')
const brightness = ref(70)
let clockTimer = 0

const fontSize = ref(settings.readerFontSize || 20)
const fontFamily = ref<ReaderFontFamily>(settings.readerFontFamily || 'hand')
const themeId = ref<ReaderThemeId>((settings.readerTheme || 2) as ReaderThemeId)
const textColor = ref(settings.readerTextColor || '')
const lineHeight = ref(settings.readerLineHeight || 2.1)
const pageTurn = ref<PageTurnMode>(settings.readerPageTurn || 'scroll')
const eyeCare = ref(!!settings.readerEyeCare)
const followSyncing = ref(false)

const theme = computed(() => getReaderTheme(themeId.value))
const chapterTitle = computed(() => chapters.value[chapterIndex.value]?.title || '')
const inShelf = computed(() => (book.value ? shelf.isInShelf(book.value.id) : false))
const wordCount = computed(() => content.value.replace(/\s/g, '').length)
const readProgressLabel = computed(() => {
  const total = Math.max(wordCount.value, 1)
  const cur = Math.min(total, Math.max(1, Math.floor(total * scrollTopRatio.value) || 1))
  return `${cur}/${total}`
})

const paragraphs = computed(() => {
  const raw = content.value.replace(/\r/g, '')
  const parts = raw.split(/\n+/).map((s) => s.trim()).filter(Boolean)
  return parts.length ? parts : [raw.trim()].filter(Boolean)
})

const catalogList = computed(() => {
  const list = chapters.value.map((chapter, index) => ({ chapter, index }))
  return catalogReverse.value ? [...list].reverse() : list
})

const pageStyle = computed(() => ({
  background: eyeCare.value ? blendEye(theme.value.page) : theme.value.page,
  color: textColor.value || theme.value.text,
}))
const panelStyle = computed(() => ({
  background: theme.value.panel,
  color: theme.value.text,
}))
const paraStyle = computed(() => ({
  fontSize: fontSize.value + 'px',
  fontFamily: fontFamilyCss(fontFamily.value),
  color: textColor.value || theme.value.text,
  lineHeight: String(lineHeight.value),
}))

function blendEye(hex: string) {
  return hex
}

function tickClock() {
  const d = new Date()
  clock.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function persistPrefs() {
  settings.patch({
    readerFontSize: fontSize.value,
    readerFontFamily: fontFamily.value,
    readerTheme: themeId.value,
    readerNight: themeId.value >= 6,
    readerTextColor: textColor.value,
    readerLineHeight: lineHeight.value,
    readerPageTurn: pageTurn.value,
    readerEyeCare: eyeCare.value,
  })
}

function bubbleOf(i: number) {
  // 装饰性段评气泡（无真实评论源时用稳定伪数）
  const n = (i * 7 + (book.value?.title.length || 0)) % 11
  return n === 0 || n === 3 || n === 7 ? String((n % 5) + 1) : ''
}

function splitPara(p: string) {
  return p.split(/(?<=[。！？；!?;])/).filter(Boolean)
}

function isHighlight(seg: string) {
  const cur = player.currentChunkText?.trim()
  if (!cur) return false
  if (!player.playing && !player.panelOpen) return false
  if (player.book?.id !== book.value?.id) return false
  return seg.includes(cur) || cur.includes(seg.trim())
}

function toastSoon() {
  uni.showToast({ title: '暂未开放', icon: 'none' })
}

function closeAllPanels() {
  chromeOpen.value = false
  setupOpen.value = false
  catalogOpen.value = false
}

function onPageTap() {
  /* 外层兜底 */
}

function onBodyClick() {
  if (setupOpen.value || catalogOpen.value) return
  chromeOpen.value = !chromeOpen.value
}

function onScroll(e: { detail?: { scrollTop?: number; scrollHeight?: number } }) {
  const top = e.detail?.scrollTop || 0
  const h = e.detail?.scrollHeight || 1
  scrollTopRatio.value = Math.min(1, top / Math.max(1, h * 0.7))
}

function goBack() {
  uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/bookshelf/index' }) })
}

function goDetail() {
  if (!book.value) return
  uni.navigateTo({ url: `/pages/book/detail?id=${encodeURIComponent(book.value.id)}` })
}

function openCatalog() {
  setupOpen.value = false
  chromeOpen.value = true
  catalogOpen.value = true
}

function openSetup() {
  catalogOpen.value = false
  chromeOpen.value = true
  setupOpen.value = true
}

function setTheme(id: ReaderThemeId) {
  themeId.value = id
  persistPrefs()
}

function setTextColor(c: string) {
  textColor.value = c
  persistPrefs()
}

function setPageTurn(m: PageTurnMode) {
  pageTurn.value = m
  persistPrefs()
  if (m !== 'scroll') {
    uni.showToast({ title: '当前仅支持上下滚动', icon: 'none' })
    pageTurn.value = 'scroll'
    persistPrefs()
  }
}

function cycleFont() {
  const order: ReaderFontFamily[] = ['hand', 'kai', 'song', 'yahei']
  const i = order.indexOf(fontFamily.value)
  fontFamily.value = order[(i + 1) % order.length]!
  persistPrefs()
}

function smaller() {
  fontSize.value = Math.max(14, fontSize.value - 1)
  persistPrefs()
}
function bigger() {
  fontSize.value = Math.min(36, fontSize.value + 1)
  persistPrefs()
}

function toggleEye() {
  eyeCare.value = !eyeCare.value
  persistPrefs()
}

function onBright(e: { detail: { value: number } }) {
  brightness.value = Number(e.detail.value)
  // 小程序无法直接改系统亮度，仅做视觉提示
}

function toggleNight() {
  if (themeId.value >= 6) setTheme(2)
  else setTheme(7)
}

function toggleShelf() {
  if (!book.value) return
  if (inShelf.value) {
    shelf.remove(book.value.id)
    uni.showToast({ title: '已移出书架', icon: 'none' })
  } else {
    shelf.add(book.value)
    uni.showToast({ title: '已加书架', icon: 'none' })
  }
}

function onSliderChange(e: { detail: { value: number } }) {
  jumpChapter(Number(e.detail.value))
}

function jumpChapter(index: number) {
  catalogOpen.value = false
  chromeOpen.value = false
  loadChapter(index)
}

async function loadChapter(index: number, opts?: { fromListen?: boolean }) {
  if (!book.value || !chapters.value.length) return
  chapterIndex.value = Math.min(Math.max(index, 0), chapters.value.length - 1)
  const chapter = chapters.value[chapterIndex.value]
  if (!chapter) return
  loading.value = true
  error.value = ''
  content.value = ''
  try {
    content.value = await getContent(chapter.id)
    afterContentLoaded(chapter)
    if (
      !opts?.fromListen &&
      settings.listenFollowReader &&
      player.panelOpen &&
      player.book?.id === book.value.id
    ) {
      followSyncing.value = true
      try {
        await player.syncFromReader(chapterIndex.value)
      } finally {
        followSyncing.value = false
      }
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '正文加载失败'
  } finally {
    loading.value = false
  }
}

function afterContentLoaded(chapter: ChapterItem) {
  if (!book.value) return
  shelf.touchHistory(book.value)
  shelf.saveReadProgress({
    bookId: book.value.id,
    chapterId: chapter.id,
    chapterIndex: chapterIndex.value,
    chapterTitle: chapter.title,
    updatedAt: Date.now(),
  })
  scrollInto.value = ''
  setTimeout(() => {
    scrollInto.value = 'top'
  }, 30)
}

watch(
  () => player.chapterIndex,
  (idx) => {
    if (followSyncing.value) return
    if (!settings.listenFollowReader) return
    if (!player.panelOpen && !player.playing) return
    if (!book.value || player.book?.id !== book.value.id) return
    if (idx === chapterIndex.value) return
    followSyncing.value = true
    loadChapter(idx, { fromListen: true }).then(
      () => {
        followSyncing.value = false
      },
      () => {
        followSyncing.value = false
      },
    )
  },
)

onLoad(async (query) => {
  tickClock()
  clockTimer = setInterval(tickClock, 30_000) as unknown as number

  let bookId = decodeURIComponent(String(query?.bookId || ''))
  const idxFromQuery = Number(query?.chapterIndex ?? -1)
  const openListenFlag = String(query?.listen || '') === '1'
  if (!bookId) {
    error.value = '缺少书籍参数'
    return
  }
  try {
    let opened = await getBookDetail(bookId)
    if (!isDirectlyReadable(opened.source)) {
      uni.showLoading({ title: '匹配可读源…' })
      try {
        opened = await resolveReadableBook(opened)
        bookId = opened.id
        uni.showToast({
          title: `已转到${getSourceById(opened.source)?.name || '可读源'}`,
          icon: 'none',
        })
      } finally {
        uni.hideLoading()
      }
    }
    book.value = opened
    chapters.value = await getChapters(bookId)
    let start = 0
    if (!Number.isNaN(idxFromQuery) && idxFromQuery >= 0 && isDirectlyReadable(opened.source)) {
      start = idxFromQuery
    } else {
      const saved = shelf.getReadProgress(bookId)
      if (saved?.chapterId) {
        const found = chapters.value.findIndex((c) => c.id === saved.chapterId)
        if (found >= 0) start = found
      } else if (typeof saved?.chapterIndex === 'number') {
        start = saved.chapterIndex
      } else {
        const legacy = loadJson<{ chapterIndex?: number; chapterId?: string } | null>(
          `read:${bookId}`,
          null,
        )
        if (legacy?.chapterId) {
          const found = chapters.value.findIndex((c) => c.id === legacy.chapterId)
          if (found >= 0) start = found
        } else if (typeof legacy?.chapterIndex === 'number') {
          start = legacy.chapterIndex
        }
      }
    }
    await loadChapter(start, { fromListen: true })
    if (openListenFlag) await openListen()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '打开阅读失败'
  }
})

onUnload(() => {
  persistPrefs()
  if (clockTimer) clearInterval(clockTimer)
})

function prevChapter() {
  if (chapterIndex.value <= 0) {
    uni.showToast({ title: '已经是第一章了！', icon: 'none' })
    return
  }
  loadChapter(chapterIndex.value - 1)
}

function nextChapter() {
  if (chapterIndex.value >= chapters.value.length - 1) {
    uni.showToast({ title: '已经是最后一章了！', icon: 'none' })
    return
  }
  loadChapter(chapterIndex.value + 1)
}

function toggleListen() {
  if (player.playing) player.pause()
  else if (player.hasSession && player.book?.id === book.value?.id) player.resume()
  else void openListen()
}

async function openListen() {
  closeAllPanels()
  if (!book.value) return
  player.setPanelOpen(true)
  try {
    uni.showLoading({ title: '准备听书…' })
    const choice = await askListenStartChapter({
      book: book.value,
      currentChapterIndex: chapterIndex.value,
    })
    if (!choice) {
      uni.hideLoading()
      return
    }
    await player.openBook(book.value, choice.chapterIndex, {
      source: choice.source || 'system',
      autoPlay: true,
      resumeProgress: choice.resumeListen,
      panelOpen: true,
    })
    if (settings.listenFollowReader && choice.chapterIndex !== chapterIndex.value) {
      await loadChapter(choice.chapterIndex, { fromListen: true })
    }
    uni.hideLoading()
  } catch (e) {
    uni.hideLoading()
    uni.showToast({
      title: e instanceof Error ? e.message.slice(0, 40) : '听书失败',
      icon: 'none',
    })
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
}
.bamboo {
  pointer-events: none;
  position: absolute;
  right: 0;
  top: 80rpx;
  width: 280rpx;
  height: 420rpx;
  opacity: 0.18;
  z-index: 0;
}
.bamboo-stem {
  position: absolute;
  right: 90rpx;
  top: 40rpx;
  width: 10rpx;
  height: 320rpx;
  background: #5a4a32;
  border-radius: 8rpx;
  transform: rotate(12deg);
}
.bamboo-leaf {
  position: absolute;
  width: 90rpx;
  height: 28rpx;
  background: #5a4a32;
  border-radius: 50% 10% 50% 10%;
}
.bamboo-leaf.l1 { right: 40rpx; top: 90rpx; transform: rotate(-25deg); }
.bamboo-leaf.l2 { right: 120rpx; top: 150rpx; transform: rotate(35deg); }
.bamboo-leaf.l3 { right: 60rpx; top: 220rpx; transform: rotate(-10deg); width: 110rpx; }

.immersive-top {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  z-index: 5;
  padding: 88rpx 28rpx 12rpx;
  display: flex;
  justify-content: space-between;
  font-size: 24rpx;
}
.it-left {
  display: flex;
  align-items: center;
  gap: 8rpx;
  max-width: 75%;
}
.chev {
  font-size: 40rpx;
  line-height: 1;
  padding-right: 4rpx;
}
.it-title {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.body {
  position: relative;
  z-index: 1;
  height: 100vh;
  box-sizing: border-box;
}
.status-pad {
  height: 140rpx;
}
.article {
  padding: 8rpx 44rpx 40rpx;
}
.para {
  margin-bottom: 36rpx;
  text-indent: 2em;
  word-break: break-word;
}
.seg {
  white-space: pre-wrap;
}
.seg.hl {
  background: rgba(196, 122, 58, 0.35);
  border-radius: 6rpx;
}
.bubble {
  display: inline-block;
  margin-left: 10rpx;
  padding: 0 12rpx;
  min-width: 36rpx;
  height: 36rpx;
  line-height: 36rpx;
  text-align: center;
  font-size: 20rpx;
  color: #8a8174;
  background: rgba(0, 0, 0, 0.08);
  border-radius: 20rpx;
  text-indent: 0;
  vertical-align: middle;
}
.chapter-end {
  display: flex;
  gap: 24rpx;
  margin-top: 48rpx;
}
.ce-btn {
  flex: 1;
  text-align: center;
  padding: 22rpx 0;
  border: 1px solid rgba(0, 0, 0, 0.12);
  font-size: 28rpx;
  opacity: 0.75;
}
.tip {
  padding: 120rpx 40rpx;
  text-align: center;
  opacity: 0.7;
}
.tip.err {
  color: #a15c38;
}
.footer-space {
  height: 220rpx;
}

.immersive-bottom {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 5;
  display: flex;
  justify-content: space-between;
  padding: 12rpx 28rpx 28rpx;
  font-size: 22rpx;
}

.listen-fab {
  position: fixed;
  right: 36rpx;
  bottom: 160rpx;
  z-index: 20;
  width: 96rpx;
  height: 96rpx;
  line-height: 96rpx;
  text-align: center;
  border-radius: 50%;
  background: rgba(40, 34, 26, 0.88);
  color: #f5efe3;
  font-size: 34rpx;
  font-weight: 700;
}
.listen-pill {
  position: fixed;
  left: 50%;
  bottom: 120rpx;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 18rpx 40rpx;
  border-radius: 999rpx;
  background: rgba(40, 34, 26, 0.9);
  color: #f5efe3;
  font-size: 28rpx;
}
.pill-ico {
  font-size: 24rpx;
}

.chrome-mask {
  position: fixed;
  inset: 0;
  z-index: 30;
  background: rgba(0, 0, 0, 0.15);
}
.top-chrome {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  z-index: 32;
  padding: 88rpx 24rpx 20rpx;
}
.tc-row {
  display: flex;
  align-items: center;
}
.tc-shelf {
  flex: 1;
  text-align: center;
  font-size: 30rpx;
  font-weight: 600;
}
.tc-icons {
  display: flex;
  gap: 22rpx;
}
.tc-ico {
  font-size: 34rpx;
  opacity: 0.85;
}

.bottom-chrome {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 32;
  padding: 20rpx 24rpx 36rpx;
  border-radius: 24rpx 24rpx 0 0;
  box-shadow: 0 -8rpx 30rpx rgba(0, 0, 0, 0.08);
}
.nav-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 18rpx;
}
.nav-link {
  font-size: 26rpx;
  white-space: nowrap;
}
.nav-slider {
  flex: 1;
}
.tab-row {
  display: flex;
  justify-content: space-around;
  padding-top: 8rpx;
}
.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  font-size: 22rpx;
  opacity: 0.75;
  min-width: 100rpx;
}
.tab.on {
  opacity: 1;
  font-weight: 600;
  color: #c47a3a;
}
.tab-ico {
  font-size: 34rpx;
}

.sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 34;
  max-height: 78vh;
  padding: 12rpx 28rpx 20rpx;
  border-radius: 28rpx 28rpx 0 0;
  box-shadow: 0 -10rpx 36rpx rgba(0, 0, 0, 0.12);
  overflow-y: auto;
}
.sheet-handle {
  width: 64rpx;
  height: 8rpx;
  border-radius: 8rpx;
  background: rgba(0, 0, 0, 0.12);
  margin: 0 auto 20rpx;
}
.set-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 28rpx;
}
.set-row.col {
  flex-direction: column;
  align-items: flex-start;
}
.set-lab {
  font-size: 26rpx;
  opacity: 0.75;
  min-width: 72rpx;
}
.flex1 {
  flex: 1;
}
.eye {
  font-size: 22rpx;
  padding: 8rpx 14rpx;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8rpx;
  white-space: nowrap;
}
.eye.on {
  border-color: #c47a3a;
  color: #c47a3a;
}
.size-box {
  display: flex;
  align-items: center;
  gap: 18rpx;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 10rpx;
  padding: 8rpx 18rpx;
}
.sz {
  font-size: 28rpx;
  padding: 4rpx 10rpx;
}
.sz-val {
  min-width: 48rpx;
  text-align: center;
  font-size: 28rpx;
}
.font-pill {
  margin-left: auto;
  font-size: 24rpx;
  padding: 10rpx 18rpx;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 999rpx;
}
.swatches {
  display: flex;
  gap: 18rpx;
  flex-wrap: wrap;
}
.swatch {
  width: 52rpx;
  height: 52rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(0, 0, 0, 0.12);
}
.swatch.on {
  border: 4rpx solid #222;
}
.bg-scroll {
  width: 100%;
  white-space: nowrap;
}
.bg-row {
  display: inline-flex;
  gap: 16rpx;
}
.bg-card {
  width: 96rpx;
  height: 72rpx;
  border-radius: 10rpx;
  border: 2rpx solid transparent;
  position: relative;
  overflow: hidden;
}
.bg-card.on {
  border-color: #222;
}
.bg-mark {
  position: absolute;
  right: 8rpx;
  bottom: 4rpx;
  font-size: 20rpx;
  opacity: 0.45;
}
.turn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  width: 100%;
}
.turn {
  padding: 12rpx 22rpx;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 999rpx;
  font-size: 24rpx;
}
.turn.on {
  background: #2c2416;
  color: #f5efe3;
  border-color: #2c2416;
}
.more-btn {
  flex: 1;
  text-align: center;
  padding: 18rpx 0;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 12rpx;
  font-size: 24rpx;
}
.auto-read {
  text-align: center;
  font-size: 28rpx;
  margin: 8rpx 0 20rpx;
  opacity: 0.85;
}
.sheet-tabs {
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  padding-top: 16rpx;
}

.catalog {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  top: 12vh;
  z-index: 34;
  border-radius: 28rpx 28rpx 0 0;
  padding: 24rpx 0 0;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -10rpx 36rpx rgba(0, 0, 0, 0.12);
}
.cat-search {
  margin: 0 28rpx 20rpx;
  padding: 16rpx 24rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.06);
  font-size: 26rpx;
  opacity: 0.7;
}
.cat-book {
  display: flex;
  gap: 20rpx;
  padding: 0 28rpx 20rpx;
}
.cat-cover {
  width: 96rpx;
  height: 128rpx;
  border-radius: 8rpx;
  background: rgba(0, 0, 0, 0.08);
}
.cat-cover.ph {
  background: rgba(0, 0, 0, 0.1);
}
.cat-meta {
  flex: 1;
  min-width: 0;
}
.cat-title {
  font-size: 32rpx;
  font-weight: 700;
  margin-bottom: 8rpx;
}
.cat-author {
  font-size: 24rpx;
  opacity: 0.7;
  margin-bottom: 10rpx;
}
.cat-detail {
  font-size: 24rpx;
  color: #c47a3a;
}
.cat-tabs {
  display: flex;
  gap: 36rpx;
  padding: 0 28rpx 12rpx;
  font-size: 28rpx;
}
.cat-tabs .on {
  font-weight: 700;
  font-size: 32rpx;
}
.cat-tools {
  display: flex;
  justify-content: space-between;
  padding: 8rpx 28rpx 12rpx;
  font-size: 24rpx;
  opacity: 0.7;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.cat-list {
  flex: 1;
  height: 0;
  padding-bottom: 20rpx;
}
.cat-item {
  padding: 22rpx 28rpx;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}
.cat-item.cur .cat-item-title {
  color: #c47a3a;
  font-weight: 600;
}
.cat-item-title {
  font-size: 28rpx;
  margin-bottom: 8rpx;
}
.cur-mark {
  margin-right: 6rpx;
  font-size: 22rpx;
}
.cat-item-sub {
  font-size: 22rpx;
  opacity: 0.55;
}
</style>
