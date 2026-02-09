// v1.1.0 (Refined & Fixed)
import { PhiGuard } from './modules/phi_guard.js';
import { KeyRotationManager } from './modules/key_rotation.js';

const keyManager = new KeyRotationManager();

// DOM Elements
const textInput = document.getElementById('input-text');
const statusBanner = document.getElementById('status-banner');
const analyzeBtn = document.getElementById('analyze-btn');
const loadingDiv = document.getElementById('loading');
const resultsContainer = document.getElementById('results-container');

// State
let currentAgeContext = null;

const SYSTEM_PROMPT = `
You are a clinical differential diagnosis assistant for Japanese clinicians.
Output support content only: list differentials, cannot-miss items, red flags, and next questions/tests.
Do NOT provide treatment, dosing, or disposition instructions.
Do NOT claim certainty or provide numeric probabilities.
Use only information present in the input; explicitly list missing info needed.

IMPORTANT: OUTPUT LANGUAGE MUST BE JAPANESE (日本語).
- Diagnosis names: Japanese (English in parens if helpful).
- Explanations: Japanese.
- Next steps: Japanese.
- Chart summary: Japanese.

JSON Output Schema:
{
  "blocked": "none" | "phi_suspected" | "policy_treatment",
  "common_likely": [{ "name": "string (Japanese)", "confidence": "high|medium|low" }],
  "cannot_miss": [{ "name": "string (Japanese)", "confidence": "high|medium|low" }],
  "red_flags": ["string (Japanese)"],
  "next_questions_tests": ["string (Japanese)"],
  "why": [
    { "name": "string (Diagnosis)", "supporting_facts": "string (Japanese)", "counterpoints": "string (Japanese)", "missing_info": "string (Japanese)" }
  ],
  "chart_copy_summary": "string (Japanese)"
}
`;

// --- Initialization ---

const MSG_PATIENT_INFO = "患者情報が含まれている可能性があります";

function handleInputChanged() {
    const text = textInput.value;
    if (!text.trim()) {
        updateStatus('EMPTY');
        return;
    }

    const check = PhiGuard.analyze(text);
    currentAgeContext = check.ageContext;

    if (check.status === 'RED') {
        updateStatus('RED', check.blockReason);
    } else if (check.status === 'YELLOW') {
        updateStatus('YELLOW', check.blockReason);
    } else {
        updateStatus('GREEN');
    }

    return check.status;
}

function updateStatus(type, reason) {
    statusBanner.style.display = 'block';
    statusBanner.className = '';

    if (type === 'EMPTY') {
        statusBanner.style.display = 'none';
        analyzeBtn.disabled = true;
        return;
    }

    if (type === 'RED') {
        statusBanner.classList.add('red');
        // Format: "Patient Info...\n⚠️ Name, Hospital..."
        const reasons = Array.isArray(reason) ? reason.join(', ') : reason;
        statusBanner.innerText = `${MSG_PATIENT_INFO}\n⚠️ ${reasons}`;
        analyzeBtn.disabled = true;
    } else if (type === 'YELLOW') {
        statusBanner.classList.add('yellow');
        const reasons = Array.isArray(reason) ? reason.join(', ') : reason;
        statusBanner.innerText = `⚠️ CHECK INFO: ${reasons}`;
        analyzeBtn.disabled = false;
    } else {
        statusBanner.classList.add('green');
        statusBanner.innerText = `✅ READY (Output: Guidelines & Chart Summary)`;
        analyzeBtn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Handshake with Background
    try {
        const response = await chrome.runtime.sendMessage({ action: 'PANEL_READY' });
        if (response && response.text) {
            // Initial Load: Pre-Redact per spec
            const check = PhiGuard.analyze(response.text);
            textInput.value = check.redactedText; // Show redacted version initially

            // Check status and AUTO-RUN if safe
            const status = handleInputChanged();

            if (status === 'GREEN') {
                runAnalysis();
            }
        }
    } catch (e) {
        console.log("Handshake failed or no pending text", e);
    }

    // LISTENER for subsequent text sends (Context Menu clicked while panel is open)
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === 'NEW_TEXT' && msg.text) {
            textInput.value = PhiGuard.analyze(msg.text).redactedText;
            const status = handleInputChanged();
            if (status === 'GREEN') {
                runAnalysis();
            }
            sendResponse({ success: true });
        }
    });
});

textInput.addEventListener('input', handleInputChanged);
analyzeBtn.addEventListener('click', runAnalysis);


// --- Logic ---

