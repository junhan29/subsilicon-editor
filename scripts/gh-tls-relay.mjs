// 一次性工具：GitHub HTTPS 被 TLS 干扰时的本地 CONNECT 转发代理
// 将 github.com:443 的 CONNECT 请求转发到可直连的 IP 140.82.114.3:443
// TLS 端到端不解密（盲转发）。用法：
//   node scripts/gh-tls-relay.mjs &
//   git -c http.proxy=http://127.0.0.1:4437 push origin main
// 完成后：unset http.proxy / kill 进程
import http from 'node:http'
import net from 'node:net'

const PORT = 4437
const TARGET = { host: '140.82.114.3', port: 443 }

const server = http.createServer((req, res) => {
  res.writeHead(405, { 'Content-Type': 'text/plain' })
  res.end('CONNECT only')
})

server.on('connect', (req, clientSocket, head) => {
  const target = net.connect(TARGET.port, TARGET.host, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
    if (head && head.length) target.write(head)
    target.pipe(clientSocket)
    clientSocket.pipe(target)
  })
  target.on('error', () => clientSocket.destroy())
  clientSocket.on('error', () => target.destroy())
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`CONNECT relay on 127.0.0.1:${PORT} -> ${TARGET.host}:${TARGET.port}`)
})
