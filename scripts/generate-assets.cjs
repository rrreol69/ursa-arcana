const fs = require('node:fs')
const path = require('node:path')

const names = [
  'Keeper of First Light', 'Indigo Cartographer', 'The Quiet Oracle', 'Ember Archivist', 'Warden of Tides', 'Gilded Wayfinder',
  'Astral Botanist', 'Keeper of the Rift', 'The Night Alchemist', 'Aurora Sentinel', 'Moonwell Scribe', 'The Cinder Seer',
  'Vault Listener', 'Comet Shepherd', 'The Azure Regent', 'Starlit Antiquarian', 'Oracle of Moss', 'Celestial Locksmith',
  'The Golden Pilgrim', 'Nebula Gardener', 'Midnight Curator', 'Arcane Mariner', 'The Last Astrologer', 'Guardian of Arc',
]
const palettes = [['111d3a','2f578c','acc6e9'], ['10283e','286b9d','74c2ec'], ['1d2448','4f68b2','99bce8'], ['112d43','2f7895','88cee2'], ['20214a','626db4','a8b9ed'], ['16243d','427ca0','b9d8f3']]
const roles = ['Keeper', 'Oracle', 'Archivist', 'Wayfinder', 'Sentinel', 'Alchemist']
const auras = ['Aurora', 'Ember', 'Tidal', 'Gilded', 'Void', 'Verdant']
const publicDir = path.join(__dirname, '..', 'public')
const imageDir = path.join(publicDir, 'nft')
const metadataDir = path.join(publicDir, 'metadata')
fs.mkdirSync(imageDir, { recursive: true })
fs.mkdirSync(metadataDir, { recursive: true })

const sets = [
  { slug: '', label: 'Genesis' },
  { slug: 'blue_hour', label: 'Blue Hour' },
  { slug: 'deep_current', label: 'Deep Current' },
  { slug: 'night_ledger', label: 'Night Ledger' },
]

for (const set of sets) {
  const setImageDir = set.slug ? path.join(imageDir, set.slug) : imageDir
  const setMetadataDir = set.slug ? path.join(metadataDir, set.slug) : metadataDir
  fs.mkdirSync(setImageDir, { recursive: true })
  fs.mkdirSync(setMetadataDir, { recursive: true })

  for (let index = 0; index < names.length; index += 1) {
  const id = index + 1
    const [dark, mid, glow] = palettes[(index + (set.slug ? set.slug.length : 0)) % palettes.length]
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="720" viewBox="0 0 600 720"><defs><linearGradient id="b" x2="1" y2="1"><stop stop-color="#${dark}"/><stop offset=".6" stop-color="#${mid}"/><stop offset="1" stop-color="#090b13"/></linearGradient><radialGradient id="h"><stop stop-color="#${glow}" stop-opacity=".7"/><stop offset="1" stop-opacity="0"/></radialGradient></defs><rect width="600" height="720" fill="url(#b)"/><circle cx="300" cy="310" r="260" fill="url(#h)"/><g fill="none" stroke="#${glow}" opacity=".3"><circle cx="300" cy="300" r="228"/><ellipse cx="300" cy="300" rx="282" ry="96" transform="rotate(${(id%13)-6} 300 300)"/></g><path d="M70 720c24-173 109-260 230-260s206 87 230 260" fill="#${dark}"/><circle cx="202" cy="274" r="71" fill="#75859a"/><circle cx="398" cy="274" r="71" fill="#75859a"/><path d="M150 348c0-124 64-203 150-203s150 79 150 203c0 111-66 193-150 193s-150-82-150-193" fill="#d6e2ec"/><ellipse cx="300" cy="417" rx="94" ry="73" fill="#b5c7d8"/><ellipse cx="240" cy="349" rx="14" ry="18" fill="#17171d"/><ellipse cx="360" cy="349" rx="14" ry="18" fill="#17171d"/><circle cx="244" cy="344" r="4" fill="#${glow}"/><circle cx="364" cy="344" r="4" fill="#${glow}"/><path d="M268 396c0-18 13-29 32-29s32 11 32 29c0 16-14 29-32 29s-32-13-32-29" fill="#222027"/><path d="M300 421v28m0 0c-18 0-30-8-38-18m38 18c18 0 30-8 38-18" fill="none" stroke="#3c353c" stroke-width="7" stroke-linecap="round"/><path d="M207 230c52-47 134-47 186 0M300 167v-42m-19 20 19-20 19 20" fill="none" stroke="#acc6e9" stroke-width="7" stroke-linecap="round"/><circle cx="300" cy="124" r="6" fill="#e7f3ff"/><text x="30" y="676" fill="#acc6e9" font-family="monospace" font-size="12" letter-spacing="3">${set.label.toUpperCase()} · #${String(id).padStart(3, '0')}</text></svg>`
    const imagePath = set.slug ? `/nft/${set.slug}/${id}.svg` : `/nft/${id}.svg`
    const metadata = { name: `${set.label} #${String(id).padStart(2, '0')} · ${names[index]}`, description: `An original cosmic keeper from the Ursa Arcana ${set.label} collection on Arc.`, image: imagePath, attributes: [{ trait_type: 'Collection', value: set.label }, { trait_type: 'Order', value: roles[index % roles.length] }, { trait_type: 'Aura', value: auras[(index * 5 + 1) % auras.length] }, { trait_type: 'Rarity', value: index === 7 || index === 23 ? 'Mythic' : index % 4 === 0 ? 'Rare' : 'Arcane' }] }
    fs.writeFileSync(path.join(setImageDir, `${id}.svg`), svg)
  const metadataJson = `${JSON.stringify(metadata, null, 2)}\n`
    fs.writeFileSync(path.join(setMetadataDir, `${id}.json`), metadataJson)
    fs.writeFileSync(path.join(setMetadataDir, String(id)), metadataJson)
  }
}

console.log(`Generated ${names.length} NFT artworks and metadata files.`)
