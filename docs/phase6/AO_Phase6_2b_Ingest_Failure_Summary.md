# Phase 6 2b — 典籍 ingest / Vector 化 結果まとめ（本日終了）

**日付:** 2026-05-24  
**ソース:** `/Users/juci/Downloads/NotebookLM/Source`  
**方針:** 本日の Vector 化作業はここまで。未完了 PDF は `Failed/` と下記一覧で次回再開。

---

## サマリ

| 区分 | 結果 |
|------|------|
| **EPUB** | **4/4 成功**（`recover:failed-books`・抽出のみ・OCR 不要） |
| **PDF（テキスト層あり）** | **26 冊成功**（初回 `ingest:books-batch`）+ **mongol_imperialism**（OCR 7p） |
| **PDF（スキャン/OCR 要）** | **未完了 6 冊** が `Failed/` に残存 |
| **その他** | 民の主 `.md` 成功（16 chunks） |

---

## EPUB — 成功（失敗原因なし）

初回バッチでは `skip_epub`（未実装）で `Failed/` へ。`recover:failed-books` で **epub2 抽出 → hybrid ingest** 済み。

| ファイル | chunks（上限 cap） |
|----------|-------------------|
| Genghis Khan and the Making of the Modern World …epub | 120 |
| The Mongol Conquest in World History …epub | 120 |
| Central Asia in World History …epub | 120 |
| The Mongols and the West 1221-1410 …epub | 120 |

→ いずれも `Source/` 直下に復帰済み。

---

## PDF — 失敗・未完了の原因分類

### A. 画像スキャン PDF（テキスト層なし）— 根本原因

`pdf-parse` 抽出 **0 文字** → 初回バッチで `skip_empty` → `Failed/` へ移動。

| ファイル | ページ数目安 | 備考 |
|----------|-------------|------|
| 【歴史小説】井上靖「蒼き狼」.pdf | 394 | 縦書きスキャン・178MB |
| 杉山正明「モンゴル帝国の興亡」上・下 | 248 / 296 | スキャン |
| Cleaves_1982_Secret_History_Mongols.pdf | 342 | スキャン |
| Forbes Manz「Rise and Rule of Tamerlane」.pdf | 119 | スキャン |
| mongol_imperialism_1987.pdf | 7 | **OCR 完了・ingest 済**（後述） |
| Morgan the Mongols.pdf | 268 | 抽出 0 文字扱いが多い（スキャン/JBIG2） |

**対策:** OpenAI Vision OCR（`staging/*.txt`）または GCP Vision 等。テキスト層のある洋書 PDF は初回から成功。

---

### B. OpenAI API レート制限（429）

**現象:** 1 回目 `recover:failed-books` で PDF 6 冊とも **1 ページ目付近で TPM 上限** → 即失敗（exit 2）。

**対策（実装済）:** ページ間隔延長・429 リトライ・`detail: low`。2 回目は EPUB 4 冊成功後、PDF OCR を再開。

---

### C. 初回 ingest の DB 制約（修正済・一時的全滅）

**現象:** `ingest_kind: "batch"` が `ao_book_sources` の check 制約外 → **37 冊すべて insert 失敗**（1 回目の本番 Run）。

**対策:** `ingest_kind: "upload"` に変更 → 2 回目で **26 冊 PDF + md 成功**。

---

### D. OCR 予算ポリシー（冊あたり見通し 1,000 円超 — 意図的中止）

**ルール:** 残ページ × **3 円/ページ**（保守見積）> **1,000 円** → OpenAI OCR **自動中止**。

| ファイル | 残ページ | 見通し | 状態 |
|----------|---------|--------|------|
| Cleaves_1982_Secret_History_Mongols.pdf | 342 | ~1,026 円 | 中止・`OCR-BUDGET-SKIPPED.txt` |
| 【歴史小説】井上靖「蒼き狼」.pdf | 394 | ~1,182 円 | 同上 |

**対策（次回）:** GCP Vision 無料枠／クレジット、または手動 OCR → `staging/<stem>.txt` → `recover:failed-books`。

---

### E. バッチ途中停止（SIGTERM / exit 143）

**現象:** `recover:failed-books` 実行中にプロセス停止（殿下ご指示の予算・運用停止）。

| ファイル | OCR 進捗（停止時） | 結果 |
|----------|-------------------|------|
| Forbes … Tamerlane.pdf | **78 / 119** ページ | `Failed/`・staging 途中（再開可） |
| 杉山 上・下 | 未着手 or 僅少 | `Failed/` |
| Morgan the Mongols.pdf | 10 ページ分のみ staging 後に **3 chunks ingest** 済み → 後に再び `Failed/` にある場合は手動移動または再処理要確認 |

**対策:** 同コマンド再実行で `.progress.json` から **ページ単位再開**。

---

### F. Morgan — 部分 Vector 化（品質上の注意）

**現象:** OCR 未完（10/268 ページ相当）の staging で 500 字超 → **3 chunks のみ ingest** 後 `Source/` へ（当時ロジック）。

**現状:** 修正済み（OCR 完了判定 `.progress.json` 必須）。全冊取り込みには **268 ページ OCR 完了** が必要。

---

## 現在のファイル配置（2026-05-24 終了時点）

### `Source/Failed/`（6 冊 — Vector 化未完了）

1. Cleaves_1982_Secret_History_Mongols.pdf — **原因 A + D**
2. Forbes Manz「Rise and Rule of Tamerlane」.pdf — **原因 A + E**（OCR 途中）
3. Morgan the Mongols.pdf — **原因 A + F**
4. 【歴史小説】井上靖「蒼き狼」.pdf — **原因 A + D**
5. 杉山正明「モンゴル帝国の興亡」上.pdf — **原因 A + E**
6. 杉山正明「モンゴル帝国の興亡」下.pdf — **原因 A + E**

### 参照ファイル

| パス | 内容 |
|------|------|
| `Source/OCR-BUDGET-SKIPPED.txt` | 予算超過で OCR 中止した冊 |
| `Source/ingest-failed-2026-05-24T13-38-22.txt` | 初回バッチ失敗一覧（スキャン・epub） |
| `Source/staging/*.txt` | OCR 途中テキスト（再開用） |

---

## 成功したコマンド・スクリプト

```bash
cd web
npm run ingest:books-batch          # テキスト層 PDF / md
npm run recover:failed-books        # Failed: EPUB + OCR PDF
npm run recover:failed-books -- --page-delay-ms 5000
```

**上限（運用）:** 1 冊 **120 chunks**、テーマ合計 **4000**（`ao-rag-policy.ts`）。

---

## 次回（Vector 化再開時）

1. **予算内 3 冊:** Forbes（OCR 再開）・杉山上下 — `recover:failed-books --page-delay-ms 5000`
2. **予算超 2 冊:** 蒼き狼・Cleaves — GCP Vision または `staging` 手置き
3. **Morgan:** 全ページ OCR 後に再 ingest（現行 3 chunks は不完全の可能性）
4. 完了後: `probe:books`、典籍論チャットは **全冊 ingest 後** に評価（チェックリスト方針）

---

## 本日の作業終了

- EPUB **完了**
- テキスト層 PDF **大半完了**
- スキャン PDF は **原因特定・分類済み**、実処理は次回
