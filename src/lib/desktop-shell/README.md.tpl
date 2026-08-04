# SubSilicon 作品独立桌面壳 · 使用说明

本目录由 **SubSilicon Editor 导出独立游戏软件** 功能生成。

## 一、运行/分发三种方式

1. **开发时预览**：安装依赖后本地启动
   ```
   npm install
   npm start
   ```
2. **打包分发**（需要联网下载 electron-builder 缓存，首次较慢）：
   ```
   # macOS（输出 dmg + zip，双架构）
   npm run dist:mac

   # Windows（输出 nsis 安装包 + portable 免安装）
   npm run dist:win

   # Linux（AppImage + deb）
   npm run dist:linux

   # 一次性打包 Win + Mac
   npm run dist:all
   ```
3. **把 dist/ 目录下产物直接发给用户**：
   - macOS：用户双击 `.dmg` 拖入「应用程序」。未公证版本需「右键 → 打开」。
   - Windows：`.exe` 安装；或 `*Portable.exe` 双击即玩（解压到任意目录都能跑）。
   - Linux：`chmod +x *.AppImage && ./xxx.AppImage`。

## 二、壳提供的能力（作品 HTML 可直接调用）

```javascript
// 仅在桌面壳运行时可用
if (window.SubSiliconDesktop) {
  // 存档
  await window.SubSiliconDesktop.saveWrite('auto', { currentNodeId: 'n1', variables: {...} })
  const saved = await window.SubSiliconDesktop.saveLoad('auto')   // { ok, data }
  await window.SubSiliconDesktop.saveDelete('auto')
  const slots = await window.SubSiliconDesktop.saveList()          // string[]

  // 窗口
  const fs = await window.SubSiliconDesktop.toggleFullscreen()
  await window.SubSiliconDesktop.minimize()

  // 打开外部链接（如赞助平台）
  await window.SubSiliconDesktop.openExternal('https://...')

  // 重置全部存档（弹确认框）
  await window.SubSiliconDesktop.resetSaves()
}
```

## 三、合规提示

1. **签名与公证**（面向正式发布时）
   - Windows：如需绕过 SmartScreen 警告，需购买 EV 代码签名证书（推荐 DigiCert/Sectigo）。
   - macOS：如需绕过"已损坏"提示，需苹果开发者账号 + Notary Service 公证。
2. **作品版权**：`work-manifest.json` 中 `author` 为作品版权归属（由你在编辑器导出时填写）。壳只负责打包，不承担作品内容责任。
3. **图标替换**：`build/` 目录放 `icon.icns` (mac) / `icon.ico` (win) / `icon.png` (linux, 1024×1024)，即可替换默认 SubSilicon 图标。

## 四、常见问题

- 打包时报 `EPERM: operation not permitted`：关闭杀毒软件 / 关闭正在运行的同名 App。
- 安装 `.exe` 报"Windows 已保护你的电脑"：点击"更多信息 → 仍要运行"，或购买代码签名证书。
- macOS 双击报"已损坏"：`xattr -d com.apple.quarantine /Applications/你的App.app`。
