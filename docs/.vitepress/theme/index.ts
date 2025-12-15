import DefaultTheme from 'vitepress/theme'
import { nextTick } from 'vue'
import type { EnhanceAppContext } from 'vitepress'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ router }: EnhanceAppContext) {
    if (typeof window !== 'undefined') {
      // 启用 View Transitions API
      const originalGo = router.go
      router.go = async (to: string = '') => {
        // 如果浏览器不支持 View Transitions，直接执行原逻辑
        if (!document.startViewTransition) {
          return originalGo(to)
        }

        // 开始过渡动画
        const transition = document.startViewTransition(async () => {
          await originalGo(to)
          await nextTick() // 等待 Vue DOM 更新完成
        })

        await transition.finished
      }
    }
  }
}
