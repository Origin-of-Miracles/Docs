---
sidebar_position: 10
outline: [2, 3]
---

# Anima - 多人格 AI 核心

> **文档状态**: Draft  
> **最后更新**: 2025-12-18  
> **Anima** (拉丁语: 灵魂) - 为基沃托斯的学生们注入灵魂

## 概述

Anima 是 Origin of Miracles 项目的 AI 核心引擎，原生 Java 实现，专为 **多人格并发** 和 **游戏深度集成** 设计。

### 设计目标

| 目标 | 描述 |
|------|------|
| **多人格** | 单进程支持 50+ 学生同时运行 |
| **低资源** | 共享 LLM 客户端，每学生仅占 ~1MB 状态 |
| **可配置** | 用户自定义 LLM/Embedding 模型、API Key |
| **游戏原生** | 与 Minecraft Forge 深度集成 |

### 线程模型

⚠️ **关键设计约束**: LLM 调用是耗时操作 (通常 1-10 秒)，必须异步处理。

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  主线程 (Game)   │    │  Anima 线程池    │    │   LLM Provider  │
│                 │    │  (异步执行)      │    │   (远程 API)    │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ 玩家输入        │───►│ 请求入队        │───►│ HTTP 请求       │
│ UI 渲染        │◄───│ 回调通知        │◄───│ 响应解析        │
│ 实体行为执行    │    │ 并发控制        │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

**使用 Miracle Bridge 的 `ThreadScheduler`**:
```java
// ❌ 错误：阻塞主线程
String reply = llmService.chat(messages).join();  // 会卡死游戏!

// ✅ 正确：异步回调
ThreadScheduler.runAsync(() -> {
    String reply = llmService.chat(messages).join();
    ThreadScheduler.runOnClientThread(() -> {
        displayReply(reply);  // 回到主线程更新 UI
    });
});
```

### 错误处理策略

| 错误类型 | 降级方案 |
|---------|----------|
| **API 超时** | 返回预设的"思考中"回复，后台重试 |
| **API 限流 (429)** | 指数退避重试，最多 3 次 |
| **网络断开** | 使用本地 Ollama 回退（如已配置） |
| **Token 超限** | 自动截断历史消息，保留系统提示 |
| **内容审核拒绝** | 记录日志，返回中性回复 |

```java
public class LLMService {
    private static final int MAX_RETRIES = 3;
    private static final long BASE_DELAY_MS = 1000;
    
    public CompletableFuture<String> chatWithRetry(List<ChatMessage> messages) {
        return CompletableFuture.supplyAsync(() -> {
            for (int i = 0; i < MAX_RETRIES; i++) {
                try {
                    return provider.chat(messages).join();
                } catch (RateLimitException e) {
                    Thread.sleep(BASE_DELAY_MS * (1 << i));  // 指数退避
                } catch (TimeoutException e) {
                    LOGGER.warn("LLM 请求超时，重试 {}/{}", i + 1, MAX_RETRIES);
                }
            }
            return getFallbackReply();  // 降级回复
        }, animaExecutor);
    }
}
```

### Token 预算管理

多学生并发场景下，需要控制总 token 消耗：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `max_tokens_per_request` | 1024 | 单次请求最大输出 token |
| `max_context_tokens` | 4096 | 上下文窗口大小 |
| `max_concurrent_requests` | 5 | 最大并发 LLM 请求数 |
| `rate_limit_rpm` | 60 | 每分钟请求限制 |

