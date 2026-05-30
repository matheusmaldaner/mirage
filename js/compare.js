import { MODELS } from './constants.js';

// number of images to request per model
const NUM_IMAGES = 8;
// max models that can be selected at once
const MAX_MODELS = 4;
// endpoint served by functions/api/generate.js when deployed to cloudflare pages
const API_ENDPOINT = '/api/generate';

let selectedModels = new Set();
let modelSelectionEnabled = true;

document.addEventListener('DOMContentLoaded', () => {
    const generateButton = document.getElementById('generate-button');
    generateButton.disabled = true;
    generateButton.style.backgroundColor = 'grey';

    // model selection is visible by default, so the toggle button should reflect that
    const wrapper = document.getElementById('model-selection-wrapper');
    const toggleButton = document.getElementById('toggle-models-button');
    if (wrapper && toggleButton) {
        const isHidden = wrapper.style.display === 'none';
        toggleButton.innerHTML = isHidden
            ? '<i class="fas fa-layer-group me-2"></i>Show Models'
            : '<i class="fas fa-layer-group me-2"></i>Hide Models';
    }

    hideLoadingAnimation();

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
                if (selectedModels.size >= MAX_MODELS) return;
                box.classList.add('selected');
                selectedModels.add(modelKey);
            }

            updateGenerateButtonState();
        });
    });
}

function updateGenerateButtonState() {
    const generateButton = document.getElementById('generate-button');
    if (selectedModels.size > 0) {
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
    if (wrapper.style.display === 'none') {
        wrapper.style.display = '';
        toggleButton.innerHTML = '<i class="fas fa-layer-group me-2"></i>Hide Models';
    } else {
        wrapper.style.display = 'none';
        toggleButton.innerHTML = '<i class="fas fa-layer-group me-2"></i>Show Models';
    }
};

window.generateModels = async function() {
    const prompt = document.getElementById('prompt-input').value.trim();
    if (!prompt) {
        alert('Enter a prompt first.');
        return;
    }
    if (selectedModels.size === 0) {
        alert('Select at least one model.');
        return;
    }

    // clear previous results
    document.getElementById('comparison-results').innerHTML = '';
    hideRateBanner();
    modelSelectionEnabled = false;
    showLoadingAnimation();

    const tasks = Array.from(selectedModels).map((modelKey, order) => {
        const model = MODELS[modelKey];
        return generateForModel(model, prompt, order)
            .then(result => displayResult(model.name, result, order))
            .catch(err => displayError(model.name, err, order));
    });

    await Promise.allSettled(tasks);

    hideLoadingAnimation();
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

    const data = await res.json();
    return data.output || data.ImageUrls || [];
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
            content += `<img src="${escapeAttr(image)}" alt="Generated output for ${escapeAttr(modelName)}, Image ${index + 1}" class="model-output-image" onError="this.style.display='none';" />`;
        });
        result.innerHTML = content;
    } else {
        result.innerHTML = `<h5>${escapeHtml(modelName)}</h5><p>No images returned.</p>`;
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
    result.innerHTML = `<h5>${escapeHtml(modelName)}</h5><p style="color: #b00;">Generation failed: ${escapeHtml(String(err.message || err))}</p>`;
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

function showRateBanner(limit, retrySeconds) {
    const banner = document.getElementById('rate-limit-banner');
    const msg = document.getElementById('rate-limit-message');
    if (!banner || !msg) return;
    const mins = retrySeconds ? Math.ceil(retrySeconds / 60) : null;
    msg.textContent = limit
        ? `Rate limit hit (${limit} generations/hour). Try again in ${mins} min.`
        : 'Rate limit hit. Try again later.';
    banner.classList.add('visible');
}

function hideRateBanner() {
    const banner = document.getElementById('rate-limit-banner');
    if (banner) banner.classList.remove('visible');
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
