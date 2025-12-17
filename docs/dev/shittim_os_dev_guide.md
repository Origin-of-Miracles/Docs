---
outline: [2, 3]
---

# Shittim OS 开发指南

> **文档状态**: Draft  
> **最后更新**: 2025-12-17

## 项目概览

**Shittim OS** 是运行在 Minecraft 内嵌浏览器中的 React SPA，作为 Origin of Miracles 的用户界面层。它模拟蔚蓝档案中的"什亭之箱"平板设备，提供 MomoTalk 聊天、学生管理、任务委托等功能。

### 技术栈

| 类别 | 技术选型 | 说明 |
|:---|:---|:---|
| 框架 | React 18 | 函数组件 + Hooks |
| 语言 | TypeScript 5 | 严格类型检查 |
| 构建 | Vite 5 | 开发服务器 + HMR |
| 路由 | React Router 6 | 客户端路由 |
| 状态 | Zustand | 轻量状态管理 |
| 样式 | Tailwind CSS | 原子化 CSS |
| 通信 | MiracleBridge SDK | Minecraft ↔ Web 桥接 |

### 运行环境

- **宿主**: MCEF Chromium 内嵌浏览器 (Chromium 110+)
- **分辨率**: 默认 1280×720，可配置
- **限制**: 无 Node.js API，纯浏览器环境

---

## 快速开始

### 环境要求

- Node.js 18+
- pnpm 8+
- Minecraft 1.20.1 + Miracle Bridge 模组

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/Origin-of-Miracles/Shittim-OS.git
cd Shittim-OS

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

### 在 Minecraft 中查看

1. 启动 Minecraft 客户端（需加载 Miracle Bridge 模组）
2. 进入游戏世界
3. 按 `F12` 打开全屏浏览器，或按 `Ctrl+B` 打开 HUD 叠加层
4. 访问 `http://localhost:5173`

> **提示**: Miracle Bridge 的 `ClientConfig` 中可配置 `devServerUrl`，设置后按快捷键自动打开开发服务器。

---

## 项目结构

```
Shittim-OS/
├── src/
│   ├── bridge/              # MiracleBridge SDK 封装
│   │   ├── client.ts        # 桥接客户端单例
│   │   ├── events.ts        # 事件类型与订阅
│   │   ├── hooks.ts         # React Hooks 封装
│   │   └── types.ts         # TypeScript 类型定义
│   │
│   ├── components/          # 通用 UI 组件
│   │   ├── common/          # 基础组件 (Button, Input, Modal...)
│   │   ├── layout/          # 布局组件 (Sidebar, Header...)
│   │   └── widgets/         # 业务组件 (ChatBubble, StudentCard...)
│   │
│   ├── pages/               # 页面组件
│   │   ├── Home/            # 首页
│   │   ├── MomoTalk/        # 聊天页面
│   │   ├── Students/        # 学生列表/详情
│   │   ├── Tasks/           # 任务委托
│   │   └── Settings/        # 设置页面
│   │
│   ├── hooks/               # 自定义 Hooks
│   │   ├── usePlayer.ts     # 玩家信息
│   │   ├── useStudents.ts   # 学生数据
│   │   └── useGameEvents.ts # 游戏事件订阅
│   │
│   ├── stores/              # Zustand 状态管理
│   │   ├── playerStore.ts   # 玩家状态
│   │   ├── chatStore.ts     # 聊天记录
│   │   └── settingsStore.ts # 用户设置
│   │
│   ├── styles/              # 全局样式
│   │   ├── index.css        # Tailwind 入口
│   │   └── themes/          # 主题变量
│   │
│   ├── utils/               # 工具函数
│   ├── constants/           # 常量定义
│   ├── App.tsx              # 应用根组件
│   ├── main.tsx             # 入口文件
│   └── router.tsx           # 路由配置
│
├── public/                  # 静态资源
│   ├── fonts/               # 字体文件
│   └── images/              # 图片资源
│
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## MiracleBridge 通信 API

Shittim OS 通过 `MiracleBridge` 全局对象与 Minecraft Java 层通信。

### 初始化与就绪检查

```typescript
// 等待桥接就绪
await MiracleBridge.whenReady();

