# Chrome Extension Design Specification: DDx Side Panel with Gemini 3.0 Flash Preview

**Version**: 1.5.0 (Final Implementation)
**Status**: APPROVED & IMPLEMENTED
**Target User**: Japanese Medical Professionals
**Model**: `gemini-3-flash-preview`
**API Provider**: Google AI Studio (User-supplied API Keys)

---

## 1. Safety & Privacy Architecture (Non-Negotiable)

### 1.1 PHI Protection Logic (The "Review-First" Gate)
The extension **MUST NOT** automatically send text to the LLM. It enforces a strict "Human-in-the-Loop" workflow.

#### Priority Rules
1.  **RED ALERT (Hard Block)**: If ANY high-risk pattern is matched -> **Analyze Button is DISABLED**.
    *   User MUST manually edit the text to remove the PHI.
    *   Re-scan happens on every keystroke/change.
2.  **YELLOW WARNING (Soft Block)**: If ONLY medium-risk patterns are matched -> **Analyze Button is ACTIVE**.
    *   User sees a warning banner ("Verify Info").
    *   User must explicitly click "Analyze". **No Auto-Send**.
3.  **GREEN (Clean)**: No matches -> **Analyze Button is ACTIVE**.
    *   **No Auto-Send** by default.

#### Detection Patterns (Refined v1.5)
*   **Hard Block (Red)**:
    *   **Names**: `Name:` followed by at least one valid character (Kanji/Kana/Alpha). Excludes empty/whitespace-only.
    *   **IDs**: `MRN`, `ID`, `カルテ`, `診察券` + digits. **Excludes generic `#` or `No.`** (to avoid document number false positives).
    *   **Contact**: Phone, Email.
    *   **Address**: Labeled (`住所:`, `〒`, `Address:`) only. Broad "Prefecture...City" matching is Removed to prevent false positives.
    *   **Dates**: Full DOB (`YYYY/MM/DD`, `S58.4.12`, `R6.2.7`).
    *   **Facility**: `病院` + `病棟` + `号室` (Strict combination).
    *   **Structure**: `[Patient ID: ...]` style brackets.
*   **Soft Warning (Yellow)**:
    *   **Facility Names**: `病院`, `クリニック` (without room numbers).
    *   **Context**: `紹介状`, `主治医`, `担当医`.

### 1.2 Automated Age Handling (Privacy-First Context)
*   **Logic (2-Pass Safe Redaction)**:
    1.  **Pass 1 (Number + Unit)**: `(\d{1,3})(歳|yo|years|months|mo|ヶ月|か月)`.
        *   **Date Boundary Check**: Checks preceding/following characters (ignoring whitespace) for `/`, `-`, `.` to avoid stripping dates like `2024 / 2 / 7`.
        *   **Unit Handling**: Strict exact match for month units (`months`, `mo`, `ヶ月` etc.) to convert to years (`/ 12`). "Monitor" or partial matches are excluded.
    2.  **Pass 2 (Label + Number)**: `age: (\d{1,3})`.
        *   Same boundary checks apply.
    3.  **Extract**: Convert number to `age_group` bucket (e.g., `<1`, `0-5`, `6-17`, `18-39`, `40-64`, `65+`).
    4.  **Redact**: Replace original confirmed age text with `[AGE_REDACTED]`.
    5.  **Send**: Pass `age_group` as separate context to LLM.
    *   *Example*: "8 months old" -> Text: "[AGE_REDACTED] old", Context: `{"age_group": "Infant"}`.

### 1.3 Zero-Retention Policy
*   **Storage**: Input text MUST NOT be saved to `chrome.storage` or IndexedDB.
*   **Memory**:
    *   Service Worker: Input text valid ONLY within `handleRequest()` scope. **Global variables prohibited.**
*   **Logging**:
    *   **Prohibited**: `console.log(input)`, `console.log(response)`.
    *   **Allowed**: Metric counters (`blocked_red`, `blocked_yellow`, `api_success`).

