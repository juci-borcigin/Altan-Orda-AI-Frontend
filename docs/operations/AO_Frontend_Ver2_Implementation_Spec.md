# Altan Orda AI Frontend Ver 2.0 実装仕様書
**作成：2026-04-09 / モンケウールのゲル**
**更新：2026-04-19 rev.4（書庫 facet 対応表・GDrive バックアップ JSON 運用）／2026-04-09 rev.3**
**宛先：スブタイ（Cursor）**
**参照：Altan_Orda-AI-FE_Spec_Doc.md / Altan_Orda-AI-FE_Dev_Notes.md**

---

## 方針：スクラップアンドビルド

既存コード（Ver 1.x）はアーキテクチャ参照用として残す。Ver 2.0は新規ブランチで構築する。

**移植するもの（Ver 1.xから引き継ぐ）：**
- UI全般（レイアウト・デザイン・世界観）
- タイプライター表示ロジック（`ao-typewriter.ts`）
- スクロール追従・応答待ち表示
- 送信ガード（応答中の多重送信防止）
- System Promptの内容
- ペルソナ定義・ゲル定義

**スクラップするもの（新規実装）：**
- データ保存層（localStorage主体 → Supabase主体）
- API接続層（OpenAI直 → OpenRouter統一 + マルチプロバイダアダプタ）
- GDriveフロント連携コード全て（廃止）
- 手動ログ保存UI（「Driveに保存」ボタン等）

---

## UI仕様

**現行UIを完全踏襲する。機能実装後に別途改修を行う。**

現行UIの構成（変更しないこと）：
- タイトルヘッダー：`ALTAN ORDA / ジュチ・ウルス`
- 左アイコンレール（常時表示）
- サブメニューパネル（アイコン選択で展開）
- サブヘッダー（ゲル名・議事タイトル表示）
- メインエリア（吹き出しチャット・顔グラ・ペルソナ名）
- 入力エリア（テキストボックス5行・送信ボタン）
- カラー：濃ネイビー（`#0B2340`）ヘッダー・フッター、金ボーダー、濃茶背景

UIに関する実装変更は本仕様書のスコープ外。変更不要。

---

## 前提確認

- 現在AOはローカルマシンのみで稼働。GitHubにpush済み・未デプロイ
- localStorage自動保存は稼働中
- GDriveコード（OAuth・ログ保存）は実装済みだが今回全廃
- OpenRouter・TavilyはコードにENV参照まで実装済み・APIキー未設定
- Supabaseアカウントは未作成

---

## GDrive廃止の範囲（明示）

**廃止：** ユーザー向けGDrive連携（OAuth・「Driveに保存」ボタン・接続状態表示・設定モーダルの連携解除）。フロントエンドのGDrive関連コードを全て削除する。

**継続：** バックアップ専用として、GitHub ActionsからのみGDrive APIを使用する（サーバー側処理のみ・フロント不要）。

---

## 認証・セキュリティ方針

**Supabase接続はVercelのAPIルート（サーバー）経由のみとする。**

- `SUPABASE_SERVICE_ROLE_KEY`はサーバー側（Vercel環境変数）にのみ置く
- ブラウザから直接Supabase APIを叩かない
- `ANON_KEY`はフロントに公開しない
- RLSは「APIルート経由でのみアクセス」を前提として設計する
- `NEXT_PUBLIC_`プレフィックスのSupabase変数は一切使用しない

完了条件の一つ：**ブラウザのネットワークタブにSupabaseのURLが露出しないこと。**

**rev.3確定（ユーザー認証）：** エンドユーザー向けの Supabase Auth・マルチユーザー分離は**当面入れない**（単一利用者・APIルート経由の現状を維持）。`user_id` 相当の厳密な紐付けは**将来対応**。

---

## LLM優先度ルール

```
1. PERSONA_LLM_MAPにペルソナ名が存在する → マップのmodelを使用
2. マップに存在しないペルソナ → 環境変数 LLM_MODEL にフォールバック
3. LLM_MODEL未設定 → エラーを返す（サイレントフォールバックしない）
```

耶律楚材・ソルコクタニを含む**全ペルソナをOpenRouter経由に統一**する。
直API（Anthropic直・Google直）は使用しない。チャット用 API キーは **`LLM_API_KEY`（OpenRouter）のみ**。埋め込み（RAG）は **方針A** により **`OPENAI_API_KEY`** を別途使用（下記 Step 2・Step 7）。

