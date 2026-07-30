/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly NEXT_PUBLIC_ARC_RPC_URL?: string
  readonly NEXT_PUBLIC_USDC_ADDRESS?: `0x${string}`
  readonly NEXT_PUBLIC_URSA_NFT_ADDRESS?: `0x${string}`
  readonly NEXT_PUBLIC_LEGACY_NFT_ADDRESS?: `0x${string}`
  readonly NEXT_PUBLIC_URSA_BLUE_HOUR_ADDRESS?: `0x${string}`
  readonly NEXT_PUBLIC_URSA_DEEP_CURRENT_ADDRESS?: `0x${string}`
  readonly NEXT_PUBLIC_URSA_NIGHT_LEDGER_ADDRESS?: `0x${string}`
  readonly NEXT_PUBLIC_RAFFLE_ADDRESS?: `0x${string}`
  readonly NEXT_PUBLIC_AUCTION_ADDRESS?: `0x${string}`
  readonly NEXT_PUBLIC_LENDING_ADDRESS?: `0x${string}`
  readonly NEXT_PUBLIC_ARC_EXPLORER_URL?: string
}