```java
public class TokenBudgetManager {
    private final Semaphore concurrentLimit = new Semaphore(5);
    private final RateLimiter rateLimiter = RateLimiter.create(1.0);  // 1 req/sec
    
    public CompletableFuture<String> acquireAndChat(StudentAgent agent, String input) {
        return CompletableFuture.supplyAsync(() -> {
            rateLimiter.acquire();  // 限流
            concurrentLimit.acquire();  // 并发控制
            try {
                return agent.generateReply(input).join();
            } finally {
                concurrentLimit.release();
            }
        }, animaExecutor);
    }
}
```

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                         Anima Core                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  StudentAgent (Per-Student Instance)                   │ │
│  │  ├─ Persona          人格配置 (性格/口癖/背景)         │ │
│  │  ├─ DesireSystem     欲望驱动 (Utility AI)            │ │
│  │  ├─ MoodState        情绪状态机                        │ │
│  │  ├─ MemoryBank       记忆系统 (短期 + 长期)           │ │
│  │  └─ RelationshipMap  社交关系 (好感度/社团)           │ │
│  └────────────────────────────────────────────────────────┘ │
│                            ↓ 共享服务                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  SharedServices                                        │ │
│  │  ├─ LLMService       聊天模型 (OpenAI/Claude/Ollama)  │ │
│  │  ├─ EmbeddingService 向量模型 (可选)                   │ │
│  │  ├─ FieldManager     场域管理                          │ │
│  │  ├─ GroupChatOrch    群聊编排                          │ │
│  │  └─ EventBus         事件总线                          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              ↕
                    Miracle Bridge (Forge Mod)
```

---

## 模块设计

### 1. LLM 服务层 (`llm/`)

支持多种 LLM 提供商，用户可自定义配置。

```java
// 统一接口
public interface LLMProvider {
    CompletableFuture<String> chat(List<ChatMessage> messages);
    CompletableFuture<String> chat(List<ChatMessage> messages, ChatOptions options);
}

// 支持的提供商
- OpenAIProvider      (OpenAI API / Azure OpenAI)
- ClaudeProvider      (Anthropic Claude)
- OllamaProvider      (本地 Ollama)
- CustomProvider      (自定义 OpenAI 兼容 API)
```

**用户配置示例** (`anima-llm.toml`):
```toml
[chat]
provider = "openai"           # openai | claude | ollama | custom
api_key = "sk-xxx"
base_url = "https://api.openai.com/v1"  # 可自定义
model = "gpt-4o"
temperature = 0.8
max_tokens = 1024

[embedding]
enabled = true
provider = "openai"
api_key = "sk-xxx"
base_url = "https://api.openai.com/v1"
model = "text-embedding-3-small"
```

### 2. 学生代理 (`agent/`)

每个学生是一个独立的 Agent 实例。

```java
public class StudentAgent {
    // 身份
    private final String studentId;
    private final Persona persona;
    
    // 状态 (独立)
    private MoodState mood;
    private MemoryBank memory;
    private DesireSystem desires;
    private RelationshipMap relationships;
    
    // 服务 (共享)
    private final LLMService llm;
    private final EmbeddingService embedding;
    
    // 核心方法
    CompletableFuture<String> generateReply(String input, PerceptionContext ctx);
    BehaviorDecision decideBehavior(PerceptionContext ctx);
    void updateMemory(MemoryEvent event);
    void updateMood(MoodTrigger trigger);
}
```

### 3. 人格配置 (`persona/`)

从 JSON/YAML 加载学生人格。

```json
{
  "id": "aris",
  "name": "爱丽丝",
  "academy": "MILLENNIUM",
  "club": "GAME_DEV",
  "personality": {
    "traits": ["天真", "好奇", "热爱冒险"],
    "speech_style": "经常说'超级厉害'，语气活泼",
    "quirks": ["自称爱丽丝", "对游戏充满热情"]
  },
  "desires": {
    "adventure": 0.8,
    "gaming": 0.9,
    "social": 0.6
  },
  "base_prompt": "你是爱丽丝，千年科技学院游戏开发部的成员..."
}
```

### Prompt 模板示例

完整的 System Prompt 结构：

```
你是 {name}，来自 {academy} 的 {club} 成员。

【性格特征】
{traits_description}

【说话风格】
{speech_style}

【当前状态】
- 情绪: {mood} ({mood_intensity}%)
- 位置: {current_field}
- 在场的人: {nearby_students}

