<template>
  <view class="card" @click="$emit('click')">
    <view class="title">{{ book.title }}</view>
    <view class="meta">{{ book.author }} · {{ sourceLabel }}</view>
    <view v-if="book.intro" class="intro">{{ book.intro }}</view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BookItem } from '../sources/types'
import { getSourceById } from '../sources/registry'

const props = defineProps<{ book: BookItem }>()
defineEmits<{ click: [] }>()

const sourceLabel = computed(
  () => getSourceById(props.book.source)?.name || props.book.source,
)
</script>

<style scoped>
.card {
  padding: 24rpx 28rpx;
  margin-bottom: 20rpx;
  background: #fffdf8;
  border-bottom: 1px solid #e7dfd2;
}
.title {
  font-size: 34rpx;
  font-weight: 600;
  margin-bottom: 8rpx;
}
.meta {
  font-size: 24rpx;
  color: #6e655a;
  margin-bottom: 8rpx;
}
.intro {
  font-size: 24rpx;
  color: #8a8174;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
</style>
