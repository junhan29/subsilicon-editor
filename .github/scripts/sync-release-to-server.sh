#!/bin/bash
# ================================================================
# sync-release-to-server.sh — 把发布资产同步到腾讯云服务器
#
# 设计目标：规避「服务器→GitHub」网络差导致的同步失败（HTTP/2 PROTOCOL_ERROR、
# ~1KB/s 超时）。改为「runner/本地 → scp → 服务器」，runner 与 GitHub 同网络稳定，
# runner 到服务器 ssh 稳定。
#
# 用法：
#   bash .github/scripts/sync-release-to-server.sh <VERSION> [SRC_DIR]
#     VERSION  = 不带 v 的版本号，如 1.18.2
#     SRC_DIR  = 本地资产目录（默认 release/，文件名须为空格格式 "SubSilicon Editor-x.y.z-*"）
#
# 环境变量（由 workflow 注入）：
#   SERVER_HOST / SERVER_USER / SERVER_SSH_KEY / SSH_PORT(默认 22022)
#
# 行为：
#   1) 清理并重建服务器 releases/v<VER>/ 目录
#   2) scp 上传全部资产（dmg/exe/AppImage/deb/tar.gz/zip + blockmap）
#   3) 服务器端验证 3 个关键 zip，生成 latest-mac.yml / latest.yml
#      （url 强制 v<VER>/ 前缀，sha512 base64 —— 对齐 electron-updater generic feedURL）
#   4) 根目录 latest*.yml 软链指向 v<VER>/
# ================================================================
set -euo pipefail

VERSION="${1:?usage: sync-release-to-server.sh <VERSION> [SRC_DIR]}"
SRC_DIR="${2:-release}"
SERVER_HOST="${SERVER_HOST:?SERVER_HOST required}"
SERVER_USER="${SERVER_USER:?SERVER_USER required}"
SSH_PORT="${SSH_PORT:-22022}"
REMOTE_RELEASE_DIR="/var/www/subsilicon/public/releases"
VERSION_DIR="${REMOTE_RELEASE_DIR}/v${VERSION}"

echo "=== [sync] version=${VERSION} src=${SRC_DIR} server=${SERVER_HOST}:${SSH_PORT} ==="

# ---------- 1. SSH 准备 ----------
mkdir -p ~/.ssh
[ -n "${SERVER_SSH_KEY:-}" ] && echo "$SERVER_SSH_KEY" > ~/.ssh/id_rsa && chmod 600 ~/.ssh/id_rsa
ssh-keyscan -p "$SSH_PORT" -H "$SERVER_HOST" >> ~/.ssh/known_hosts 2>/dev/null || true

# ssh 与 scp 共用选项（端口用 -o Port=，ssh 与 scp 均兼容）
SSH_OPTS="-o Port=$SSH_PORT -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=5"

# ---------- 2. 服务器创建版本目录（清理 CI 失败残留） ----------
ssh $SSH_OPTS "$SERVER_USER@$SERVER_HOST" "rm -rf $VERSION_DIR && mkdir -p $VERSION_DIR"
echo "=== [sync] created $VERSION_DIR ==="

# ---------- 3. scp 上传资产（空格文件名，缺失仅警告不中断） ----------
ASSETS=(
  "SubSilicon Editor-${VERSION}-macos-arm64.dmg"
  "SubSilicon Editor-${VERSION}-macos-arm64.dmg.blockmap"
  "SubSilicon Editor-${VERSION}-macos-arm64.zip"
  "SubSilicon Editor-${VERSION}-macos-arm64.zip.blockmap"
  "SubSilicon Editor-${VERSION}-macos-x64.dmg"
  "SubSilicon Editor-${VERSION}-macos-x64.dmg.blockmap"
  "SubSilicon Editor-${VERSION}-macos-x64.zip"
  "SubSilicon Editor-${VERSION}-macos-x64.zip.blockmap"
  "SubSilicon Editor-${VERSION}-windows-x64.exe"
  "SubSilicon Editor-${VERSION}-windows-x64.exe.blockmap"
  "SubSilicon Editor-${VERSION}-windows-x64.zip"
  "SubSilicon Editor-${VERSION}-windows-x64.zip.blockmap"
  "SubSilicon Editor-${VERSION}-linux-amd64.deb"
  "SubSilicon Editor-${VERSION}-linux-x64.tar.gz"
  "SubSilicon Editor-${VERSION}-linux-x86_64.AppImage"
)
SCP_ARGS=()
for a in "${ASSETS[@]}"; do
  if [ -f "$SRC_DIR/$a" ]; then
    SCP_ARGS+=("$SRC_DIR/$a")
  else
    echo "  WARN: 本地缺失 ${a}（跳过，不中断）"
  fi