【环境感知】
- 时间: {time_of_day} ({weather})
- 玩家正在看: {player_looking_at}
- 附近物品: {nearby_items}

【对话历史】
{recent_messages}

【指令】
根据你的性格自然地回复玩家。保持角色一致性，不要打破第四面墙。
回复长度控制在 1-3 句话，除非话题需要更长的解释。
```

### 4. 记忆系统 (`memory/`)

分层记忆架构：

| 层级 | 存储 | 用途 |
|------|------|------|
| **即时记忆** | 内存 List | 当前对话上下文 (最近 N 条) |
| **短期记忆** | SQLite | 今日事件摘要 |
| **长期记忆** | 向量库 + KG | HippoRAG 式联想检索 (Phase 2) |

### 5. 场域系统 (`field/`)

管理空间位置和群聊。

```java
public class FieldManager {
    // 检测玩家进入的场域
    Field detectField(BlockPos playerPos);
    
    // 获取场域内的学生
    List<StudentAgent> getStudentsInField(Field field);
    
    // 群聊编排
    List<SpeakIntent> orchestrateGroupChat(
        Field field, 
        String playerMessage,
        List<StudentAgent> presentStudents
    );
}
```

#### 群聊编排算法

当多个学生在同一场域时，`GroupChatOrchestrator` 决定谁说话：

```java
public class GroupChatOrchestrator {
    /**
     * 编排群聊响应顺序
     * 
     * @param playerMessage 玩家消息
     * @param students 在场学生列表
     * @return 按顺序排列的发言意图
     */
    public List<SpeakIntent> orchestrate(String playerMessage, List<StudentAgent> students) {
        List<SpeakIntent> intents = new ArrayList<>();
        
        for (StudentAgent student : students) {
            // 计算响应意愿 (0.0 - 1.0)
            float willingness = calculateWillingness(student, playerMessage);
            
            // 只有意愿超过阈值才加入
            if (willingness > 0.3) {
                intents.add(new SpeakIntent(student, willingness));
            }
        }
        
        // 按意愿排序，最想说话的先说
        intents.sort((a, b) -> Float.compare(b.willingness, a.willingness));
        
        // 限制最多 3 人回复，避免刷屏
        return intents.subList(0, Math.min(3, intents.size()));
    }
    
    private float calculateWillingness(StudentAgent student, String message) {
        float base = 0.5f;
        
        // 性格加成：外向 > 内向
        base += student.getPersona().getExtroversion() * 0.2f;
        
        // 话题相关性：如果消息涉及学生兴趣
        if (isTopicRelevant(message, student)) {
            base += 0.3f;
        }
        
        // 最近是否说过话（避免一人独霸）
        if (student.hasSpokenRecently()) {
            base -= 0.2f;
        }
        
        // 情绪加成：高兴时更愿意说话
        base += student.getMood().getPositivity() * 0.1f;
        
        return Math.clamp(base, 0f, 1f);
    }
}
```

**发言延迟模拟**：
```java
// 模拟打字延迟，让对话更自然
int typingDelayMs = 500 + message.length() * 30;  // 基础 + 每字符 30ms
ThreadScheduler.schedule(() -> {
    bridgeAPI.pushEvent("studentReply", event);
}, typingDelayMs, TimeUnit.MILLISECONDS);
```

### 6. 欲望系统 (`desire/`)

Utility AI 行为决策。

```java
public class DesireSystem {
    Map<DesireType, Float> desires;  // 欲望权重
    
    // 根据环境计算效用值
    float calculateUtility(DesireType desire, PerceptionContext ctx);
    
    // 选择最优行为
    BehaviorDecision decide(PerceptionContext ctx);
}

