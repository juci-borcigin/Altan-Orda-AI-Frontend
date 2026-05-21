# 議事 DB を空にして再取り込みする手順

**目的:** `ao_threads` / `ao_messages`（および `ao_embeddings`）を削除し、`import-logs.mjs` でエクスポートから再度流し込む。

**所要:** データ量次第（目安: Claude + Gemini で数分）。ChatGPT を足すと増える。

**注意:** `TRUNCATE` は元に戻せない。実行前に Supabase のバックアップや GitHub Actions の GDrive バックアップの有無を確認すること。

**マイグレーション:** テーブル改名（`021_rename_core_ao_tables.sql`）適用後は、旧名 `threads` / `messages` / `embeddings` / `ao_prompt_sections` は存在しない。

---

## 0. 前提

- ローカルで取り込む場合: リポジトリルートに `node_modules`（`npm install` 済み）、`web/.env` に **`SUPABASE_URL`** と **`SUPABASE_SERVICE_ROLE_KEY`** があること。
- 取り込み対象ファイルのパスを控えておく（ChatGPT / Claude / Gemini の JSON 等）。

---

## 1. コードの展開（アプリ・スクリプト）

再取り込みの**品質**は `import-logs.mjs` と `GET /api/state` の実装に依存するため、取り込み前に次を反映しておく。

1. 作業ブランチで `git pull`（またはマージ済みの `main` をチェックアウト）。
2. リポジトリルートで依存関係を揃える。

   ```bash
   cd /path/to/Altan-Orda-AI-Frontend
   npm install
   ```

3. フロント（`web/`）を触っている場合は、ローカルでビルドが通るか任意で確認。

   ```bash
   cd web && npm run build
   ```

4. **本番（Vercel）**も同じコミットにしておきたい場合は、通常どおり push → デプロイ完了を待つ（取り込みスクリプトは**手元の Node**で実行するため、Vercel 側は「アプリが新しい `/api/state` 等を配る」ために揃える）。

---

## 2. DB の Truncate（Supabase）

1. [Supabase](https://supabase.com/dashboard) → 対象プロジェクト → **SQL Editor**。
2. リポジトリの **`scripts/truncate-threads-messages.sql`** の全文をコピーし、エディタに貼り付けて **Run**。

   内容は次の順で `TRUNCATE` する（`ao_embeddings` → `ao_messages` → `ao_threads`）。

3. **Table Editor** で `ao_threads` / `ao_messages` / `ao_embeddings` が空であることを確認（任意）。

`profile_entries` 等、議事以外のテーブルは**この SQL では消さない**。

---

## 3. 再取り込み（`import-logs.mjs`）

リポジトリ**ルート**で実行する。`--project-id` はゲル／ウルスに相当するラベル（例: `トゥルイ・ウルス`）または生の `gemini` / `claude` / `gungi` 等。

### 3.1 事前確認（dry-run）

```bash
cd /path/to/Altan-Orda-AI-Frontend

# ChatGPT（conversations.json が配列でも可）
node scripts/import-logs.mjs --provider chatgpt --file "/path/to/ChatGPT/conversations.json" --dry-run --dry-run-limit 5

# Claude
node scripts/import-logs.mjs --provider claude --file "/path/to/conversations.json" --project-id オゴデイ・ウルス --dry-run --dry-run-limit 5

# Gemini（マイアクティビティ）
node scripts/import-logs.mjs --provider gemini-activity --file "/path/to/マイアクティビティ.json" --dry-run --dry-run-limit 5
```

### 3.2 本番取り込み（INSERT）

環境変数は `web/.env` または `web/.env.local` を参照（スクリプトが `dotenv` で読み込む）。

**再実行:** `source_native_id` と `source_provider` が両方あるスレッドは、取り込み前に **同キーの既存 `ao_threads` を DELETE**（`ao_messages` は CASCADE）してから再挿入する（二重化しない。手動で変えた列は消える）。

```bash
# ChatGPT（例: 軍議ゲルへ）
node scripts/import-logs.mjs --provider chatgpt --file "/path/to/conversations.json" --project-id 軍議ゲル

# Claude（例: オゴデイ・ウルス）
node scripts/import-logs.mjs --provider claude --file "/path/to/claude-conversations.json" --project-id オゴデイ・ウルス --facet chat

# Gemini activity（例: トゥルイ・ウルス）
node scripts/import-logs.mjs --provider gemini-activity --file "/path/to/マイアクティビティ.json" --project-id トゥルイ・ウルス

# NotebookLM（既定: project_id=study, source_facet=study, source_provider=nblm。--project-id で上書き可）
node scripts/import-logs.mjs --provider nblm --file "/path/to/NotebookLM Conversation.json"
```

**ログをファイルに残す:** 進捗は **標準出力（stdout）** に出る。次のどちらでもファイルに追記できる。

```bash
node scripts/import-logs.mjs ... | tee /tmp/import.log
# または stderr もまとめたい場合（エラー時）
node scripts/import-logs.mjs ... 2>&1 | tee /tmp/import.log
```

以前は進捗が `console.error` だけだったため、**`2>&1` なしの `| tee`** だとファイルがほぼ空になることがあった。

- **`--facet`**: 取り込み時の既定 `source_facet`（`do` | `feel` | `think` | `chat` は Claude / Gemini / ChatGPT 系、`study` は NotebookLM 等）。会話ごとの自動振り分けは未実装。
- **`--max-threads N`**: 先頭 N スレッドだけ試すスモーク用。全件再実行時は付けない。

**取り込み順:** 依存関係は無いので任意。公式メモに近い順なら ChatGPT → Claude → Gemini でもよい。

---

## 4. アプリの確認

1. ローカルまたは本番で **ブラウザをリロード**（`/api/state` が再取得される）。
2. ゲルごとの件数・議事一覧が期待どおりか確認。
3. **RAG（ao_embeddings）**を運用している場合: `ao_embeddings` も Truncate で消えているため、**再ベクトル化**（Database Webhooks / Edge Function / 手動パイプライン等）が必要なら別途実行する。

---

## 5. トラブル時

- **`ao_threads insert` / `ao_messages insert` のエラー:** `.env` の URL・キー、RLS、列不足（マイグレーション未適用）を確認。
- **取り込みが途中で止まった:** その時点までの行は残る。完全にやり直す場合は **2. Truncate** から繰り返す。
