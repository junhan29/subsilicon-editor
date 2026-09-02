#!/bin/bash
# ================================================================
# local-sync-release.sh — 本地发布同步（替代 CI 内跨国际 scp，根治 6h 超时）
#
# 背景：GitHub Actions runner（境外）→ 腾讯云服务器（中国）跨国际 scp 实测仅
# ~12-20KB/s，1.1GB 资产无法在 GitHub 6h job 超时内完成（v1.19.0 实测被取消）。
# 本地链路（国内镜像下载 + scp 直传）实测 ~5-10MB/s，2 分钟即可完成上传。
#
# 用法：
#   bash scripts/local-sync-release.sh <VERSION>      # VERSION 不带 v，如 1.19.0
#
# 前置：
#   - gh CLI 已登录（读取 GitHub Release 资产 size 做校验）
#   - ~/.ssh/config 存在 subsilicon 别名（HostName/User/Port/IdentityFile），
#     可用环境变量 SSH_HOST_ALIAS 覆盖别名
#
# 流程：
#   1) 解析 ~/.ssh/config 的服务器信息
#   2) 从国内镜像（gh-proxy.com → ghfast.top → GitHub 直连）下载全部资产并校验 size
#   3) 调用 .github/scripts/sync-release-to-server.sh 上传 + 服务器端生成 yml + 根软链
#   4) 更新服务器 releases/latest.json（指向 v<VERSION>）
#   5) 清理临时文件与 sync 脚本写入的 ~/.ssh/id_rsa
#
# 注意：网站本地 public/releases/latest.json 与 v<VERSION>/releases-manifest.json
#       需另行同步并运行 node scripts/gen-download-config.cjs（见发布 SOP）。
# ================================================================
set -euo pipefail

VERSION="${1:?usage: local-sync-release.sh <VERSION>}"
SSH_HOST="${SSH_HOST_ALIAS:-subsilicon}"
REPO="junhan29/subsilicon-editor"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== [local-sync] version=${VERSION} ssh_host=${SSH_HOST} ==="

# ---------- 1. 解析 SSH config ----------
resolve_ssh_opt() { ssh -G "$SSH_HOST" 2>/dev/null | awk -v k="$1" '$1==k {print $2; exit}'; }
SERVER_HOST="$(resolve_ssh_opt hostname)"
SERVER_USER="$(resolve_ssh_opt user)"
SSH_PORT="$(resolve_ssh_opt port)"; SSH_PORT="${SSH_PORT:-22022}"
SSH_KEY="$(resolve_ssh_opt identityfile)"
if [ -z "$SERVER_HOST" ] || [ -z "$SERVER_USER" ]; then
  echo "❌ ~/.ssh/config 缺少 $SSH_HOST 别名（需 HostName/User）"; exit 1
fi
if [ -n "$SSH_KEY" ] && [ "${SSH_KEY:0:1}" = "~" ]; then SSH_KEY="$HOME${SSH_KEY:1}"; fi
[ -f "$SSH_KEY" ] || { echo "❌ IdentityFile 不存在: $SSH_KEY"; exit 1; }
echo "    server=${SERVER_USER}@${SERVER_HOST}:${SSH_PORT} key=${SSH_KEY}"

# ---------- 2. 获取 GitHub Release 资产清单（期望 size 校验） ----------
ASSETS_JSON="$(gh api "repos/$REPO/releases/tags/v$VERSION" --jq '.assets[] | "\(.name)|\(.size)"' 2>/dev/null || true)"
if [ -z "$ASSETS_JSON" ]; then
  echo "❌ 无法读取 GitHub Release v$VERSION（gh 未登录或 Release 未创建）"; exit 1
fi
echo "    Release 资产数: $(printf '%s\n' "$ASSETS_JSON" | wc -l | tr -d ' ')"

# ---------- 3. 下载资产（国内镜像优先，size 校验兜底） ----------
RELEASE_URL="https://github.com/$REPO/releases/download/v$VERSION"
MIRRORS=("https://gh-proxy.com/" "https://ghfast.top/" "")
TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; rm -f "$HOME/.ssh/id_rsa" "$HOME/.ssh/id_rsa.pub"; }
trap cleanup EXIT

file_size() { stat -f%z "$1" 2>/dev/null || stat -c%s "$1" 2>/dev/null || echo 0; }

download_one() {
  local name="$1" want="$2" got=""
  for m in "${MIRRORS[@]}"; do
    local url="$m$RELEASE_URL/$name"
    echo "  → $name"
    echo "     源: ${url:-直连 GitHub}"
    if curl -fsSL -o "$TMP/$name" --max-time 900 --retry 1 "$url"; then
      got="$(file_size "$TMP/$name")"
      if [ "$got" = "$want" ]; then echo "     OK size=${got}"; return 0; fi
      echo "     size 不匹配 (${got} != ${want})，换源重试"
    else
      echo "     下载失败，换源重试"
    fi
  done
  echo "❌ 全部源失败: $name"; return 1
}

N=0
while IFS='|' read -r name want; do
  [ -n "$name" ] || continue
  download_one "$name" "$want"
  N=$((N+1))
done <<< "$ASSETS_JSON"
echo "=== [local-sync] downloaded ${N} assets (size 校验通过) ==="

