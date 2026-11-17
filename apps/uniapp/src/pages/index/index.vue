<template>
  <view class="page">
    <view class="brand">听书匣</view>
    <view class="search-row">
      <input
        v-model="keyword"
        class="input"
        confirm-type="search"
        placeholder="输入书名或作者"
        @confirm="onSearch"
      />
      <view class="search-btn" @click="onSearch">搜索</view>
    </view>

    <view v-if="loading" class="tip">搜索中…</view>
    <view v-if="error" class="warn">{{ error }}</view>

    <BookCard
      v-for="book in items"
      :key="book.id"
      :book="book"
      @click="goDetail(book.id)"
    />

    <view v-if="!loading && searched && !items.length && !error" class="tip">未找到书籍</view>
    <view class="hint">多源并行：红薯中文 · 布谷小说 · 800小说</view>
    <MiniPlayer />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import BookCard from '../../components/BookCard.vue'
import MiniPlayer from '../../components/MiniPlayer.vue'
import { searchBooks } from '../../services/search'
import type { BookItem } from '../../sources/types'

const keyword = ref('混沌天帝诀')
const items = ref<BookItem[]>([])
const error = ref('')
const loading = ref(false)
const searched = ref(false)

async function onSearch() {
  const q = keyword.value.trim()
  if (!q) {
    uni.showToast({ title: '请输入关键词', icon: 'none' })
    return
  }
  loading.value = true
  searched.value = true
  error.value = ''
  try {
    const result = await searchBooks(q)
    items.value = result.items
    if (result.errors.length) {
      const lines = result.errors.map((e) => `${e.source}: ${e.message}`)
      const domainFail = result.errors.every((e) => /合法域名|domain list/i.test(e.message))
      if (!result.items.length && domainFail) {
        error.value =
          '真机预览会校验合法域名（开发者工具的「不校验」无效）。\n请在手机上：右上角 ··· → 打开调试；或到公众平台配置 request 域名后重试。\n' +
          lines.join('\n')
      } else {
        error.value = lines.join('\n')
      }
    }
  } catch (e) {
    items.value = []
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function goDetail(id: string) {
  uni.navigateTo({ url: `/pages/book/detail?id=${encodeURIComponent(id)}` })
}
</script>

<style scoped>
.page {
  padding: 32rpx 28rpx 180rpx;
}
.brand {
  font-size: 52rpx;
  font-weight: 700;
  letter-spacing: 4rpx;
  color: #2f5d50;
  margin-bottom: 28rpx;
}
.search-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 28rpx;
}
.input {
  flex: 1;
  height: 72rpx;
  padding: 0 20rpx;
  background: #fffdf8;
  border: 1px solid #d9d0c2;
  font-size: 28rpx;
}
.search-btn {
  height: 72rpx;
  line-height: 72rpx;
  padding: 0 28rpx;
  background: #2f5d50;
  color: #f7f3eb;
  font-size: 28rpx;
  text-align: center;
}
.tip {
  color: #6e655a;
  font-size: 26rpx;
  margin-bottom: 16rpx;
}
.hint {
  color: #8a8174;
  font-size: 22rpx;
  margin-top: 16rpx;
  line-height: 1.4;
}
.warn {
  color: #a15c38;
  font-size: 24rpx;
  margin-bottom: 16rpx;
  line-height: 1.5;
  white-space: pre-wrap;
}
</style>
