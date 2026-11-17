<template>
  <view class="page">
    <view class="block">
      <view class="label">听书模式</view>
      <radio-group @change="onListenPref">
        <label class="radio"><radio value="auto" :checked="settings.listenPref === 'auto'" />自动</label>
        <label class="radio"><radio value="source-audio" :checked="settings.listenPref === 'source-audio'" />强制有声</label>
        <label class="radio"><radio value="tts" :checked="settings.listenPref === 'tts'" />强制 TTS</label>
      </radio-group>
    </view>

    <view class="block">
      <view class="label">数据源（并行搜索）</view>
      <view class="hint-inline">红薯中文 + 布谷小说 + 800小说（直连）</view>
      <label v-for="s in sources" :key="s.id" class="row">
        <switch
          :checked="settings.enabledSourceIds.includes(s.id)"
          @change="(e: any) => settings.toggleSource(s.id, !!e.detail.value)"
        />
        <text>{{ s.name }}</text>
      </label>
    </view>

    <view class="block">
      <view class="label">朗读引擎</view>
      <radio-group @change="onEngine">
        <label class="radio"><radio value="system" :checked="settings.ttsEngine === 'system'" />系统语音（推荐，小米等自带引擎）</label>
        <label class="radio"><radio value="baidu" :checked="settings.ttsEngine === 'baidu'" />AI 音色（百度云）</label>
      </radio-group>
      <view class="hint-inline">系统语音仅 Android/iOS App 可用，微信小程序无法调用。小米：设置 → 更多设置 → 无障碍 → 文字转语音（TTS）输出，选好中文引擎后，用 HBuilderX「运行到手机或模拟器」打 App 真机包。</view>
    </view>

    <view class="block">
      <view class="label">百度 API Key</view>
      <input
        class="input"
        :value="settings.baiduApiKey"
        placeholder="填入后本地保存"
        @blur="(e: any) => settings.patch({ baiduApiKey: e.detail.value })"
      />
      <view class="label">百度 Secret Key</view>
      <input
        class="input"
        :value="settings.baiduSecretKey"
        password
        placeholder="填入后本地保存"
        @blur="(e: any) => settings.patch({ baiduSecretKey: e.detail.value })"
      />
      <view class="label">百度发音人</view>
      <picker :range="voiceNames" :value="voiceIndex" @change="onVoice">
        <view class="picker">{{ voiceNames[voiceIndex] || '选择音色' }}</view>
      </picker>
      <view class="label">语速 {{ settings.baiduSpd }}</view>
      <slider
        min="0"
        max="15"
        :value="settings.baiduSpd"
        show-value
        @change="(e: any) => settings.patch({ baiduSpd: Number(e.detail.value) })"
      />
    </view>

    <view class="block">
      <label class="row">
        <switch
          :checked="settings.listenFollowReader"
          @change="(e: any) => settings.patch({ listenFollowReader: !!e.detail.value })"
        />
        <text>边听边读 · 自动跟随章节</text>
      </label>
      <label class="row">
        <switch
          :checked="settings.autoNextChapter"
          @change="(e: any) => settings.patch({ autoNextChapter: !!e.detail.value })"
        />
        <text>播完自动下一章</text>
      </label>
    </view>

    <view class="block">
      <view class="btn" @click="exportBackup">导出备份 JSON</view>
      <view class="btn" @click="importBackup">从剪贴板导入备份</view>
    </view>

    <view class="hint">
      开发者工具可勾选「不校验合法域名」。真机预览/体验版会强制校验：手机右上角···→打开调试；或在公众平台「开发设置→服务器域名」加入 request：www.hongshu.com、g.hongshu.com、img2.hongshu.com、www.buguxs.com、www.800xs.org（需备案 HTTPS）。封面另加 downloadFile 域名；百度 TTS 见开发文档。
    </view>
    <MiniPlayer />
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MiniPlayer from '../../components/MiniPlayer.vue'
import { BAIDU_VOICES } from '../../services/tts/cloud/voices'
import { listAllSources } from '../../sources/registry'
import { useSettingsStore } from '../../stores/settings'

const settings = useSettingsStore()
const sources = listAllSources()
const voiceNames = BAIDU_VOICES.map((v) => `${v.name}（${v.library}）`)
const voiceIndex = computed(() => {
  const idx = BAIDU_VOICES.findIndex((v) => v.per === settings.baiduPer)
  return idx >= 0 ? idx : 0
})

function onListenPref(e: { detail: { value: string } }) {
  settings.patch({ listenPref: e.detail.value as 'auto' | 'source-audio' | 'tts' })
}

function onEngine(e: { detail: { value: string } }) {
  settings.patch({ ttsEngine: e.detail.value as 'system' | 'baidu' })
}

function onVoice(e: { detail: { value: string } }) {
  const idx = Number(e.detail.value)
  const voice = BAIDU_VOICES[idx]
  if (voice) settings.patch({ baiduPer: voice.per })
}

function exportBackup() {
  const raw = settings.exportBackup()
  uni.setClipboardData({
    data: raw,
    success: () => uni.showToast({ title: '已复制到剪贴板', icon: 'none' }),
  })
}

function importBackup() {
  uni.getClipboardData({
    success: (res) => {
      try {
        settings.importBackup(String(res.data || ''))
        uni.showToast({ title: '导入成功', icon: 'none' })
      } catch {
        uni.showToast({ title: '导入失败，检查 JSON', icon: 'none' })
      }
    },
  })
}
</script>

<style scoped>
.page {
  padding: 28rpx 28rpx 180rpx;
}
.block {
  margin-bottom: 36rpx;
  padding-bottom: 24rpx;
  border-bottom: 1px solid #e7dfd2;
}
.label {
  font-size: 28rpx;
  font-weight: 600;
  margin: 12rpx 0;
}
.radio {
  display: inline-flex;
  align-items: center;
  margin-right: 20rpx;
  font-size: 26rpx;
}
.row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin: 12rpx 0;
  font-size: 28rpx;
}
.input {
  height: 72rpx;
  padding: 0 20rpx;
  background: #fffdf8;
  border: 1px solid #d9d0c2;
  margin-bottom: 12rpx;
}
.picker {
  padding: 20rpx;
  background: #fffdf8;
  border: 1px solid #d9d0c2;
}
.btn {
  margin-top: 12rpx;
  padding: 20rpx;
  text-align: center;
  background: #2f5d50;
  color: #f7f3eb;
}
.hint {
  font-size: 22rpx;
  color: #6e655a;
  line-height: 1.5;
}
.hint-inline {
  font-size: 26rpx;
  color: #6e655a;
  line-height: 1.5;
}
</style>
