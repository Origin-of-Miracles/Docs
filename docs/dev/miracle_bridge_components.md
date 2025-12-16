---
outline: [2, 4]
---

# Miracle Bridge 组件架构

> **文档状态**: Draft  
> **最后更新**: 2025-12-16

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
│  └── MiracleBrowser     MCEF Chromium 封装                   │
├──────────────────────────────────────────────────────────────┤
│  bridge/                                                     │
│  └── BridgeAPI          JS ↔ Java 双向通信                   │
├──────────────────────────────────────────────────────────────┤
│  config/                                                     │
│  ├── ClientConfig       客户端配置                           │
│  ├── ServerConfig       服务端配置                           │
│  ├── ConfigValidator    配置校验                             │
│  ├── ConfigReloader     热重载                               │
│  └── ConfigWatcher      文件监听                             │
├──────────────────────────────────────────────────────────────┤
│  entity/                                                     │
│  ├── IEntityDriver      实体控制接口                         │
│  └── ysm/YSMCompat      YSM 命令封装                         │
├──────────────────────────────────────────────────────────────┤
│  network/                                                    │
│  └── ModNetworkHandler  Forge 网络包                         │
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

### 3.2 ConfigValidator

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

### 3.3 ConfigReloader

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

### 3.4 ConfigWatcher

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

### 4.2 YSMCompat

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

## 5. Network 模块

### 5.1 ModNetworkHandler

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
    CHANNEL.registerMessage(0, C2SBridgeActionPacket.class,
        C2SBridgeActionPacket::encode,
        C2SBridgeActionPacket::decode,
        C2SBridgeActionPacket::handle);
}
```

**数据包类型** (规划中):

| 包类型 | 方向 | 用途 |
| :--- | :--- | :--- |
| `C2SBridgeActionPacket` | Client → Server | 客户端请求服务端操作 |
| `S2CBridgeResponsePacket` | Server → Client | 服务端响应 |
| `S2CEventPushPacket` | Server → Client | 服务端事件广播 |

---

## 6. 线程模型

### 关键线程

| 线程 | 用途 | 注意事项 |
| :--- | :--- | :--- |
| **Render Thread** | Webview 纹理渲染 | 仅在此线程操作 OpenGL |
| **Client/Server Thread** | 游戏逻辑、实体操作 | 通过 `Minecraft.getInstance().execute()` 调度 |
| **Config Watcher Thread** | 配置文件监听 | 后台守护线程 |
| **Network I/O** | 网络包处理 | Netty 事件循环 |

### 线程安全最佳实践

```java
// ❌ 错误：在非主线程直接操作游戏对象
someAsyncThread.execute(() -> {
    player.teleport(x, y, z);  // 可能崩溃！
});

// ✅ 正确：调度到主线程
someAsyncThread.execute(() -> {
    Minecraft.getInstance().execute(() -> {
        player.teleport(x, y, z);
    });
});
```

---

## 7. 扩展点

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
```

---

:::warning 注意
本文档描述的是当前实现状态。部分功能（如资源拦截器、感知 API）尚在开发中，架构可能调整。
:::
