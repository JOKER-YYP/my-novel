<template>
  <view class="page">
    <view class="brand">书城</view>
    <view class="sub">红薯中文榜单 / 分类</view>

    <scroll-view scroll-x class="tabs">
      <view
        v-for="t in rankTabs"
        :key="t.id"
        class="tab"
        :class="{ on: mode === 'rank' && rankType === t.type }"
        @click="loadRank(t.type)"
      >{{ t.title }}</view>
    </scroll-view>

    <view class="section-title">分类</view>
    <view class="cats">
      <view
        v-for="c in cats"
        :key="c.id"
        class="cat"
        :class="{ on: mode === 'cat' && categoryId === c.id }"
        @click="loadCategory(c.id)"
      >{{ c.title }}</view>
    </view>

    <view v-if="loading" class="tip">加载中…</view>
    <view v-if="error" class="warn">{{ error }}</view>

    <BookCard
      v-for="book in items"
      :key="book.id"
      :book="book"
      @click="goDetail(book.id)"
    />
    <view v-if="!loading && !items.length && !error" class="tip">暂无数据</view>
    <MiniPlayer />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import BookCard from '../../components/BookCard.vue'
import MiniPlayer from '../../components/MiniPlayer.vue'
import {
  CATEGORIES,
  fetchCategory,
  fetchRank,
  RANK_TABS,
} from '../../services/store'
import type { BookItem } from '../../sources/types'

const mode = ref<'rank' | 'cat'>('rank')
const rankType = ref(0)
const categoryId = ref('')
const items = ref<BookItem[]>([])
const loading = ref(false)
const error = ref('')

const rankTabs = computed(() => [...RANK_TABS])
const cats = computed(() => [...CATEGORIES])

async function loadRank(type: number) {
  mode.value = 'rank'
  rankType.value = type
  categoryId.value = ''
  loading.value = true
  error.value = ''
  try {
    items.value = await fetchRank(type, 1, 1)
  } catch (e) {
    items.value = []
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function loadCategory(id: string) {
  mode.value = 'cat'
  categoryId.value = id
  loading.value = true
  error.value = ''
  try {
    items.value = await fetchCategory(id, 1)
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

loadRank(0)
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
  margin-bottom: 8rpx;
}
.sub {
  font-size: 24rpx;
  color: #8a8174;
  margin-bottom: 20rpx;
}
.tabs {
  white-space: nowrap;
  margin-bottom: 20rpx;
}
.tab {
  display: inline-block;
  padding: 12rpx 22rpx;
  margin-right: 10rpx;
  font-size: 24rpx;
  color: #6e655a;
  background: #fffdf8;
  border: 1px solid #d9d0c2;
}
.tab.on {
  color: #2f5d50;
  border-color: #2f5d50;
  font-weight: 600;
}
.section-title {
  font-size: 26rpx;
  color: #8a8174;
  margin-bottom: 12rpx;
}
.cats {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 24rpx;
}
.cat {
  padding: 10rpx 20rpx;
  font-size: 24rpx;
  background: #fffdf8;
  border: 1px solid #e7dfd2;
  color: #6e655a;
}
.cat.on {
  border-color: #2f5d50;
  color: #2f5d50;
}
.tip {
  color: #6e655a;
  font-size: 26rpx;
  margin-bottom: 16rpx;
}
.warn {
  color: #a15c38;
  font-size: 22rpx;
  margin-bottom: 16rpx;
  line-height: 1.5;
}
</style>
