---
sidebar_position: 11
outline: [2, 3]
---

# Anima ↔ Bridge 集成指南

> **文档状态**: Draft  
> **最后更新**: 2025-12-18

本文档描述 Anima AI 核心与 Miracle Bridge 的集成方式，以及与前端 (Shittim OS) 的通信协议。

## 数据流概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Shittim OS (前端)                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │  MomoTalk    │    │  学生状态    │    │  场景 UI    │              │
│  │  对话界面    │    │  面板       │    │             │              │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘              │
│         │                   │                   │                       │
│         └───────────────────┼───────────────────┘                       │
│                             │                                           │
│                     bridge.request() / bridge.on()                      │
└─────────────────────────────┼───────────────────────────────────────────┘
                              │ bridge:// 协议
┌─────────────────────────────┼───────────────────────────────────────────┐
│                      Miracle Bridge                                     │
│  ┌──────────────────────────▼───────────────────────────────────────┐  │
│  │                        BridgeAPI                                  │  │
│  │  ├─ anima.chat          → AnimaCore.chat()                       │  │
│  │  ├─ anima.getStudents   → StudentAgentManager.getAll()           │  │
│  │  ├─ anima.getStatus     → StudentAgent.getStatus()               │  │
│  │  └─ anima.action        → StudentAgent.executeAction()           │  │
│  └──────────────────────────┬───────────────────────────────────────┘  │
│                             │                                           │
│  ┌──────────────────────────▼───────────────────────────────────────┐  │
│  │                       AnimaCore                                   │  │
│  │  ├─ StudentAgentManager  (学生代理管理)                           │  │
│  │  ├─ LLMService           (LLM 调用)                               │  │
│  │  ├─ FieldManager         (场域管理)                               │  │
│  │  └─ TokenBudgetManager   (Token 预算)                             │  │
│  └──────────────────────────┬───────────────────────────────────────┘  │
│                             │                                           │
│  ┌──────────────────────────▼───────────────────────────────────────┐  │
│  │                   PerceptionAPI                                   │  │
│  │  └─ 环境感知: 方块、实体、时间、天气                               │  │
│  └──────────────────────────┬───────────────────────────────────────┘  │
│                             │                                           │
│  ┌──────────────────────────▼───────────────────────────────────────┐  │
│  │                  IEntityDriver                                    │  │
│  │  ├─ YSMEntityDriver      (YSM 动画/表情)                          │  │
│  │  └─ VanillaEntityDriver  (原版实体)                               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    Minecraft 1.20.1 世界
```

---

## Bridge API 注册

Anima 在初始化时向 BridgeAPI 注册处理器：

```java
public class AnimaCore {
    
