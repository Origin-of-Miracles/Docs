---
outline: [2, 4]
---

# Miracle Bridge 组件架构

> **文档状态**: Draft  
> **最后更新**: 2025-12-17

本文档详细描述 Miracle Bridge 各核心组件的实现逻辑和设计决策。

## 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                     React/TypeScript 前端                    │
│                      (Shittim OS UI)                        │
└─────────────────────────┬───────────────────────────────────┘
                          │ bridge:// 协议
┌─────────────────────────▼───────────────────────────────────┐
│  browser/                                                    │
│  ├── BrowserManager     浏览器实例生命周期管理                 │
│  ├── MiracleBrowser     MCEF Chromium 封装                   │
│  ├── BrowserScreen      全屏浏览器界面                        │
│  ├── BrowserOverlay     HUD 叠加层浏览器                     │
│  ├── InputHandler       输入事件处理                         │
│  └── KeyBindings        快捷键注册                           │
├──────────────────────────────────────────────────────────────┤
│  bridge/                                                     │
│  ├── BridgeAPI          JS ↔ Java 双向通信                   │
│  └── BridgeMessageQueue 双向消息队列                         │
├──────────────────────────────────────────────────────────────┤
│  config/                                                     │
│  ├── ClientConfig       客户端配置                           │
│  ├── ServerConfig       服务端配置                           │
│  ├── ModConfigs         配置注册入口                         │
│  ├── ConfigValidator    配置校验                             │
│  ├── ConfigReloader     热重载                               │
│  └── ConfigWatcher      文件监听                             │
├──────────────────────────────────────────────────────────────┤
│  entity/                                                     │
│  ├── IEntityDriver      实体控制接口                         │
│  ├── EntityDriverFactory 驱动工厂                            │
│  ├── VanillaEntityDriver 原版驱动实现                        │
│  ├── PerceptionAPI      实体感知 API                         │
│  └── ysm/                                                    │
│      ├── YSMCompat      YSM 命令封装                         │
│      └── YSMEntityDriver YSM 驱动实现                        │
├──────────────────────────────────────────────────────────────┤
│  event/                                                      │
│  ├── ForgeEventBridge   Forge 事件桥接                       │
│  ├── ClientEventListener 客户端事件监听                      │
│  └── ServerEventListener 服务端事件监听                      │
├──────────────────────────────────────────────────────────────┤
│  network/                                                    │
│  ├── ModNetworkHandler  网络通道管理                         │
│  ├── C2SBridgeActionPacket 客户端→服务端请求                  │
│  ├── S2CBridgeResponsePacket 服务端→客户端响应               │
│  ├── S2CEventPushPacket 服务端事件推送                       │
│  └── S2CFullSyncPacket  全量同步数据包                       │
├──────────────────────────────────────────────────────────────┤
│  util/                                                       │
│  ├── ThreadScheduler    线程调度器                           │
│  └── MessageHelper      消息格式化辅助                       │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
              Minecraft 1.20.1 (Forge 47.2.0)
```

---

## 1. Browser 模块

### 1.1 BrowserManager

**职责**: 管理所有浏览器实例的生命周期，提供命名浏览器的注册和检索。

**设计模式**: 单例 + 注册表

```java
// 使用示例
BrowserManager manager = BrowserManager.getInstance();
MiracleBrowser browser = manager.createBrowser("main", "https://shittim.os/");
manager.closeBrowser("main");
```

**核心数据结构**:

```java
// 线程安全的浏览器映射表
private final Map<String, MiracleBrowser> browsers = new ConcurrentHashMap<>();
```

**关键方法**:

| 方法 | 说明 |
| :--- | :--- |
| `createBrowser(name, url)` | 使用默认配置创建浏览器 |
| `createBrowser(name, url, w, h, transparent)` | 完整参数创建 |
| `getBrowser(name)` | 获取已注册的浏览器 |
| `closeBrowser(name)` | 关闭并注销浏览器 |
| `closeAll()` | 模组卸载时清理所有实例 |

**线程安全考量**:
- 使用 `ConcurrentHashMap` 支持多线程访问
- 创建时自动关闭同名旧实例

---

### 1.2 MiracleBrowser

**职责**: 封装 MCEF `MCEFBrowser`，提供简化的高层 API。

**依赖**: `com.cinemamod.mcef.MCEF`, `MCEFBrowser`

```java
// 创建透明背景浏览器
MiracleBrowser browser = new MiracleBrowser(true);
browser.create("https://example.com", 1920, 1080);

