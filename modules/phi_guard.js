/**
 * PHI Guard Module (Fixed v1.4.7)
 * Handles PHI detection with strict regex rules and state safety.
 */

// HARD PATTERNS (Red - Strict Block)
const HARD_PATTERNS = [
    // Names (Japanese + Honorifics)
    /([一-龠]{2,})\s*(様|殿|さん|氏)/,
    // Name Label: Require at least one non-whitespace character (prevents empty/space-only matches)
    /Name:\s*([^\n]*\S[^\n]*)/i,

    // IDs (MRN/Chart No/Ticket No) - Specific Labels Only (Removed generic No/No.)
    /(MRN|ID|カルテ|診察券|患者番号|カルテ番号|受診番号)[:\s]*([0-9\-]+)/i,
    /\[Patient ID:\s*([0-9]+)\]/i,

    // Contact Info
    /(0\d{1,4}-\d{1,4}-\d{4})/, // Phone
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/, // Email

    // Address - Labeled Only or Very Specific
    /(住所|〒|Address)[:\s]*([^\n]+)/i,

    // Dates (DOB)
    /(S|H|R|M|T|Showa|Heisei|Reiwa)?(\d{1,2})[\.\/年](\d{1,2})[\.\/月](\d{1,2})/, // Japanese Date
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/, // ISO Date

    // Facility specific - Hospital + Room is enough for RED (Ward optional)
    /([一-龠]+病院)\s*([一-龠]+病棟)?\s*(\d+号室)/,
];

// SOFT PATTERNS (Yellow - Warning)
const SOFT_PATTERNS = [
    // General Facility names (without room number) or partial matches
    /([一-龠]+(病院|クリニック|医院|診療所))/,
    // Context keywords
    /(紹介状|主治医|担当医)/,
];

export class PhiGuard {

    static analyze(text) {
        let redactedText = text;
        let ageContext = null;
        let status = 'GREEN';
        let blockReason = null;

        // 1. Automated Age Extraction & Redaction (Safe substitution)
        const ages = [];

        // Pass 1: "72 歳/yo/month/ヶ月" (Number + Unit)
        // Supports: 歳, yo, years, yrs, months, month, mo, ヶ月, か月 (and variants)
        redactedText = redactedText.replace(/\b(\d{1,3})\s*(歳|yo|years|yrs|months|month|mo|ヶ月|か月)\b/gi, (match, p1, p2, offset, string) => {
            const ageVal = parseInt(p1);

            // Robust Boundary check for dates (2024 / 12 / 31, R6.2.7) - Skip spaces
            // Check previous char (ignoring trailing spaces of previous segment)
            const prevChar = string.slice(0, offset).trimEnd().slice(-1);
            // Check next char (ignoring leading spaces of next segment)
            const nextChar = string.slice(offset + match.length).trimStart().slice(0, 1);

            if (['/', '-', '.'].includes(prevChar)) return match;
            if (['/', '-', '.'].includes(nextChar)) return match;

            if (!isNaN(ageVal)) {
                let finalAge = ageVal;

                // Month conversion logic - Strict Check
                const unit = p2.toLowerCase();
                // Exact match instead of includes() to avoid false positives (e.g. 'monitor')
                if (['months', 'month', 'mo', 'ヶ月', 'か月'].includes(unit)) {
                    finalAge = ageVal / 12;
                }

                ages.push(finalAge);
                return '[AGE_REDACTED]';
            }
            return match;
        });

        // Pass 2: "age: 72" (Label + Number) - Units assumed Years
        redactedText = redactedText.replace(/\bage[:\s]*(\d{1,3})\b/gi, (match, p1, offset, string) => {
            const ageVal = parseInt(p1);

            const prevChar = string.slice(0, offset).trimEnd().slice(-1);
            const nextChar = string.slice(offset + match.length).trimStart().slice(0, 1);

            if (['/', '-', '.'].includes(prevChar)) return match;
            if (['/', '-', '.'].includes(nextChar)) return match;

            if (!isNaN(ageVal)) {
                ages.push(ageVal);
                return '[AGE_REDACTED]';
            }
            return match;
        });

        if (ages.length > 0) {
            const ageGroup = this._categorizeAge(ages[0]);
            ageContext = { age_group: ageGroup };
        }

        // 2. Hard Block Scan (Stateless test)
        let hardHits = [];
        const hardLabels = [
            "Name (氏名)",
            "Name Label (Name:)",
            "ID (MRN/カルテNo)",
            "Patient ID Bracket",
            "Phone (電話)",
            "Email",
            "Address (住所)",
            "Date (日付)",
            "ISO Date",
            "Facility (病院+部屋)"
        ];

        HARD_PATTERNS.forEach((pattern, index) => {
            if (pattern.test(redactedText)) {
                hardHits.push(hardLabels[index] || "Unknown Pattern");
            }
        });

        if (hardHits.length > 0) {
            status = 'RED';
            // Return unique hits
            blockReason = [...new Set(hardHits)];
            return { status, redactedText, ageContext, blockReason };
        }

        // 3. Soft Warning Scan
        let softHits = [];
        const softLabels = [
            "Facility Name (病院名)",
            "Context Keyword (紹介状等)"
        ];

        SOFT_PATTERNS.forEach((pattern, index) => {
            if (pattern.test(redactedText)) {
                softHits.push(softLabels[index] || "Warning Pattern");
            }
        });

        if (softHits.length > 0) {
            status = 'YELLOW';
            blockReason = [...new Set(softHits)];
        }

        return { status, redactedText, ageContext, blockReason };
    }

    static _categorizeAge(age) {
        if (age < 1) return 'Infant';
        if (age < 6) return '0-5';
        if (age < 18) return '6-17';
        if (age < 40) return '18-39';
        if (age < 65) return '40-64';
        return '65+';
    }
}
