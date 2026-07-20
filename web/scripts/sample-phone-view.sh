#!/usr/bin/env bash
# スマホから Sample を見るための最短経路。
# 1) 同一Wi-Fi: Mac の LAN IP を表示
# 2) 静的フォルダだけを簡易ホスト（Mac起動中）
# 3) 恒久: public/sample を Vercel/Cloudflare Pages へ

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo unknown)"

echo "=== Sample スマホ閲覧 ==="
echo "1) Next dev が動いていれば:"
echo "   http://${IP}:3000/sample"
echo "   http://${IP}:3000/sample/session1-visual-lab"
echo
echo "2) 静的ビューアのみ（Mac起動中・追加依存なし）:"
echo "   cd ${ROOT}/public/sample/session1-visual-lab && python3 -m http.server 8765"
echo "   http://${IP}:8765/static.html"
echo
echo "3) Mac電源オフでも見る:"
echo "   ${ROOT}/public/sample/session1-visual-lab/ を zip して"
echo "   Cloudflare Pages / Netlify / Vercel の静的デプロイへアップロード"
echo "   （画像+manifest.json+static.html だけで動く）"
