import { ref, onMounted, onUnmounted } from 'vue'

interface UsePollingOptions {
  interval?: number
  immediate?: boolean
}

export function usePolling(fetchFn: () => Promise<void>, options: UsePollingOptions = {}) {
  const { interval = 60_000, immediate = true } = options
  const isPolling = ref(false)
  let timer: ReturnType<typeof setInterval> | null = null

  function start() {
    if (timer) return
    isPolling.value = true
    timer = setInterval(fetchFn, interval)
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    isPolling.value = false
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      fetchFn()
      start()
    } else {
      stop()
    }
  }

  onMounted(() => {
    if (immediate) fetchFn()
    start()
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onUnmounted(() => {
    stop()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })

  return { isPolling, start, stop }
}
