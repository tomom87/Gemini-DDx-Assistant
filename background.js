/**
 * Background Service Worker (Fixed v1.4.2)
 * Handles Context Menu, Side Panel Handshake, and PMID Verification.
 */

import { PmidVerifier } from './modules/pmid_verifier.js';

const pmidVerifier = new PmidVerifier();
let pendingText = null; // Transient buffer for handshake

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "ddx-start",
        title: "Open DDx Assistant",
        contexts: ["selection"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "ddx-start") {
        // 1. Store text temporarily
        pendingText = info.selectionText;

        // 2. Open Panel
        chrome.sidePanel.open({ tabId: tab.id });
    }
});

// Message Handling
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'PANEL_READY') {
        // 3. Handshake received from Side Panel
        if (pendingText) {
            sendResponse({ text: pendingText });
            pendingText = null; // Clear immediately after sending
        } else {
            sendResponse({ text: null });
        }
        return false; // Synchronous response usually fine here, but safety first
    }

    if (msg.action === 'VERIFY_PMIDS') {
        // 4. Delegate Verification to SW Logic (Async)
        pmidVerifier.verify(msg.pmids).then(results => {
            sendResponse(results);
        });
        return true; // Keep channel open for async response
    }
});