    public void registerBridgeHandlers(BridgeAPI bridgeAPI) {
        // 对话请求
        bridgeAPI.register("anima.chat", this::handleChatRequest);
        
        // 获取所有学生状态
        bridgeAPI.register("anima.getStudents", this::handleGetStudents);
        
        // 获取单个学生详情
        bridgeAPI.register("anima.getStudent", this::handleGetStudent);
        
        // 执行学生行为
        bridgeAPI.register("anima.action", this::handleAction);
        
        // 获取场域信息
        bridgeAPI.register("anima.getField", this::handleGetField);
    }
}
```

---

## API 协议定义

### 1. `anima.chat` - 发送对话

**请求** (JS → Java):
```typescript
interface ChatRequest {
  studentId: string;      // 学生 ID，如 "aris"
  message: string;        // 玩家消息
  includePerception?: boolean;  // 是否附加环境感知 (默认 true)
}
```

**响应** (Java → JS):
```typescript
interface ChatResponse {
  success: boolean;
  requestId: string;      // 用于追踪异步回复
  immediate?: string;     // 即时回复 (如 "思考中...")
}
```

**事件推送** (Java → JS，异步):
```typescript
// 事件名: "studentReply"
interface StudentReplyEvent {
  requestId: string;
  studentId: string;
  studentName: string;
  message: string;
  mood: string;           // 当前情绪
  animationId?: string;   // 触发的动画
  timestamp: number;
}
```

**Java 实现示例**:
```java
private JsonObject handleChatRequest(JsonObject request) {
    String studentId = request.get("studentId").getAsString();
    String message = request.get("message").getAsString();
    String requestId = UUID.randomUUID().toString();
    
    JsonObject response = new JsonObject();
    response.addProperty("success", true);
    response.addProperty("requestId", requestId);
    response.addProperty("immediate", "...");  // 思考中
    
    // 异步处理 LLM 请求
    ThreadScheduler.runAsync(() -> {
        StudentAgent agent = agentManager.getAgent(studentId);
        if (agent == null) return;
        
        // 获取环境感知
        JsonObject perception = null;
        if (request.has("includePerception") && request.get("includePerception").getAsBoolean()) {
            PerceptionAPI api = new PerceptionAPI(player);
            perception = api.getFullPerception(10, 16.0);
        }
        
        // 生成回复
        String reply = agent.generateReply(message, perception).join();
        
        // 推送到前端
        JsonObject event = new JsonObject();
        event.addProperty("requestId", requestId);
        event.addProperty("studentId", studentId);
        event.addProperty("studentName", agent.getPersona().getName());
        event.addProperty("message", reply);
        event.addProperty("mood", agent.getMood().name());
        event.addProperty("timestamp", System.currentTimeMillis());
        
        ThreadScheduler.runOnClientThread(() -> {
            bridgeAPI.pushEvent("studentReply", event);
        });
    });
    
    return response;
}
```

---

### 2. `anima.getStudents` - 获取学生列表

**请求**:
```typescript
interface GetStudentsRequest {
  fieldId?: string;   // 可选：只返回指定场域的学生
  includeOffline?: boolean;  // 是否包含不在场的学生
}
```

**响应**:
```typescript
interface StudentSummary {
  id: string;
  name: string;
  academy: string;
  club: string;
  mood: string;
  currentField: string | null;
  affection: number;      // 好感度 0-100
  isPresent: boolean;     // 是否在玩家附近
}

interface GetStudentsResponse {
  students: StudentSummary[];
  currentField: string | null;
}
```

---

### 3. `anima.getStudent` - 获取学生详情

**请求**:
```typescript
interface GetStudentRequest {
  studentId: string;
}
```

**响应**:
```typescript
interface StudentDetail {
  id: string;
  name: string;
  academy: string;
  club: string;
  
  // 状态
  mood: string;
  moodIntensity: number;  // 0-100
  desires: Record<string, number>;  // 欲望权重
  
  // 位置
  position: { x: number; y: number; z: number };
  currentField: string | null;
  
  // 关系
  affection: number;
  relationshipLevel: string;  // "stranger" | "acquaintance" | "friend" | "close_friend"
  
  // 记忆摘要
  recentMemories: string[];
}
```

---

### 4. `anima.action` - 执行学生行为

**请求**:
```typescript
interface ActionRequest {
  studentId: string;
  action: "moveTo" | "lookAt" | "playAnimation" | "setExpression";
  params: {
    // moveTo
    target?: { x: number; y: number; z: number };
    // lookAt
    lookTarget?: { x: number; y: number; z: number };
    // playAnimation / setExpression
    animationId?: string;
    expressionId?: string;
  };
}
```

**响应**:
```typescript
interface ActionResponse {
  success: boolean;
  error?: string;
}
```

---

## 事件推送列表

Anima 主动推送到前端的事件：

| 事件名 | 触发时机 | 数据结构 |
|--------|---------|---------|
| `studentReply` | LLM 生成回复完成 | `StudentReplyEvent` |
| `studentMoodChange` | 学生情绪变化 | `{ studentId, oldMood, newMood }` |
| `studentEnterField` | 学生进入场域 | `{ studentId, fieldId }` |
| `studentLeaveField` | 学生离开场域 | `{ studentId, fieldId }` |
| `groupChatStart` | 群聊开始 | `{ fieldId, participants: string[] }` |
| `affectionChange` | 好感度变化 | `{ studentId, oldValue, newValue, reason }` |

---

## 前端集成示例

### Shittim OS Bridge Client

```typescript
// src/bridge/anima.ts
import { bridge } from './client';