// 执行 JavaScript
browser.executeJavaScript("console.log('Hello from Java')");

// 渲染到屏幕
browser.render(0, 0, screenWidth, screenHeight);
```

**生命周期**:

```
new MiracleBrowser(transparent)
        │
        ▼
   create(url, w, h)  ──► MCEF.createBrowser()
        │
        ├──► loadUrl(newUrl)     // 导航
        ├──► executeJavaScript() // 执行 JS
        ├──► resize(w, h)        // 调整大小
        ├──► render(x, y, w, h)  // 渲染纹理
        │
        ▼
     close()  ──► 释放 MCEF 资源
```

**渲染实现** (OpenGL):

```java
public void render(int x, int y, int renderWidth, int renderHeight) {
    int textureId = browser.getRenderer().getTextureID();
    
    // 设置着色器和混合模式
    RenderSystem.setShaderTexture(0, textureId);
    RenderSystem.enableBlend();
    
    // 绘制四边形
    BufferBuilder builder = Tesselator.getInstance().getBuilder();
    builder.begin(VertexFormat.Mode.QUADS, DefaultVertexFormat.POSITION_TEX_COLOR);
    // ... 顶点数据 ...
    BufferUploader.drawWithShader(builder.end());
}
```

---

### 1.3 BrowserScreen

**职责**: 全屏浏览器界面，捕获所有输入事件并转发到浏览器。

**适用场景**:
- 主 UI 界面
- 设置界面
- 全屏对话界面

```java
// 创建并显示全屏浏览器
BrowserScreen screen = new BrowserScreen("main", true); // allowEscapeClose = true
Minecraft.getInstance().setScreen(screen);
```

**特性**:
- 自动调整浏览器尺寸匹配屏幕
- 完整的鼠标/键盘事件转发
- 可配置 ESC 键关闭行为

---

### 1.4 BrowserOverlay

**职责**: HUD 叠加层浏览器，在游戏画面上方渲染透明浏览器。

**适用场景**:
- 对话气泡
- 状态面板
- 通知提示
- 悬浮菜单

**输入模式**:

| 模式 | 说明 |
| :--- | :--- |
| `PASSTHROUGH` | 输入透传给游戏 |
| `CAPTURE` | 拦截输入到浏览器 |

```java
BrowserOverlay overlay = BrowserOverlay.getInstance();
overlay.init("http://localhost:5173/overlay", 800, 600);
overlay.setInputMode(InputMode.PASSTHROUGH);
overlay.show();
```

---

### 1.5 InputHandler

**职责**: 输入事件处理器，负责坐标转换和修饰键管理。

**功能**:
- 屏幕坐标 → 浏览器坐标转换
- GLFW → CEF 修饰键映射
- 鼠标按钮状态追踪

```java
InputHandler handler = new InputHandler();
int browserX = handler.scaleX(screenX, screenWidth, browserWidth);
int cefMods = handler.fromGlfwModifiers(glfwMods);
```

---

### 1.6 KeyBindings

**职责**: 快捷键注册和处理。

**注册的快捷键**:

| 快捷键 | 功能 |
| :--- | :--- |
| `F11` | 切换全屏浏览器 |
| `F12` | 打开开发者工具 |
| `Ctrl+B` | 打开 Bridge 控制面板 |
| `Ctrl+Shift+B` | 切换叠加层显示 |
| `F5` | 刷新浏览器 |

---

## 2. Bridge 模块

### 2.1 BridgeAPI

**职责**: 实现 JavaScript 与 Java 之间的双向通信。

**通信模式**:

| 方向 | 机制 | 用途 |
| :--- | :--- | :--- |
| JS → Java | `bridge://api/{action}` 协议 | 前端调用后端方法 |
| Java → JS | `executeJavaScript()` | 推送事件、状态同步 |

**处理器注册**:

```java
// 函数式接口
@FunctionalInterface
public interface BridgeHandler {
    JsonObject handle(JsonObject request);
}

// 注册处理器
bridgeAPI.register("getPlayerInfo", request -> {
    JsonObject response = new JsonObject();
    response.addProperty("name", player.getName());
    response.addProperty("health", player.getHealth());
    return response;
});
```

**请求处理流程**:

```
JavaScript fetch('bridge://api/action', { body })
                    │
                    ▼
         BridgeAPI.handleRequest(action, json)
                    │
                    ├── 日志记录 (可配置)
                    ├── 请求大小检查
                    │
                    ▼
           handlers.get(action).handle(request)
                    │
                    ▼
              返回 JSON 响应
```