### 1.4 Strict Reference Verification (The "Double-Check" Gate)
*   **Prompt Rule**: "LLM outputs PMIDs and Guideline Identifiers (Text) only. No URLs."
*   **Architecture (Service Worker Delegation)**:
    1.  Side Panel sends `VERIFY_PMIDS` message to Background.
    2.  **Service Worker**:
        *   Checks `pmid_cache` (chrome.storage.local).
        *   If miss: Fetches `https://pubmed.ncbi.nlm.nih.gov/<PMID>/`.
            *   Try `HEAD`. If `405/403`, Fallback to `GET` (Status only).
        *   Returns validity map `{ "12345": true, "67890": false }`.
    3.  **Side Panel**: Renders Valid as Link, Invalid as "Suppressed Count".

#### Cache Structure (Storage Optimized)
*   **Key**: `pmid_cache` (Single Entry)
*   **Value**:
    ```json
    {
      "date": "2026-02-07",  // JST Date String
      "items": { "12345678": { "s": 1, "t": 1700000000 } }
    }
    ```
*   **Reset**: Daily at `00:00 JST`.

---

## 2. Architecture (Manifest V3)

### 2.1 Manifest Configuration
*   **Permissions**: `sidePanel`, `contextMenus`, `storage`.
*   **Host Permissions**: `https://pubmed.ncbi.nlm.nih.gov/*`.

### 2.2 Side Panel Handshake
*   **Race Condition Prevention**:
    1.  Background receives Right-Click -> "Open Side Panel".
    2.  Background buffers text.
    3.  Side Panel loads and sends `PANEL_READY`.
    4.  Background acknowledges and sends buffered text.

---

## 3. Data Flow & Features

### 3.1 Gemini API Integration
*   **Provider**: Google AI Studio.
*   **Model**: `gemini-3-flash-preview`.
*   **Prompt**:
    *   System: "You are a clinical assistant... No URLs... No PHI..."
    *   Input: "Text: {{text}}\nContext: Age Group: {{age_group}}"

#### JSON Output Schema
*   (Standard Schema: Common/Likely, Cannot Miss, Red Flags, Needs, Rationales, References)

### 3.2 Key Rotation Logic
*   **Storage**: 4 Keys in `chrome.storage.local`.
*   **Selection**: Key `i` if `status != 'error'` AND `usage_today < 20`.
*   **Error Handling**:
    *   **401/403**: Mark **DISABLED** (User fix required).
    *   **429/503**: **Cooldown 5 min**.
    *   **500**: **Cooldown 1 min**.
*   **Reset**: Daily at `00:00 JST`.

---

## 4. UI/UX (Side Panel)

1.  **Header**: "DDx Assistant".
2.  **Input Area**:
    *   `<textarea>` (Pre-redacted on load).
    *   **Alerts**:
        *   🔴 "PHI BLOCKED" (Disabled).
        *   🟡 "CHECK INFO" (Active).
        *   🟢 "READY" (Active).
    *   `[ Analyze ]` Button.
3.  **Results**: Accordion/List.
    *   **Low Confidence**: Styled with `.confidence-low` (gray/smaller).
4.  **References**:
    *   Link (Verified Only).
    *   Footer: "Suppressed references: N" (if applicable).
5.  **Chart Copy**: Textarea + Copy Button (`navigator.clipboard`).

---

## 5. Implementation Roadmap (Completed)

1.  **Scaffolding**: `manifest.json`, `background.js`, `sidepanel.html`.
2.  **Logic Core**:
    *   `KeyManager` (Rotation/Cooldown/JST Date).
    *   `PhiGuard` (v1.4.7 Regex Rules + Safe Age Extraction).
    *   `PmidCache` (SW-based).
3.  **UI Construction**: Side Panel Interactivity & Styling.
4.  **Refinement**: Operational hardening (Name regex, Date boundaries).

---
**End of Specification v1.5.0**