---

## 実装順序

### Step 1：Vercelデプロイ

- GitHubリポジトリをVercelに接続してデプロイ
- 本番URLを確認・記録
- **Root Directory は必ず `web` を指定する**（リポジトリ直下に `package.json` が無く、Next.js アプリは `web/` にあるため）。`outputDirectory` を `.next` に向ける設定は Next.js on Vercel では使わない（404 の原因になる）
- 任意：`web/vercel.json`（スキーマ参照のみで可）
- 初回は Vercel ダッシュボードで GitHub 連携・環境変数（後続 Step で追加）を設定する

---

### Step 2：OpenRouter + Tavily + 埋め込み用 OpenAI ENV設定

コード変更不要。`.env`（およびVercelのEnvironment Variables）に以下を追加。

**チャット・Web検索（OpenRouter / Tavily）：**

```
LLM_API_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=（OpenRouter APIキー）
LLM_MODEL=openai/gpt-4.1-mini        # PERSONA_LLM_MAPにないペルソナのフォールバック
OPENROUTER_SITE_URL=https://altan-orda-ai-frontend.vercel.app
TAVILY_API_KEY=（Tavily APIキー）
```

**埋め込み（RAG・方針A）：** チャット用の `LLM_API_KEY`（OpenRouter）とは**別キー**として必須。

```
OPENAI_API_KEY=（OpenAI APIキー。text-embedding-3-small 用。Edge Function 等サーバー側のみ）
```

設定後に動作確認：チャット送信・Web検索tool callingが発火するか確認。

---

### Step 3：GDriveフロントコード削除

Step 1・2の動作確認後に実施。

---

### Step 4：Supabaseセットアップ

#### 4-1. プロジェクト作成

- Supabase Freeアカウントを作成
- プロジェクト名：`altan-orda`
- リージョン：`Northeast Asia（Tokyo）`推奨
- 以下をVercel環境変数（サーバー側のみ）に追加：

```
SUPABASE_URL=（SupabaseプロジェクトURL）
SUPABASE_SERVICE_ROLE_KEY=（service_roleキー）
```

#### 4-2. テーブル作成

以下のSQLをSupabase SQL Editorで実行。

```sql
-- pgvector拡張の有効化
create extension if not exists vector;

-- threads：議事スレッド
create table threads (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  project_id   text not null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- messages：メッセージ（正規化済み text + 生レスポンス raw_response の両方を保存）
create table messages (
  id              uuid primary key default gen_random_uuid(),
  thread_id       uuid references threads(id) on delete cascade,
  role            text not null,         -- 'user' | 'assistant'
  text            text not null,         -- パース・正規化済みテキスト（RAG・表示対象）
  persona         text,                  -- 'フナン' | 'モンケウール' 等（1行＝1ペルソナ発言）
  provider        text,                  -- 'openrouter'（全ペルソナ共通）
  model_id        text,                  -- 実使用モデルID（例: anthropic/claude-sonnet-4.5）
  content_type    text default 'text',   -- 'text' | 'code' | 'artifact' | 'image'
  artifact_url    text,                  -- 将来用（Supabase Storage URL）
  raw_response    jsonb,                 -- プロバイダの生レスポンス全体（1応答につき1件目のみ保存）
  tool_results    jsonb,                 -- Tavily検索結果等
  token_count     int,
  created_at      timestamptz default now()
);

-- embeddings：RAGベクトルインデックス
create table embeddings (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid not null references messages(id) on delete cascade,
  source_type  text not null,   -- 'message' | 'profile'
  chunk_text   text not null,
  embedding    vector(1536),    -- text-embedding-3-small（1536次元固定）
  created_at   timestamptz default now()
);
create index on embeddings using hnsw (embedding vector_cosine_ops);

-- profile_entries：殿下個人知識DB
create table profile_entries (
  id          uuid primary key default gen_random_uuid(),
  category    text not null,
  content     text not null,
  priority    int default 5,    -- 1（高）〜10（低）。注入上限超過時に優先度順でカット
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- match_embeddings RPC（RAG検索用）
create or replace function match_embeddings(
  query_embedding vector(1536),
  match_count     int default 5,
  match_threshold float default 0.7
)
returns table (
  id          uuid,
  source_id   uuid,
  source_type text,
  chunk_text  text,
  similarity  float
)
language sql stable
as $$
  select
    id,
    source_id,
    source_type,
    chunk_text,
    1 - (embedding <=> query_embedding) as similarity
  from embeddings
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
```