export const anima = {
  /**
   * 发送对话消息
   */
  async chat(studentId: string, message: string): Promise<string> {
    const response = await bridge.request('anima.chat', {
      studentId,
      message,
      includePerception: true
    });
    
    // 返回请求 ID，实际回复通过事件推送
    return response.requestId;
  },
  
  /**
   * 获取所有学生
   */
  async getStudents(fieldId?: string): Promise<StudentSummary[]> {
    const response = await bridge.request('anima.getStudents', { fieldId });
    return response.students;
  },
  
  /**
   * 获取学生详情
   */
  async getStudent(studentId: string): Promise<StudentDetail> {
    return bridge.request('anima.getStudent', { studentId });
  },
  
  /**
   * 监听学生回复
   */
  onReply(callback: (event: StudentReplyEvent) => void): () => void {
    return bridge.on('studentReply', callback);
  }
};
```

### MomoTalk 组件使用

```tsx
// src/pages/MomoTalk/ChatRoom.tsx
import { useEffect, useState } from 'react';
import { anima } from '@/bridge/anima';

export function ChatRoom({ studentId }: { studentId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  
  useEffect(() => {
    // 监听学生回复
    const unsubscribe = anima.onReply((event) => {
      if (event.studentId === studentId) {
        setIsTyping(false);
        setMessages(prev => [...prev, {
          sender: event.studentName,
          content: event.message,
          timestamp: event.timestamp
        }]);
      }
    });
    
    return unsubscribe;
  }, [studentId]);
  
  const sendMessage = async (text: string) => {
    // 添加玩家消息
    setMessages(prev => [...prev, {
      sender: 'Player',
      content: text,
      timestamp: Date.now()
    }]);
    
    // 发送到 Anima
    setIsTyping(true);
    await anima.chat(studentId, text);
  };
  
  return (
    <div className="chat-room">
      <MessageList messages={messages} />
      {isTyping && <TypingIndicator studentId={studentId} />}
      <MessageInput onSend={sendMessage} />
    </div>
  );
}
```

---

## 配置与 Miracle Bridge 集成

Anima 配置使用独立的 TOML 文件，但需要注册到 Miracle Bridge 的配置监听系统：

```java
// Anima 配置加载
public class AnimaConfig {
    private static final Path CONFIG_PATH = FMLPaths.CONFIGDIR.get()
        .resolve("anima-llm.toml");
    
    public static void initialize() {
        // 加载配置
        loadConfig();
        
        // 注册到 ConfigWatcher 实现热重载
        ConfigWatcher.getInstance().watchFile(CONFIG_PATH, () -> {
            LOGGER.info("Anima 配置已重载");
            loadConfig();
        });
    }
}
```

---

## 线程安全注意事项

1. **Bridge 请求处理器** 运行在 Minecraft 主线程
2. **LLM 调用** 必须转移到异步线程池
3. **事件推送** 必须回到客户端主线程
4. **PerceptionAPI** 必须在服务端主线程调用

```java
// 完整的线程安全调用链
bridgeAPI.register("anima.chat", request -> {
    // 1. 主线程：快速返回
    JsonObject response = new JsonObject();
    response.addProperty("requestId", UUID.randomUUID().toString());
    
    // 2. 异步：LLM 调用
    ThreadScheduler.runAsync(() -> {
        // 3. 需要服务端数据时，切换到服务端线程
        ThreadScheduler.runOnServerThread(() -> {
            JsonObject perception = perceptionAPI.getFullPerception(10, 16);
            
            // 4. 再次切换到异步线程进行 LLM 调用
            ThreadScheduler.runAsync(() -> {
                String reply = llmService.chat(messages).join();
                
                // 5. 回到客户端主线程推送事件
                ThreadScheduler.runOnClientThread(() -> {
                    bridgeAPI.pushEvent("studentReply", event);
                });
            });
        });
    });
    
    return response;
});
```

---

## 相关文档

- [Anima 设计文档](./anima_design) - AI 核心架构详解
- [Miracle Bridge 组件架构](./miracle_bridge_components) - Bridge 模块实现
- [Shittim OS 开发指南](./shittim_os_dev_guide) - 前端开发规范