// 检查是否就绪
if (MiracleBridge.isReady()) {
  // 可以安全调用
}
```

### 调用 Java 方法

```typescript
// 基础调用
const result = await MiracleBridge.call('actionName', { param: 'value' });

// 需要服务端处理的调用（自动添加 server: 前缀）
const serverResult = await MiracleBridge.callServer('actionName', { param: 'value' });
```

### 便捷方法

SDK 提供了常用功能的便捷方法：

```typescript
// 获取玩家信息
const player = await MiracleBridge.getPlayerInfo();
// 返回: { name, uuid, health, position, ... }

// 获取背包
const inventory = await MiracleBridge.getInventory();
// 返回: { slots: [...] }

// 传送玩家
await MiracleBridge.teleport(100, 64, 200);

// 发送聊天消息
await MiracleBridge.sendChat('Hello!');

// 执行命令（需权限）
await MiracleBridge.executeCommand('/time set day');
```

### 监听游戏事件

```typescript
// 订阅事件
MiracleBridge.on('player:chat', (data) => {
  console.log(`${data.sender}: ${data.message}`);
});

// 单次订阅
MiracleBridge.once('player:respawn', (data) => {
  console.log('Player respawned');
});

// 取消订阅
const handler = (data) => { ... };
MiracleBridge.on('entity:spawn', handler);
MiracleBridge.off('entity:spawn', handler);
```

### 可用事件列表

| 事件名 | 触发时机 | 数据结构 |
|:---|:---|:---|
| `player:join` | 玩家加入世界 | `{ name, uuid }` |
| `player:leave` | 玩家离开世界 | `{ name, uuid }` |
| `player:chat` | 聊天消息 | `{ sender, message, timestamp }` |
| `player:death` | 玩家死亡 | `{ cause }` |
| `player:respawn` | 玩家重生 | `{ position }` |
| `entity:spawn` | 实体生成 | `{ entityId, type, position }` |
| `entity:death` | 实体死亡 | `{ entityId, cause }` |
| `world:load` | 世界加载 | `{ dimension }` |
| `world:unload` | 世界卸载 | `{ dimension }` |

### 调试模式

```typescript
// 启用调试日志
MiracleBridge.configure({ debug: true });
// 或
MiracleBridge.enableDebug();

// 查看状态
console.log(MiracleBridge.getStatus());
// { ready: true, pendingRequests: 0, eventListeners: [...], config: {...} }
```

---

## React Hooks 封装

为了更好地与 React 集成，建议封装自定义 Hooks：

```typescript
// src/bridge/hooks.ts
import { useEffect, useState } from 'react';

/**
 * 订阅游戏事件的 Hook
 */
export function useGameEvent<T>(eventName: string, handler: (data: T) => void) {
  useEffect(() => {
    MiracleBridge.on(eventName, handler);
    return () => MiracleBridge.off(eventName, handler);
  }, [eventName, handler]);
}

/**
 * 获取玩家信息的 Hook
 */
export function usePlayer() {
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    MiracleBridge.getPlayerInfo()
      .then(setPlayer)
      .finally(() => setLoading(false));
  }, []);

  return { player, loading };
}

/**
 * Bridge 就绪状态 Hook
 */
