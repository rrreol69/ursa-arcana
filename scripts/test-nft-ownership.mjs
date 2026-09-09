import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/nftOwnership.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { discoverOwnedTokens, indexedTokens } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const wallet = '0xabc'
function reader(ids, { fail = false, balance = ids.length } = {}) {
  const calls = []; let active = 0; let peak = 0
  return {
    calls, get peak() { return peak },
    balance: async () => BigInt(balance),
    supply: async () => { calls.push('supply'); return 20n },
    owner: async (_, id) => {
      calls.push(id); active++; peak = Math.max(peak, active)
      await new Promise(resolve => setTimeout(resolve, 1)); active--
      if (fail) throw new Error('RPC limit')
      return ids.includes(id) ? wallet : '0xother'
    },
  }
}
let rpc = reader([])
assert.deepEqual((await discoverOwnedTokens(wallet, ['blue'], rpc, new Map())).get('blue'), [])
assert.equal(rpc.calls.length, 0, 'zero balance skips supply and owner reads')
rpc = reader([9])
assert.deepEqual((await discoverOwnedTokens(wallet, ['blue'], rpc, new Map([['blue', [9, 9, 999, -1]]]))).get('blue'), [9])
assert.deepEqual(rpc.calls, ['supply', 9], 'indexed ownership does not scan the collection')
rpc = reader([9, 12])
assert.deepEqual((await discoverOwnedTokens(wallet, ['blue'], rpc, new Map([['blue', [1, 9]]]))).get('blue'), [9, 12])
assert.ok(rpc.peak <= 4, 'ownership concurrency is bounded')
rpc = reader([9])
assert.deepEqual((await discoverOwnedTokens(wallet, ['blue'], rpc, new Map())).get('blue'), [9], 'indexer outage fallback')
await assert.rejects(discoverOwnedTokens(wallet, ['blue'], reader([9], { fail: true }), new Map()), /RPC limit/)
await assert.rejects(discoverOwnedTokens(wallet, ['blue'], reader([], { balance: 1 }), new Map()), /incomplete/)
const controller = new AbortController(); controller.abort()
await assert.rejects(discoverOwnedTokens(wallet, ['blue'], reader([9]), new Map(), controller.signal), /abort/i)
const originalFetch = globalThis.fetch
let page = 0
globalThis.fetch = async () => ({ ok: true, json: async () => (++page === 1
  ? { items: [{ id: '9', token: { address_hash: 'BLUE' } }], next_page_params: { id: '9' } }
  : { items: [{ id: '12', token: { address_hash: 'BLUE' } }], next_page_params: null }) })
assert.deepEqual((await indexedTokens(wallet)).get('blue'), [9, 12], 'indexer pagination')
globalThis.fetch = originalFetch
console.log('Ownership regression checks passed: empty wallet, indexed IDs, stale indexer, fallback, concurrency, RPC failure, incomplete scan, cancellation, pagination.')

if (process.argv.includes('--live')) {
  const { createPublicClient, http, fallback, parseAbi } = await import('viem')
  const wallet = '0x7682e0A5Fa85424121b73E8A0fa254405a4cca87'
  const collections = ['0x09d7D7015964b18B847cF484fa77E879A4913dd7', '0x0Af21679b58591799e20F790EBCc55de84690D01', '0x51f7241946b27E2092158Bd60437415369CBd0bf', '0xA0b35566294E4924c37dC68366a45E6c0939AdB1', '0xe1821ab9Db5F22E3452F1e7d576aFE4c3E92aF09']
  const client = createPublicClient({ transport: fallback(['drpc.', 'blockdaemon.', 'quicknode.', ''].map(prefix => http(`https://rpc.${prefix}testnet.arc.network`, { batch: false, retryCount: 1, retryDelay: 500, timeout: 8000 })), { retryCount: 1 }) })
  const abi = parseAbi(['function balanceOf(address) view returns(uint256)', 'function totalSupply() view returns(uint256)', 'function ownerOf(uint256) view returns(address)'])
  const indexed = await indexedTokens(wallet).catch(() => new Map())
  const blockNumber = await client.getBlockNumber()
  let reads = 0
  const liveReader = {
    balance: address => { reads++; return client.readContract({ address, abi, functionName: 'balanceOf', args: [wallet], blockNumber }) },
    supply: address => { reads++; return client.readContract({ address, abi, functionName: 'totalSupply', blockNumber }) },
    owner: (address, id) => { reads++; return client.readContract({ address, abi, functionName: 'ownerOf', args: [BigInt(id)], blockNumber }) },
  }
  const result = await discoverOwnedTokens(wallet, collections, liveReader, indexed)
  console.log(JSON.stringify({ block: String(blockNumber), reads, owned: Object.fromEntries(result) }))
  const fallbackResult = await discoverOwnedTokens(wallet, collections, liveReader, new Map())
  assert.deepEqual(fallbackResult, result, 'live indexer and RPC fallback agree at the same block')
  console.log('Live indexer/RPC reconciliation passed.')
}
