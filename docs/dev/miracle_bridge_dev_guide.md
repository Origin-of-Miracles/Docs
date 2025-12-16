---
sidebar_position: 1
outline: [2, 3]
---

# Miracle Bridge 开发文档

> **文档状态**: Draft (草案)  
> **适用版本**: Minecraft 1.20.1 (Forge)  
> **模块**: Core / Precursor Mod  
> **最后更新**: 2025-12-16

## 0. 更新日志 (Changelog)

| 版本 | 日期 | 描述 |
| :--- | :--- | :--- |
| 0.1.1 | 2025-12-16 | 迁移至 CinemaMod/MCEF 作为浏览器内核 |
| 0.1.0 | 2025-12-16 | 初始草案，定义核心职责与编码规范 |

## 1. 项目定位 (Project Scope)

**Miracle Bridge** 是 "Origin of Miracles" 生态系统的核心前置模组 (Core Library / Precursor Mod)。

它的核心使命不是提供直接的游戏玩法（如剧情、任务脚本），而是**构建连接 Minecraft 原生世界与现代 Web/AI 技术的桥梁**。它负责抹平 Java 游戏引擎与现代前端技术栈 (React/Webview) 以及 AI 后端 (LLM/Python) 之间的鸿沟。

## 2. 核心职责 (Core Responsibilities)

根据项目憧憬 (Aspirations)，Miracle Bridge 需要承担以下底层技术职责：

