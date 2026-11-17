<template>
  <view class="page">
    <view class="hero">
      <view class="title">{{ player.book?.title || '未在播放' }}</view>
      <view class="chapter">{{ player.currentChapter?.title }}</view>
      <view class="status">{{ player.statusText || '就绪' }}</view>
      <view v-if="player.currentChunkText" class="chunk">{{ player.currentChunkText }}</view>
    </view>

    <view class="card">
      <view class="label">朗读来源</view>
      <view class="sources">
        <view
          class="src"
          :class="{ on: player.source === 'system' }"
          @click="switchSource('system')"
        >
          系统朗读
        </view>
        <view class="src" :class="{ on: player.source === 'ai' }" @click="switchSource('ai')">
          AI 音色
        </view>
        <view
          class="src"
          :class="{ on: player.source === 'source-audio' }"
          @click="switchSource('source-audio')"
        >
          真人有声
        </view>
      </view>
      <view class="hint">系统语音走手机自带引擎（小米 TTS），需打包 Android App；微信小程序不能调用系统语音。有声需书源支持。</view>
    </view>

    <view class="card">
      <view class="row">
        <text>边听边读 · 自动跟随章节</text>
        <switch
          :checked="settings.listenFollowReader"
          @change="onFollow"
        />
      </view>
      <view class="row">
        <text>播完自动下一章</text>
        <switch
          :checked="settings.autoNextChapter"
          @change="(e: any) => settings.patch({ autoNextChapter: !!e.detail.value })"
        />
      </view>
      <view class="progress">
        <text v-if="player.source !== 'source-audio' && player.totalChunks">
          片 {{ player.chunkIndex + 1 }} / {{ player.totalChunks }}
        </text>
        <text v-else>进度 {{ formatTime(player.positionSec) }}</text>
      </view>
    </view>

    <view class="controls">
      <view class="btn" @click="player.prevChapter()">上一章</view>
      <view class="btn primary" @click="toggle">{{ player.playing ? '暂停' : '播放' }}</view>
      <view class="btn" @click="player.nextChapter()">下一章</view>
    </view>
    <view class="controls">
      <view class="btn" @click="goReader">边听边读</view>
      <view class="btn" @click="goDetail">详情</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { ListenSource } from '../../services/book'
import { usePlayerStore } from '../../stores/player'
import { useSettingsStore } from '../../stores/settings'

const player = usePlayerStore()
const settings = useSettingsStore()

function toggle() {
  if (player.playing) player.pause()
  else if (player.hasSession) player.resume()
}

function switchSource(source: ListenSource) {
  if (!player.hasSession) {
    uni.showToast({ title: '请先打开一本书', icon: 'none' })
    return
  }
  player.switchSource(source)
}

function onFollow(e: { detail: { value: boolean } }) {
  settings.patch({ listenFollowReader: !!e.detail.value })
}

function formatTime(sec: number) {
  const s = Math.floor(sec || 0)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

function goReader() {
  if (!player.book) return
  player.setPanelOpen(true)
  uni.navigateTo({
    url: `/pages/reader/index?bookId=${encodeURIComponent(player.book.id)}&chapterIndex=${player.chapterIndex}&listen=1`,
  })
}

function goDetail() {
  if (!player.book) return
  uni.navigateTo({
    url: `/pages/book/detail?id=${encodeURIComponent(player.book.id)}`,
  })
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 36rpx 28rpx 48rpx;
  background: #f7f3eb;
}
.hero {
  padding: 36rpx 28rpx;
  margin-bottom: 24rpx;
  background: linear-gradient(145deg, #2f5d50, #1d3b34);
  color: #f7f3eb;
}
.title {
  font-size: 40rpx;
  font-weight: 700;
  margin-bottom: 10rpx;
}
.chapter,
.status {
  font-size: 26rpx;
  opacity: 0.9;
  margin-bottom: 6rpx;
}
.chunk {
  margin-top: 16rpx;
  font-size: 26rpx;
  line-height: 1.5;
  opacity: 0.85;
  max-height: 120rpx;
  overflow: hidden;
}
.card {
  background: #fffdf8;
  border: 1px solid #e7dfd2;
  padding: 24rpx;
  margin-bottom: 20rpx;
}
.label {
  font-size: 28rpx;
  font-weight: 600;
  margin-bottom: 16rpx;
}
.sources {
  display: flex;
  gap: 12rpx;
}
.src {
  flex: 1;
  text-align: center;
  padding: 18rpx 8rpx;
  border: 1px solid #d9d0c2;
  font-size: 24rpx;
  color: #2f5d50;
}
.src.on {
  background: #2f5d50;
  border-color: #2f5d50;
  color: #f7f3eb;
  font-weight: 600;
}
.hint {
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #8a8174;
  line-height: 1.4;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 28rpx;
  margin-bottom: 12rpx;
}
.progress {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #6e655a;
}
.controls {
  display: flex;
  gap: 16rpx;
  margin-top: 16rpx;
}
.btn {
  flex: 1;
  text-align: center;
  padding: 22rpx 0;
  background: #fffdf8;
  border: 1px solid #d9d0c2;
  color: #1f1a14;
  font-size: 28rpx;
}
.btn.primary {
  background: #c4a574;
  border-color: #c4a574;
  font-weight: 600;
}
</style>