# GitHub Release 资产名为 "SubSilicon.Editor-*"（点号），sync 脚本期望空格格式，统一重命名
cd "$TMP"
for f in SubSilicon.Editor-${VERSION}-*; do
  [ -e "$f" ] || continue
  mv "$f" "SubSilicon Editor-${f#SubSilicon.Editor-}"
done
echo "=== [local-sync] renamed assets to space format ==="

# ---------- 4. 服务器同步（上传 + yml 生成 + 根软链） ----------
SERVER_HOST="$SERVER_HOST" SERVER_USER="$SERVER_USER" \
SERVER_SSH_KEY="$(cat "$SSH_KEY")" SSH_PORT="$SSH_PORT" \
bash "$DIR/../.github/scripts/sync-release-to-server.sh" "$VERSION" "$TMP"

# ---------- 5. 更新服务器 latest.json（网站下载页运行时数据） ----------
ssh -o ConnectTimeout=15 "$SSH_HOST" "cat > /var/www/subsilicon/public/releases/latest.json << 'EOF'
{
  \"latest\": \"v$VERSION\",
  \"version\": \"$VERSION\",
  \"updatedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\",
  \"manifestUrl\": \"/releases/v$VERSION/releases-manifest.json\"
}
EOF
chown subsilicon:subsilicon /var/www/subsilicon/public/releases/latest.json" \
  && echo "=== [local-sync] 服务器 latest.json 已更新 → v$VERSION ==="

# ---------- 6. 上传网站 manifest + 生成/部署 data/updates ----------
# 6a. 如果网站本地有 manifest，上传到服务器版本目录
WEBSITE_ROOT="$(cd "$DIR/../../.." && pwd)"
MANIFEST="$WEBSITE_ROOT/public/releases/v$VERSION/releases-manifest.json"
if [ -f "$MANIFEST" ]; then
  scp -o ConnectTimeout=15 "$MANIFEST" "$SSH_HOST:/var/www/subsilicon/public/releases/v$VERSION/releases-manifest.json" \
    && ssh -o ConnectTimeout=15 "$SSH_HOST" "chown subsilicon:subsilicon /var/www/subsilicon/public/releases/v$VERSION/releases-manifest.json" \
    && echo "=== [local-sync] releases-manifest.json 已上传 ==="
fi

# 6b. 从服务器 yml 读取 base64 sha512 → 转 hex → 生成 data/updates JSON
update_hex() { echo "$1" | base64 -d 2>/dev/null | xxd -p | tr -d '\n'; }
MAC_SHA="$(ssh -o ConnectTimeout=15 "$SSH_HOST" "cat /var/www/subsilicon/public/releases/latest-mac.yml" | grep 'sha512:' | head -1 | awk '{print $2}')"
WIN_SHA="$(ssh -o ConnectTimeout=15 "$SSH_HOST" "cat /var/www/subsilicon/public/releases/latest.yml" | grep 'sha512:' | head -1 | awk '{print $2}')"
MAC_HEX="$(update_hex "$MAC_SHA")"
WIN_HEX="$(update_hex "$WIN_SHA")"
MAC_SIZE="$(ssh -o ConnectTimeout=15 "$SSH_HOST" "cat /var/www/subsilicon/public/releases/latest-mac.yml" | grep 'size:' | head -1 | awk '{print $2}')"
WIN_SIZE="$(ssh -o ConnectTimeout=15 "$SSH_HOST" "cat /var/www/subsilicon/public/releases/latest.yml" | grep 'size:' | head -1 | awk '{print $2}')"
NOW="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"

for pair in "mac:arm64:$MAC_HEX:$MAC_SIZE:macos-arm64" "win:x64:$WIN_HEX:$WIN_SIZE:windows-x64"; do
  IFS=':' read -r plat arch hex size fname <<< "$pair"
  ssh -o ConnectTimeout=15 "$SSH_HOST" "mkdir -p /var/www/subsilicon/standalone/data/updates/$plat && cat > /var/www/subsilicon/standalone/data/updates/$plat/$arch.json << ENDJSON
{
  \"version\": \"$VERSION\",
  \"releaseDate\": \"$NOW\",
  \"releaseNotes\": \"SubSilicon Editor v$VERSION\",
  \"files\": [
    {
      \"url\": \"https://subsilicon.cn/releases/v$VERSION/SubSilicon%20Editor-$VERSION-$fname.zip\",
      \"sha512\": \"$hex\",
      \"size\": $size
    }
  ],
  \"$plat\": {
    \"zip\": {
      \"url\": \"https://subsilicon.cn/releases/v$VERSION/SubSilicon%20Editor-$VERSION-$fname.zip\",
      \"sha512\": \"$hex\",
      \"size\": $size
    }
  }
}
ENDJSON
chown -R subsilicon:subsilicon /var/www/subsilicon/standalone/data/updates/$plat"
done
echo "=== [local-sync] data/updates 已生成并部署到 standalone ==="

echo "=== [local-sync] 完成：服务器 /releases/v$VERSION/ + data/updates 已就绪 ==="
echo "提示：网站本地 public/releases/latest.json + v$VERSION/releases-manifest.json 需同步并运行 node scripts/gen-download-config.cjs"
