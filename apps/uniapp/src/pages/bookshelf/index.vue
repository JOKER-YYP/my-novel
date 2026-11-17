<template>
  <view class="page">
    <view class="section-head">
      <view class="section-title">书架</view>
      <view v-if="shelf.books.length" class="section-count">{{ shelf.books.length }} 本</view>
    </view>

    <view v-if="!shelf.books.length" class="tip">书架空空如也，去详情页点「加入书架」</view>
    <view v-for="book in shelf.books" :key="book.id" class="row">
      <view class="main" @click="goDetail(book.id)">
        <view class="title">{{ book.title }}</view>
        <view class="meta">{{ book.author }} · {{ sourceName(book.source) }}</view>
        <view v-if="progressText(book.id)" class="progress">{{ progressText(book.id) }}</view>
      </view>
      <view class="ops">
        <view class="op primary" @click.stop="continueRead(book)">续读</view>
        <view class="op" @click.stop="continueListen(book)">续听</view>
        <view class="op danger" @click.stop="removeBook(book)">移出</view>
      </view>
    </view>

    <view class="section-head">
      <view class="section-title">最近</view>
      <view v-if="shelf.history.length" class="link" @click="clearHistory">清空</view>
    </view>

    <view v-if="!shelf.history.length" class="tip">阅读或听书后会出现在这里</view>
    <view v-for="book in shelf.history" :key="'h-' + book.id" class="row">
      <view class="main" @click="goDetail(book.id)">
        <view class="title">{{ book.title }}</view>
        <view class="meta">{{ book.author }} · {{ sourceName(book.source) }}</view>
        <view v-if="progressText(book.id)" class="progress">{{ progressText(book.id) }}</view>
      </view>
      <view class="ops">
        <view class="op primary" @click.stop="continueRead(book)">续读</view>
        <view class="op" @click.stop="continueListen(book)">续听</view>
        <view
          v-if="!shelf.isInShelf(book.id)"
          class="op"
          @click.stop="addToShelf(book)"
        >
          加书架
        </view>
      </view>
    </view>

    <MiniPlayer />
  </view>
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import MiniPlayer from '../../components/MiniPlayer.vue'
import { askListenStartChapter } from '../../services/listen'
import { getSourceById } from '../../sources/registry'
import type { BookItem } from '../../sources/types'
import {
  formatProgressLine,
  formatRelativeTime,
  useBookshelfStore,
  type ProgressRecord,
} from '../../stores/bookshelf'
import { usePlayerStore } from '../../stores/player'

const shelf = useBookshelfStore()
const player = usePlayerStore()
const progressMap = ref<Record<string, ProgressRecord | null>>({})

function refreshProgress() {
  const ids = new Set([...shelf.books, ...shelf.history].map((b) => b.id))
  const next: Record<string, ProgressRecord | null> = {}
  ids.forEach((id) => {
    next[id] = shelf.getProgress(id)
  })
  progressMap.value = next
}

onShow(() => {
  refreshProgress()
})

function sourceName(source: string) {
  return getSourceById(source)?.name || source
}

function progressText(bookId: string) {
  const p = progressMap.value[bookId]
  const line = formatProgressLine(p)
  if (!line) return ''
  const time = formatRelativeTime(p?.updatedAt)
  return time ? `${line} · ${time}` : line
}

function goDetail(id: string) {
  uni.navigateTo({ url: `/pages/book/detail?id=${encodeURIComponent(id)}` })
}

function continueRead(book: BookItem) {
  const p = shelf.getReadProgress(book.id) || shelf.getProgress(book.id)
  const idx = p?.chapterIndex ?? 0
  uni.navigateTo({
    url: `/pages/reader/index?bookId=${encodeURIComponent(book.id)}&chapterIndex=${idx}`,
  })
}

async function continueListen(book: BookItem) {
  try {
    uni.showLoading({ title: '准备听书…' })
    const read = shelf.getReadProgress(book.id)
    const choice = await askListenStartChapter({
      book,
      currentChapterIndex: read?.chapterIndex ?? 0,
    })
    if (!choice) {
      uni.hideLoading()
      return
    }
    await player.openBook(book, choice.chapterIndex, {
      source: choice.source,
      autoPlay: true,
      resumeProgress: choice.resumeListen,
    })
    uni.hideLoading()
    uni.navigateTo({ url: '/pages/player/index' })
  } catch (e) {
    uni.hideLoading()
    uni.showToast({
      title: e instanceof Error ? e.message.slice(0, 40) : '听书失败',
      icon: 'none',
    })
  }
}

function addToShelf(book: BookItem) {
  const ok = shelf.add(book)
  uni.showToast({ title: ok ? '已加入书架' : '已在书架', icon: 'none' })
  refreshProgress()
}

function removeBook(book: BookItem) {
  uni.showModal({
    title: '移出书架',
    content: `确定移出「${book.title}」？`,
    success: (res) => {
      if (!res.confirm) return
      shelf.remove(book.id)
      refreshProgress()
    },
  })
}

function clearHistory() {
  uni.showModal({
    title: '清空最近',
    content: '只清空最近记录，不影响书架与阅读进度。',
    success: (res) => {
      if (!res.confirm) return
      shelf.clearHistory()
      refreshProgress()
    },
  })
}
</script>

<style scoped>
.page {
  padding: 28rpx 28rpx 180rpx;
}
.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 12rpx 0 16rpx;
}
.section-title {
  font-size: 32rpx;
  font-weight: 600;
}
.section-count,
.link {
  font-size: 24rpx;
  color: #6e655a;
}
.link {
  color: #2f5d50;
}
.tip {
  color: #6e655a;
  font-size: 26rpx;
  margin-bottom: 28rpx;
}
.row {
  display: flex;
  gap: 16rpx;
  padding: 22rpx 0;
  border-bottom: 1px solid #e7dfd2;
}
.main {
  flex: 1;
  min-width: 0;
}
.title {
  font-size: 32rpx;
  font-weight: 600;
  margin-bottom: 6rpx;
}
.meta {
  font-size: 24rpx;
  color: #6e655a;
  margin-bottom: 6rpx;
}
.progress {
  font-size: 24rpx;
  color: #2f5d50;
}
.ops {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  flex-shrink: 0;
}
.op {
  min-width: 108rpx;
  text-align: center;
  padding: 10rpx 16rpx;
  border: 1px solid #d9d0c2;
  font-size: 22rpx;
  color: #2f5d50;
}
.op.primary {
  background: #2f5d50;
  border-color: #2f5d50;
  color: #f7f3eb;
}
.op.danger {
  color: #a15c38;
  border-color: #e2c4b4;
}
</style>