**事件推送机制**:

```java
// Java 端
bridgeAPI.pushEvent("gameStateChanged", eventData);

// 生成的 JavaScript
window.dispatchEvent(new CustomEvent('gameStateChanged', {
    detail: { /* eventData */ }
}));
```

**服务端请求** (需要网络包):

```java
// 发起异步请求
CompletableFuture<JsonObject> future = bridgeAPI.requestFromServer(action, data);
future.thenAccept(response -> {
    // 处理服务端响应
});
```

---

### 2.2 BridgeMessageQueue

**职责**: 提供 JS ↔ Java 的异步消息传递机制。

**设计背景**: 由于 MCEF 的 SchemeHandler 注册时机限制，采用轮询模式。

**消息类型**:

| 类型 | 说明 |
| :--- | :--- |
| `REQUEST` | JS → Java 请求 |
| `RESPONSE` | Java → JS 响应 |
| `EVENT` | Java → JS 事件推送 |

**工作流程**:

```
1. JS 调用 submitRequest() 提交请求到请求队列
2. Java 主线程轮询 pollRequest() 处理请求
3. Java 处理完成后调用 submitResponse() 提交响应
4. JS 轮询 pollResponse() 获取响应
```

**核心数据结构**:

```java
// 请求队列 (JS → Java)
private final Queue<Message> requestQueue = new ConcurrentLinkedQueue<>();

// 响应队列 (Java → JS)
private final Queue<Message> responseQueue = new ConcurrentLinkedQueue<>();

// 事件队列 (Java → JS)
private final Queue<Message> eventQueue = new ConcurrentLinkedQueue<>();
```

---

## 3. Config 模块

### 3.1 配置类层次

```
ModConfigs (注册入口)
    ├── ClientConfig (仅客户端)
    │   ├── browser.defaultWidth/Height
    │   ├── browser.transparentBackground
    │   ├── browser.devServerUrl
    │   └── debug.* (日志选项)
    │
    └── ServerConfig (服务端)
        ├── bridge.maxRequestSize
        └── bridge.rateLimitPerSecond
```

### 3.2 ModConfigs

**职责**: 配置注册入口，在模组初始化时注册客户端和服务端配置。

```java
public class ModConfigs {
    public static void register() {
        ModLoadingContext.get().registerConfig(ModConfig.Type.CLIENT, ClientConfig.SPEC);
        ModLoadingContext.get().registerConfig(ModConfig.Type.SERVER, ServerConfig.SPEC);
    }
}
```

### 3.3 ConfigValidator

**职责**: 校验配置值的合法性。

```java
public static ValidationResult validate() {
    ValidationResult result = new ValidationResult();
    
    // 浏览器尺寸校验
    int width = ClientConfig.getBrowserWidth();
    if (width < 320 || width > 7680) {
        result.addError("browser.defaultWidth", 
            "浏览器宽度必须在 320-7680 之间");
    }
    
    return result;
}
```

### 3.4 ConfigReloader

**职责**: 处理配置热重载，区分即时生效和重启生效的配置项。

**配置快照机制**:

```java
private static class ConfigSnapshot {
    final int browserWidth;
    final int browserHeight;
    // ... 其他字段
    
    Set<String> getChangedPaths(ConfigSnapshot other) {
        Set<String> changed = new HashSet<>();
        if (browserWidth != other.browserWidth) 
            changed.add("browser.defaultWidth");
        // ...
        return changed;
    }
}
```

**重启生效的配置项**:

```java
private static final Set<String> CLIENT_RESTART_REQUIRED = Set.of(
    "browser.defaultWidth",
    "browser.defaultHeight",
    "browser.transparentBackground"
);
```

### 3.5 ConfigWatcher

**职责**: 监听配置文件变更，触发热重载。

**实现**: 使用 Java NIO `WatchService`

```java
// 注册监听
WatchKey key = configPath.register(watchService,
    StandardWatchEventKinds.ENTRY_MODIFY);

// 轮询事件
while (running) {
    WatchKey polledKey = watchService.poll(1, TimeUnit.SECONDS);
    if (polledKey != null) {
        for (WatchEvent<?> event : polledKey.pollEvents()) {
            if (isConfigFile(event)) {
                ConfigReloader.reload();
            }
        }
    }
}
```

---

