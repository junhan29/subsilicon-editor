const fs = require('fs')
const path = require('path')

const isDev = process.env.NODE_ENV === 'development'

// Desktop files are already CommonJS, just copy them
const files = ['main.cjs', 'preload.cjs']

for (const file of files) {
  const src = path.join(__dirname, file)
  const dest = path.join(__dirname, 'dist', file)
  
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(src, dest)
    console.log(`Copied ${file}`)
  }
}

console.log('Electron main process files ready')
