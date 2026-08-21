#!/usr/bin/env bash
# スマホから Lab（実験室）を見るための最短経路。
# 1) 本命: Vercel Preview（AO_LAB_PUBLIC=1 または AO_SAMPLE_PUBLIC=1）
# 2) 同一 Wi-Fi: 下の LAN URL
# 3) 恒久: public/lab を静的ホストへ
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo '<MacのLAN IP>')"
echo "=== Lab スマホ閲覧 ==="
echo "1) Preview: https://<preview>.vercel.app/lab"
echo "2) 同一 Wi-Fi（npm run dev 中）:"
echo "   http://${IP}:3000/lab"
echo "   http://${IP}:3000/lab/session1-visual-lab"
echo "3) 静的だけ:"
echo "   cd ${ROOT}/public/lab/session1-visual-lab && python3 -m http.server 8765"
echo "4) オフライン zip:"
echo "   ${ROOT}/public/lab/session1-visual-lab/ を zip して"
echo "   または session1-visual-lab-offline.zip"