## 4. Entity 模块

### 4.1 IEntityDriver

**职责**: 定义实体行为和动画控制的标准化接口。

```java
public interface IEntityDriver {
    void playAnimation(String animationId);
    void setExpression(String expressionId);
    void navigateTo(BlockPos target);
    void lookAt(BlockPos target);
    void halt();
    boolean isAvailable();
    BlockPos getPosition();
}
```

**设计意图**:
- 抽象化实体控制，支持多种后端实现
- 允许 YSM、原版、或其他模组提供具体实现
- 为 LLM 驱动的 AI 行为提供统一 API

---

### 4.2 EntityDriverFactory

**职责**: 根据实体类型和环境自动选择合适的驱动实现。

**驱动选择优先级**:

```
1. 自定义注册的驱动
2. YSM 驱动（如果 YSM 可用）
3. 原版驱动（回退方案）
```

```java
// 获取驱动
IEntityDriver driver = EntityDriverFactory.getInstance().getDriver(player);

// 注册自定义驱动
factory.registerDriver("myentity", player -> new MyCustomDriver(player));
```

**核心实现**:

```java
private IEntityDriver createDriver(ServerPlayer player) {
    // 1. 检查自定义驱动
    if (customDrivers.containsKey(entityType)) {
        return customDrivers.get(entityType).apply(player);
    }
    
    // 2. 检查 YSM 是否可用
    if (YSMCompat.isYSMLoaded()) {
        return new YSMEntityDriver(player);
    }
    
    // 3. 回退到原版驱动
    return new VanillaEntityDriver(player);
}
```

---

### 4.3 VanillaEntityDriver

**职责**: 基于原版 Minecraft API 的实体驱动实现。

**功能**:
- 基础导航（使用原版寻路）
- 视线控制（`lookAt`）
- 位置获取

---

### 4.4 PerceptionAPI

**职责**: 提供实体周围环境的感知能力，用于 AI 决策。

**感知能力**:

| 方法 | 说明 |
| :--- | :--- |
| `getNearbyBlocks(radius)` | 扫描周围方块 |
| `getNearbyEntities(radius)` | 扫描周围实体 |
| `getEnvironmentInfo()` | 获取时间、天气、生物群系 |
| `hasLineOfSight(target)` | 视线检测 |

```java
PerceptionAPI perception = new PerceptionAPI(player);

// 获取周围 10 格内的方块
JsonArray blocks = perception.getNearbyBlocks(10);

// 获取周围实体
JsonArray entities = perception.getNearbyEntities(16, e -> e instanceof LivingEntity);

// 获取环境信息
JsonObject env = perception.getEnvironmentInfo();
```

**输出格式**: 所有方法返回 JSON 格式数据，便于传递给 LLM。

---

### 4.5 YSMCompat

**职责**: 通过命令封装 YSM 功能（YSM 不提供 Java API）。

**软依赖检测**:

```java
private static Boolean ysmLoaded = null;

public static boolean isYSMLoaded() {
    if (ysmLoaded == null) {
        ysmLoaded = ModList.get().isLoaded("ysm");
    }
    return ysmLoaded;
}
```

**命令执行** (需要 OP 权限):

```java
private static void executeCommand(ServerPlayer player, String command) {
    var server = player.getServer();
    if (server == null) {
        LOGGER.warn("无法执行 YSM 命令: 服务器未就绪");
        return;
    }
    server.getCommands().performPrefixedCommand(
        player.createCommandSourceStack().withPermission(4),
        command
    );
}
```

**支持的操作**:

| 方法 | YSM 命令 |
| :--- | :--- |
| `playAnimation(player, "wave")` | `ysm play <name> wave` |
| `stopAnimation(player)` | `ysm play <name> stop` |
| `setModel(player, model, texture)` | `ysm model set <name> <model> <tex> true` |
| `executeMolang(player, expr)` | `ysm molang execute <name> <expr>` |
| `reloadModels(player)` | `ysm model reload` |

---

### 4.6 YSMEntityDriver

**职责**: 用于 YSM 兼容玩家的实体驱动实现。

**特性**:
- 完整动画控制
- 表情系统（通过 Molang 变量）
- 异步导航支持

```java
YSMEntityDriver driver = new YSMEntityDriver(player);

// 播放动画
driver.playAnimation("wave");

// 设置表情
driver.setExpression("happy");

// 异步导航
CompletableFuture<Boolean> future = driver.navigateToAsync(targetPos);
future.thenAccept(success -> {
    if (success) {
        driver.playAnimation("idle");
    }
});
```