#### 4-3. messagesの保存設計（1行＝1ペルソナ発言）

Ver 1.xのパーサで分割済みのペルソナブロックをそれぞれ1行として挿入する。

```typescript
// 例：フナン・ケテが同一応答に含まれる場合
await supabase.from('ao_messages').insert([
  {
    thread_id,
    role: 'assistant',
    text: 'フナンの発言テキスト',
    persona: 'フナン',
    provider: 'openrouter',
    model_id: 'openai/gpt-4.1-mini',
    raw_response: { /* OpenAIの生レスポンス全体 */ },  // 1応答につき1件目のみ
  },
  {
    thread_id,
    role: 'assistant',
    text: 'ケテの発言テキスト',
    persona: 'ケテ',
    provider: 'openrouter',
    model_id: 'openai/gpt-4.1-mini',
    raw_response: null,  // 同一応答の2件目以降はnull
  }
])
```

#### 4-4. localStorageをSupabaseに移行

- メッセージ送信のたびにAPIルート経由でSupabaseへ非同期書き込み
- 楽観的UI更新（書き込み完了を待たずUIに反映）
- 読み込み時：Supabaseを正とする。取得失敗時はlocalStorageをフォールバック
- localStorageは補助キャッシュとして併存（廃止しない）

#### 4-5. PERSONA_LLM_MAP の実装

