import COS from 'cos-nodejs-sdk-v5'
import fs from 'fs'
import path from 'path'

const COS_SECRET_ID = process.env.COS_SECRET_ID
const COS_SECRET_KEY = process.env.COS_SECRET_KEY
const COS_BUCKET = process.env.COS_BUCKET
const COS_REGION = process.env.COS_REGION || 'ap-shanghai'
const VERSION = process.env.VERSION
const RELEASE_DIR = process.env.RELEASE_DIR || 'release'

if (!COS_SECRET_ID || !COS_SECRET_KEY || !COS_BUCKET || !VERSION) {
  console.error('Missing required env vars: COS_SECRET_ID, COS_SECRET_KEY, COS_BUCKET, VERSION')
  process.exit(1)
}

const cos = new COS({
  SecretId: COS_SECRET_ID,
  SecretKey: COS_SECRET_KEY,
})

const files = []
for (const f of fs.readdirSync(RELEASE_DIR)) {
  const fullPath = path.join(RELEASE_DIR, f)
  if (fs.statSync(fullPath).isFile()) {
    files.push(fullPath)
  }
}

let ok = 0, fail = 0
for (const local of files) {
  const filename = path.basename(local)
  const remoteKey = `releases/v${VERSION}/${filename}`

  try {
    const stat = fs.statSync(local)
    await new Promise((res, rej) => {
      cos.putObject({
        Bucket: COS_BUCKET,
        Region: COS_REGION,
        Key: remoteKey,
        Body: fs.createReadStream(local),
        ContentLength: stat.size,
      }, (err, data) => {
        if (err) rej(err); else res(data)
      })
    })
    console.log(`OK: ${remoteKey} (${(stat.size / 1024 / 1024).toFixed(1)}MB)`)
    ok++
  } catch (e) {
    console.log(`FAIL: ${remoteKey} - ${e.message || e}`)
    fail++
  }
}

console.log(`\nDone: ${ok} uploaded, ${fail} failed`)