async function runAnalysis() {
    // 1. UI Reset
    analyzeBtn.disabled = true;
    loadingDiv.style.display = 'block';
    resultsContainer.style.display = 'none';

    // Clear ALL previous results
    document.getElementById('list-common').innerHTML = '';
    document.getElementById('list-cannot-miss').innerHTML = '';
    document.getElementById('list-red-flags').innerHTML = '';
    document.getElementById('list-rationale').innerHTML = '';
    document.getElementById('list-next-steps').innerHTML = '';
    // Removed references from UI
    document.getElementById('chart-copy-text').value = '';

    try {
        // 2. SAFETY CHECK: Re-run PhiGuard immediately before send
        // This catches cases where user manually re-typed "72歳" into the box.
        const rawInput = textInput.value;
        const finalCheck = PhiGuard.analyze(rawInput);

        // RED block check
        if (finalCheck.status === 'RED') {
            throw new Error("PHI_BLOCK_ACTIVE");
        }

        // USE REDACTED TEXT for payload (Enforce Age Redaction)
        // We do NOT update the UI textarea here to avoid confused user experience during typing,
        // but we guarantee the API payload is clean.
        const finalText = finalCheck.redactedText;

        // Update context based on THIS final check
        const finalContext = finalCheck.ageContext ? `Age Context: ${finalCheck.ageContext.age_group}` : "Age Context: Unknown";

        const { key, index } = await keyManager.getActiveKey();

        const payload = {
            contents: [{
                parts: [{
                    text: `Selected Text:\n${finalText}\n\n${finalContext}\n\nTask: Produce differential diagnosis JSON.`
                }]
            }],
            systemInstruction: {
                parts: [{ text: SYSTEM_PROMPT }]
            },
            generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json"
            }
        };

        // 4. API Call
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${key}`;

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            await keyManager.reportError(index, response.status);
            throw new Error(`API_ERROR_${response.status}`);
        }

        const data = await response.json();
        await keyManager.incrementUsage(index);

        // 5. Parse & Render
        let textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textResult) throw new Error("NO_CONTENT");

        const json = JSON.parse(textResult);

        if (json.blocked === 'phi_suspected') {
            alert("Model blocked the request due to suspected PHI.");
            return;
        }

        await renderResults(json);

        // AUTO-COPY Chart Summary: Use Background -> Offscreen for reliable access
        if (json.chart_copy_summary) {
            try {
                const res = await chrome.runtime.sendMessage({
                    action: 'CLIPBOARD_COPY',
                    text: json.chart_copy_summary
                });
                if (res && res.success) {
                    console.log("Auto-copy requested successfully");
                } else {
                    console.error("Auto-copy dispatch failed in Background:", res?.error);
                }
            } catch (err) {
                console.error("Auto-copy message dispatch threw:", err);
            }
        }

    } catch (e) {
        if (e.message.includes('ALL_KEYS')) {
            alert("APIキーが設定されていないか、すべて無効（エラー）になっています。Settingsを確認してください。");
        } else if (e.message.includes('API_ERROR')) {
            alert(`API Error: ${e.message}. キーを回転しました。もう一度Analyzeを押してください。`);
        } else if (e.message === 'PHI_BLOCK_ACTIVE') {
            alert("患者情報（PHI）が検出されたため、送信をブロックしました。");
        } else {
            alert(`実行エラー: ${e.message}`);
        }
    } finally {
        loadingDiv.style.display = 'none';
        handleInputChanged();
    }
}


async function renderResults(json) {
    resultsContainer.style.display = 'block';

    const fillList = (id, items, formatter) => {
        const el = document.getElementById(id);
        el.innerHTML = items?.map(formatter).join('') || 'None';
    };

    fillList('list-common', json.common_likely, i => `<div class="diagnosis-item"><span class="confidence-${i.confidence}">${i.name}</span></div>`);
    fillList('list-cannot-miss', json.cannot_miss, i => `<div class="diagnosis-item" style="font-weight:bold;">${i.name}</div>`);

    document.getElementById('list-red-flags').innerHTML = json.red_flags?.map(s => `<li>${s}</li>`).join('') || '';
    document.getElementById('list-next-steps').innerHTML = json.next_questions_tests?.map(s => `<li>${s}</li>`).join('') || '';

    document.getElementById('list-rationale').innerHTML = (json.why || []).map(w => `
    <details>
      <summary>${w.name}</summary>
      <div class="rationale-content">
        <strong>Facts:</strong> ${w.supporting_facts}<br>
        <strong>Counter:</strong> ${w.counterpoints}<br>
        <strong>Missing:</strong> ${w.missing_info}
      </div>
    </details>
  `).join('');

    // References REMOVED per user request

    // Chart Copy
    const copyText = document.getElementById('chart-copy-text');
    copyText.value = json.chart_copy_summary || '';

    document.getElementById('copy-btn').onclick = async () => {
        try {
            await navigator.clipboard.writeText(copyText.value);
            alert('Copied!');
        } catch (err) {
            console.error('Failed to copy', err);
        }
    };
}
