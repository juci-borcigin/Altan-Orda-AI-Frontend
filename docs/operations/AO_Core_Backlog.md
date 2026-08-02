# AO 本体バックログ（To Do）

**更新**: 2026-08-02  
**位置づけ**: 着手前の構想・残課題の置き場。勝手に実装しない。優先順位は殿下の指示に従う。

関連: [AO_Handoff_to_Core_2026-08-02.md](./AO_Handoff_to_Core_2026-08-02.md) ・ [AO_Phase7_Planning.md](../phase7/AO_Phase7_Planning.md) ・ [version-2-layout.md](../version-2-layout.md)

---

## 当面の方針（2026-08-02）

| 項目 | 状態 |
|------|------|
| 講義メーカー機能追加 | クローズ（再開は別指示） |
| Phase 6 続き（典籍論・新規 upload・本番 RAG 配線） | **据え置き** |
| 主戦場 | AO 本体（チャット・運用・レイアウト） |

### 確定した足場方針（2026-08-02）

| 項目 | 決定 |
|------|------|
| PR | 講義メーカー確定分＋ Lab 改名を **1 PR**（`.cursor/` 除外） |
| 本番デプロイ | 講義メーカー（`/`・`/courses`・`/l` 等）は **実施してよい** |
| Lab 原則 | **安く・簡単・安全**。高度な隔離は不要。リスクとコストをかける場所ではない |
| Lab 閲覧 | **この Mac のローカルで充分** |
| Lab と Git | **α**: Git に残す。本番には **載せない**（正本 `web/.vercelignore`） |
| 旧 `/sample` on Vercel | **次の製品デプロイで載せない**（Git からも削除し `/lab` へ寄せる） |
| A（env 同居）／B（Preview）／D（独立 PJ） | **当面やらない** |
| `page.tsx` 三段 | **本体フェーズ**（この PR 外） |
| 同期・永続・残高 UX | **2.5** で想起 |

#### Lab 判断（スブタイ・委任／安く簡単で安全）

- β（Git にも残さない）でも「見る」だけは足りるが、消失・再現・幕僚共有で不利 → **α**
- 別 Vercel／別リポは過コスト → やらない
- 本番にルートを上げないことが、セキュリティ（URL）と運用（バグ温床）への最短策
- 無視リスト方式は可（ソース内 if 分岐を増やさない）

### 実行前の残確認

- [x] デプロイ経路: リポジトリ直下の linked project（`altan-orda-ai-frontend`）へ `vercel --prod`（Root Directory = `web`）。`web/` 単体で新規プロジェクトを作らないこと
- [x] 実行（コミット → Push → PR → 本番デプロイ）— 2026-08-02

PR: https://github.com/juci-borcigin/Altan-Orda-AI-Frontend/pull/1  
本番: https://altan-orda-ai-frontend.vercel.app （`/l` 生存、`/lab`・`/sample` はビルド非搭載）

---

## 将来構想：マルチユーザー（未着手・記録のみ）

大きな方向性。まだ取り掛からない。

1. **機能のモジュール化**  
   直近の講義メーカー、メインのチャット bot、将来の Phase 7 情報管理などを、互いに疎結合なモジュールとして切る。
2. **設定 UI**  
   モジュールごとに対応する設定画面を用意する。
3. **UI テンプレート化**  
   レイアウト／見た目をテンプレート化し、カスタマイズしやすくする。
4. **認証**  
   最初は簡単なユーザー認証から（現状は Google OAuth / Basic の運用ゲート。真のマルチテナント分離は未着手）。

旧 Ver2 仕様では「エンドユーザー向け Supabase Auth・マルチユーザー分離は当面入れない」とあった（`AO_Frontend_Ver2_Implementation_Spec.md` rev.3）。本項はそれを **将来方針として復活・拡張**するメモ。

---

## 作業順の仮置き

1. **足場**: 完了（2026-08-02）
2. **使える基本機能（最低限ゲート）** — 実装中／完了予定  
   - **脱 OpenRouter**: 常時直結。例外は `AO_LLM_FORCE_OPENROUTER=1` のみ（開発時明示）。失敗はエラー（OR へ黙って落とさない）  
   - **単価**: ベンダー直結表（`ao-vendor-pricing.ts`）。OR models API は FORCE 時のみ  
   - **モデル**: Anthropic（Opus 5/4.8/4.7/4.6・Sonnet 5/4.6/4.5・Haiku 4.5）＋ OpenAI（5.6 Sol/Terra/Luna・5.5・5.4/mini）必須。試験に Fable 5・nano・Grok・DeepSeek・Sonar/Pro  
   - 要約既定: Haiku 4.5（実課金は圧縮時のみ別コール。UI 概算には未加算）  
   - Sonar 選択時は Tavily オフ  
   - RAG 改良は内容未定・後追い可
2.5. **基本機能の続き**（この段階で想起）  
   - 同期・永続の健全性  
   - API 残高切れ UX  
   - （候補）履歴要約 Haiku の概算への加算
3. **レイアウト Ver2**（Phase 7 の枠）※前後で `page.tsx`：確定 → 掃除 → 分割  
4. **Phase 7 機能本体**  
5. **マルチユーザー**

---

## Lab / Sample（確定メモ）

| 場所 | Sample / Lab |
|------|----------------|
| この Mac・ローカル | `/lab` を使う（実験・比較。主な用途は AO） |
| GitHub | `/lab` を残す。旧 `/sample` は削除 |
| Vercel 本番 | **載せない**（`.vercelignore` で `/lab`・`/api/lab`・`public/lab` 等） |

---

**作成: 2026-08-02（スブタイ）**
