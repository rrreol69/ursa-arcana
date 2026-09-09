// Indexer data is only a discovery hint. Ownership and completeness are checked
// against one RPC block before a snapshot is published to the UI.
export type OwnershipReader = {
  balance: (collection: string) => Promise<bigint>
  supply: (collection: string) => Promise<bigint>
  owner: (collection: string, id: number) => Promise<string>
}

export async function discoverOwnedTokens(
  wallet: string,
  collections: string[],
  reader: OwnershipReader,
  indexed: Map<string, number[]>,
  signal?: AbortSignal,
): Promise<Map<string, number[]>> {
  const found = new Map<string, number[]>()
  for (const collection of collections) {
    signal?.throwIfAborted()
    const balance = await reader.balance(collection)
    if (balance === 0n) { found.set(collection, []); continue }
    const owned: number[] = []
    const checked = new Set<number>()
    const check = async (ids: number[]) => {
      signal?.throwIfAborted()
      const owners = await Promise.all(ids.map(id => reader.owner(collection, id)))
      owners.forEach((owner, index) => {
        checked.add(ids[index])
        if (owner.toLowerCase() === wallet.toLowerCase()) owned.push(ids[index])
      })
    }
    const supply = Number(await reader.supply(collection))
    if (!Number.isSafeInteger(supply) || supply < 0) throw new Error('Invalid NFT supply')
    const candidates = [...new Set(indexed.get(collection.toLowerCase()) ?? [])]
      .filter(id => Number.isSafeInteger(id) && id >= 1 && id <= supply)
    for (let offset = 0; offset < candidates.length && BigInt(owned.length) < balance; offset += 4) {
      await check(candidates.slice(offset, offset + 4))
    }
    // These configured Ursa contracts issue contiguous IDs starting at 1.
    // If an indexer is late or unavailable, reconcile only missing ownership.
    for (let start = 1; start <= supply && BigInt(owned.length) < balance; start += 4) {
      await check(Array.from({ length: Math.min(4, supply - start + 1) }, (_, i) => start + i).filter(id => !checked.has(id)))
    }
    if (BigInt(owned.length) !== balance) throw new Error('NFT ownership scan is incomplete. Please retry.')
    found.set(collection, owned.sort((a, b) => a - b))
  }
  return found
}

export async function indexedTokens(wallet: string, signal?: AbortSignal): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>()
  let params = new URLSearchParams({ type: 'ERC-721' })
  const timeout = AbortSignal.timeout(8_000)
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout
  // Bound latency for wallets holding many unrelated collections; RPC fills gaps.
  for (let page = 0; page < 20; page++) {
    const response = await fetch(`https://testnet.arcscan.app/api/v2/addresses/${wallet}/nft?${params}`, { signal: requestSignal })
    if (!response.ok) throw new Error('NFT indexer unavailable')
    const body = await response.json() as { items: { id: string; token: { address_hash: string } }[]; next_page_params?: Record<string, string | number> | null }
    for (const item of body.items) {
      const address = item.token.address_hash.toLowerCase()
      const id = Number(item.id)
      if (Number.isSafeInteger(id) && id > 0) result.set(address, [...(result.get(address) ?? []), id])
    }
    if (!body.next_page_params) break
    params = new URLSearchParams({ type: 'ERC-721', ...Object.fromEntries(Object.entries(body.next_page_params).map(([key, value]) => [key, String(value)])) })
  }
  return result
}
