# Qdrant セットアップガイド（典籍論・殿下向け）

クラスタ **ao_rag**（FREE / HEALTHY）ができていれば、あとは **API キー → ENV → collection 初期化 → 試し ingest** の順です。

---

## 1. 未決だった3項目（何の話か）

| 項目 | 意味 | 既定（コード） |
|------|------|----------------|
| **冊/テーマあたりチャンク上限** | 1 PDF を無限に細切りにしないガード。Qdrant Free を守る | **1 冊 120 チャンク**、テーマ合計 **4000**（`ao-rag-policy.ts`・テーマ合計 enforce は次段） |
| **1536 vs 512** | ベクトル次元。小さいほど安い・速い、精度はやや落ちる | **1536**（`text-embedding-3-small` 既定）。変えるなら collection 作り直し + 全再 ingest |
| **典籍論 rag_max_chars 配分** | 1 回の LLM に渡す RAG 文字数の **内訳** | `ao_projects.rag_max_chars`（例 4000）を比率で分割。**典籍論**: 議事 25% / Wiki 25% / 典籍 50%。**他論**: 議事 70% / Wiki 30% |

殿下が `ao_projects` で `rag_max_chars` を変えれば、配分だけコード比率に従って変わります。

---

## 2. Qdrant Cloud でやること（コンソール）

### 2-1. クラスタ URL

1. クラスタ **ao_rag** → **Cluster UI** または Overview
2. **Cluster URL** をコピー（例: `https://xxxxxxxx.ap-northeast-1-0.aws.cloud.qdrant.io:6333`）
   - **末尾に `:6333` がある形式**をそのまま `QDRANT_URL` に使う

リージョンは **Vercel / Supabase と同じ近傍**（東京なら AWS Tokyo 等）が望ましい。既に作ったクラスタで問題なければそのままでよい。

### 2-2. API キー

1. 左メニュー **API Keys**（クラスタ内）
2. **Create API Key** → 表示されたキーを **一度だけ**コピー

### 2-3. Collection 名

コンソールのクラスタ名は **ao_rag** でも、**Vector collection** は別に `ao_rag` という名前で作ります（スクリプトが自動作成）。

---

## 3. ENV（ローカル `web/.env` と Vercel）

```env
QDRANT_URL=https://（クラスタ URL・:6333 付き）
QDRANT_API_KEY=（API Keys で発行）
QDRANT_COLLECTION=ao_rag
```

| 変数 | 説明 |
|------|------|
| `QDRANT_URL` | REST のベース URL |
| `QDRANT_API_KEY` | クラスタ API キー（Service Role 相当・サーバのみ） |
| `QDRANT_COLLECTION` | 省略時 `ao_rag` |

**OpenAI** と **Supabase** は既存のまま。Vercel 本番にも同じ3つを追加して **Redeploy**。

---

## 4. Collection 初期化（hybrid・ローカル 1 コマンド）

**既存の dense のみ `ao_rag` がある場合は、Qdrant コンソールでコレクション削除してから実行。**

```bash
cd web
npm run init:qdrant
```

成功例: `[init-qdrant] OK hybrid collection=ao_rag dense=1536 + bm25`

- **dense** 1536 Cosine（OpenAI embed）+ **bm25** sparse（Qdrant Inference 要）
- payload index: `project_id`, `kind`, `source_id`, `theme_slug`

---

## 5. Supabase migration

SQL Editor または CLI で順に:

1. `024_ao_embed_kind_books.sql`（未適用なら）
2. `025_ao_book_sources_no_fulltext.sql`

---

## 6. 試し ingest（縦スライス）

`.txt` / `.md` のみ（PDF は未対応）:

```bash
curl -X POST http://localhost:3000/api/notebook/ingest \
  -F "theme_slug=juchi-ulus" \
  -F "work_title=テスト典籍" \
  -F "file=@./sample.md"
```

成功: `{ ok: true, source_id, chunks: N }`

---

## 7. 典籍論チャットでの RAG

`project_id=notebook` の Phase5 チャットで:

- **議事** → Supabase `thread`
- **Wiki** → Supabase `wiki`（**全論が読む**）
- **典籍** → Qdrant `books`

他論は **thread + wiki** のみ。

---

## 8. 冷起動（Free）

1 週間使わないとクラスタ **suspend**。最初の検索が遅いことがある。  
対策: 月 1 回 `npm run init:qdrant` や ingest で触る / 許容。

---

## 9. トラブル

| 症状 | 確認 |
|------|------|
| 503 QDRANT not set | `web/.env` と Vercel ENV |
| 次元エラー | collection を 1536 で作り直し（`init:qdrant`） |
| 典籍 0 件 | ingest 済みか、`notebook` 論でチャットしているか |
| Wiki 0 件 | `ao_embeddings` に `kind=wiki` がまだ無い（Wiki ingest は 2a） |
