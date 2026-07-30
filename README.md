# Ursa Arcana

Ursa Arcana is a multi-collection NFT utility hub running on Arc Testnet. It combines minting, verifiable raffles, English auctions, and borrower-request lending in one responsive React application.

The project is testnet-only. All displayed assets and USDC balances have no real-world monetary value.

## Features

- Dedicated mint page for five NFT collections.
- Free Genesis mint and paid ERC-20 USDC minting.
- Verifiable commit-reveal NFT raffles.
- English auctions with withdrawable outbid balances and last-minute extensions.
- P2P NFT-backed lending with fixed principal, interest, and repayment deadlines.
- Wallet Vault for owned and escrowed NFTs across all configured collections.
- Collection-based grouping for raffles, auctions, loans, and Vault positions.
- Injected EVM wallet support through Wagmi and Viem.
- Arc Testnet network switching, transaction states, receipt confirmation, and RPC fallback.

## NFT Collections

| Collection | Mint status | Price | Max supply | Contract |
|---|---|---:|---:|---|
| Genesis Keepers | Live | Free | 24 | `0x09d7D7015964b18B847cF484fa77E879A4913dd7` |
| Legacy Keepers | Read-only | - | 24 | `0x0Af21679b58591799e20F790EBCc55de84690D01` |
| Blue Hour | Live | 1 USDC | 24 | `0x51f7241946b27E2092158Bd60437415369CBd0bf` |
| Deep Current | Live | 2 USDC | 24 | `0xA0b35566294E4924c37dC68366a45E6c0939AdB1` |
| Night Ledger | Live | 3 USDC | 24 | `0xe1821ab9Db5F22E3452F1e7d576aFE4c3E92aF09` |

Genesis uses `UrsaArcanaNFT`. The three paid collections use separate `UrsaArcanaPaidNFT` deployments and transfer ERC-20 USDC directly to the configured treasury. Every mintable collection has a maximum of 10 public mints per wallet.

## Utility Contracts

| Contract | Address |
|---|---|
| UrsaRaffle | `0x250498F74EE7Cd123496997443E9cF83C4688aA7` |
| UrsaAuction | `0x3e3d155eB55553Ef72CE30dc496902E3AF0208e4` |
| UrsaLending | `0x36a07654AE19c1311Fa71f0980FBb208baa04Ae7` |

All five NFT collections are allowlisted on each utility contract. Contract state can be checked with `npm run contracts:verify:utilities`.

## Stack

- React 19 and TypeScript
- Vite 6
- React Router
- TanStack Query
- Wagmi and Viem
- Solidity 0.8.28
- Hardhat and OpenZeppelin Contracts
- Arc Testnet, chain ID `5042002`

## Local Development

Requirements:

- Node.js 20 or newer
- npm
- An injected EVM wallet for transaction testing

Install dependencies and create the local environment file:

```bash
npm install
cp .env.example .env
```

Generate the local NFT artwork and metadata, then start Vite:

```bash
npm run assets:generate
npm run dev
```

The application is available at `http://localhost:5173` by default. The app enters preview mode when contract addresses are not configured.

## Environment

Frontend variables are exposed intentionally and must use the `NEXT_PUBLIC_` prefix:

```dotenv
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.drpc.testnet.arc.network
NEXT_PUBLIC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
NEXT_PUBLIC_URSA_NFT_ADDRESS=
NEXT_PUBLIC_LEGACY_NFT_ADDRESS=
NEXT_PUBLIC_URSA_BLUE_HOUR_ADDRESS=
NEXT_PUBLIC_URSA_DEEP_CURRENT_ADDRESS=
NEXT_PUBLIC_URSA_NIGHT_LEDGER_ADDRESS=
NEXT_PUBLIC_RAFFLE_ADDRESS=
NEXT_PUBLIC_AUCTION_ADDRESS=
NEXT_PUBLIC_LENDING_ADDRESS=
NEXT_PUBLIC_ARC_EXPLORER_URL=https://testnet.arcscan.app
```

Deployment-only variables must never be exposed to frontend code:

```dotenv
ARC_RPC_URL=https://rpc.drpc.testnet.arc.network
USDC_ADDRESS=0x3600000000000000000000000000000000000000
NFT_BASE_URI=https://your-domain.example/metadata/
NFT_BASE_URI_BLUE_HOUR=https://your-domain.example/metadata/blue_hour/
NFT_BASE_URI_DEEP_CURRENT=https://your-domain.example/metadata/deep_current/
NFT_BASE_URI_NIGHT_LEDGER=https://your-domain.example/metadata/night_ledger/
NFT_TREASURY=
DEPLOYER_PRIVATE_KEY=
```

Use `.env.example` as the source of truth. `.env` and all local environment variants are ignored by Git.

## Available Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and create the production build |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `npm run assets:generate` | Generate NFT SVG artwork and metadata |
| `npm run contracts:compile` | Compile Solidity contracts |
| `npm run contracts:test` | Run the Hardhat contract test suite |
| `npm run contracts:deploy:nft` | Deploy the Genesis NFT contract |
| `npm run contracts:deploy:collections` | Deploy the 1, 2, and 3 USDC collections |
| `npm run contracts:deploy:utilities` | Deploy shared raffle, auction, and lending contracts |
| `npm run contracts:allowlist` | Allowlist all configured collections on the utilities |
| `npm run contracts:verify:utilities` | Read deployment, supply, price, and allowlist state |
| `npm run contracts:smoke:mint` | Submit a Genesis mint smoke test |

## Contract Deployment

Deploy the Genesis collection:

```bash
npm run contracts:deploy:nft
```

Deploy the shared utility contracts after setting `NEXT_PUBLIC_URSA_NFT_ADDRESS`:

```bash
npm run contracts:deploy:utilities
```

Deploy Blue Hour, Deep Current, and Night Ledger after configuring their metadata base URIs and the utility addresses:

```bash
npm run contracts:deploy:collections
```

The collection deployment script sets prices to 1, 2, and 3 USDC, prints the resulting `NEXT_PUBLIC_URSA_*_ADDRESS` values, and allowlists each new collection on all configured utility contracts.

To reconcile or verify allowlists separately:

```bash
npm run contracts:allowlist
npm run contracts:verify:utilities
```

## Verification

Run the complete local verification set before deployment:

```bash
npm run lint
npm run build
npm run contracts:compile
npm run contracts:test
```

The contract suite covers free and paid mint limits, USDC treasury transfers, raffle settlement and refunds, English auction settlement, lending repayment/default, and the shared 5 USDC utility caps.

## Project Structure

```text
contracts/   Solidity NFT, raffle, auction, lending, and mock USDC contracts
public/      NFT artwork, metadata, icons, and static hosting redirects
scripts/     Asset generation, deployment, allowlist, inspection, and smoke scripts
src/         React application, wallet config, contract catalog, and onchain queries
test/        Hardhat contract tests
brief.md     Product requirements and active Arc Testnet deployment snapshot
```

## Security

- Never commit `.env`, a deployer private key, or a raffle reveal secret.
- Never prefix private values with `NEXT_PUBLIC_`.
- Use a dedicated testnet deployment wallet with limited funds.
- Review every wallet request and verify contract addresses before signing.
- Raffle reveal secrets must remain private until the reveal transaction.
- This code has not undergone a production security audit and is not intended for mainnet use.

## Product Brief

See [`brief.md`](./brief.md) for detailed requirements, contract behavior, acceptance criteria, and the current Arc Testnet deployment snapshot.
