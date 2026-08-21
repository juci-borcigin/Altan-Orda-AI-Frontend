# ローカル退避（Git 非追跡）

掃除・最新化で削除したファイルのコピー置き場。`.gitignore` によりリポジトリには載せない。

##  layout

```
_archive/cleanup-YYYY-MM-DD/<chunk-id>/
  … 削除前のファイル／ディレクトリ
```

## 戻し

1. [AO_Cleanup_Ledger.md](../docs/operations/AO_Cleanup_Ledger.md) で chunk-id と commit SHA を確認
2. まず `git revert <sha>`（コード差分）
3. 画像・単体ファイルのみ Ledger の退避パスから元位置へコピー
