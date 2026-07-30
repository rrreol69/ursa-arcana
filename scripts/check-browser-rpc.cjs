const WebSocket = require('ws')

async function main() {
  const target = await fetch('http://127.0.0.1:9222/json/new?http://127.0.0.1:4173/vault', { method: 'PUT' }).then(response => response.json())
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  const pending = new Map()
  let id = 0
  await new Promise(resolve => socket.on('open', resolve))
  socket.on('message', raw => {
    const message = JSON.parse(raw)
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message)
      pending.delete(message.id)
    }
  })
  const call = (method, params = {}) => new Promise(resolve => {
    const nextId = ++id
    pending.set(nextId, resolve)
    socket.send(JSON.stringify({ id: nextId, method, params }))
  })
  await call('Runtime.enable')
  await new Promise(resolve => setTimeout(resolve, 1500))
  for (const url of ['https://rpc.drpc.testnet.arc.network', 'https://rpc.blockdaemon.testnet.arc.network']) {
    const expression = `fetch('${url}', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: '0x0Af21679b58591799e20F790EBCc55de84690D01', data: '0x18160ddd' }, 'latest'] }) }).then(async response => JSON.stringify({ url: '${url}', status: response.status, body: await response.text() })).catch(error => JSON.stringify({ url: '${url}', error: error.message }))`
    const response = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    console.log(response.result.result.value)
  }
  socket.close()
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