enum DesireType {
    ADVENTURE,  // 冒险 (爱丽丝)
    SLACKING,   // 摸鱼 (星野)
    FOOD,       // 美食 (美食研)
    SOCIAL,     // 社交
    WORK,       // 工作
    REST        // 休息
}
```

### 7. 情绪与动画映射

情绪状态需要映射到 YSM 动画 ID：

| 情绪状态 | YSM 动画 ID | 触发条件 |
|---------|-------------|---------|
| `HAPPY` | `emote_happy`, `emote_excited` | 收到礼物、完成任务、好感度提升 |
| `SAD` | `emote_sad`, `emote_depressed` | 任务失败、被忽视、长时间不互动 |
| `ANGRY` | `emote_angry`, `emote_annoyed` | 被攻击、反复被打断 |
| `SURPRISED` | `emote_surprised`, `emote_shocked` | 突发事件、意外消息 |
| `THINKING` | `emote_think`, `emote_confused` | AI 生成回复时 |
| `IDLE` | `idle_normal`, `idle_bored` | 默认状态 |

```java
public class MoodAnimationMapper {
    private static final Map<MoodState, List<String>> ANIMATION_MAP = Map.of(
        MoodState.HAPPY, List.of("emote_happy", "emote_excited", "emote_joy"),
        MoodState.SAD, List.of("emote_sad", "emote_depressed"),
        MoodState.THINKING, List.of("emote_think", "emote_confused")
        // ...
    );
    
    public String selectAnimation(MoodState mood) {
        List<String> options = ANIMATION_MAP.getOrDefault(mood, List.of("idle_normal"));
        return options.get(random.nextInt(options.size()));  // 随机选择变体
    }
    
    // 与 YSM 集成
    public void applyMoodToEntity(LivingEntity entity, MoodState mood) {
        if (YSMCompat.isYSMLoaded()) {
            String animId = selectAnimation(mood);
            YSMCompat.playAnimation(entity, animId);
        }
    }
}
```

---

## 目录结构

```
miraclebridge/
└── anima/
    ├── AnimaCore.java              # 核心入口
    ├── config/
    │   ├── AnimaConfig.java        # 配置加载
    │   └── LLMConfig.java          # LLM 配置
    ├── llm/
    │   ├── LLMProvider.java        # 接口
    │   ├── LLMService.java         # 服务封装
    │   ├── ChatMessage.java        # 消息模型
    │   ├── impl/
    │   │   ├── OpenAIProvider.java
    │   │   ├── ClaudeProvider.java
    │   │   ├── OllamaProvider.java
    │   │   └── CustomProvider.java
    │   └── embedding/
    │       ├── EmbeddingProvider.java
    │       └── EmbeddingService.java
    ├── agent/
    │   ├── StudentAgent.java       # 学生代理
    │   ├── StudentAgentManager.java
    │   └── PromptBuilder.java
    ├── persona/
    │   ├── Persona.java            # 人格模型
    │   ├── PersonaLoader.java      # 配置加载
    │   └── SpeechStyle.java
    ├── memory/
    │   ├── MemoryBank.java         # 记忆库
    │   ├── MemoryEvent.java
    │   ├── ShortTermMemory.java
    │   └── LongTermMemory.java     # Phase 2
    ├── mood/
    │   ├── MoodState.java          # 情绪状态
    │   └── MoodTransition.java
    ├── desire/
    │   ├── DesireSystem.java       # 欲望系统
    │   ├── DesireType.java
    │   └── UtilityCalculator.java
    ├── field/
    │   ├── Field.java              # 场域定义
    │   ├── FieldManager.java
    │   └── GroupChatOrchestrator.java
    └── relationship/
        ├── RelationshipMap.java
        └── Affection.java          # 好感度
```

---

## 配置文件

### `config/anima-llm.toml`

```toml
# ========================================
# Anima LLM 配置
# ========================================

[chat]
# 提供商: openai | claude | ollama | custom
provider = "openai"

# API 密钥 (敏感信息，建议使用环境变量)
api_key = "${OPENAI_API_KEY}"

# API 地址 (支持自定义，如 Azure、代理、本地)
base_url = "https://api.openai.com/v1"