### 2.1 Webview 容器与渲染 (The "Screen")
这是实现“什亭之箱” UI 的基础。
- **高性能嵌入**: 基于 [CinemaMod/MCEF](https://github.com/CinemaMod/mcef/tree/1.20.1) (ds58 维护的分支)，在 Minecraft 客户端内集成 Chromium 浏览器内核 (当前 Chromium 版本: `116.0.5845.190`)。
- **UI 覆盖 (Overlay)**: 提供全屏、无边框的 Web 渲染层，用于显示 OS 界面、MomoTalk 等。
- **资源拦截 (Resource Handler)**: 拦截特定的 HTTP 请求（如 `https://shittim.os/*`），直接从 Mod jar 包或本地缓存中读取 React 构建产物，确保无网环境下 UI 仍可加载，并提高加载速度。

### 2.2 JS-Java 双向通信桥梁 (The "Bridge")
实现 React 前端与 Minecraft 后端的实时数据交换。
- **Java -> JS (Context Push)**:
    - **状态同步**: 实时推送玩家数据（HP、AP、位置、持有物品）给前端。
    - **事件通知**: 将游戏内事件（如“收到新邮件”、“进入战斗状态”、“天气变为下雨”）转发给前端。
- **JS -> Java (Action Execution)**:
    - **指令执行**: 允许前端通过 JS API 调用 Java 方法（如 `bridge.teleport(x, y, z)`，`bridge.giveItem(id)`）。
    - **回调处理**: 处理前端的异步请求（如“查询背包数据”）。

### 2.3 实体与 AI 接口 (The "Soul" Interface)
为了实现“活着的学生”，Bridge 必须开放对实体的深度控制权。
- **感知 API (Perception API)**:
    - 提供高效的扫描接口，获取实体周围的“环境上下文” (Context)。
    - **输出**: 结构化 JSON 数据（包括附近的方块类型、其他实体、当前时间、天气、光照等级），供 LLM 决策使用。
- **驱动 API (Actuation API)**:
    - **YSM 兼容**: 深度集成 **Yes Steve Model**，允许通过代码控制模型的具体动作 (Animation)、表情 (Expression) 和皮肤状态。
    - **导航控制**: 封装寻路算法，允许外部指令直接控制实体的移动目标（而非简单的 WASD 模拟）。

### 2.4 沉浸式音频系统 (Audio & Immersion)
- **TTS 集成**: 提供流式音频播放接口，支持从 AI 后端接收语音数据流并在游戏内指定位置（3D 音效）播放。
- **动态 BGM**: 接管原版音乐系统，提供淡入淡出 (Cross-fade) 接口，实现根据游戏状态（日常/战斗/剧情）平滑切换背景音乐。

## 3. 编码规范 (Coding Standards)

为了保证项目的可维护性和稳定性，所有贡献者需遵守以下规范。

### 3.1 开发环境
- **JDK**: Java 17 (推荐 Microsoft Build of OpenJDK)
- **Mod Loader**: Forge (Target Minecraft 1.20.1)
- **Mappings**: Official Mojang Mappings
- **构建工具**: Gradle 8.x

### 3.2 依赖项 (Dependencies)

| 依赖 | 版本 | 用途 | 备注 |
| :--- | :--- | :--- | :--- |
| **MCEF** (CinemaMod/mcef) | `2.1.6-1.20.1` | 浏览器内核 | 内置 native 库下载器 |
| Yes Steve Model (YSM) | 2.x | 3D 模型兼容 | 软依赖，无则降级 |
| Gson | (Forge 内置) | JSON 序列化 | - |

**Gradle 配置 (`build.gradle`)**:

```groovy
repositories {
    maven {
        url = uri('https://mcef-download.cinemamod.com/repositories/releases')
    }
    // 可选：用于快照版本
    maven {
        url = uri('https://mcef-download.cinemamod.com/repositories/snapshots')
    }
}

dependencies {
    // Forge
    compileOnly fg.deobf('com.cinemamod:mcef:2.1.6-1.20.1')
    runtimeOnly fg.deobf('com.cinemamod:mcef-forge:2.1.6-1.20.1')
}
```

**跨平台支持** (MCEF 内置):
- Windows 10/11 (x86_64, arm64)
- macOS 11+ (Intel, Apple Silicon)
- GNU Linux glibc 2.31+ (x86_64, arm64)

> ⚠️ **注意**: MCEF 首次启动时会自动从 `https://mcef-download.cinemamod.com` 下载 CEF 二进制文件，需确保网络通畅。

### 3.3 代码风格 (Style Guide)
- **命名约定**:
    - **类名**: `PascalCase` (e.g., `WebviewManager`, `EntityPerceptionService`)
    - **方法/变量**: `camelCase` (e.g., `injectJavascript`, `playerHealth`)
    - **常量**: `UPPER_SNAKE_CASE` (e.g., `MAX_PACKET_SIZE`)
    - **接口**: 建议以 `I` 开头 (e.g., `IBridgeService`)，便于区分实现类。
- **注释**:
    - **Javadoc**: 所有 `public` 接口和核心逻辑类必须包含 Javadoc，说明其用途、参数和返回值。
    - **TODO**: 使用 `// TODO: [User] Description` 标记未完成功能。

### 3.3 架构设计原则
- **模块化 (Modularity)**:
    - `core`: 模组加载、配置读取。
    - `browser`: MCEF 浏览器封装与生命周期管理。
    - `bridge`: JS ↔ Java 通信桥梁逻辑。
    - `entity`: 实体控制与 YSM 兼容层。
    - `network`: 客户端-服务端网络包 & 外部 AI 后端通信。
- **通信协议 (Protocols)**:
    - **JS ↔ Java (进程内)**: 通过 `MCEFBrowser.executeJavaScript()` 推送，通过 MCEF 的 `mod://` Scheme Handler 拦截请求实现回调。
    - **Client ↔ Server (Minecraft)**: Forge 标准 `SimpleChannel` 网络包。
    - **Mod ↔ AI Backend (外部)**: HTTP/REST 或 WebSocket，推荐异步 HTTP Client (如 OkHttp)。
- **事件驱动 (Event-Driven)**:
    - 优先监听 Forge 事件总线 (`MinecraftForge.EVENT_BUS`)，尽量避免使用 Mixin 修改原版代码，以提高兼容性。
    - 仅在无法通过事件实现功能时（如修改渲染管线底层）使用 Mixin。
- **线程安全 (Thread Safety)**:
    - **渲染线程**: Webview 的渲染和纹理更新必须在渲染线程操作。
    - **逻辑线程**: 游戏逻辑（实体移动、物品操作）必须在 Server Thread 或 Client Thread 操作。
    - **异步 I/O**: 网络请求、AI 推理、文件读写必须在独立线程池中执行，**严禁阻塞主线程**。

### 3.4 安全性 (Security)
- **指令白名单**: JS -> Java 的调用接口必须经过严格的权限检查。仅暴露必要的 API，禁止前端执行任意 Java 代码或系统命令。
- **输入校验**: 对所有来自 JS 或 AI 的数据进行类型和范围校验，防止空指针或非法参数导致游戏崩溃。

## 4. 交付物清单 (Deliverables)

开发初期需优先完成以下模块：

### 4.1 `MiracleBrowser` 类
基于 `MCEFBrowser` 封装的浏览器实例，提供更高层的抽象。

```java
import com.cinemamod.mcef.MCEF;
import com.cinemamod.mcef.MCEFBrowser;

public class MiracleBrowser {
    private MCEFBrowser browser;
    
    /** 创建浏览器实例 */
    public void create(String url, boolean transparent) {
        if (MCEF.isInitialized()) {
            this.browser = MCEF.createBrowser(url, transparent);
        }
    }
    
    /** 加载指定 URL */
    public void loadUrl(String url) {
        browser.loadURL(url);
    }
    
    /** 执行 JavaScript 代码 */
    public void executeJavaScript(String script) {
        browser.executeJavaScript(script, browser.getURL(), 0);
    }
    
    /** 调整浏览器大小 */
    public void resize(int width, int height) {
        browser.resize(width, height);
    }
    
    /** 获取 OpenGL 纹理 ID 用于渲染 */
    public int getTextureId() {
        return browser.getRenderer().getTextureID();
    }
    
    /** 发送鼠标事件 */
    public void sendMousePress(int x, int y, int button) {
        browser.sendMousePress(x, y, button);
    }
    
    public void sendMouseRelease(int x, int y, int button) {
        browser.sendMouseRelease(x, y, button);
    }
    
    public void sendMouseMove(int x, int y) {
        browser.sendMouseMove(x, y);
    }
    
    /** 发送键盘事件 */
    public void sendKeyPress(int keyCode, long scanCode, int modifiers) {
        browser.sendKeyPress(keyCode, scanCode, modifiers);
    }
    
    /** 关闭并释放资源 */
    public void close() {
        browser.close();
    }
}
```

**渲染示例** (在 `Screen.render()` 中):

```java
@Override
public void render(GuiGraphics guiGraphics, int mouseX, int mouseY, float delta) {
    // 绑定浏览器纹理
    RenderSystem.setShaderTexture(0, browser.getTextureId());
    RenderSystem.setShader(CoreShaders.POSITION_TEX_COLOR);
    
    // 绘制四边形
    BufferBuilder buffer = Tesselator.getInstance().begin(
        VertexFormat.Mode.QUADS, DefaultVertexFormat.POSITION_TEX_COLOR
    );
    buffer.addVertex(x, y + h, 0).setUv(0f, 1f).setColor(255, 255, 255, 255);
    buffer.addVertex(x + w, y + h, 0).setUv(1f, 1f).setColor(255, 255, 255, 255);
    buffer.addVertex(x + w, y, 0).setUv(1f, 0f).setColor(255, 255, 255, 255);
    buffer.addVertex(x, y, 0).setUv(0f, 0f).setColor(255, 255, 255, 255);
    BufferUploader.drawWithShader(buffer.build());
}
```

### 4.2 `BridgeAPI` - JS ↔ Java 通信

MCEF 支持通过 `mod://` Scheme Handler 实现 JS 到 Java 的回调。

**Java 端 (注册 Scheme Handler)**:
```java
// 在 MCEF 初始化后注册自定义协议
MCEF.getApp().getHandle().registerSchemeHandlerFactory(
    "bridge", "",  // 拦截 bridge:// 协议
    (browser, frame, url, request) -> new BridgeSchemeHandler(request)
);
```

**JS 端调用**:
```javascript
// 通过 fetch 调用 Java 端
async function callJava(action, params) {
    const response = await fetch(`bridge://api/${action}`, {
        method: 'POST',
        body: JSON.stringify(params)
    });
    return response.json();
}

