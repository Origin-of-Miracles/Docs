# 模型制作贡献

为学生创建 GeckoLib 3D 模型、动画和纹理。

## 什么是 GeckoLib？

[GeckoLib](https://github.com/bernie-g/geckolib) 是 Minecraft 的高级动画库，支持：

- 骨骼动画
- 关键帧动画
- 平滑过渡
- 多动画混合

## 所需工具

### 必备软件

- **[Blockbench](https://www.blockbench.net/)** - 3D 建模工具
  - 免费开源
  - 支持 GeckoLib 格式
  - 内置动画编辑器

### 可选工具

- **图像编辑器**（Photoshop、GIMP、Krita）
- **参考资料**：《蔚蓝档案》官方立绘

## 文件结构

每个学生需要提供 3 个文件：

```
models/
├── geo/students/
│   └── aris.geo.json          # 几何模型
├── animations/students/
│   └── aris.animation.json    # 动画定义
└── textures/students/
    └── aris.png               # 纹理贴图
```

## 建模流程

### 1. 创建新项目

在 Blockbench 中：

1. **File → New → GeckoLib Animated Model**
2. 设置项目名称（如 `aris`）
3. 选择合适的模板（建议使用 Biped）

### 2. 建模规范

#### 尺寸标准

- **总高度**：1.8 格（约 28.8 像素）
- **头部**：6-8 像素
- **身体**：10-12 像素
- **四肢**：符合人体比例

#### 面数限制

- ⚠️ **< 10,000 三角形**（必须）
- 推荐：5,000-7,000 三角形
- 过高会影响游戏性能

#### 骨骼命名

使用英文小写+下划线：

```
root
├── body
│   ├── head
│   ├── left_arm
│   ├── right_arm
│   ├── left_leg
│   └── right_leg
└── ...
```

### 3. UV 贴图

#### 纹理规范

- **分辨率**：512x512 或 1024x1024
- **格式**：PNG（支持透明通道）
- **文件大小**：< 1MB

#### UV 布局

- 合理利用空间，避免浪费
- 重要部位（脸部）使用更高分辨率
- 对称部位可以镜像复用

### 4. 动画制作

#### 必需动画

| 动画名 | 说明 | 时长 |
|--------|------|------|
| `idle` | 待机动画 | 2-4 秒循环 |
| `walk` | 行走动画 | 1-2 秒循环 |
| `run` | 奔跑动画 | 0.8-1.5 秒循环 |

#### 可选动画

| 动画名 | 说明 | 触发时机 |
|--------|------|----------|
| `talk` | 对话动画 | 与玩家交互时 |
| `wave` | 挥手动画 | 问候玩家 |
| `attack` | 攻击动画 | 战斗时 |
| `hurt` | 受伤动画 | 受到伤害 |
| `death` | 死亡动画 | 生命值归零 |

#### 动画规范

- **帧率**：24 FPS
- **插值**：使用贝塞尔曲线（Bezier）平滑过渡
- **循环**：待机和行走动画必须无缝循环
- **幅度**：动作自然，避免过于夸张

### 5. 导出文件

#### 导出几何模型

1. **File → Export → Export GeckoLib Model**
2. 保存为 `models/geo/students/<id>.geo.json`

#### 导出动画

1. **File → Export → Export GeckoLib Animation**
2. 保存为 `models/animations/students/<id>.animation.json`

#### 导出纹理

1. **File → Export → Export Texture**
2. 保存为 `models/textures/students/<id>.png`

## 质量标准

### 模型质量

✅ **合格标准：**
- 忠于原作角色设计
- 比例协调，无明显变形
- 面数合理，优化良好
- UV 贴图无拉伸扭曲

❌ **不合格特征：**
- 模型过于简陋或粗糙
- 面数超标（> 10,000）
- 纹理模糊或像素化严重
- 骨骼绑定错误，动画异常

### 动画质量

✅ **合格标准：**
- 动作流畅自然
- 无明显抖动或穿模
- 循环动画无缝衔接
- 符合角色性格特点

❌ **不合格特征：**
- 动作僵硬机械
- 关键帧过少，运动不连贯
- 循环动画有明显停顿
- 动作幅度过大或过小

### 纹理质量

✅ **合格标准：**
- 清晰度高，细节丰富
- 色彩还原度好
- 无明显接缝或错位
- 光影效果自然

❌ **不合格特征：**
- 分辨率过低，模糊不清
- 色彩失真或过度饱和
- UV 接缝明显
- 使用不当图案或文字

## 提交流程

### 1. 准备文件

```bash
# 确保文件放置在正确位置
models/
├── geo/students/hoshino.geo.json
├── animations/students/hoshino.animation.json
└── textures/students/hoshino.png
```

### 2. 测试模型

在游戏中测试：

1. 复制文件到开发环境
2. 启动 Minecraft
3. 使用 `/anima summon hoshino` 召唤
4. 检查：
   - 模型是否正确渲染
   - 纹理是否正常显示
   - 动画是否流畅播放
   - 碰撞箱是否合理

### 3. 提交 PR

```bash
git add models/
git commit -m "feat: 添加小鸟游星野模型和动画"
git push origin main
```

在 PR 描述中附上：
- 模型预览截图（至少 3 张不同角度）
- 动画演示 GIF
- 面数统计
- 纹理分辨率

## 优化建议

### 减少面数

- 隐藏面（看不见的部分）可以删除
- 使用 Decimate 修改器简化模型
- 曲面部分使用法线贴图代替高模

### 提升性能

- 使用 LOD（细节层次）模型
- 合并相同材质的网格
- 优化骨骼数量（< 50 根）

### 提升视觉效果

- 使用法线贴图增加细节
- 添加发光材质（如眼睛、光环）
- 使用粒子效果（需额外开发）

## 常见问题

### Q: Blockbench 导出选项找不到 GeckoLib？

A: 需要安装 GeckoLib 插件：
1. Blockbench → File → Plugins
2. 搜索 "GeckoLib"
3. 点击 Install

### Q: 模型在游戏中看不见？

A: 检查：
- 文件名是否与 ID 匹配
- 文件路径是否正确
- JSON 格式是否有误
- 是否重启了游戏

### Q: 动画播放异常？

A: 可能原因：
- 骨骼名称与代码不匹配
- 关键帧插值设置错误
- 动画循环参数未设置
- 帧率不符合标准

### Q: 纹理显示为紫黑格？

A: 说明纹理文件缺失或路径错误：
- 确认纹理文件已上传
- 检查文件名拼写
- 验证 .geo.json 中的纹理引用

## 参考资源

- [Blockbench 官方教程](https://www.blockbench.net/wiki/)
- [GeckoLib 文档](https://github.com/bernie-g/geckolib/wiki)
- [Minecraft 模型规范](https://minecraft.wiki/w/Model)
- [UV 贴图入门教程](https://www.youtube.com/watch?v=...)

## 示例模型

- [阿罗娜模型参考](https://github.com/Origin-of-Miracles/Anima-Assets/tree/main/models)

---

如有疑问，欢迎在 [Discussions](https://github.com/Origin-of-Miracles/Anima-Assets/discussions) 提问！
