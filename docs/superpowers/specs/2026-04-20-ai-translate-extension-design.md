# AI 划词翻译插件设计

**日期**: 2026-04-20
**目标用户**: 程序员
**支持浏览器**: Chrome

---

## 1. 项目概述

开发一个 AI 驱动的浏览器划词翻译插件，支持调用多种模型厂商 API（OpenAI、Anthropic、Google Gemini 等），支持整页翻译，主要面向程序员群体。

---

## 2. 技术架构

### 2.1 扩展规范

- **Manifest V3** + Service Worker（Chrome 官方推荐架构）

### 2.2 组件职责

| 组件 | 职责 |
|------|------|
| **Popup** | API 配置、模型选择、用户偏好设置 |
| **Content Script** | 划词监听、翻译气泡 UI、整页翻译 DOM 操作、代码块识别 |
| **Service Worker** | API 请求、消息路由、快捷键处理 |
| **Storage** | API Keys、用户偏好、翻译历史（本地存储） |

### 2.3 数据流向

```
划词翻译：
用户划词 → Content Script 捕获选中文字 → 发送消息给 Service Worker
        → Service Worker 调用选定模型 API → 返回结果 → Content Script 展示气泡

整页翻译：
触发（右键/工具栏/快捷键）→ Content Script 获取页面 DOM 文本节点
                        → 发送到 Service Worker → 调用翻译 API
                        → 返回译文 → Content Script 在原文下方插入译文区块
```

---

## 3. 功能设计

### 3.1 划词翻译

**触发方式（多种可选）：**
- 弹出气泡按钮：选中文字后出现圆形翻译图标，点击后显示结果
- 即时划词：选中后自动翻译，无需点击
- 快捷键：`Alt+T`（可自定义）

**展示样式（三选一）：**
- 气泡卡片：紧邻选中文本，最大宽度 400px，智能定位
- 侧边面板：右侧滑出，宽度 360px
- 原生下嵌：译文插入到选中文字下方

### 3.2 整页翻译

**触发方式：**
- 右键菜单 → "翻译整页"
- 页面右下角浮动工具栏（可折叠）
- 快捷键 `Alt+Shift+T`

**展示方式：**
- 页面顶部显示翻译进度条
- 译文区块插入到原文区域下方，灰色分隔线隔离
- 支持"原文/译文/双语"视图切换

### 3.3 代码翻译处理

- 识别 `<pre>`、`<code>` 标签和行内代码
- 代码块保留原样不动
- 仅翻译注释、文档字符串、普通文本
- hover 显示"代码未翻译"提示

### 3.4 语言处理

- 自动检测源语言
- 显示语言标签（如 `[EN→ZH]`）
- 用户可手动选择源/目标语言
- 按域名记忆语言偏好

### 3.5 API 配置

**支持厂商：**
- OpenAI（gpt-4o, gpt-4o-mini）
- Anthropic（claude-sonnet-4-6, claude-opus-4-6）
- Google Gemini（gemini-2.5-pro-preview, gemini-2.0-flash）

**配置结构：**
```json
{
  "providers": [
    { "id": "openai", "name": "OpenAI", "models": ["gpt-4o", "gpt-4o-mini"], "defaultModel": "gpt-4o-mini" },
    { "id": "anthropic", "name": "Anthropic", "models": ["claude-sonnet-4-6", "claude-opus-4-6"], "defaultModel": "claude-sonnet-4-6" },
    { "id": "gemini", "name": "Google Gemini", "models": ["gemini-2.5-pro-preview", "gemini-2.0-flash"], "defaultModel": "gemini-2.0-flash" }
  ],
  "activeProvider": "anthropic",
  "apiKeys": {
    "openai": "sk-...",
    "anthropic": "sk-ant-...",
    "gemini": "AIza..."
  }
}
```

### 3.6 数据存储

- **本地存储**：`chrome.storage.local`，不上传任何数据
- **云端同步**（可选）：登录 Google 账号后支持跨设备同步
- **导入/导出**：支持手动导出配置为 JSON 文件

### 3.7 界面语言

- 跟随浏览器语言自动切换（简体中文 / English）

---

## 4. UI 设计

### 4.1 Popup 设置页面布局

```
┌─────────────────────────────────────────┐
│ 🤖 AI 翻译助手                    [v1.0] │
├─────────────────────────────────────────┤
│ 【API 配置】                             │
│  ┌─────────────────────────────────┐    │
│  │ 提供商: [ Anthropic    ▼ ]      │    │
│  │ 模型:   [ claude-sonnet-4-6 ▼ ] │    │
│  │ API Key: [••••••••••••••••••••] │    │
│  │                        [保存]  │    │
│  └─────────────────────────────────┘    │
│                                         │
│ 【翻译触发】                             │
│ ☑ 划词气泡按钮  ☑ 即时划词  ☐ 快捷键    │
│                                         │
│ 【展示样式】                             │
│ ○ 气泡卡片  ● 侧边面板  ○ 原生下嵌      │
│                                         │
│ 【语言偏好】                             │
│ 源语言: [自动检测 ▼]                    │
│ 目标语言: [中文 ▼]                       │
│ ☑ 记忆网站偏好                          │
│                                         │
│ 【高级】                                 │
│ [管理 API Keys] [导入/导出配置]          │
└─────────────────────────────────────────┘
```

### 4.2 划词翻译气泡

- 圆形图标按钮，选中文字后出现
- 点击后显示翻译结果卡片
- 智能定位，避免超出视口

### 4.3 整页翻译工具栏

- 页面右下角浮动工具栏
- 可折叠
- 包含"翻译/切换视图/关闭"按钮

---

## 5. 文件结构

```
ai-translate-extension/
├── manifest.json           # 扩展配置文件
├── popup.html              # 设置页面
├── popup.js                # 设置页面逻辑
├── content.js              # Content Script（划词、DOM操作）
├── background.js           # Service Worker（API调用）
├── styles/
│   ├── popup.css           # 设置页样式
│   ├── content.css         # 气泡/面板样式
│   └── toolbar.css         # 整页翻译工具栏样式
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── docs/
    └── (本设计文档)
```

---

## 6. 测试计划

- 划词翻译三种触发方式
- 整页翻译三种触发方式
- 三种展示样式切换
- API 调用（各厂商）
- 代码块识别与保留
- 语言检测与记忆
- 配置导入/导出
- 云端同步（如启用）