---

## 5. Event 模块

### 5.1 ForgeEventBridge

**职责**: 监听 Minecraft 游戏事件并转发到浏览器/JS。

**监听的事件**:
- 玩家事件（加入、离开、死亡、重生）
- 实体事件（生成、死亡）
- 聊天事件

**事件传递通道**:

| 通道 | 说明 |
| :--- | :--- |
| 客户端本地 | 直接推送到 BridgeAPI |
| 网络广播 | 通过 S2CEventPushPacket 发送给所有玩家 |

```java
// 事件处理示例
@SubscribeEvent
public static void onPlayerJoin(PlayerEvent.PlayerLoggedInEvent event) {
    JsonObject data = new JsonObject();
    data.addProperty("playerName", player.getName().getString());
    data.addProperty("uuid", player.getUUID().toString());
    // ...
    broadcastEvent("player:join", data);
}
```

**事件开关**:

```java
private static boolean entityEventsEnabled = true;
private static boolean playerEventsEnabled = true;
private static boolean chatEventsEnabled = true;
```

---

### 5.2 ClientEventListener

**职责**: 监听客户端特定事件。

**监听的事件**:
- GUI 渲染事件
- 输入事件
- 客户端 tick

---

### 5.3 ServerEventListener

**职责**: 监听服务端特定事件。

**监听的事件**:
- 服务器启动/停止
- 玩家连接管理
- 世界保存

---

## 6. Network 模块

### 6.1 ModNetworkHandler

**职责**: 注册和管理 Forge 网络通道。

```java
private static final String PROTOCOL_VERSION = "1";
private static SimpleChannel CHANNEL;

public static void register() {
    CHANNEL = NetworkRegistry.newSimpleChannel(
        new ResourceLocation(MiracleBridge.MOD_ID, "main"),
        () -> PROTOCOL_VERSION,
        PROTOCOL_VERSION::equals,
        PROTOCOL_VERSION::equals
    );
    
    // 注册数据包
    registerPackets();
}
```

**发送方法**:

| 方法 | 说明 |
| :--- | :--- |
| `sendToPlayer(player, packet)` | 向指定玩家发送 |
| `sendToAll(packet)` | 向所有玩家广播 |
| `sendToServer(packet)` | 从客户端向服务端发送 |
| `sendToDimension(dim, packet)` | 向指定维度广播 |

---

### 6.2 数据包类型

| 包类型 | 方向 | 用途 |
| :--- | :--- | :--- |
| `C2SBridgeActionPacket` | Client → Server | 客户端请求服务端操作 |
| `S2CBridgeResponsePacket` | Server → Client | 服务端响应 |
| `S2CEventPushPacket` | Server → Client | 服务端事件广播 |
| `S2CFullSyncPacket` | Server → Client | 全量状态同步 |

**数据包结构示例**:

```java
public class C2SBridgeActionPacket {
    private final String action;
    private final String payload;
    private final String requestId;
    
    public static void encode(C2SBridgeActionPacket pkt, FriendlyByteBuf buf) {
        buf.writeUtf(pkt.action);
        buf.writeUtf(pkt.payload);
        buf.writeUtf(pkt.requestId);
    }
    
    public static C2SBridgeActionPacket decode(FriendlyByteBuf buf) {
        return new C2SBridgeActionPacket(
            buf.readUtf(),
            buf.readUtf(),
            buf.readUtf()
        );
    }
}
```

---

## 7. Util 模块

### 7.1 ThreadScheduler

**职责**: 提供统一的线程切换 API，确保代码在正确的线程上执行。

**线程模型**:

| 线程类型 | 用途 | API |
| :--- | :--- | :--- |
| 客户端主线程 | 游戏逻辑、GUI | `runOnClientThread()` |
| 服务端主线程 | 实体、世界 | `runOnServerThread()` |
| 异步线程池 | 网络、AI、文件 I/O | `runAsync()` |
| 延迟调度器 | 定时任务 | `schedule()` |

**使用示例**:

```java
// 在客户端主线程执行
ThreadScheduler.runOnClientThread(() -> {
    player.displayClientMessage(Component.literal("Hello"), false);
});

// 异步执行并返回结果
CompletableFuture<String> future = ThreadScheduler.supplyAsync(() -> {
    return fetchDataFromAPI();
});

// 延迟执行
ThreadScheduler.schedule(() -> {
    checkStatus();
}, 5, TimeUnit.SECONDS);

// 定时重复执行
ThreadScheduler.scheduleAtFixedRate(() -> {
    syncState();
}, 0, 1, TimeUnit.SECONDS);
```

