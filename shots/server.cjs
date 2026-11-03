const http = require('http')
const fs = require('fs')
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
  const chunks = []
  req.on('data', c => chunks.push(c))
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8')
    fs.writeFileSync('shots/frame.jpg', Buffer.from(body.replace(/^data:image\/\w+;base64,/, ''), 'base64'))
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
  })
}).listen(8099, '127.0.0.1', () => console.log('ready'))
