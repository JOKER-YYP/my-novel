<template>
  <view class="page">
    <view v-if="book" class="header">
      <view class="title">{{ book.title }}</view>
      <view class="meta">{{ book.author }}</view>
      <view v-if="progressHint" class="progress">{{ progressHint }}</view>
      <view v-if="book.intro" class="intro">{{ book.intro }}</view>
      <view class="actions">
        <view class="btn primary" @click="startRead">{{ hasProgress ? '继续阅读' : '开始阅读' }}</view>
        <view class="btn" @click="startListen">{{ hasProgress ? '继续听书' : '听书' }}</view>
        <view class="btn" @click="toggleShelf">{{ inShelf ? '移出书架' : '加入书架' }}</view>
      </view>
    </view>

    <view class="section-title">目录</view>
    <view v-if="loading" class="tip">加载中…</view>
    <view
      v-for="(c, i) in chapters"
      :key="c.id"
      class="chapter"
      :class="{ current: progress?.chapterId === c.id }"
      @click="openChapter(i)"
    >
      {{ c.title }}
    </view>

    <MiniPlayer />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import MiniPlayer from '../../components/MiniPlayer.vue'
import { getBookDetail, getChapters } from '../../services/book'
import { askListenStartChapter } from '../../services/listen'
import type { BookItem, ChapterItem } from '../../sources/types'
import {
  formatProgressLine,
  formatRelativeTime,
  useBookshelfStore,
  type ProgressRecord,
} from '../../stores/bookshelf'
import { usePlayerStore } from '../../stores/player'

const book = ref<BookItem | null>(null)
const chapters = ref<ChapterItem[]>([])
const loading = ref(false)
const progress = ref<ProgressRecord | null>(null)
const shelf = useBookshelfStore()
const player = usePlayerStore()

const inShelf = computed(() => (book.value ? shelf.isInShelf(book.value.id) : false))
const hasProgress = computed(() => Boolean(progress.value?.chapterId || (progress.value?.chapterIndex ?? -1) >= 0))
const progressHint = computed(() => {
  const line = formatProgressLine(progress.value)
  if (!line) return ''
  const time = formatRelativeTime(progress.value?.updatedAt)
  return time ? `${line} · ${time}` : line
})

function refreshProgress() {
  if (!book.value) return
  progress.value = shelf.getProgress(book.value.id)
}

onLoad(async (query) => {
  const id = decodeURIComponent(String(query?.id || ''))
  if (!id) return
  loading.value = true
  try {
    book.value = await getBookDetail(id)
    shelf.touchHistory(book.value)
    refreshProgress()
    chapters.value = await getChapters(id)
  } catch (e) {
    uni.showToast({
      title: e instanceof Error ? e.message : '加载失败',
      icon: 'none',
    })
  } finally {
    loading.value = false
  }
})

onShow(() => {
  refreshProgress()
})

function toggleShelf() {
  if (!book.value) return
  if (inShelf.value) {
    shelf.remove(book.value.id)
    uni.showToast({ title: '已移出书架', icon: 'none' })
  } else {
    shelf.add(book.value)
    uni.showToast({ title: '已加入书架', icon: 'none' })
  }
}

function resolveStartIndex(target: BookItem, chapterList: ChapterItem[]) {
  const saved = shelf.getReadProgress(target.id) || shelf.getProgress(target.id)
  if (saved?.chapterId) {
    const found = chapterList.findIndex((c) => c.id === saved.chapterId)
    if (found >= 0) return found
  }
  if (typeof saved?.chapterIndex === 'number' && saved.chapterIndex >= 0) {
    return saved.chapterIndex
  }
  return 0
}

async function startRead() {
  if (!book.value) return
  const list = chapters.value.length ? chapters.value : await getChapters(book.value.id)
  chapters.value = list
  const i = resolveStartIndex(book.value, list)
  uni.navigateTo({
    url: `/pages/reader/index?bookId=${encodeURIComponent(book.value.id)}&chapterIndex=${i}`,
  })
}

function openChapter(index: number) {
  if (!book.value) return
  uni.navigateTo({
    url: `/pages/reader/index?bookId=${encodeURIComponent(book.value.id)}&chapterIndex=${index}`,
  })
}

async function startListen() {
  if (!book.value) return
  try {
    const list = chapters.value.length ? chapters.value : await getChapters(book.value.id)
    chapters.value = list
    const currentIdx = resolveStartIndex(book.value, list)
    const choice = await askListenStartChapter({
      book: book.value,
      currentChapterIndex: currentIdx,
    })
    if (!choice) return
    await player.openBook(book.value, choice.chapterIndex, {
      source: choice.source,
      autoPlay: true,
      resumeProgress: choice.resumeListen,
      panelOpen: false,
    })
    uni.navigateTo({ url: '/pages/player/index' })
  } catch (e) {
    uni.showToast({
      title: e instanceof Error ? e.message.slice(0, 40) : '听书失败',
      icon: 'none',
      duration: 3000,
    })
  }
}
</script>

<style scoped>
.page {
  padding: 28rpx 28rpx 180rpx;
}
.title {
  font-size: 44rpx;
  font-weight: 700;
  margin-bottom: 8rpx;
}
.meta {
  color: #6e655a;
  font-size: 26rpx;
  margin-bottom: 8rpx;
}
.progress {
  color: #2f5d50;
  font-size: 24rpx;
  margin-bottom: 12rpx;
}
.intro {
  line-height: 1.6;
  font-size: 28rpx;
  margin-bottom: 24rpx;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 36rpx;
}
.btn {
  padding: 16rpx 28rpx;
  border: 1px solid #2f5d50;
  color: #2f5d50;
  font-size: 26rpx;
}
.btn.primary {
  background: #2f5d50;
  color: #f7f3eb;
}
.section-title {
  font-size: 30rpx;
  font-weight: 600;
  margin-bottom: 12rpx;
}
.tip {
  font-size: 24rpx;
  color: #6e655a;
  margin-bottom: 12rpx;
}
.chapter {
  padding: 22rpx 0;
  border-bottom: 1px solid #e7dfd2;
  font-size: 28rpx;
}
.chapter.current {
  color: #2f5d50;
  font-weight: 600;
}
</style>
