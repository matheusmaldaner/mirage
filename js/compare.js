import { MODELS } from './constants.js';
import { PORTUGUESE_DESCRIPTIONS } from './translations_pt.js';

// images to request per model; replicate caps most models at 4, so 4 keeps the grid uniform
const NUM_IMAGES = 4;
// max models that can be selected at once
const MAX_MODELS = 4;
// endpoints served by functions/api/*.js when deployed to cloudflare pages
const API_ENDPOINT = '/api/generate';
const STATUS_ENDPOINT = '/api/status';
// how often to poll a still-running generation, and how long to wait before giving up
const POLL_INTERVAL_MS = 2000;
// generous cap; slow batch models (e.g. aura-flow at 8 images) can run ~4 min, more if cold
const MAX_GENERATION_MS = 6 * 60 * 1000;

// labels respect the page's lang attribute
const IS_PT = document.documentElement.lang.startsWith('pt');
const L = IS_PT
    ? { show: 'Mostrar Modelos', hide: 'Esconder Modelos', noPrompt: 'Digite um prompt primeiro.', noModel: 'Selecione pelo menos um modelo.', noImages: 'Nenhuma imagem retornada.', genFailed: 'Geração falhou: ', tooMany: max => `Você pode selecionar até ${max} modelos.`, alt: (model, n) => `Imagem gerada por ${model}, imagem ${n}`, rate: (lim, mins) => lim ? `Limite de uso atingido (${lim} gerações/hora). Tente novamente em ${mins} min.` : 'Limite de uso atingido. Tente novamente em breve.', rateBare: 'Limite atingido. Tente novamente mais tarde.' }
    : { show: 'Show Models', hide: 'Hide Models', noPrompt: 'Enter a prompt first.', noModel: 'Select at least one model.', noImages: 'No images returned.', genFailed: 'Generation failed: ', tooMany: max => `You can only select up to ${max} models.`, alt: (model, n) => `Generated output for ${model}, Image ${n}`, rate: (lim, mins) => lim ? `Rate limit hit (${lim} generations/hour). Try again in ${mins} min.` : 'Rate limit hit. Try again later.', rateBare: 'Rate limit hit. Try again later.' };

let selectedModels = new Set();
let modelSelectionEnabled = true;
let waitForAllModels = true;

document.addEventListener('DOMContentLoaded', () => {
    const generateButton = document.getElementById('generate-button');
    generateButton.disabled = true;
    generateButton.style.backgroundColor = 'grey';

    // model selection is visible by default, so the toggle button should reflect that
    const wrapper = document.getElementById('model-selection-wrapper');
    const toggleButton = document.getElementById('toggle-models-button');
    if (wrapper && toggleButton) {
        const isHidden = wrapper.style.display === 'none';
        toggleButton.innerHTML = `<i class="fas fa-layer-group me-2"></i>${isHidden ? L.show : L.hide}`;
    }

    const promptInput = document.getElementById('prompt-input');
    if (promptInput) {
        promptInput.addEventListener('input', updateGenerateButtonState);
        promptInput.addEventListener('keydown', event => {
            if (event.key === 'Enter' && !generateButton.disabled) {
                event.preventDefault();
                window.generateModels();
            }
        });
    }

    const waitCheckbox = document.getElementById('waitForAllModelsCheckbox');
    if (waitCheckbox) {
        waitForAllModels = waitCheckbox.checked;
        waitCheckbox.addEventListener('change', () => {
            waitForAllModels = waitCheckbox.checked;
        });
    }

    const formContainer = document.getElementById('form-container');
    if (formContainer) formContainer.style.display = 'flex';

    hideLoadingAnimation();
    showTutorialIfNeeded();

    // model boxes are rendered by constants.js generateModelSelection on DOMContentLoaded
    // attach behavior on the next tick so the boxes already exist
    setTimeout(attachModelBoxHandlers, 0);
});

function attachModelBoxHandlers() {
    const modelBoxes = document.querySelectorAll('.model-box');

    modelBoxes.forEach(box => {
        const img = box.querySelector('img');
        if (img) {
            img.loading = 'eager';
            img.fetchPriority = 'high';
            img.decoding = 'async';
        }

        box.addEventListener('click', () => {
            if (!modelSelectionEnabled) return;

            const modelKey = box.getAttribute('data-model');

            if (box.classList.contains('selected')) {
                box.classList.remove('selected');
                selectedModels.delete(modelKey);
            } else {
                if (selectedModels.size >= MAX_MODELS) {
                    alert(L.tooMany(MAX_MODELS));
                    return;
                }
                box.classList.add('selected');
                selectedModels.add(modelKey);
                updateModelHoverInfo(modelKey);
            }

            updateGenerateButtonState();
        });

        box.addEventListener('mouseenter', () => {
            updateModelHoverInfo(box.getAttribute('data-model'));
        });

        box.addEventListener('mouseleave', () => {
            const modelInfo = document.getElementById('model-info');
            if (selectedModels.size > 0) {
                const lastSelectedModelKey = Array.from(selectedModels).slice(-1)[0];
                updateModelHoverInfo(lastSelectedModelKey);
            } else if (modelInfo) {
                modelInfo.style.display = 'none';
            }
        });
    });
}

