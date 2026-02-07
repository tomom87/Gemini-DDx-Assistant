/**
 * PMID Verifier Module
 * Handles double-check verification of PMIDs against PubMed.
 * Implements Caching (Daily JST) and HEAD/GET Fallback.
 */

const CACHE_KEY = 'pmid_cache';
const CACHE_CAP = 200;
const PUBMED_BASE = 'https://pubmed.ncbi.nlm.nih.gov/';

export class PmidVerifier {
    constructor() {
        this.storage = chrome.storage.local;
    }

    async verify(pmids) {
        if (!pmids || pmids.length === 0) return {};

        const cacheData = await this._getCache();
        const results = {};
        let needsSave = false;
        let newItemsCount = 0;

        for (const pmid of pmids) {
            // 1. Check Cache
            if (cacheData.items[pmid]) {
                results[pmid] = (cacheData.items[pmid].s === 1);
                continue;
            }

            // 2. Fetch Live
            const isVerified = await this._fetchLive(pmid);
            results[pmid] = isVerified;

            // 3. Update Cache
            cacheData.items[pmid] = {
                s: isVerified ? 1 : 0,
                t: Math.floor(Date.now() / 1000)
            };
            needsSave = true;
            newItemsCount++;
        }

        if (needsSave) {
            // Enforce Cap logic if we added new items
            if (Object.keys(cacheData.items).length > CACHE_CAP) {
                this._pruneCache(cacheData);
            }
            await this.storage.set({ [CACHE_KEY]: cacheData });
        }

        return results;
    }

    async _fetchLive(pmid) {
        const url = `${PUBMED_BASE}${pmid}/`;
        try {
            // Try HEAD first
            const headRes = await fetch(url, { method: 'HEAD', cache: 'force-cache' });
            if (headRes.ok) return true;

            // If Method Not Allowed (405) or Forbidden (403), try GET
            if (headRes.status === 405 || headRes.status === 403) {
                const getRes = await fetch(url, { method: 'GET', cache: 'force-cache' });
                // Only require status 200, we don't read the body
                return getRes.ok;
            }

            // 404 or other errors -> invalid
            return false;

        } catch (e) {
            // Network error / Timeout -> Treat as unverified to be safe
            return false;
        }
    }

    async _getCache() {
        const todayJST = new Intl.DateTimeFormat('ja-JP', {
            timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(new Date());

        const data = await this.storage.get(CACHE_KEY);
        const entry = data[CACHE_KEY] || { date: todayJST, items: {} };

        // Daily Reset
        if (entry.date !== todayJST) {
            return { date: todayJST, items: {} };
        }

        return entry;
    }

    _pruneCache(cacheEntry) {
        const keys = Object.keys(cacheEntry.items);
        if (keys.length <= CACHE_CAP) return;

        // Simple strategy: Sort by timestamp and keep newest
        // Convert to array of {k, t}
        const sorted = keys.map(k => ({ k, t: cacheEntry.items[k].t }))
            .sort((a, b) => b.t - a.t); // Descending (newest first)

        const kept = sorted.slice(0, CACHE_CAP);

        // Rebuild object
        const newItems = {};
        kept.forEach(item => {
            newItems[item.k] = cacheEntry.items[item.k];
        });
        cacheEntry.items = newItems;
    }
}
