/**
 * Key Rotation Manager (Fixed v1.4.2)
 * Handles selection, error tracking, and daily resets for 4 API keys.
 * Uses strict JST Date formatting for stability.
 */

const MAX_DAILY_USAGE = 20;
const COOLDOWN_LONG_MS = 5 * 60 * 1000; // 5 minutes (429, 503)
const COOLDOWN_SHORT_MS = 1 * 60 * 1000; // 1 minute (500, etc)

export class KeyRotationManager {
    constructor() {
        this.storage = chrome.storage.local;
    }

    async getActiveKey() {
        const data = await this.storage.get(['api_keys', 'key_usage']);
        const keys = data.api_keys || [];
        let usage = data.key_usage || {};

        const todayJST = this._getTodayJST();

        // Reset check for ALL keys
        let needsSave = false;
        for (let i = 0; i < 4; i++) {
            const keyId = `key_${i}`;
            if (!usage[keyId] || usage[keyId].date !== todayJST) {
                usage[keyId] = { count: 0, date: todayJST, status: 'active', cooldown_until: 0 };
                needsSave = true;
            }
        }
        if (needsSave) await this.storage.set({ key_usage: usage });

        // Select Key
        const now = Date.now();
        for (let i = 0; i < keys.length; i++) {
            if (!keys[i]) continue; // Skip empty slots

            const stats = usage[`key_${i}`];

            // Skip Disabled (Auth Error)
            if (stats.status === 'disabled') continue;

            // Skip Cooldown
            if (stats.status === 'cooldown') {
                if (now < stats.cooldown_until) continue;
                // Cooldown expired
                stats.status = 'active';
                stats.cooldown_until = 0;
                await this._updateUsage(i, stats);
            }

            // Skip Daily Limit
            if (stats.count >= MAX_DAILY_USAGE) continue;

            // Found active key
            return { key: keys[i], index: i };
        }

        throw new Error('ALL_KEYS_EXHAUSTED_OR_DISABLED');
    }

    async incrementUsage(index) {
        const data = await this.storage.get('key_usage');
        const usage = data.key_usage || {};
        const keyId = `key_${index}`;

        if (usage[keyId]) {
            usage[keyId].count++;
            await this.storage.set({ key_usage: usage });
        }
    }

    async reportError(index, status) {
        const data = await this.storage.get('key_usage');
        const usage = data.key_usage || {};
        const keyId = `key_${index}`;

        if (!usage[keyId]) return;

        if (status === 401 || status === 403) {
            usage[keyId].status = 'disabled'; // Requires user intervention
        } else if (status === 429 || status === 503) {
            usage[keyId].status = 'cooldown';
            usage[keyId].cooldown_until = Date.now() + COOLDOWN_LONG_MS;
        } else {
            // 500 or others
            usage[keyId].status = 'cooldown';
            usage[keyId].cooldown_until = Date.now() + COOLDOWN_SHORT_MS;
        }

        await this.storage.set({ key_usage: usage });
    }

    _getTodayJST() {
        // Robust JST Date: YYYY-MM-DD
        // Using Intl with explicit parts to avoid locale slash/dash variance
        const formatter = new Intl.DateTimeFormat('ja-JP', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });

        const parts = formatter.formatToParts(new Date());
        const y = parts.find(p => p.type === 'year').value;
        const m = parts.find(p => p.type === 'month').value;
        const d = parts.find(p => p.type === 'day').value;

        return `${y}-${m}-${d}`;
    }

    async _updateUsage(index, newStats) {
        const data = await this.storage.get('key_usage');
        const usage = data.key_usage || {};
        usage[`key_${index}`] = newStats;
        await this.storage.set({ key_usage: usage });
    }
}