**核心线程池**:

```java
// 异步任务线程池
private static final ExecutorService ASYNC_EXECUTOR = 
    Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "miraclebridge-async-" + System.currentTimeMillis());
        t.setDaemon(true);
        return t;
    });

// 延迟任务调度器
private static final ScheduledExecutorService SCHEDULED_EXECUTOR = 
    Executors.newScheduledThreadPool(2, r -> {
        Thread t = new Thread(r, "miraclebridge-scheduled-" + System.currentTimeMillis());
        t.setDaemon(true);
        return t;
    });
```

---

### 7.2 MessageHelper

**职责**: 消息格式化辅助工具。

**功能**:
- 带前缀的消息格式化
- 颜色样式支持
- 多语言消息处理

---

## 8. 线程模型

### 关键线程

| 线程 | 用途 | 注意事项 |
| :--- | :--- | :--- |
| **Render Thread** | Webview 纹理渲染 | 仅在此线程操作 OpenGL |
| **Client/Server Thread** | 游戏逻辑、实体操作 | 通过 `Minecraft.getInstance().execute()` 调度 |
| **Config Watcher Thread** | 配置文件监听 | 后台守护线程 |
| **Network I/O** | 网络包处理 | Netty 事件循环 |
| **Async Pool** | 异步任务 | 守护线程，自动扩展 |

### 线程安全最佳实践

```java
// ❌ 错误：在非主线程直接操作游戏对象
someAsyncThread.execute(() -> {
    player.teleport(x, y, z);  // 可能崩溃！
});

// ✅ 正确：使用 ThreadScheduler 调度到主线程
ThreadScheduler.runAsync(() -> {
    // 异步获取数据
    JsonObject data = fetchFromAPI();
    
    // 切换到主线程处理结果
    ThreadScheduler.runOnServerThread(() -> {
        player.teleport(data.get("x").getAsDouble(), ...);
    });
});
```

---

## 9. 扩展点

### 注册自定义 Bridge 处理器

```java
// 在模组初始化时
BridgeAPI bridge = /* 获取实例 */;
bridge.register("myCustomAction", request -> {
    String param = request.get("param").getAsString();
    // 处理逻辑...
    JsonObject response = new JsonObject();
    response.addProperty("result", "success");
    return response;
});
```

### 实现自定义 EntityDriver

```java
public class MyEntityDriver implements IEntityDriver {
    private final Mob entity;
    
    @Override
    public void playAnimation(String animationId) {
        // 自定义动画实现
    }
    
    @Override
    public void navigateTo(BlockPos target) {
        entity.getNavigation().moveTo(target.getX(), target.getY(), target.getZ(), 1.0);
    }
    
    // ... 其他方法
}

// 注册到工厂
EntityDriverFactory.getInstance().registerDriver("myentity", player -> new MyEntityDriver(player));
```

### 监听游戏事件推送到前端

```java
// 在 ForgeEventBridge 中添加新事件监听
@SubscribeEvent
public static void onCustomEvent(MyCustomEvent event) {
    JsonObject data = new JsonObject();
    data.addProperty("customField", event.getValue());
    broadcastEvent("custom:event", data);
}
```

### 扩展 PerceptionAPI

```java
// 添加自定义感知方法
public class ExtendedPerceptionAPI extends PerceptionAPI {
    
    public JsonObject getCustomData() {
        JsonObject data = new JsonObject();
        // 自定义感知逻辑
        return data;
    }
}
```

---

:::warning 注意
本文档描述的是当前实现状态（v0.1.0-alpha）。架构可能随开发进度调整。
:::

---

## 附录：模块依赖关系

```
MiracleBridge.java (入口)
    ├── ModConfigs.register()
    ├── ModNetworkHandler.register()
    ├── BrowserManager.getInstance()
    ├── ConfigReloader.initializeSnapshot()
    └── ConfigWatcher.getInstance().start()

BrowserManager
    └── MiracleBrowser
        └── BridgeAPI
            └── BridgeMessageQueue

EntityDriverFactory
    ├── YSMEntityDriver
    │   └── YSMCompat
    └── VanillaEntityDriver

ForgeEventBridge
    └── ModNetworkHandler (S2CEventPushPacket)
```
