<template>
  <view v-if="player.hasSession" class="mini" @click="goPlayer">
    <view class="info">
      <text class="t">{{ player.book?.title }}</text>
      <text class="s">{{ sourceLabel }} · {{ player.statusText || player.currentChapter?.title }}</text>
    </view>
    <view class="btn" @click.stop="toggle">{{ player.playing ? '暂停' : '继续' }}</view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { describeListenSource } from '../services/listen'
import { usePlayerStore } from '../stores/player'

const player = usePlayerStore()
const sourceLabel = computed(() => describeListenSource(player.source))

function toggle() {
  if (player.playing) player.pause()
  else player.resume()
}

function goPlayer() {
  uni.navigateTo({ url: '/pages/player/index' })
}
</script>

<style scoped>
.mini {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 100rpx;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 24rpx;
  background: rgba(47, 93, 80, 0.95);
  color: #f7f3eb;
}
.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.t {
  font-size: 28rpx;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.s {
  font-size: 22rpx;
  opacity: 0.85;
}
.btn {
  padding: 10rpx 22rpx;
  border: 1px solid rgba(247, 243, 235, 0.5);
  font-size: 24rpx;
}
</style>