done
if [ "${#SCP_ARGS[@]}" -eq 0 ]; then
  echo "❌ 没有可上传的资产（$SRC_DIR 为空或文件名非空格格式）"
  exit 1
fi
# 逐个 scp（避免单个大文件/连接挂起卡住整批；ConnectTimeout 防止连接建立无限等待，
# ServerAlive 兜底传输静默超时）。上传失败仅警告，由服务器端验证兜底。
SCP_FAILED=0
UPLOADED=0
for a in "${SCP_ARGS[@]}"; do
  echo "  → 上传 ${a##*/}"
  if scp $SSH_OPTS -o ConnectTimeout=30 "$a" "$SERVER_USER@$SERVER_HOST:$VERSION_DIR/"; then
    UPLOADED=$((UPLOADED + 1))
  else
    echo "  WARN: ${a##*/} 上传失败（继续下一个）"
    SCP_FAILED=$((SCP_FAILED + 1))
  fi
done
echo "=== [sync] uploaded ${UPLOADED} / ${#SCP_ARGS[@]} assets (failed: ${SCP_FAILED}) ==="
[ "$SCP_FAILED" -eq 0 ] || echo "⚠️ ${SCP_FAILED} 个资产上传失败，服务器端验证将兜底"

# ---------- 4. 服务器端：验证 + 生成 yml（v<VER>/ 前缀 + base64 sha512）+ 软链 ----------
ssh $SSH_OPTS "$SERVER_USER@$SERVER_HOST" "VERSION=$VERSION VERSION_DIR=$VERSION_DIR RELEASE_DIR=$REMOTE_RELEASE_DIR bash -s" << 'REMOTE'
set -e
cd "$VERSION_DIR"

echo "=== Step 3: Verify downloads ==="
FAILED=0
for f in \
  "SubSilicon Editor-${VERSION}-macos-arm64.zip" \
  "SubSilicon Editor-${VERSION}-macos-x64.zip" \
  "SubSilicon Editor-${VERSION}-windows-x64.zip"; do
  if [ -s "$f" ]; then
    echo "OK: $f ($(stat -c%s "$f") bytes)"
  else
    echo "MISSING: $f"
    FAILED=1
  fi
done
if [ "$FAILED" -eq 1 ]; then
  echo "关键 zip 缺失，中止发布（避免写出错误元数据）"
  exit 1
fi

echo "=== Step 4: Generate update metadata (v<VER>/ prefix + base64 sha512) ==="
MAC_A64_SHA=$(openssl dgst -sha512 -binary "SubSilicon Editor-${VERSION}-macos-arm64.zip" | base64)
MAC_X64_SHA=$(openssl dgst -sha512 -binary "SubSilicon Editor-${VERSION}-macos-x64.zip" | base64)
MAC_A64_SIZE=$(stat -c%s "SubSilicon Editor-${VERSION}-macos-arm64.zip")
MAC_X64_SIZE=$(stat -c%s "SubSilicon Editor-${VERSION}-macos-x64.zip")
WIN_SHA=$(openssl dgst -sha512 -binary "SubSilicon Editor-${VERSION}-windows-x64.zip" | base64)
WIN_SIZE=$(stat -c%s "SubSilicon Editor-${VERSION}-windows-x64.zip")
RD=$(date -u +%Y-%m-%dT%H:%M:%SZ)

cat > latest-mac.yml << YML
version: ${VERSION}
files:
  - url: v${VERSION}/SubSilicon Editor-${VERSION}-macos-arm64.zip
    sha512: ${MAC_A64_SHA}
    size: ${MAC_A64_SIZE}
  - url: v${VERSION}/SubSilicon Editor-${VERSION}-macos-x64.zip
    sha512: ${MAC_X64_SHA}
    size: ${MAC_X64_SIZE}
path: v${VERSION}/SubSilicon Editor-${VERSION}-macos-x64.zip
sha512: ${MAC_X64_SHA}
releaseDate: '${RD}'
YML

cat > latest.yml << YML
version: ${VERSION}
files:
  - url: v${VERSION}/SubSilicon Editor-${VERSION}-windows-x64.zip
    sha512: ${WIN_SHA}
    size: ${WIN_SIZE}
path: v${VERSION}/SubSilicon Editor-${VERSION}-windows-x64.zip
sha512: ${WIN_SHA}
releaseDate: '${RD}'
YML

echo "=== Step 5: Publish (root symlinks) ==="
ln -sfn "v${VERSION}/latest-mac.yml" "$RELEASE_DIR/latest-mac.yml"
ln -sfn "v${VERSION}/latest.yml" "$RELEASE_DIR/latest.yml"

echo "=== Final verification ==="
ls -lh "$VERSION_DIR/"
echo "=== Sync complete ==="
REMOTE

echo "=== [sync] done ==="