function updateGenerateButtonState() {
    const generateButton = document.getElementById('generate-button');
    const promptInput = document.getElementById('prompt-input');
    const promptValue = promptInput ? promptInput.value.trim() : '';
    if (selectedModels.size > 0 && promptValue !== '') {
        generateButton.disabled = false;
        generateButton.style.backgroundColor = '';
    } else {
        generateButton.disabled = true;
        generateButton.style.backgroundColor = 'grey';
    }
}

window.toggleModels = function() {
    const wrapper = document.getElementById('model-selection-wrapper');
    const toggleButton = document.getElementById('toggle-models-button');
    const modelInfo = document.getElementById('model-info');
    if (wrapper.style.display === 'none') {
        wrapper.style.display = '';
        toggleButton.innerHTML = `<i class="fas fa-layer-group me-2"></i>${L.hide}`;
        if (selectedModels.size > 0) {
            const lastSelectedModelKey = Array.from(selectedModels).slice(-1)[0];
            updateModelHoverInfo(lastSelectedModelKey);
        }
    } else {
        wrapper.style.display = 'none';
        toggleButton.innerHTML = `<i class="fas fa-layer-group me-2"></i>${L.show}`;
        if (modelInfo) modelInfo.style.display = 'none';
    }
};

function updateModelHoverInfo(modelKey) {
    const model = MODELS[modelKey];
    const modelInfo = document.getElementById('model-info');
    const modelName = document.getElementById('model-name');
    const modelDescription = document.getElementById('model-description');
    const modelImage1 = document.getElementById('model-image-1');
    const modelImage2 = document.getElementById('model-image-2');
    const modelInfoLink = document.getElementById('model-info-link');

    if (!model || !modelInfo || !modelName || !modelDescription || !modelImage1 || !modelImage2 || !modelInfoLink) {
        return;
    }

    const description = IS_PT && PORTUGUESE_DESCRIPTIONS[modelKey]
        ? PORTUGUESE_DESCRIPTIONS[modelKey]
        : model.description;
    const images = Array.isArray(model.images) ? model.images.filter(src => src && !src.includes('placeholder')) : [];

    modelName.textContent = model.name;
    modelDescription.textContent = description || '';

    // optional per-model italic note (e.g. slow-to-warm-up models)
    const modelNote = document.getElementById('model-note');
    if (modelNote) {
        const note = (IS_PT && model.notePt) ? model.notePt : model.note;
        modelNote.textContent = note || '';
        modelNote.style.display = note ? 'block' : 'none';
    }
    modelImage1.src = images[0] || model.teaser || 'images/onboarding-default-mirage-1.png';
    modelImage2.src = images[1] || images[0] || model.teaser || 'images/onboarding-default-mirage-2.png';
    modelImage1.onerror = () => { modelImage1.src = 'images/onboarding-default-mirage-1.png'; };
    modelImage2.onerror = () => { modelImage2.src = 'images/onboarding-default-mirage-2.png'; };
    modelInfoLink.href = model.link || '#';
    modelInfoLink.style.display = 'flex';
    modelInfo.style.display = 'flex';
}

window.generateModels = async function() {
    const prompt = document.getElementById('prompt-input').value.trim();
    if (!prompt) {
        alert(L.noPrompt);
        return;
    }
    if (selectedModels.size === 0) {
        alert(L.noModel);
        return;
    }

    // clear previous results
    document.getElementById('comparison-results').innerHTML = '';
    // the results wrapper ships hidden (models_display.css sets #model-container display:none); reveal it on generate
    const resultsSection = document.getElementById('model-container');
    if (resultsSection) resultsSection.style.display = 'block';
    hideRateBanner();
    modelSelectionEnabled = false;
    setGenerationUiDisabled(true);
    showLoadingAnimation();

    const selectedEntries = Array.from(selectedModels);
    const tasks = selectedEntries.map((modelKey, order) => {
        const model = MODELS[modelKey];
        return generateForModel(model, prompt, order)
            .then(result => ({ model, result, order }))
            .catch(err => ({ model, err, order }));
    });

    if (waitForAllModels) {
        const results = await Promise.all(tasks);
        results.forEach(item => {
            if (item.err) {
                displayError(item.model.name, item.err, item.order);
            } else {
                displayResult(item.model.name, item.result, item.order);
            }
        });
    } else {
        let firstDone = false;
        await Promise.allSettled(tasks.map(task => task.then(item => {
            if (!firstDone) {
                hideLoadingAnimation();
                firstDone = true;
            }
            if (item.err) {
                displayError(item.model.name, item.err, item.order);
            } else {
                displayResult(item.model.name, item.result, item.order);
            }
        })));
    }

    hideLoadingAnimation();
    setGenerationUiDisabled(false);
    modelSelectionEnabled = true;
};

