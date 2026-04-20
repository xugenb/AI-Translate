/**
 * 多模型厂商 API 封装
 */

class TranslationAPI {
  constructor(provider, model, apiKey) {
    this.provider = provider;
    this.model = model;
    this.apiKey = apiKey;
  }

  async translate(text, sourceLang = 'auto', targetLang = 'zh') {
    switch (this.provider) {
      case 'openai':
        return this.translateWithOpenAI(text, sourceLang, targetLang);
      case 'anthropic':
        return this.translateWithAnthropic(text, sourceLang, targetLang);
      case 'gemini':
        return this.translateWithGemini(text, sourceLang, targetLang);
      default:
        throw new Error(`Unknown provider: ${this.provider}`);
    }
  }

  async translateWithOpenAI(text, sourceLang, targetLang) {
    const prompt = sourceLang === 'auto'
      ? `Translate the following text to ${targetLang}. Only output the translation, no explanations. Text: ${text}`
      : `Translate from ${sourceLang} to ${targetLang}. Only output the translation. Text: ${text}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  }

  async translateWithAnthropic(text, sourceLang, targetLang) {
    const prompt = sourceLang === 'auto'
      ? `Translate the following text to ${targetLang}. Only output the translation, no explanations. Text: ${text}`
      : `Translate from ${sourceLang} to ${targetLang}. Only output the translation. Text: ${text}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text.trim();
  }

  async translateWithGemini(text, sourceLang, targetLang) {
    const langInstruction = sourceLang === 'auto'
      ? `Translate to ${targetLang}`
      : `Translate from ${sourceLang} to ${targetLang}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${langInstruction}. Only output the translation:\n${text}` }] }]
        })
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text.trim();
  }
}

async function createTranslator(apiConfig) {
  const { providers, activeProvider, apiKeys } = apiConfig;
  const providerConfig = providers.find(p => p.id === activeProvider);
  if (!providerConfig) throw new Error(`Provider not found: ${activeProvider}`);
  if (!apiKeys[activeProvider]) throw new Error(`API key not set for ${activeProvider}`);
  return new TranslationAPI(activeProvider, providerConfig.defaultModel, apiKeys[activeProvider]);
}
