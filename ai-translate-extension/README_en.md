# AI Translate Assistant

AI-powered browser extension for text translation, supporting multiple model providers. Built for programmers.

## Features

### Selection Translation
- **Multiple triggers**: Bubble button, instant translate, keyboard shortcut (Alt+T)
- **Three display styles**: Bubble card, side panel, inline
- **Smart language detection**: Auto-detect source language with label [EN→ZH]

### Full Page Translation
- **Multiple triggers**: Context menu, floating toolbar, shortcut (Alt+Shift+T)
- **Side-by-side view**: Original text with translation below
- **View toggle**: Original / Translation / Both

### Code Protection
- Auto-detect code blocks (`<pre>`, `<code>`)
- Code content preserved, only comments and docstrings translated

### Multi-Provider Support
- **OpenAI**: GPT-4o, GPT-4o-mini
- **Anthropic**: Claude Sonnet 4.6, Claude Opus 4.6
- **Google Gemini**: Gemini 2.5 Pro Preview, Gemini 2.0 Flash

### Other
- Browser language auto-follow (English / Simplified Chinese)
- Import/export configuration
- Per-domain language preferences

## Installation

1. Download/clone this repo
2. Open Chrome, go to `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the `ai-translate-extension` folder

## Configuration

1. Click the extension icon in Chrome toolbar
2. In **API Config**, select provider and model, enter API Key
3. Adjust trigger modes, display style, and language preferences as needed

## Usage

### Selection Translation

| Trigger | Action |
|---------|--------|
| Bubble button | Select text → Click the translate button |
| Instant | Select text to auto-translate |
| Shortcut | Select text → Press `Alt+T` |

### Full Page Translation

| Trigger | Action |
|---------|--------|
| Context menu | Right-click → "Translate entire page" |
| Toolbar | Click the toolbar button (bottom-right) |
| Shortcut | Press `Alt+Shift+T` |

## Tech Stack

- Chrome Extension (Manifest V3)
- Vanilla JavaScript
- Service Worker

## License

MIT
