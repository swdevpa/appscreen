// AI Designer (Magical Makeover) - Automated design generation
// Analyzes screenshots, generates copy, selects fonts/colors, and creates background images

// Track tooltips
let magicalDesignerTooltipShown = false;

/**
 * Show a tooltip for the AI Designer feature
 */
function showMagicalDesignerTooltip() {
    if (magicalDesignerTooltipShown || localStorage.getItem('magicalDesignerTooltipDismissed')) return;

    const provider = getSelectedProvider();
    const config = llmProviders[provider];
    const apiKey = localStorage.getItem(config.storageKey);
    // Google provider is best for this due to Gemini Image generation
    if (!apiKey) return;

    magicalDesignerTooltipShown = true;
    // ... Tooltip logic similar to magical-titles ...
}

/**
 * Show the Magical Designer confirmation dialog
 */
function showMagicalDesignerDialog() {
    if (!state.screenshots || state.screenshots.length === 0) {
        showAppAlert('Please add some screenshots first.', 'info');
        return;
    }

    const provider = getSelectedProvider();
    const config = llmProviders[provider];
    const apiKey = localStorage.getItem(config.storageKey);

    if (!apiKey) {
        showAppAlert('Please configure your AI API key in Settings first.', 'error');
        return;
    }

    // Warn if not using Google? The image gen part needs Google key for Gemini
    // But we can perhaps use the configured provider for text, and check for Google key for image?
    // For simplicity, let's assume we use the selected provider for text, 
    // BUT we need a Google Key for the image generation part if we want to use Gemini 3.
    // If the user selected OpenAI/Claude, we can still use Gemini for Image if a Google Key is present?
    // Or just require Google provider to be active for the full experience?
    // Let's check if we have a Google key specifically for the image part.

    const googleKey = getApiKey('google');
    if (!googleKey) {
        // Warning: Background generation requires Google API Key (for Gemini)
        // We could prompt them or just fail later.
        // For now, let's proceed and if it fails, it fails with a clear error.
    }

    // Populate language dropdown
    const langSelect = document.getElementById('magical-designer-language');
    if (langSelect) {
        langSelect.innerHTML = state.projectLanguages.map(lang => {
            const langName = languageNames[lang] || lang;
            return `<option value="${lang}">${langName}</option>`;
        }).join('');
    }

    // Show modal
    const modal = document.getElementById('magical-designer-modal');
    if (modal) {
        modal.classList.add('visible');
        document.getElementById('magical-designer-count').textContent = state.screenshots.length;
    }
}

/**
 * Hide the dialog
 */
function hideMagicalDesignerDialog() {
    const modal = document.getElementById('magical-designer-modal');
    if (modal) modal.classList.remove('visible');
}

/**
 * Main function to generate full designs
 */
