# Chrome Web Store Listing Draft

## 1. 掲載情報 (Store Listing)

### 名前 (Extension Name)
**DDx Assistant (Preview) with Gemini**

### 概要 (Short Description) - Max 132 chars
**Google Gemini 3.0 Flash (Preview) を活用した、臨床医向けの鑑別診断支援ツールです。強力なプライバシー保護機能を搭載。**

### 説明 (Detailed Description)

**【重要：本ツールは研究・教育目的のプロトタイプです。実際の臨床判断には使用せず、必ず医師の最終判断を優先してください。】**

DDx Assistant は、臨床医の思考プロセスをサポートするために設計された Chrome 拡張機能です。
電子カルテや臨床メモのテキストをサイドパネルで安全に解析し、鑑別診断リストや見逃してはいけない疾患、追加すべき検査項目を瞬時に提案します。

#### 🚀 主な機能

1.  **鑑別診断の生成 (Differential Diagnosis)**
    *   **Common/Likely**: 頻度が高く、まず疑うべき疾患
    *   **Must Not Miss**: 見逃すと危険な致死的疾患
    *   **Red Flags**: 注意すべき身体所見や病歴
    *   **Next Steps**: 鑑別を絞り込むための追加質問や検査

2.  **強力なプライバシー保護 (PHI Guard)**
    *   **ローカル完結**: 個人情報（氏名、ID、日付、連絡先など）の検出はすべてブラウザ内で行われます。
    *   **自動墨消し**: 送信前に危険な個人情報を検知し、API送信をブロックまたは警告します。
    *   **年齢の抽象化**: "72歳" などの具体的な数値を自動で `[AGE_REDACTED]` に置換し、年代カテゴリ（例: 65+）として安全に処理します。
    *   **データ非保存**: 送信されたテキストデータはいかなるサーバーにも保存されません。

3.  **Google Gemini 3.0 Flash 搭載**
    *   最新の高性能モデルによる高速なレスポンス。
    *   ユーザー自身の API キーを使用するため、コスト管理も容易です。

#### 📦 使い方
1.  拡張機能をインストールし、Gemini API キーを設定します。
2.  ブラウザ上のテキストを選択して右クリック -> "DDx Assistant" を起動。
3.  サイドパネルに表示されたテキストを確認し、"Analyze" をクリック。

---

## 2. プライバシーへの取り組み (Privacy Practices)

### 単一用途 (Single Purpose)
*   **鑑別診断支援**: 臨床テキストに基づいて医学的な示唆を提供することに特化しています。

### データの使用 (Data Usage)
*   **個人を特定できる情報 (PII)**: 本拡張機能は PII を収集・送信しません。ローカルでフィルタリングされます。
*   **ユーザーデータ**: Gemini API との通信にのみ使用され、第三者に販売・共有されることはありません。
*   **保存**: 送信データは一時的にメモリ上で処理されるのみで、永続化されません。

### 権限の正当性 (Permissions Justification)
*   `sidePanel`: 診断支援結果を表示するために使用します。
*   `storage`: APIキーの設定に使用します。
*   `contextMenus`: ユーザーが選択したテキストをサイドパネルに送るための右クリックメニューを提供します。
*   `host_permissions (generativelanguage.googleapis.com)`: Google Gemini API を呼び出して推論を行うために必要です。
