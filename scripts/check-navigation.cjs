const WebSocket = require('ws')

async function main() {
  const target = await fetch('http://127.0.0.1:9222/json/new?http://127.0.0.1:4173', { method: 'PUT' }).then(response => response.json())
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  const pending = new Map()
  const exceptions = []
  let id = 0

  await new Promise(resolve => socket.on('open', resolve))
  socket.on('message', raw => {
    const message = JSON.parse(raw)
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message)
      pending.delete(message.id)
    }
    if (message.method === 'Runtime.exceptionThrown') {
      exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text)
    }
  })

  const call = (method, params = {}) => new Promise(resolve => {
    const nextId = ++id
    pending.set(nextId, resolve)
    socket.send(JSON.stringify({ id: nextId, method, params }))
  })

  await call('Runtime.enable')
  await new Promise(resolve => setTimeout(resolve, 2500))

  for (const path of ['/raffles', '/auctions', '/lend', '/vault', '/learn', '/']) {
    await call('Runtime.evaluate', { expression: `document.querySelector('a[href="${path}"]')?.click()` })
    await new Promise(resolve => setTimeout(resolve, 700))
    const response = await call('Runtime.evaluate', {
      expression: `JSON.stringify({ path: location.pathname, children: document.getElementById('root').children.length, heading: document.querySelector('h1')?.textContent })`,
      returnByValue: true,
    })
    console.log(response.result.result.value)
  }

  socket.close()
  if (exceptions.length) {
    console.error(exceptions.join('\n'))
    process.exitCode = 1
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