`web/src/lib/persona-llm-map.ts`（新規作成）。`model` には [OpenRouter のモデル一覧](https://openrouter.ai/models) に掲載の**正式ID（`id` フィールド）**を使う。行末コメントに同じ正式IDを明記する（表記ゆれ防止）。

```typescript
// 全ペルソナをOpenRouter経由に統一。直APIは使用しない。
export const PERSONA_LLM_MAP: Record<string, {
  model: string,        // OpenRouter の正式モデルID（API の model パラメータにそのまま渡す）
  maxHistory?: number
}> = {
  'フナン':       { model: 'openai/gpt-4.1-mini' },       // 正式ID: openai/gpt-4.1-mini
  'モンケウール': { model: 'openai/gpt-4.1-mini' },       // 正式ID: openai/gpt-4.1-mini
  'ケテ':         { model: 'openai/gpt-4.1-mini' },       // 正式ID: openai/gpt-4.1-mini
  'バイジュ':     { model: 'openai/gpt-4.1-mini' },       // 正式ID: openai/gpt-4.1-mini
  '耶律楚材':     { model: 'anthropic/claude-sonnet-4.5' }, // 正式ID: anthropic/claude-sonnet-4.5
  'ソルコクタニ': { model: 'google/gemini-2.5-flash' },    // 正式ID: google/gemini-2.5-flash
}
// provider は全ペルソナ 'openrouter' 固定。
// マップに存在しないペルソナは LLM_MODEL 環境変数にフォールバック。
```

`route.ts`のアダプタはOpenRouter統一なので単一実装で完結する。
プロバイダ差異（OpenAI・Anthropic・Gemini形式の違い）はOpenRouterが吸収する。

---

### Step 5：GitHub Actionsの設定

`.github/workflows/supabase-maintenance.yml`（リポジトリルートの`.github/workflows/`に配置）：

```yaml
name: Supabase Maintenance

on:
  schedule:
    - cron: '0 0 * * 1,4'   # 月・木 UTC0時（JST 9時）keepalive
    - cron: '0 1 * * 0'     # 日曜 UTC1時（JST 10時）GDriveバックアップ
  workflow_dispatch:

jobs:
  keepalive:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase
        run: |
          curl -s "${{ secrets.SUPABASE_URL }}/rest/v1/ao_threads?select=id&limit=1" \
            -H "apikey: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}"
          echo "Supabase ping OK"

  gdrive-backup:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Backup to GDrive
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          GDRIVE_CLIENT_ID: ${{ secrets.GDRIVE_CLIENT_ID }}
          GDRIVE_CLIENT_SECRET: ${{ secrets.GDRIVE_CLIENT_SECRET }}
          GDRIVE_REFRESH_TOKEN: ${{ secrets.GDRIVE_REFRESH_TOKEN }}
          GDRIVE_BACKUP_FOLDER_ID: ${{ secrets.GDRIVE_BACKUP_FOLDER_ID }}
        run: node scripts/backup-to-gdrive.mjs
```

`scripts/backup-to-gdrive.mjs`（リポジトリルートの`scripts/`に配置）：
- Supabaseから全threads・messagesをJSON取得
- `altan-orda-backup-YYYY-MM-DD.json`としてGDriveの指定フォルダへアップロード
- 同名ファイルは上書き
- GDrive APIはリフレッシュトークンのみでサーバー側から操作（フロントOAuth不要）

#### Step 5-1：GDrive バックアップ JSON の扱い（運用・ドキュメント⑤）

- **中身：** ルートに `schema: "altan-orda-supabase-backup-v1"`、`exportedAt`、`threads` / `messages` の配列（当時の Supabase 行に近い形）。
- **自動リストア：** 本リポジトリでは **未実装**。障害・検証時は JSON を手元にダウンロードし、**SQL Editor での手当て**や、**別途ワンオフスクリプト**を想定する。
- **同日の再バックアップ：** ファイル名が日付単位のため、**同一日は GDrive 上で上書き**される（履歴がファイル名だけでは残らない）。日跨ぎで別ファイルが増える。
- **ベンダー別エクスポート（Claude / Gemini / ChatGPT の ZIP）との関係：** **別物**。再取り込みの正は **各公式エクスポート + `import-logs.mjs`**。バックアップ JSON は「Supabase のスナップショット」として保管・人間参照用と割り切る。
- **ChatGPT のエクスポート：** OpenAI 側の処理待ちで **数日かかる**ことがある。取得後にアダプタ・facet ルールを追記する。

**GitHub Secretsに追加が必要なキー（Vercel環境変数と名称を統一）：**

| Secret名 | 用途 |
|---|---|
| `SUPABASE_URL` | SupabaseプロジェクトURL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase操作キー |
| `GDRIVE_CLIENT_ID` | GDriveバックアップ |
| `GDRIVE_CLIENT_SECRET` | GDriveバックアップ |
| `GDRIVE_REFRESH_TOKEN` | 初回のみ手動OAuthして取得 |
| `GDRIVE_BACKUP_FOLDER_ID` | GDriveのバックアップ保存フォルダID |

---

### Step 6：既存ログのインポート（初回一括・スブタイタスク）

**実装名：** `scripts/import-logs.mjs`（Node・リポジトリルートで `node scripts/import-logs.mjs …`）。

**CLI 概要（2026-04 時点）：**
```
node scripts/import-logs.mjs \
  --provider chatgpt|claude|gemini|gemini-activity \
  --file "<エクスポートファイルのパス>" \
  [--project-id オゴデイ・ウルス|トゥルイ・ウルス|…] \
  [--facet do|feel|think|chat] \   # Claude 一括時の既定 facet（Gemini activity は subtitle から推定）
  [--persona "…"] \
  [--dry-run] [--dry-run-limit N] [--max-threads N]
```

- **`threads` 列：** `005_threads_import_provenance.sql` 適用後、`source_facet` / `source_provider` / `source_native_id` を付与可能。
- **`--max-threads N`：** 先頭 N スレッドのみ INSERT（スモーク用）。全件を同じ DB で再度流すと **先頭 N 件は二重**になるため、手削除か別検証 DBを推奨。

**`--persona` 未指定時のデフォルト：** ChatGPT・Claude 系は **耶律楚材**、Gemini 系は **ソルコクタニ**（Gemini アクティビティでは subtitle から Gem 名を推して上書きする場合あり）。

#### アダプタ A：ChatGPT

- 入力：`conversations.json`（ZIPを解凍済み）の **単一会話オブジェクト**（`mapping` + `current_node`）
- `current_node`から`parent`を辿って線形化
- `role: system/tool`はスキップ。`parts[]`を`\n\n`で結合してtextに正規化
- デフォルト：`provider: 'openrouter'`、`model_id: 'openai/gpt-4.1-mini'`、`persona: '耶律楚材'`
- **注意：** トップが **会話の配列**の ZIP は、現スクリプトでは未対応（配列ループは後日）

#### アダプタ B：Claude

- 入力：公式エクスポートの **`conversations.json`（会話の配列）** または旧単体 `{ messages: [] }`
- `chat_messages` の `sender`（human/assistant）、本文は `text` と `content[]` をマージ。`thinking` タイプは本文結合から除外（生は `raw_response` に保持可）
- デフォルト：`project_id` は `--project-id` または **`claude`**（オゴデイ・ウルス相当）

#### アダプタ C：Gemini

- **`gemini-activity`：** Takeout の **`マイアクティビティ.json`**（アクティビティ行の配列）。1 行 ≒ 1 スレッド。
- **`gemini`：** Gems 用 HTML 等（従来の粗い HTML パース）

**インポート優先順（推奨）：** ChatGPT → Claude → Gemini（ChatGPT 入手待ちの間は Claude / Gemini のみ可）

#### Step 6-1：`source_facet` と AO メイン表示の対応（運用・ドキュメント④）

DB には **`do` / `feel` / `think` / `chat`** を素直に格納し、**AO のゲル・ラベル表示は読み出し時にマッピング**する方針（格納時に AO の `ProjectId` を無理に増やさない）。

| `source_facet` | 意味（殿下軍議での呼び） |
|----------------|---------------------------|
| `do` | 実行・将軍軸 |
| `feel` | ケア・侍衛軸 |
| `think` | 参謀・宰相軸 |
| `chat` | 未分類・一般チャット |

**Claude（Projects / ゲル名 → facet、格納時ルールの例・将来マッピングの正）：**

| エクスポート側の名前 | `source_facet` |
|----------------------|----------------|
| 将軍 モンケウールのゲル | `do` |
| 侍衛 バイジュのゲル | `feel` |
| 宰相 フナンのゲル | `think` |
| 上記以外・紐付け不明 | `chat` |

**Gemini（Gems / subtitle の Gem 名 → facet。インポート時はスクリプトが推定）：**

| Gem 名の目安 | `source_facet` |
|--------------|----------------|
| 将軍 モンケウール（「将軍 スブタイ」等は別扱い） | `do` |
| 護衛 バイジュ | `feel` |
| 宰相 フナン | `think` |
| その他の Gem・subtitle なし | `chat` |

**ChatGPT（カスタム指示の名称 → facet、エクスポート入手後に取り込みルールへ反映）：**

| 名称 | `source_facet` |
|------|----------------|
| 起業：「歴史と文化ｘ英語と国際経験ｘ旅行」 | `do` |
| 心 | `feel` |
| 共通の指示 | `think` |
| 上記以外 | `chat` |

**再格納：** 生データは手元の公式エクスポートに残るため、AO 表示や RAG でおかしければ **該当 `threads` を削除して `import-logs.mjs` を再実行**すればよい（`source_native_id` の UPSERT は未実装のため二重に注意）。

---

### Step 7：RAG実装

#### 7-1. ベクトル化パイプライン

`messages`テーブルへのINSERT後、**Database Webhooks**（Supabase **Free** プランで利用可）経由で Supabase Edge Function を非同期起動する。

**失敗時リトライ（rev.3確定）：** Webhook 呼び出し側または Edge Function 内のいずれかで、**最大3回**のリトライを実装する（DLQ は当面不要）。

`supabase/functions/vectorize/index.ts`（新規作成）：
- 対象：`messages.text`（正規化済みテキスト）のみ。`raw_response`はベクトル化しない
- モデル：OpenAI `text-embedding-3-small`（次元数：1536固定）
- チャンクサイズ：500トークン / オーバーラップ：50トークン
- 結果を`embeddings`テーブルに格納
- 認証：環境変数 **`OPENAI_API_KEY`** で OpenAI Embeddings API を**直接**呼ぶ（**方針A 確定**）。チャット用の **`LLM_API_KEY`（OpenRouter）とは別キー**。

**方針B（OpenRouter 経由の埋め込みのみ）は採用しない。**

**補足：** `match_embeddings`の`match_threshold`はデータ分布で要チューニング。初期値0.7は仮。

#### 7-2. RAG注入（route.tsに追加）

```typescript
// 毎リクエスト時の注入フロー

// 1. profile_entriesを常時注入（priority順・上限2000トークン）
const profileContext = await supabase
  .from('profile_entries')
  .select('category, content, priority')
  .order('priority', { ascending: true })
// 上限2000トークンを超える場合はpriorityの低いエントリを切り捨てる

// 2. embeddings検索（新規議事・スレッド切替直後の初回メッセージ時のみ）
const isFirstMessage = !currentThreadId || isThreadSwitched
if (isFirstMessage) {
  const { data: ragChunks } = await supabase.rpc('match_embeddings', {
    query_embedding: await embed(userMessage),
    match_count: 5,
    match_threshold: 0.7
  })
}

// 3. システムプロンプトの末尾に追記
const contextBlock = `
## 殿下に関する背景知識
${formatProfileEntries(profileContext)}

## 関連する過去の議論
${ragChunks?.map(c => c.chunk_text).join('\n---\n') ?? ''}
`
```

**RAG発動条件の整理：**

| 状況 | profile_entries注入 | embeddings検索 |
|---|---|---|
| 新規議事・初回メッセージ | ✅ 常時 | ✅ 発動 |
| 議事継続（2回目以降） | ✅ 常時 | ❌ threads履歴で代替 |
| スレッド切替直後の1発目 | ✅ 常時 | ✅ 発動 |

---

### Step 8：profile_entries初期データ投入

内容は別途モンケウールのゲルで確定後、追加で渡す。
スキーマはStep 4-2で作成済みのテーブルにSQLでINSERT。

---

## ENVまとめ（最終版）

| 変数 | 用途 | 設定場所 |
|---|---|---|
| `LLM_API_BASE_URL` | OpenRouter URL | Vercel環境変数 |
| `LLM_API_KEY` | OpenRouter APIキー（チャット） | Vercel環境変数 |
| `LLM_MODEL` | フォールバックモデルID | Vercel環境変数 |
| `OPENROUTER_SITE_URL` | OpenRouter向けReferer | Vercel環境変数 |
| `TAVILY_API_KEY` | Web検索 | Vercel環境変数 |
| `OPENAI_API_KEY` | 埋め込み `text-embedding-3-small`（方針A・OpenAI直）。**チャット用 `LLM_API_KEY` とは別** | Vercel環境変数（Edge Function 等サーバー側のみ） |
| `SUPABASE_URL` | Supabase接続URL（サーバーのみ） | Vercel環境変数 + GitHub Secrets |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase操作キー（サーバーのみ） | Vercel環境変数 + GitHub Secrets |
| `GDRIVE_CLIENT_ID` | GDriveバックアップ | GitHub Secrets |
| `GDRIVE_CLIENT_SECRET` | GDriveバックアップ | GitHub Secrets |
| `GDRIVE_REFRESH_TOKEN` | GDriveバックアップ | GitHub Secrets |
| `GDRIVE_BACKUP_FOLDER_ID` | バックアップ保存先フォルダ | GitHub Secrets |

`NEXT_PUBLIC_`プレフィックスのSupabase変数は使用しない。全てサーバー側のみ。

---

## rev.3 で確定した事項（旧「残存疑問」の解消）

| 項目 | 内容 |
|---|---|
| ユーザー認証 | **現状維持**（単一利用者・APIルート経由）。Supabase Auth / 厳密な `user_id` は**将来対応** |
| 埋め込みキー | **方針A**：`OPENAI_API_KEY` で OpenAI Embeddings を直接呼ぶ。`LLM_API_KEY` とは別 |
| DB Webhook | **Free** で利用可。失敗時 **リトライ3回** を実装 |
| OpenRouter モデルID | `PERSONA_LLM_MAP` のコメントに**正式ID**を明記（Step 4-5）。一覧は [openrouter.ai/models](https://openrouter.ai/models) |
| インポート `--persona` 未指定 | **Step 6** のアダプタ別デフォルトに従う（A・B: 耶律楚材／C: ソルコクタニ） |

---

## 完了条件

- [ ] Vercel本番URLでAOが起動する
- [ ] UIが現行Ver 1.xと同等に表示される
- [ ] メッセージ送信がOpenRouter経由で動作する
- [ ] Tavilyが必要時に発火する
- [ ] 送受信メッセージがSupabaseに自動保存される（APIルート経由・フロント直接接続なし）
- [ ] ブラウザのネットワークタブにSupabaseのURLが露出しない
- [ ] MacとiPhoneどちらから開いても同じ議事が参照できる
- [ ] GitHub ActionsのKeepaliveが動作する
- [ ] GitHub ActionsのGDriveバックアップが動作する
- [ ] 既存ログがSupabaseにインポートされている
- [ ] 新規メッセージ送信時にRAGコンテキストがシステムプロンプトに注入されている

---

## 保留・後フェーズ

- Artifactの保存実装（Supabase Storage）
- profile_entriesの自動抽出・更新
- 管理者画面
- Geminiインポートの精度改善
- 公式Claude.aiエクスポートZIPへの正式対応（スキーマ判明次第）
- UIの改修（Ver 2.0機能実装完了後）

---

*Altan Orda AI Frontend Ver 2.0 実装仕様書 rev.3 以上*
