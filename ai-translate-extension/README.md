# AI Translate Assistant

AI 驱动的浏览器划词翻译插件，支持多种模型厂商 API，面向程序员群体。

[English](README.md) | [简体中文](README_zh-CN.md)

## 功能特性

### 划词翻译
- **多种触发方式**：气泡按钮、即时划词、快捷键 (Alt+T)
- **三种展示样式**：气泡卡片、侧边面板、原生下嵌
- **智能语言检测**：自动检测源语言，支持显示语言标签 [EN→ZH]

### 整页翻译
- **多种触发方式**：右键菜单、浮动工具栏、快捷键 (Alt+Shift+T)
- **双语对照**：保留原文，下方显示译文
- **视图切换**：支持原文 / 译文 / 双语三种视图

### 代码保护
- 自动识别代码块（`<pre>`、`<code>`）
- 代码内容保持不变，仅翻译注释和文档字符串

### 多模型支持
- **OpenAI**: GPT-4o, GPT-4o-mini
- **Anthropic**: Claude Sonnet 4.6, Claude Opus 4.6
- **Google Gemini**: Gemini 2.5 Pro Preview, Gemini 2.0 Flash

### 其他
- 浏览器语言自动跟随（简体中文 / English）
- 支持导入/导出配置
- 按域名记忆语言偏好

## 安装

1. 下载/克隆本仓库
2. 打开 Chrome，进入 `chrome://extensions/`
3. 开启右上角 **Developer mode**
4. 点击 **Load unpacked**
5. 选择 `ai-translate-extension` 文件夹

## 配置

1. 点击 Chrome 工具栏的扩展图标
2. 在 **API 配置** 中选择提供商和模型，输入 API Key
3. 根据需要调整触发方式、展示样式和语言偏好

## 使用方法

### 划词翻译

| 触发方式 | 操作 |
|---------|------|
| 气泡按钮 | 选中文字 → 点击出现的翻译按钮 |
| 即时划词 | 选中文字自动显示翻译结果 |
| 快捷键 | 选中文字 → 按 `Alt+T` |

### 整页翻译

| 触发方式 | 操作 |
|---------|------|
| 右键菜单 | 页面内右键 → "翻译整页" |
| 浮动工具栏 | 点击页面右下角工具栏按钮 |
| 快捷键 | 按 `Alt+Shift+T` |

## 文件结构

```
ai-translate-extension/
├── manifest.json           # 扩展配置
├── _locales/               # 国际化
│   ├── en/messages.json
│   └── zh_CN/messages.json
├── popup.html              # 设置页面
├── popup.css
├── popup.js
├── content/
│   ├── content.js          # Content Script
│   └── content.css         # UI 样式
├── background/
│   └── background.js       # Service Worker
├── lib/
│   ├── storage.js          # 存储层
│   └── api-providers.js    # API 封装
└── icons/                  # 图标
```

## 技术栈

- Chrome Extension (Manifest V3)
- Vanilla JavaScript
- Service Worker

## 注意事项

- 本扩展不会收集或上传任何用户数据
- API Key 存储在本地，仅用于调用翻译 API
- 代码块内的内容不会被翻译

## License

MIT