async function generateForModel(model, prompt, order) {
    const body = {
        model_name: model.id,
        model_version_id: model.version,
        prompt,
        num: NUM_IMAGES,
    };

    const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        showRateBanner(data.limit_per_hour, data.retry_after_seconds);
        throw new Error('rate limit');
    }

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`api error ${res.status}: ${text}`);
    }

    // /api/generate returns the prediction's current state; poll /api/status until it finishes
    let state = await res.json();
    const deadline = Date.now() + MAX_GENERATION_MS;
    while (state.status === 'starting' || state.status === 'processing') {
        if (Date.now() > deadline) throw new Error('timed out waiting for generation');
        await sleep(POLL_INTERVAL_MS);
        const statusRes = await fetch(`${STATUS_ENDPOINT}?id=${encodeURIComponent(state.id)}`);
        if (!statusRes.ok) continue; // transient status read failure, keep polling
        state = await statusRes.json();
    }

    if (state.status !== 'succeeded') {
        throw new Error(state.error || `generation ${state.status}`);
    }
    return state.output || [];
}

function displayResult(modelName, images, order) {
    const resultsContainer = document.getElementById('comparison-results');
    const result = document.createElement('div');
    result.className = 'result model';
    result.id = `result-for-${cssSafe(modelName)}`;

    if (order === 0) result.classList.add('fixed-model');

    if (Array.isArray(images) && images.length > 0) {
        let content = `<h5>${escapeHtml(modelName)}</h5>`;
        images.forEach((image, index) => {
            content += `<img src="${escapeAttr(image)}" alt="${escapeAttr(L.alt(modelName, index + 1))}" class="model-output-image" onError="this.style.display='none';" />`;
        });
        result.innerHTML = content;
    } else {
        result.innerHTML = `<h5>${escapeHtml(modelName)}</h5><p>${L.noImages}</p>`;
    }

    resultsContainer.appendChild(result);

    result.addEventListener('click', () => result.classList.toggle('highlighted'));

    const imgs = result.querySelectorAll('.model-output-image');
    imgs.forEach(img => {
        img.onclick = (event) => {
            event.stopPropagation();
            document.getElementById('pop-up-image').src = img.src;
            new bootstrap.Modal(document.getElementById('image-modal')).show();
        };
    });
}

function displayError(modelName, err, order) {
    const resultsContainer = document.getElementById('comparison-results');
    const result = document.createElement('div');
    result.className = 'result model error';
    result.innerHTML = `<h5>${escapeHtml(modelName)}</h5><p style="color: #b00;">${L.genFailed}${escapeHtml(String(err.message || err))}</p>`;
    resultsContainer.appendChild(result);
}

function showLoadingAnimation() {
    const el = document.getElementById('loading-animation');
    if (el) el.classList.remove('hidden');
}

function hideLoadingAnimation() {
    const el = document.getElementById('loading-animation');
    if (el) el.classList.add('hidden');
}

function setGenerationUiDisabled(disabled) {
    const promptInput = document.getElementById('prompt-input');
    const generateButton = document.getElementById('generate-button');
    if (promptInput) promptInput.disabled = disabled;
    if (generateButton) generateButton.disabled = disabled;
    document.querySelectorAll('.model-box').forEach(box => {
        box.classList.toggle('disabled', disabled);
    });
    if (!disabled) updateGenerateButtonState();
}

function showTutorialIfNeeded() {
    const modal = document.getElementById('tutorialModal');
    if (!modal || localStorage.getItem('tutorialShown')) return;
    new bootstrap.Modal(modal).show();
    localStorage.setItem('tutorialShown', 'true');
}

function showRateBanner(limit, retrySeconds) {
    const banner = document.getElementById('rate-limit-banner');
    const msg = document.getElementById('rate-limit-message');
    if (!banner || !msg) return;
    const mins = retrySeconds ? Math.ceil(retrySeconds / 60) : null;
    msg.textContent = limit ? L.rate(limit, mins) : L.rateBare;
    banner.classList.add('visible');
}

function hideRateBanner() {
    const banner = document.getElementById('rate-limit-banner');
    if (banner) banner.classList.remove('visible');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function cssSafe(s) {
    return String(s).replace(/[^a-z0-9_-]/gi, '-');
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function escapeAttr(s) {
    return escapeHtml(s);
}
