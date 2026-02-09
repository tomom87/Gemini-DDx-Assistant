// Offscreen Clipboard Handler
chrome.runtime.onMessage.addListener(async (message) => {
    if (message.target !== 'offscreen') return;

    if (message.type === 'WRITE_CLIPBOARD') {
        const text = message.data;
        try {
            const textArea = document.getElementById('temp-copy-area');
            textArea.value = text;
            textArea.select();
            const success = document.execCommand('copy');
            if (success) {
                console.log('Offscreen copy successful');
            } else {
                throw new Error('execCommand returned false');
            }
        } catch (err) {
            console.error('Offscreen copy failed', err);
        } finally {
            // Optional: Close the offscreen document? 
            // Usually, the background script manages the lifecycle.
        }
    }
});
