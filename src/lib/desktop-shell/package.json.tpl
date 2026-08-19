{
  "name": "subsilicon-work-shell",
  "version": "1.0.0",
  "private": true,
  "_subsiliconStandaloneShell": true,
  "description": "SubSilicon 作品独立桌面壳（由编辑器导出器生成）",
  "main": "main.cjs",
  "author": "SubSilicon Work Author",
  "scripts": {
    "start": "electron .",
    "dist:mac": "electron-builder --mac --publish never",
    "dist:win": "electron-builder --win --publish never",
    "dist:linux": "electron-builder --linux --publish never",
    "dist:all": "electron-builder -mw --publish never"
  },
  "devDependencies": {
    "electron": "__ELECTRON_VERSION__",
    "electron-builder": "__BUILDER_VERSION__"
  },
  "build": {
    "appId": "cn.subsilicon.work.__WORK_ID__",
    "productName": "__WORK_NAME__",
    "directories": {
      "output": "dist"
    },
    "asar": true,
    "asarUnpack": [
      "index.html",
      "work-manifest.json",
      "work-icon.png"
    ],
    "files": [
      "main.cjs",
      "preload.cjs",
      "index.html",
      "work-manifest.json",
      "work-icon.png"
    ],
    "mac": {
      "category": "public.app-category.games",
      "target": [
        { "target": "dmg", "arch": ["x64", "arm64"] },
        { "target": "zip", "arch": ["x64", "arm64"] }
      ],
      "icon": "build/icon.icns",
      "darkModeSupport": true,
      "hardenedRuntime": false,
      "gatekeeperAssess": false
    },
    "win": {
      "target": [
        { "target": "nsis", "arch": ["x64"] },
        { "target": "portable", "arch": ["x64"] }
      ],
      "icon": "build/icon.ico"
    },
    "linux": {
      "target": [
        { "target": "AppImage", "arch": ["x64"] },
        { "target": "deb", "arch": ["x64"] }
      ],
      "category": "Game",
      "icon": "build/icon.png"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "perMachine": false,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "__WORK_NAME__"
    }
  }
}
