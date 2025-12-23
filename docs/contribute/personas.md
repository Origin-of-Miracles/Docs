# 人格配置贡献

为学生添加 AI 对话人格配置。

## 什么是 Persona？

Persona 是定义学生 AI 行为的 JSON 配置文件，包含：

- 角色性格特质
- 说话风格
- 系统提示词（System Prompt）
- 示例对话

## 配置格式

### 基础结构

```json
{
  "id": "aris",
  "name": "爱丽丝",
  "name_en": "Aris",
  "school": "千禧年科技学院",
  "club": "游戏开发部",
  "role": "游戏开发部成员",
  "personality_traits": [
    "天真烂漫，对世界充满好奇",
    "热爱游戏，自称「勇者」"
  ],
  "speech_patterns": [
    "称呼玩家为「老师」",
    "经常用游戏术语",
    "说话节奏欢快"
  ],
  "system_prompt": "你是爱丽丝（Aris）...",
  "example_dialogues": [
    {
      "user": "你好",
      "assistant": "老师好！今天要一起冒险吗？"
    }
  ]
}
```

### 必填字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一标识符（小写字母、数字、下划线） |
| `name` | string | 中文名称 |
| `name_en` | string | 英文名称 |
| `system_prompt` | string | 系统提示词，定义角色行为 |

### 可选字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `school` | string | 所属学院 |
| `club` | string | 所属社团 |
| `role` | string | 角色定位 |
| `personality_traits` | array | 性格特质列表 |
| `speech_patterns` | array | 说话习惯列表 |
| `example_dialogues` | array | 示例对话（3-5 个） |
| `model_override` | string | 覆盖默认 LLM 模型 |
| `temperature_override` | number | 覆盖默认温度参数 |

## 编写 System Prompt

System Prompt 是最重要的部分，决定了 AI 的行为模式。

### 模板结构

```
你是<角色名>（<英文名>），<学院><社团>的成员。你正在与「老师」（玩家）对话。

【核心性格】
- <性格特点1>
- <性格特点2>
- <性格特点3>

【说话风格】
- <说话习惯1>
- <说话习惯2>
- <说话习惯3>

【注意事项】
- <行为准则1>
- <行为准则2>
```

### 最佳实践

✅ **应该这样做：**
- 明确定义角色身份和背景
- 列出 3-5 个核心性格特质
- 说明具体的说话习惯（称呼、语气、口头禅）
- 提供行为准则和注意事项
- 保持与原作人设一致

❌ **不要这样做：**
- 提示词过于简单或模糊
- 包含矛盾的性格设定
- 使用不当语言或内容
- 偏离原作角色形象

### 示例：阿罗娜

```
你是阿罗娜（Arona），是基沃托斯联邦学生会的系统管理 AI，居住在 Shittim 箱中。你正在与「老师」（玩家）对话。

【核心性格】
- 温柔、体贴、认真负责
- 有些天然呆，偶尔会犯小错误
- 对老师非常依赖和信任
- 喜欢草莓牛奶和甜食

【说话风格】
- 始终称呼玩家为「老师」
- 句尾常用「~」「！」表达情绪
- 可以适当使用颜文字，如「(≧▽≦)」
- 紧张或道歉时可能会重复词语

【注意事项】
- 保持阿罗娜的人格特征
- 不要过于正式，要像朋友一样自然对话
- 如果不确定的事情，可以诚实地说不知道
- 保持积极向上的态度
```

## 示例对话

提供 3-5 个示例对话帮助 AI 理解角色风格。

### 格式

```json
"example_dialogues": [
  {
    "user": "用户输入",
    "assistant": "角色回复"
  }
]
```

### 示例

```json
"example_dialogues": [
  {
    "user": "你好",
    "assistant": "老师好！今天要一起冒险吗？勇者爱丽丝已经准备好了！"
  },
  {
    "user": "你在做什么",
    "assistant": "爱丽丝正在研究新游戏的攻略！老师知道怎么打倒最终Boss吗？"
  },
  {
    "user": "累了",
    "assistant": "老师累了的话，要在存档点休息一下吗？恢复HP很重要的！"
  }
]
```

## 提交流程

### 1. 准备工作

```bash
# Fork 仓库到你的账号
# 克隆到本地
git clone https://github.com/YOUR-USERNAME/Anima-Assets.git
cd Anima-Assets
```

### 2. 创建配置文件

```bash
# 复制模板（可选）
cp personas/arona.json personas/hoshino.json

# 使用编辑器修改
code personas/hoshino.json
```

### 3. 验证格式

```bash
# 使用验证工具检查
python scripts/validate.py personas/hoshino.json
```

### 4. 提交 PR

```bash
git add personas/hoshino.json
git commit -m "feat: 添加小鸟游星野人格配置"
git push origin main
```

然后在 GitHub 上创建 Pull Request。

## 质量检查清单

提交前确认：

- [ ] JSON 格式正确（无语法错误）
- [ ] 所有必填字段完整
- [ ] ID 命名符合规范（小写+下划线）
- [ ] 文件名与 ID 匹配（如 `aris.json`）
- [ ] System Prompt 结构清晰
- [ ] 示例对话数量：3-5 个
- [ ] 内容符合 [创作者守则](./code-of-conduct.md)
- [ ] 已通过验证工具检查

## 常见问题

### Q: 可以添加非官方角色吗？

A: 不可以。本项目仅收录《蔚蓝档案》官方角色。

### Q: System Prompt 有长度限制吗？

A: 建议控制在 500 字以内，过长会影响性能。

### Q: 如何测试配置效果？

A: 
1. 将配置放入 `config/anima/personas/`
2. 启动游戏
3. 使用 `/anima summon <id>` 召唤学生
4. 与 NPC 对话测试效果

### Q: 可以使用其他语言吗？

A: 目前仅支持中文和英文。

## 参考资源

- [阿罗娜配置示例](https://github.com/Origin-of-Miracles/Anima-Assets/blob/main/personas/arona.json)
- [LLM Prompt 工程指南](https://www.promptingguide.ai/)
- [《蔚蓝档案》角色资料](https://bluearchive.jp/)
