# AO コード掃除・最新化 Ledger

**更新**: 2026-08-20  
**位置づけ**: 掃除／最新化の作業ログ。戻し手順・確認 Tier・commit SHA を記録する。  
**正本（定義）**: [version-2-layout.md §10](../version-2-layout.md)（テンプレ・パーツ台帳）

---

## 戻しの三層

| 層 | 手段 |
|----|------|
| **Git** | 塊ごと commit → `git revert <sha>` |
| **ローカル退避** | リポジトリ直下 `_archive/cleanup-YYYY-MM-DD/<chunk-id>/`（`.gitignore` 済・Mac ローカルのみ） |
| **本 Ledger** | 下表の 1 行 |

### 退避ルール

- **ファイル削除・大規模リネームの直前**に `_archive` へコピー
- import 整理など Git だけで戻せる塊は退避省略可（Ledger に「Git のみ」と記載）
- 1 commit = 1 chunk（UI 枠移行と lib 削除を混ぜない）
- **Git 記録の方針（2026-08-20）**: 掃除の途中 commit はしない。**掃除完了後・新規開発の前に一括 commit**。戻しは Ledger の chunk と `_archive` で足りる

---

## 確認 Tier

| Tier | 例 | 担保 |
|------|-----|------|
| **A** | 未使用 import、空 dir、別名削除 | `tsc` + `next build` |
| **B** | 枠 Template 化、CSS | 殿下目視 + build |
| **C** | `lib/*` 削除、session handler 整理 | build + スモーク checklist（下記） |
| **D** | `api/chat`、`lib/phase5/*` | build + checklist + probe |

### Tier C スモーク（非 UI・短時間）

- [ ] reload 後も議事一覧が残る
- [ ] 新規議事 → タイトル編集 → reload 後も反映
- [ ] 1 ターン送信 → SSE 応答
- [ ] 設定オーバーレイ：モデル選択が保持
- [ ] 使用量オーバーレイが開く
- [ ] 削除確認 OK / キャンセル

---

## 一括 commit 前ゲート（Remind）

**PC 目視のあと、スマホ確認を済ませてから commit。** 新規開発（A/B テンプレ・Phase 7 等）はその後。

| 面 | URL | 見るもの | 2026-08-20 |
|----|-----|----------|------------|
| PC | `http://localhost:3000/` | 大枠・論タブ・議事タイトル・吹き出し | **済** |
| PC | 同上・巻物／ゴミ箱 | 議事一覧・削除確認の `frame_AS` | **済** |
| **スマホ** | 同上（compact） | 地図・ロゴ、左ドロワー、議事帯、吹き出し | **済**（整理由来の問題なし） |
| Lab | `http://localhost:3000/lab/template-tokens` | トークン台帳 | **済** |

左歯車のグレーアウトは既定。表示の細かいずれ・**左カラムの挙動**は AO シェル側の既存問題であり、**この整理 commit のあと**で直す（混ぜない）。

任意残り（`AO_P5_*` リネーム、未使用 CSS、`/phase5-preview` 二重）は **commit 後**でも可。見た目を変える `map-bg-mobile` 配線は別判断。

---

## 予定（最新化 vs 削除）

| ID | 種別 | 内容 | Tier | 状態 |
|----|------|------|------|------|
| M-01 | 最新化 | 議事一覧／設定：`AoOrnamentalFrame` → `AoTemplateFrame` | B | **完了（chunk-02）** |
| M-02 | 最新化 | 削除確認：`AoOrnamentalFrame` → `AoTemplateFrame` | B | **完了（chunk-02）** |
| M-03 | 最新化 | `AO_P5_*` 定数リネーム（`ao-chrome.ts`） | A/B | 予定 |
| M-04 | 最新化 | `map-bg-mobile` コンパクト viewport 配線 | B | 予定 |
| M-05 | 最新化 | 典籍 §9 の `AoOrnamentalFrame` 記述更新 | doc | **完了（chunk-02）** |
| D-01 | 削除 | 旧 phase5 試作（Bubble/Corner/DecorativeFrame/PortraitCard/PortraitFrameC） | A | **完了（chunk-03）**。`AoTemplateLayoutSample` は A/B 種として残置 |
| D-02 | 削除 | `ao-ron-tab-chrome.ts` | A | **完了（chunk-01）** |
| D-03 | 削除 | `public/phase4/` 画像 | A | **対象なし**（ディレクトリ不在） |

---

## 実施ログ

| 日付 | chunk-id | 種別 | 触ったパス | commit | 退避 | Tier | 確認 | 戻し |
|------|----------|------|------------|--------|------|------|------|------|
| 2026-08-20 | setup | doc | 本 Ledger、`_archive/README.md`、`.gitignore` | （未 commit） | — | — | — | ファイル削除 |
| 2026-08-20 | chunk-01-tier-a-mechanical | logic | `use-ao-chat-session.tsx`（未使用 import／死んだ state・effect・関数） | （未 commit） | Git のみ | A | `tsc` OK、`next build` OK | `git revert` |
| 2026-08-20 | chunk-01-tier-a-mechanical | logic | `ao-kin-layout.ts`（GIKUJI 別名削除、`CHAT_FACE_STACK_W_PX` 非 export 化） | （未 commit） | Git のみ | A | 同上 | `git revert` |
| 2026-08-20 | chunk-01-tier-a-mechanical | logic | `ao-project-tabs-panel.tsx`（`AoRubyGold` 共有化） | （未 commit） | Git のみ | A | 同上 | `git revert` |
| 2026-08-20 | chunk-01-tier-a-mechanical | asset | `public/*.svg` 雛形 5 件削除 | （未 commit） | `_archive/cleanup-2026-08-20/chunk-01-tier-a-mechanical/public/` | A | build OK | `_archive` から `web/public/` へコピー |
| 2026-08-20 | chunk-01-tier-a-mechanical | logic | `lib/ao-ron-tab-chrome.ts` 削除 | （未 commit） | `_archive/.../lib/ao-ron-tab-chrome.ts` | A | import 0・build OK | `_archive` から復元 |
| 2026-08-20 | chunk-02-ornamental-to-template | UI | 議事一覧／設定重ね・削除確認を `AoTemplateFrame` `frame_AS` へ | （未 commit） | `_archive/cleanup-2026-08-20/chunk-02-ornamental-to-template/` | B | `tsc`／build 後、**殿下目視待ち** | `git revert` ＋退避から `AoOrnamentalFrame.tsx` 復元 |
| 2026-08-20 | chunk-02-ornamental-to-template | logic | `AoOrnamentalFrame.tsx` 削除（本番参照 0） | （未 commit） | 同上 | B | 同上 | `_archive` から `web/src/components/ao-phase5/` へコピー |
| 2026-08-20 | chunk-02-ornamental-to-template | doc | `version-2-layout.md` §9／§11.9 を Template 正本へ | （未 commit） | Git のみ | B | — | `git revert` |
| 2026-08-20 | chunk-03-dead-phase5-prototypes | logic | `AoP5Bubble` / `Corner` / `DecorativeFrame` / `PortraitCard` / `PortraitFrameC` 削除 | （未 commit） | `_archive/cleanup-2026-08-20/chunk-03-dead-phase5-prototypes/` | A | `tsc`／build | `_archive` から `ao-phase5/` へコピー |

---

## 実施ログの書き方（テンプレ）

```
| YYYY-MM-DD | chunk-NN-slug | UI|logic|asset|doc | パス概要 | <sha> | _archive/... または Git のみ | A|B|C|D | build / 殿下目視 / checklist | git revert <sha> |
```