async function generateMagicalDesigns() {
    hideMagicalDesignerDialog();

    const provider = getSelectedProvider();
    const providerConfig = llmProviders[provider];
    const apiKey = localStorage.getItem(providerConfig.storageKey);

    // We specifically need Google API Key for image generation
    // Check if we have it, even if current provider is different
    let googleApiKey = getApiKey('google');
    if (!googleApiKey && provider === 'google') googleApiKey = apiKey;

    if (!googleApiKey) {
        // If we don't have a google key, we can't generate the image. 
        // We could fall back to just text/layout, or ask for the key.
        // For now, let's try to proceed with text only or error?
        // Let's error nicely.
        await showAppAlert('To generate Magic Backgrounds, you need a Google API Key (Gemini) configured in Settings.', 'warning');
        return;
    }

    // Get selected language
    const langSelect = document.getElementById('magical-designer-language');
    const sourceLang = langSelect?.value || state.projectLanguages[0] || 'en';
    const langName = languageNames[sourceLang] || 'English';

    // Collect images
    const images = [];
    for (const screenshot of state.screenshots) {
        const dataUrl = getScreenshotDataUrl(screenshot, sourceLang);
        if (dataUrl) {
            const parsed = parseDataUrl(dataUrl);
            if (parsed) images.push(parsed);
        }
    }

    if (images.length === 0) return;

    // UI Progress
    const createProgress = () => {
        const el = document.createElement('div');
        el.id = 'magical-designer-progress';
        el.innerHTML = `
            <div class="modal-overlay visible">
                <div class="modal">
                     <div class="modal-icon" style="background: linear-gradient(135deg, #FF0080 0%, #7928CA 100%);">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: white; animation: spin 2s linear infinite;">
                            <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6L5.7 21l2.3-7-6-4.6h7.6z"/>
                        </svg>
                    </div>
                    <h3 class="modal-title">AI Designer Working...</h3>
                    <p id="md-status" style="color: var(--text-secondary); margin-top: 8px;">Analyzing app aesthetics...</p>
                    <div class="progress-steps" style="margin-top: 15px; text-align: left; font-size: 13px; color: var(--text-tertiary);">
                        <div id="step-1">○ Analyzing screenshots</div>
                        <div id="step-2">○ Generating high-conversion copy</div>
                        <div id="step-3">○ Designing background</div>
                        <div id="step-4">○ Applying magic</div>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(el);
        return el;
    };

    const progressEl = createProgress();
    const updateStep = (step, text) => {
        document.getElementById(`step-${step}`).innerHTML = '● ' + text;
        document.getElementById(`step-${step}`).style.color = 'var(--text-primary)';
        document.getElementById('md-status').textContent = text;

        // Mark previous steps done
        for (let i = 1; i < step; i++) {
            document.getElementById(`step-${i}`).innerHTML = '✓ ' + document.getElementById(`step-${i}`).textContent.substring(2);
            document.getElementById(`step-${i}`).style.color = '#4CAF50';
        }
    };

    try {
        // Step 1: Analyze & Generate Copy + Design Params
        updateStep(1, 'Analyzing screenshots & aesthetics...');

        const prompt = `You are an expert App Store Designer and Marketing Copywriter. 
Your goal is to create a "High Conversion" makeover for these ${images.length} screenshots.

1. **Analyze** the screenshots to understand the app's purpose, color palette, and vibe (e.g., minimal, playful, professional, dark mode, etc.).
2. **Generate Copy**: Write punchy, benefit-driven headlines and subheadlines. Focus on the user problem solved.
3. **Design Background**: Describe a SINGLE, cohesive background image that would look stunning behind these screenshots.
   - It should be abstract, professional, and not distracting.
   - It should complement the app's colors (e.g., if app is white, maybe a colored gradient background; if app is dark, maybe a deep rich background).
   - High conversion backgrounds often use: smooth 3D abstract shapes, glassmorphism, soft gradients, or subtle texture.
   - Provide a precise prompt for an image generator (DALL-E 3/Gemini) to create this background.

CRITICAL OUTPUT FORMAT (JSON ONLY):
{
    "design_analysis": {
        "app_vibe": "...",
        "primary_color": "#HEX",
        "accent_color": "#HEX",
        "font_style": "Modern/Serif/Handwritten"
    },
    "copy": {
        "0": { "headline": "...", "subheadline": "..." },
        "1": { "headline": "...", "subheadline": "..." }
        ...
    },
    "background_prompt": "A high quality abstract background image featuring...",
    "background_color_overlay": "#HEX",
    "text_color": "#HEX"
}

Language: ${langName}
`;

        updateStep(2, 'Generating high-converting copy...');

        let analysisResponse;
        if (provider === 'anthropic') {
            analysisResponse = await generateTitlesWithAnthropic(apiKey, images, prompt);
        } else if (provider === 'openai') {
            analysisResponse = await generateTitlesWithOpenAI(apiKey, images, prompt);
        } else if (provider === 'google') {
            analysisResponse = await generateTitlesWithGoogle(apiKey, images, prompt);
        } else {
            throw new Error('Unknown provider');
        }

        // Clean and parse JSON
        const jsonStr = analysisResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const designData = JSON.parse(jsonStr.match(/\{[\s\S]*\}/)[0]);

        console.log('Design Analysis:', designData);

        // Step 3: Generate Background Image
        updateStep(3, 'Generating custom background (Gemini)...');

        let backgroundImageVal = null;
        if (designData.background_prompt) {
            // Enhance prompt for Gemini
            const enhancedPrompt = `${designData.background_prompt}. High resolution, abstract, wallpaper style, no text, smooth lighting, 8k, photorealistic or high-end 3D render style.`;
            try {
                backgroundImageVal = await generateImageWithGoogle(googleApiKey, enhancedPrompt);
            } catch (imgError) {
                console.error("Background text-to-image failed:", imgError);
                // Fallback to gradient if image fails?
            }
        }

        // Step 4: Apply Everything
        updateStep(4, 'Applying magical design...');

        // 4a. Apply Text (Copy & Color)
        for (let i = 0; i < state.screenshots.length; i++) {
            const ss = state.screenshots[i];
            const copy = designData.copy[String(i)] || designData.copy[i];

            if (copy) {
                if (!ss.text) ss.text = { headlines: {}, subheadlines: {} };
                if (!ss.text.headlines) ss.text.headlines = {};
                if (!ss.text.subheadlines) ss.text.subheadlines = {};

                ss.text.headlines[sourceLang] = copy.headline;
                ss.text.subheadlines[sourceLang] = copy.subheadline;
            }
        }

        // 4b. Apply Global Settings (Colors, Fonts)
        // We update the defaults so it applies to all, OR we update each screenshot?
        // Usually safer to update specific screenshot instances to avoid overwriting defaults if user didn't want it.
        // But for a "makeover" we want a consistent look.

        const newTextSettings = {
            headlineColor: designData.text_color || '#ffffff',
            subheadlineColor: designData.text_color || '#ffffff',
            // Simple mapping for font style
            headlineFont: designData.design_analysis.font_style?.toLowerCase().includes('serif') ? 'Playfair Display' : 'Inter',
            subheadlineFont: designData.design_analysis.font_style?.toLowerCase().includes('serif') ? 'Playfair Display' : 'Inter'
        };

        // Load the font if needed
        if (newTextSettings.headlineFont !== 'Inter' && typeof loadGoogleFont === 'function') {
            loadGoogleFont(newTextSettings.headlineFont);
        }

        // 4c. Apply Background
        // Start with defaults to ensure we have all properties (gradient, solid, noise, etc.)
        const newBackgroundSettings = JSON.parse(JSON.stringify(state.defaults.background));

        // Update with our new settings
        newBackgroundSettings.type = backgroundImageVal ? 'image' : 'gradient';

        if (backgroundImageVal) {
            // Preload the image so it's ready for drawing
            const bgImg = new Image();
            await new Promise((resolve, reject) => {
                bgImg.onload = resolve;
                bgImg.onerror = reject;
                bgImg.src = backgroundImageVal;
            });

            newBackgroundSettings.image = bgImg; // Assign the Image object, not the string
            newBackgroundSettings.imageFit = 'cover';
        }

        newBackgroundSettings.overlayColor = designData.background_color_overlay || '#000000';
        newBackgroundSettings.overlayOpacity = 30; // Good default for legibility

        // If image failed, maybe set a nice gradient based on analyzed colors
        if (!backgroundImageVal && designData.design_analysis.primary_color) {
            newBackgroundSettings.type = 'gradient';
            newBackgroundSettings.gradient = {
                angle: 135,
                stops: [
                    { color: designData.design_analysis.primary_color, position: 0 },
                    { color: designData.design_analysis.accent_color || '#000000', position: 100 }
                ]
            };
        } else if (!newBackgroundSettings.gradient) {
            // Ensure gradient exists if we started from something else or if defaults are weird
            newBackgroundSettings.gradient = {
                angle: 135,
                stops: [
                    { color: '#667eea', position: 0 },
                    { color: '#764ba2', position: 100 }
                ]
            };
        }

        // Apply to all screenshots
        state.screenshots.forEach(ss => {
            // Text Styles
            Object.assign(ss.text, newTextSettings);
            // Background
            // We need to clone to avoid reference issues for the settings object
            const bgCopy = JSON.parse(JSON.stringify(newBackgroundSettings));

            // CRITICAL: JSON.stringify destroys the Image object (turns it into {}), so we must manually restore it
            if (newBackgroundSettings.image) {
                bgCopy.image = newBackgroundSettings.image;
            }

            ss.background = bgCopy;

            // Should we set 3D/Layout?
            // "High conversion" layout adjustments
            ss.screenshot.use3D = true;
            ss.screenshot.scale = 75; // Smaller to fit text
            ss.screenshot.x = 50; // Center horz
            ss.screenshot.y = 65; // Move down (50 is center) to clear header
            ss.screenshot.rotation3D = { x: 0, y: 15, z: 0 }; // Nice slight angle
            ss.screenshot.shadow = { enabled: true, color: '#000000', blur: 50, opacity: 40, x: 0, y: 30 };

            // Ensure text is readable and top-aligned
            ss.text.position = 'top';
            ss.text.offsetY = 12; // 12% from top
            ss.text.headlineSize = 80;
            ss.text.headlineWeight = '900'; // Extra Bold
            ss.text.headlineCase = 'uppercase'; // ALL CAPS

            // Enable subheadlines explicitly
            ss.text.subheadlineEnabled = true;
            ss.text.subheadlineSize = 40;
            ss.text.subheadlineWeight = '500';
            ss.text.subheadlineOpacity = 90; // High visibility
        });

        // Update UI
        syncUIWithState();
        updateCanvas();
        saveState();

        progressEl.remove();
        await showAppAlert('✨ AI Design Makeover Complete!', 'success');

    } catch (error) {
        console.error('Magical Designer Error:', error);
        progressEl.remove();
        await showAppAlert(`Design generation failed: ${error.message}`, 'error');
    }
}
