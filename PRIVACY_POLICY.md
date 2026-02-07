# DDx Assistant プライバシーポリシー / Privacy Policy

**Effective Date:** 2026年2月8日

---

## 日本語 (Japanese)

本プライバシーポリシーは、DDx Assistant（以下「本拡張機能」）による利用者情報の取り扱いについて定めたものです。
本拡張機能は、AIを活用した鑑別診断支援を提供することを目的としており、利用者のプライバシー保護とデータセキュリティを最優先事項としています。「ローカル処理優先」「データ最小化」の原則に基づいて運用されます。

### 1. 収集する情報とその使用目的

#### A. 個人情報について
本拡張機能は、利用者の指名、住所、電話番号などの個人識別情報（PII）を一切収集・保存しません。

#### B. テキストデータ（臨床情報）
*   **ローカル処理**: ユーザーが選択したテキストは、ブラウザ内でローカルに処理され、個人情報（氏名、IDなど）が含まれる可能性がある場合は自動的に墨消し（Redaction）されます。
*   **外部送信**: 墨消し後のテキストのみが Google Gemini API に送信され、診断支援情報の生成に使用されます。
*   **非保存**: 送信されたテキストデータおよびAPIからの応答データは、開発者のサーバーには一切保存されません。ブラウザのメモリ上で一時的に処理されるのみです。

#### C. APIキー
*   本拡張機能を使用するには、ユーザー自身の Google Gemini API キーが必要です。
*   入力されたAPIキーは利用者のデバイス内（`chrome.storage.local`）にのみ保存され、開発者や第三者に共有されることはありません。

### 2. 第三者サービスの使用
本拡張機能は以下の外部サービスを利用します。

*   **Google Gemini API**: AIによる推論を行うために使用します。利用規約は [Google Generative AI Terms of Service](https://policies.google.com/terms) に準拠します。
*   **PubMed (NCBI)**: 医学文献の実在確認を行うために、PubMed ID (PMID) を送信します。利用規約は [NCBI's Privacy Policy](https://www.ncbi.nlm.nih.gov/home/about/policies.shtml) に準拠します。

### 3. お問い合わせ
本プライバシーポリシーに関するご質問は、GitHubリポジトリの Issue ページよりお問い合わせください。

---

## English

DDx Assistant ("the Extension") is designed to provide clinical differential diagnosis assistance using AI. We prioritize user privacy and data security. The Extension operates under a "Local-First" and "Data Minimization" philosophy.

### 1. Data Collection and Usage

#### A. Personal Information
The Extension **DOES NOT** collect, store, or share any personal identification information (PII) such as names, addresses, or phone numbers.

#### B. User Content (Clinical Text)
*   **Processing**: Text selected by the user is processed locally within the browser to detect and redact potential Protected Health Information (PHI) before any transmission.
*   **Transmission**: Only the redacted text is sent to the Google Gemini API for the sole purpose of generating diagnostic suggestions.
*   **No Storage**: The text and the API response are NOT stored on our servers. They exist only in the browser's temporary memory during the session.

#### C. API Keys
*   The Extension requires users to provide their own Google Gemini API Key.
*   This key is stored locally on your device (`chrome.storage.local`) and is used only to authenticate requests to the Google Gemini API. It is never shared with the developer or third parties.

### 2. Third-Party Services

#### A. Google Gemini API
The Extension uses Google's Generative AI services. Use of this API is subject to [Google's Generative AI Terms of Service](https://policies.google.com/terms).

#### B. PubMed (NCBI)
The Extension verifies scientific citations by sending PubMed IDs (PMIDs) to the National Center for Biotechnology Information (NCBI). This interaction is subject to [NCBI's Privacy Policy](https://www.ncbi.nlm.nih.gov/home/about/policies.shtml).

### 3. Contact
If you have questions about this Privacy Policy, please contact the developer via the GitHub repository issues page.
