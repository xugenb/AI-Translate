(function() {
  'use strict';

  /**
   * 多模型厂商 API 封装
   * @class
   */
  class TranslationAPI {
    /**
     * Creates a TranslationAPI instance.
     * @param {string} provider - The API provider name (openai, anthropic, gemini)
     * @param {string} model - The model identifier to use
     * @param {string} apiKey - The API key for authentication
     */
    constructor(provider, model, apiKey) {
      this.provider = provider;
      this.model = model;
      this.apiKey = apiKey;
    }

    /**
     * Translates text using the configured provider.
     * @param {string} text - The text to translate
     * @param {string} [sourceLang='auto'] - Source language code
     * @param {string} [targetLang='zh'] - Target language code
     * @returns {Promise<string>} The translated text
     * @throws {Error} If the provider is unknown or API call fails
     */
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

    /**
     * Translates text using the OpenAI API.
     * @param {string} text - The text to translate
     * @param {string} sourceLang - Source language code
     * @param {string} targetLang - Target language code
     * @returns {Promise<string>} The translated text
     * @throws {Error} If the API call fails or response structure is invalid
     */
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
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid OpenAI response structure');
      }
      return data.choices[0].message.content.trim();
    }

    /**
     * Translates text using the Anthropic API.
     * @param {string} text - The text to translate
     * @param {string} sourceLang - Source language code
     * @param {string} targetLang - Target language code
     * @returns {Promise<string>} The translated text
     * @throws {Error} If the API call fails or response structure is invalid
     */
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
      if (!data.content || !data.content[0] || !data.content[0].text) {
        throw new Error('Invalid Anthropic response structure');
      }
      return data.content[0].text.trim();
    }

    /**
     * Translates text using the Gemini API.
     * @param {string} text - The text to translate
     * @param {string} sourceLang - Source language code
     * @param {string} targetLang - Target language code
     * @returns {Promise<string>} The translated text
     * @throws {Error} If the API call fails or response structure is invalid
     */
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
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
        throw new Error('Invalid Gemini response structure');
      }
      return data.candidates[0].content.parts[0].text.trim();
    }
  }

  /**
   * Creates a TranslationAPI instance based on the provided configuration.
   * @param {Object} apiConfig - The API configuration object
   * @param {Array<{id: string, defaultModel: string}>} apiConfig.providers - Available providers
   * @param {string} apiConfig.activeProvider - The active provider ID
   * @param {Object.<string, string>} apiConfig.apiKeys - Map of provider IDs to API keys
   * @returns {Promise<TranslationAPI>} A configured TranslationAPI instance
   * @throws {Error} If the provider or API key is not found
   */
  async function createTranslator(apiConfig) {
    const { providers, activeProvider, apiKeys } = apiConfig;
    const providerConfig = providers.find(p => p.id === activeProvider);
    if (!providerConfig) throw new Error(`Provider not found: ${activeProvider}`);
    if (!apiKeys[activeProvider]) throw new Error(`API key not set for ${activeProvider}`);
    return new TranslationAPI(activeProvider, providerConfig.defaultModel, apiKeys[activeProvider]);
  }
})();