export function useBridgeReady() {
  const [ready, setReady] = useState(MiracleBridge.isReady());

  useEffect(() => {
    if (!ready) {
      MiracleBridge.whenReady().then(() => setReady(true));
    }
  }, []);

  return ready;
}
```

使用示例：

```tsx
function ChatPage() {
  const { player, loading } = usePlayer();
  
  useGameEvent('player:chat', (data) => {
    // 处理新消息
    addMessage(data);
  });

  if (loading) return <Loading />;
  
  return <div>Welcome, {player.name}!</div>;
}
```

---

## 开发规范

### 命名约定

| 类型 | 规范 | 示例 |
|:---|:---|:---|
| 组件文件 | `PascalCase` | `MomoTalk.tsx`, `ChatBubble.tsx` |
| Hook 文件 | `useCamelCase` | `usePlayer.ts`, `useGameEvents.ts` |
| 工具函数 | `camelCase` | `formatTime.ts`, `parseMessage.ts` |
| 常量 | `UPPER_SNAKE_CASE` | `MAX_MESSAGE_LENGTH` |
| CSS 类 | `kebab-case` | `chat-bubble`, `student-card` |
| 类型/接口 | `PascalCase` | `PlayerInfo`, `ChatMessage` |

### 组件编写规范

```tsx
// ✅ 推荐：函数组件 + TypeScript
interface StudentCardProps {
  student: Student;
  onClick?: () => void;
}

export function StudentCard({ student, onClick }: StudentCardProps) {
  return (
    <div className="student-card" onClick={onClick}>
      <img src={student.avatar} alt={student.name} />
      <span>{student.name}</span>
    </div>
  );
}
```

### 样式方案

1. **Tailwind CSS** - 用于大部分样式
2. **CSS Modules** - 用于复杂组件和动画
3. **CSS 变量** - 用于主题颜色

```tsx
// Tailwind 示例
<button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
  Send
</button>

// CSS Modules 示例
import styles from './ChatBubble.module.css';
<div className={styles.bubble}>{message}</div>
```

### 主题色彩

参考蔚蓝档案 UI 设计：

```css
:root {
  --color-primary: #3b82f6;      /* 主色调 - 蓝色 */
  --color-primary-light: #60a5fa;
  --color-secondary: #f0f9ff;    /* 背景 - 浅蓝 */
  --color-accent: #fbbf24;       /* 强调 - 金色 */
  --color-text: #1e293b;         /* 文字 - 深灰 */
  --color-text-muted: #64748b;   /* 次要文字 */
}
```

---

## 调试技巧

### 1. 浏览器开发者工具

在 Minecraft 中按 `F12` 打开 DevTools（需在 Miracle Bridge 配置中启用）。

### 2. Vite HMR 热重载

修改代码后自动刷新，无需重启 Minecraft。

### 3. Bridge 请求日志

```typescript
MiracleBridge.configure({ debug: true });
```

控制台将输出所有请求和响应。

### 4. 独立浏览器测试

可以在 Chrome/Edge 中打开 `http://localhost:5173` 进行 UI 开发，但 Bridge 调用会失败。建议 Mock：

```typescript
// src/bridge/mock.ts
if (!window.MiracleBridge?.isReady()) {
  window.MiracleBridge = {
    isReady: () => true,
    call: async (action, payload) => {
      console.log('[Mock]', action, payload);
      return { success: true };
    },
    // ... 其他方法
  };
}
```

---

## 构建与部署

```bash
# 构建生产版本
pnpm build

# 预览构建结果
pnpm preview
```

构建产物在 `dist/` 目录，可部署到任何静态服务器。

### 集成到模组

将 `dist/` 内容复制到 Miracle Bridge 的 `assets/miraclebridge/web/` 目录，通过 `bridge://` 协议访问（待实现）。

---

:::tip 开发建议
1. 先在普通浏览器中完成 UI 开发，再到 Minecraft 中测试通信
2. 善用 TypeScript 类型定义，避免运行时错误
3. 保持组件小巧，便于复用和测试
:::

:::warning 注意事项
- MCEF 浏览器不支持某些现代 API（如 WebGPU）
- 避免使用 `localStorage` 进行敏感数据存储
- 大量 DOM 操作可能影响游戏帧率
:::
