#!/usr/bin/env bash
# ============================================================
# SubSilicon Editor · 一键发布脚本（幂等）
#   用法：
#     bin/release.sh <patch|minor|major> [--skip-push] [--no-build]
#
#   流程：
#   1. bump 版本号（单源：build-version.cjs + package.json）
#   2. git tag v<NEW_VERSION>
#   3. 执行 npm run dist（三平台构建 → 触发 V3 后处理）
#   4. 把 release/ 产物同步到网站项目 public/releases/v<SEMVER>/
#      并在 public/releases/ 生成 latest.json 指向当前
#   5. 默认 git push origin HEAD --tags（--skip-push 跳过）
#
#   dry-run 范例：bin/release.sh patch --skip-push --no-build
#     (bump 后需要自己手动再 bump 回原版本恢复)
# ============================================================
set -euo pipefail

RED='\033[0;31m'
GRN='\033[0;32m'
YEL='\033[1;33m'
RST='\033[0m'
BOLD='\033[1m'

if [[ "${BASH_SOURCE[0]}" = /* ]]; then
  SCRIPT="${BASH_SOURCE[0]}"
else
  SCRIPT="$PWD/${BASH_SOURCE[0]}"
fi
SCRIPT_DIR="$(cd -P "$(dirname "$SCRIPT")" && pwd)"
ROOT_DIR="$(cd -P "$SCRIPT_DIR/.." && pwd)"

# ---- 参数解析 ----
BUMP="${1:-}"
SKIP_PUSH=0
NO_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --skip-push) SKIP_PUSH=1 ;;
    --no-build)  NO_BUILD=1 ;;
  esac
done

if [[ -z "$BUMP" ]]; then
  echo -e "${RED}缺少 bump 参数：$0 <patch|minor|major> [--skip-push] [--no-build]${RST}"
  exit 1
fi
case "$BUMP" in
  patch|minor|major) ;;
  *) echo -e "${RED}非法 bump 类型：$BUMP (仅允许 patch|minor|major)${RST}"; exit 1 ;;
esac

cd "$ROOT_DIR"

echo -e "${BOLD}======== SubSilicon Editor 发布开始 ========${RST}"
echo "  ROOT        : $ROOT_DIR"
echo "  bump        : $BUMP"
echo "  skip push?  : $([[ $SKIP_PUSH -eq 1 ]] && echo YES || echo NO)"
echo "  build?      : $([[ $NO_BUILD -eq 1 ]] && echo NO || echo YES)"
echo

# ---- S1. bump 版本 ----
echo -e "${BOLD}[S1/6] 执行 bump: $BUMP${RST}"
node scripts/bump-version.cjs "$BUMP" || {
  echo -e "${RED}bump 失败${RST}"; exit 1
}

# 读取新 SEMVER / VERSION（从 build-version.cjs require）
eval "$(node -e "
  const v = require('./desktop/build-version.cjs');
  console.log('SEMVER=' + v.SEMVER);
  console.log('VERSION=' + v.VERSION);
")"
echo -e "  → 新版本: SEMVER=${GRN}${SEMVER}${RST}  VERSION=${GRN}${VERSION}${RST}"

# ---- S2. git tag v<SEMVER> ----
echo
echo -e "${BOLD}[S2/6] Git tag: v${SEMVER}${RST}"
TAG="v${SEMVER}"
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo -e "${YEL}  tag $TAG 已存在，跳过打 tag (幂等)${RST}"
else
  git tag -a "$TAG" -m "Release $TAG"
  echo -e "${GRN}  打 tag OK${RST}"
fi

# ---- S3. 构建 ----
echo
echo -e "${BOLD}[S3/6] 构建产物 (npm run dist)${RST}"
if [[ $NO_BUILD -eq 1 ]]; then
  echo -e "${YEL}  --no-build：跳过构建；为了 dry-run 仍跑 postProcessReleases 走一次生成流程${RST}"
  node -e "
    const { preflightPatch, postProcessReleases } = require('./desktop/build.cjs');
    const pre = preflightPatch();
    postProcessReleases({ buildInfo: pre.buildInfo });
  " || { echo -e "${RED} postProcess 失败${RST}"; exit 1; }
else
  npm run dist || { echo -e "${RED} 构建失败${RST}"; exit 1; }
fi

# ---- S4. 同步到网站项目 ----
WEBSITE_ROOT="/Users/seey/projects/SubSilicon"
WEBSITE_RELEASES="$WEBSITE_ROOT/public/releases"
TARGET_DIR="$WEBSITE_RELEASES/v${SEMVER}"
echo
echo -e "${BOLD}[S4/6] 同步到网站项目 → $TARGET_DIR${RST}"
if [[ -d "$WEBSITE_ROOT" ]]; then
  mkdir -p "$TARGET_DIR"
  # 三大件 dmg/exe + blockmap + latest-*.yml + releases-manifest.json + CHECKSUMS_SHA256.txt
  rsync -ah --delete --include='*.dmg' --include='*.exe' --include='*.blockmap' \
    --include='latest-*.yml' --include='latest.yml' \
    --include='releases-manifest.json' --include='CHECKSUMS_SHA256.txt' \
    --exclude='*' \
    "$ROOT_DIR/release/" "$TARGET_DIR/"
  echo -e "${GRN}  rsync 完成${RST}"
  ls -lah "$TARGET_DIR"

  # ---- S5. 写 latest.json 指向当前 ----
  echo
  echo -e "${BOLD}[S5/6] 生成 latest.json (最新指针)${RST}"
  UPDATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  cat > "$WEBSITE_RELEASES/latest.json" <<JSON
{
  "latest": "v${SEMVER}",
  "version": "${SEMVER}",
  "updatedAt": "${UPDATED_AT}",
  "manifestUrl": "/releases/v${SEMVER}/releases-manifest.json"
}
JSON
  echo -e "${GRN}  latest.json 写入："
  cat "$WEBSITE_RELEASES/latest.json"
else
  echo -e "${YEL}  网站目录不存在 ($WEBSITE_ROOT)，跳过同步${RST}"
fi

# ---- S6. Push 默认 ----
echo
echo -e "${BOLD}[S6/6] git push origin HEAD --tags${RST}"
if [[ $SKIP_PUSH -eq 1 ]]; then
  echo -e "${YEL}  --skip-push：跳过 push。手动执行：${RST}"
  echo "      cd "$ROOT_DIR" && git push origin HEAD --tags"
else
  git push origin HEAD --tags
fi

echo
echo -e "${GRN}${BOLD}🎉 发布完成。${RST}"
echo "  版本:  v${SEMVER}"
echo "  产物:  $ROOT_DIR/release/"
echo "  网站:  $TARGET_DIR/"
echo
echo -e "${YEL}提示: 网站端下一步需要执行 SubSilicon 的 build + deploy (用户可独立执行)${RST}"
echo "      cd $WEBSITE_ROOT && npm run build  && <pm2/部署脚本> restart"