# 模型名称
model = "gpt-4o"

# 生成参数
temperature = 0.8
max_tokens = 1024
timeout_seconds = 30

[embedding]
# 是否启用向量检索 (长期记忆需要)
enabled = false

provider = "openai"
api_key = "${OPENAI_API_KEY}"
base_url = "https://api.openai.com/v1"
model = "text-embedding-3-small"

[ollama]
# Ollama 本地配置 (当 provider = "ollama" 时使用)
base_url = "http://localhost:11434"
model = "llama3.2"
```

### `config/anima-core.toml`

```toml
[general]
# 日志级别
log_level = "INFO"

# 最大并发学生数
max_concurrent_agents = 50

[memory]
# 即时记忆条数
immediate_memory_size = 20

# 短期记忆保留天数
short_term_days = 7

[behavior]
# 行为决策间隔 (tick)
decision_interval = 100

# 群聊响应延迟 (模拟打字)
typing_delay_ms = 500
```

---

## 开发路线

### Phase 1: 基础对话 (MVP)
- [x] PerceptionAPI (已有)
- [ ] LLMService + OpenAI/Ollama Provider
- [ ] StudentAgent 基础框架
- [ ] Persona 配置加载
- [ ] 单学生对话

### Phase 2: 多人格 + 场域
- [ ] StudentAgentManager (多学生管理)
- [ ] FieldManager (场域检测)
- [ ] GroupChatOrchestrator (群聊编排)
- [ ] MoodState (情绪系统)

### Phase 3: Utility AI
- [ ] DesireSystem (欲望驱动)
- [ ] BehaviorDecision (行为决策)
- [ ] 与 IEntityDriver 集成

### Phase 4: 高级记忆
- [ ] EmbeddingService
- [ ] 向量存储 (SQLite-VSS 或 FAISS JNI)
- [ ] HippoRAG 2 实现

---

## API 示例

```java
// 初始化 Anima
AnimaCore anima = AnimaCore.getInstance();
anima.initialize(configPath);

// 获取学生代理
StudentAgent aris = anima.getAgent("aris");

// 使用 Miracle Bridge 的 PerceptionAPI 获取环境感知
// 注意：PerceptionAPI 需要 ServerPlayer，返回 JsonObject
PerceptionAPI perception = new PerceptionAPI(serverPlayer);
JsonObject ctx = perception.getFullPerception(10, 16.0);  // 方块半径 10，实体半径 16

// 异步生成回复（避免阻塞主线程）
ThreadScheduler.runAsync(() -> {
    String reply = aris.generateReply("今天玩什么游戏？", ctx).join();
    
    // 回到主线程执行游戏逻辑
    ThreadScheduler.runOnServerThread(() -> {
        // 通过 Bridge 推送到前端显示
        bridgeAPI.pushEvent("studentReply", createReplyEvent(aris, reply));
        
        // 行为决策
        BehaviorDecision decision = aris.decideBehavior(ctx);
        if (decision.getType() == BehaviorType.MOVE_TO) {
            IEntityDriver driver = EntityDriverFactory.create(studentEntity);
            driver.navigateTo(decision.getTargetPos());
        }
    });
});
```

### 前端触发对话示例

```typescript
// Shittim OS 前端 (TypeScript)
import { bridge } from '@/bridge';

// 发送对话请求
const response = await bridge.request('anima.chat', {
  studentId: 'aris',
  message: '今天玩什么游戏？',
  includePerception: true  // 自动附加环境感知
});

// 监听学生回复事件
bridge.on('studentReply', (event) => {
  console.log(`${event.studentName}: ${event.message}`);
  // 更新 MomoTalk UI
});
```

---

## 命名由来

**Anima** 在拉丁语中意为"灵魂"、"生命力"。

> *"我们不仅是在造建筑，我们是在造'人'。"*

Anima 的使命，就是为基沃托斯的每一位学生注入独特的灵魂。