// 示例：获取玩家信息
const playerInfo = await callJava('getPlayerInfo', {});
console.log(playerInfo.name, playerInfo.health);

// 示例：执行游戏动作
await callJava('teleport', { x: 100, y: 64, z: 200 });
```

**Java 推送到 JS**:
```java
// 通过 executeJavaScript 推送事件到前端
browser.executeJavaScript(
    "window.dispatchEvent(new CustomEvent('gameEvent', { detail: " + eventJson + " }))",
    browser.getURL(), 0
);
```

### 4.3 `IEntityDriver` 接口
定义控制 YSM 模型动作的标准方法。

```java
public interface IEntityDriver {
    /** 播放指定动画 */
    void playAnimation(String animationId);
    
    /** 设置表情状态 */
    void setExpression(String expressionId);
    
    /** 命令实体移动到目标位置 */
    void navigateTo(BlockPos target);
    
    /** 强制停止当前行为 */
    void halt();
}
```

## 5. 参考资源 (References)

- **MCEF GitHub**: https://github.com/CinemaMod/mcef/tree/1.20.1
- **MCEF Example Mod**: https://github.com/CinemaMod/mcef-fabric-example-mod
- **CinemaMod Discord**: https://discord.gg/rNrh5kW8Ty

---
*Origin of Miracles Dev Team*
