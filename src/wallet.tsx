import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { createConfig, WagmiProvider } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { defineChain, fallback, http } from 'viem'

const rpcUrls = [
  import.meta.env.NEXT_PUBLIC_ARC_RPC_URL || 'https://rpc.drpc.testnet.arc.network',
  'https://rpc.blockdaemon.testnet.arc.network',
  'https://rpc.quicknode.testnet.arc.network',
  'https://rpc.testnet.arc.network',
]

export const arcTestnet = defineChain({
  id: 5_042_002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: rpcUrls },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: import.meta.env.NEXT_PUBLIC_ARC_EXPLORER_URL || 'https://testnet.arcscan.app' },
  },
  testnet: true,
})

export const USDC_ADDRESS = import.meta.env.NEXT_PUBLIC_USDC_ADDRESS || '0x3600000000000000000000000000000000000000'

export const config = createConfig({
  chains: [arcTestnet],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [arcTestnet.id]: fallback(
      rpcUrls.map(url => http(url, { batch: true, retryCount: 2, retryDelay: 250, timeout: 10_000 })),
      { rank: true, retryCount: 2, retryDelay: 250 },
    ),
  },
})

const queryClient = new QueryClient()

export function Web3Provider({ children }: PropsWithChildren) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}
