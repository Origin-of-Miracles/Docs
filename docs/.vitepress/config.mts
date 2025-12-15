import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Origin of Miracles",
  description: "Community Documentation - Where all miracles begin",
  
  lang: 'zh-CN',
  cleanUrls: true,
  
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: '/logo.png',
    
    nav: [
      { text: '首页', link: '/' },
      { text: '社区宣言', link: '/manifesto' },
      { text: 'EULA', link: '/eula' },
      { text: 'GitHub', link: 'https://github.com/Origin-of-Miracles' }
    ],

    sidebar: [
      {
        text: '项目文档',
        items: [
          { text: '社区宣言', link: '/manifesto' },
          { text: 'EULA 协议', link: '/eula' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Origin-of-Miracles' }
    ],

    footer: {
      message: 'Released under the CC BY-NC-SA 4.0 License.',
      copyright: '© 2025 Origin of Miracles. Not officially affiliated with NEXON Games or Yostar.'
    },

    search: {
      provider: 'local'
    },

    outline: {
      label: '目录',
      level: [2, 3]
    },

    lastUpdated: {
      text: '最后更新于',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'short'
      }
    },

    docFooter: {
      prev: '上一页',
      next: '下一页'
    },

    darkModeSwitchLabel: '外观',
    returnToTopLabel: '返回顶部',
    sidebarMenuLabel: '菜单'
  },

  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/logo.png' }],
    ['link', { rel: 'apple-touch-icon', href: '/logo.png' }],
    ['meta', { name: 'theme-color', content: '#00AEE1' }]
  ]
})
