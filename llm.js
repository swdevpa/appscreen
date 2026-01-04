// LLM Provider Configuration
// Centralized configuration for all AI translation providers and models

const llmProviders = {
    anthropic: {
        name: 'Anthropic (Claude)',
        keyPrefix: 'sk-ant-',
        storageKey: 'claudeApiKey',
        modelStorageKey: 'anthropicModel',
        models: [
            { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5 ($)' },
            { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5 ($$)' },
            { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5 ($$$)' }
        ],
        defaultModel: 'claude-sonnet-4-5-20250929'
    },
    openai: {
        name: 'OpenAI (GPT)',
        keyPrefix: 'sk-',
        storageKey: 'openaiApiKey',
        modelStorageKey: 'openaiModel',
        models: [
            { id: 'gpt-5.1-2025-11-13', name: 'GPT-5.1 ($$$)' },
            { id: 'gpt-5-mini-2025-08-07', name: 'GPT-5 Mini ($$)' },
            { id: 'gpt-5-nano-2025-08-07', name: 'GPT-5 Nano ($)' }
        ],
        defaultModel: 'gpt-5-mini-2025-08-07'
    },
    google: {
        name: 'Google (Gemini)',
        keyPrefix: 'AIza',
        storageKey: 'googleApiKey',
        modelStorageKey: 'googleModel',
        models: [
            { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview ($$$)' },
            { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview ($$)' }
        ],
        defaultModel: 'gemini-3-flash-preview'
    }
};

/**
 * Get the selected model for a provider
 * @param {string} provider - Provider key (anthropic, openai, google)
 * @returns {string} - Model ID
 */
function getSelectedModel(provider) {
    const config = llmProviders[provider];
    if (!config) return null;
    return localStorage.getItem(config.modelStorageKey) || config.defaultModel;
}

/**
 * Get the selected provider
 * @returns {string} - Provider key
 */
function getSelectedProvider() {
    return localStorage.getItem('aiProvider') || 'anthropic';
}

/**
 * Get API key for a provider
 * @param {string} provider - Provider key
 * @returns {string|null} - API key or null
 */
function getApiKey(provider) {
    const config = llmProviders[provider];
    if (!config) return null;
    return localStorage.getItem(config.storageKey);
}

/**
 * Validate API key format for a provider
 * @param {string} provider - Provider key
 * @param {string} key - API key to validate
 * @returns {boolean} - Whether key format is valid
 */
function validateApiKeyFormat(provider, key) {
    const config = llmProviders[provider];
    if (!config) return false;
    return key.startsWith(config.keyPrefix);
}

/**
 * Generate HTML options for model select dropdown
 * @param {string} provider - Provider key
 * @param {string} selectedModel - Currently selected model ID (optional)
 * @returns {string} - HTML string of option elements
 */
function generateModelOptions(provider, selectedModel = null) {
    const config = llmProviders[provider];
    if (!config) return '';

    const selected = selectedModel || getSelectedModel(provider);
    return config.models.map(model =>
        `<option value="${model.id}"${model.id === selected ? ' selected' : ''}>${model.name}</option>`
    ).join('\n');
}

/**
 * Generate image using Google Gemini Image API
 * @param {string} apiKey - Google API key
 * @param {string} prompt - Text prompt for the image
 * @returns {Promise<string>} - Base64 image data string
 */
async function generateImageWithGoogle(apiKey, prompt) {
    const model = 'gemini-3-pro-image-preview'; // specific model for image generation

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                responseModalities: ["IMAGE", "TEXT"],
                imageConfig: {
                    imageSize: "1K" // "1K" is a common standard, though "1024x1024" or similar might be more precise depending on API, assuming 1K is valid per user snippet
                }
            }
        })
    });

    if (!response.ok) {
        const status = response.status;
        const errorBody = await response.json().catch(() => ({}));
        console.error('Google Image API Error:', { status, model, error: errorBody });
        if (status === 401 || status === 403) throw new Error('AI_UNAVAILABLE');
        throw new Error(`API request failed: ${status} - ${errorBody.error?.message || 'Unknown error'}`);
    }

    // Handle streaming-like response format (REST API might return standard JSON but let's handle the structure)
    // The user snippet shows a stream loop but for REST it usually returns a single response object if not streaming? 
    // Wait, the user snippet used `generateContentStream`. The REST API `generateContent` (without stream) returns a full response.
    // Let's assume standard generateContent return structure.

    // User snippet structure for stream: chunk.candidates[0].content.parts[0].inlineData
    // Standard response: candidates[0].content.parts[0].inlineData

    const data = await response.json();

    if (!data.candidates || !data.candidates[0]?.content?.parts) {
        throw new Error('No image generated');
    }

    const part = data.candidates[0].content.parts.find(p => p.inlineData);
    if (!part) {
        // Fallback: check if there is text explaining why it failed or just text output
        const textPart = data.candidates[0].content.parts.find(p => p.text);
        if (textPart) throw new Error(`AI returned text instead of image: ${textPart.text}`);
        throw new Error('No image data in response');
    }

    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
}
