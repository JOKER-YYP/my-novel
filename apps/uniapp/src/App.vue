<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { useSettingsStore } from './stores/settings'
import { warmupSystemTts } from './services/tts'

onLaunch(() => {
  useSettingsStore()
  // 预热 Android/小米系统 TTS，降低首句延迟
  void warmupSystemTts()
})
</script>

<style>
page {
  background: #f7f3eb;
  color: #1f1a14;
  font-family: "Source Han Serif SC", "Songti SC", "Noto Serif SC", Georgia, serif;
}
</style>
