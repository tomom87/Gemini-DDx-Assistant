/**
 * Background Service Worker
 * Handles Context Menu, Handshake, and Offscreen Clipboard operations.
 */

let pendingText = null;

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "ddx-start",
        title: "Open DDx Assistant",
        contexts: ["selection"]
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "ddx-start") {
        pendingText = info.selectionText;

        // 2. Open Panel (if closed)
        await chrome.sidePanel.open({ tabId: tab.id });

        // 3. If panel is already open, notify it immediately
        // This ensures subsequent clicks also trigger analysis
        try {
            await chrome.runtime.sendMessage({
                action: 'NEW_TEXT',
                text: pendingText
            });
            pendingText = null; // Clear if handled
        } catch (e) {
            // Error means panel might not be open yet, which is fine (handled by handshake)
            console.log("Sidepanel not active yet, waiting for handshake");
        }
    }
});

// Message Handling
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'PANEL_READY') {
        if (pendingText) {
            sendResponse({ text: pendingText });
            pendingText = null;
        } else {
            sendResponse({ text: null });
        }
        return false;
    }

    if (msg.action === 'CLIPBOARD_COPY') {
        handleClipboardCopy(msg.text).then(() => {
            sendResponse({ success: true });
        }).catch(err => {
            console.error('Clipboard copy error:', err);
            sendResponse({ success: false, error: err.message });
        });
        return true; // Async
    }
});

async function handleClipboardCopy(text) {
    const hasOffscreen = await chrome.offscreen.hasDocument();
    if (!hasOffscreen) {
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: [chrome.offscreen.Reason.CLIPBOARD],
            justification: 'Copying clinical summary to clipboard automatically'
        });
    }

    // Send the message to the offscreen document - with small delay for initialization
    setTimeout(async () => {
        try {
            await chrome.runtime.sendMessage({
                type: 'WRITE_CLIPBOARD',
                target: 'offscreen',
                data: text
            });
        } catch (e) {
            console.error('Failed to send to offscreen:', e);
        }
    }, 100);
}
