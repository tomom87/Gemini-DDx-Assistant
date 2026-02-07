document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save-btn').addEventListener('click', saveOptions);

const KEY_COUNT = 4;

function createKeyInputs() {
    const container = document.getElementById('keys-list');
    container.innerHTML = '';

    for (let i = 1; i <= KEY_COUNT; i++) {
        const div = document.createElement('div');
        div.className = 'key-container';
        div.innerHTML = `
      <div class="key-header">
        <span>Key ${i}</span>
        <span id="status-${i}" class="status">Unknown</span>
      </div>
      <input type="password" id="key-${i}" placeholder="Enter Google AI Studio API Key">
    `;
        container.appendChild(div);
    }
}

async function saveOptions() {
    const keys = [];
    for (let i = 1; i <= KEY_COUNT; i++) {
        const val = document.getElementById(`key-${i}`).value.trim();
        keys.push(val);
    }

    // Preserve existing usage stats, just update keys
    const data = await chrome.storage.local.get(['api_keys']);

    chrome.storage.local.set({ api_keys: keys }, () => {
        const status = document.getElementById('save-status');
        status.textContent = 'Settings saved.';
        status.className = 'success';
        setTimeout(() => status.textContent = '', 2000);
        restoreOptions(); // Refresh UI
    });
}

async function restoreOptions() {
    createKeyInputs();
    const data = await chrome.storage.local.get(['api_keys', 'key_usage']);
    const keys = data.api_keys || [];
    const usage = data.key_usage || {};

    // Check JST date for reset display logic (actual reset happens in background)
    const todayJST = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

    for (let i = 0; i < KEY_COUNT; i++) {
        const input = document.getElementById(`key-${i + 1}`);
        if (keys[i]) input.value = keys[i];

        const stats = usage[`key_${i}`] || { count: 0, date: todayJST, status: 'active' };
        const statusSpan = document.getElementById(`status-${i + 1}`);

        let text = `Usage: ${stats.count}/20`;
        if (stats.date !== todayJST) text = 'Usage: 0/20 (Reset)';

        if (stats.status === 'disabled') {
            text += ' (DISABLED: Auth Error)';
            statusSpan.style.color = 'red';
        } else if (stats.status === 'cooldown') {
            text += ' (COOLDOWN)';
            statusSpan.style.color = 'orange';
        } else {
            text += ' (Active)';
            statusSpan.style.color = 'green';
        }
        statusSpan.textContent = text;
    }
}
