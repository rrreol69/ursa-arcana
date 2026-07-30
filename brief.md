# Ursa Arcana — Product Brief

## 1. Ringkasan

Ursa Arcana adalah hub NFT-native di Arc Testnet dengan maskot beruang penjaga kosmik. Produk ini mengambil inspirasi dari ekosistem [Famous Fox Federation](https://famousfoxes.com/), tetapi menggunakan brand, artwork, copy, dan smart contract yang original.

V1 berfokus pada halaman mint multi-koleksi dan tiga utility onchain:

1. Mint NFT Genesis dan tiga koleksi berbayar baru menggunakan USDC.
2. NFT raffle dengan tiket USDC.
3. NFT auction dengan model English auction.
4. P2P lending dengan NFT sebagai collateral.

Produk harus terasa seperti satu dunia koleksi yang kohesif, bukan sekumpulan halaman DeFi yang terpisah.

## 2. Tujuan

- Membuat pengalaman NFT yang mudah dipahami pengguna baru Arc.
- Menyediakan utility yang benar-benar berjalan di Arc Testnet.
- Menggunakan maskot beruang original sebagai pusat identitas visual.
- Membuat fondasi kontrak dan UI yang dapat diperluas ke koleksi atau utility lain.
- Menyatukan lima alamat koleksi NFT dalam satu alur mint dan Vault.
- Menyediakan alur testing lengkap: mint, escrow, bid, ticket, loan, repayment, default, dan claim.

## 3. Non-goals V1

- Deployment ke Arc Mainnet.
- Marketplace terbuka untuk semua ERC-721 tanpa allowlist.
- Liquidity pool lending, LTV, liquidation engine, atau floor-price oracle.
- Token governance atau token utility terpisah.
- Platform fee atau revenue sharing.
- Integrasi embedded wallet, login email, atau WalletConnect QR.
- Randomness berbasis `blockhash` atau `PREVRANDAO`.

## 4. Brand dan arah visual

### Identitas

- Nama kerja: **Ursa Arcana**
- Tema: beruang penjaga artefak dan gerbang kosmik.
- Tone: misterius, premium, hangat, dan sedikit playful.
- Tagline kerja: **“Guard the rare. Unlock the arcana.”**

### Visual

- Warna utama: midnight navy, deep indigo, aurora purple, warm gold, dan cyan glow.
- UI menggunakan kartu artefak, border halus, tekstur grain, dan glow yang terkontrol.
- Hero menampilkan satu beruang kosmik original sebagai anchor visual.
- Hindari meniru logo, karakter, layout, copy, atau aset Famous Foxes.
- Gunakan CSS/layout untuk ornamen sederhana; gunakan ImageGen untuk bitmap mascot dan artwork NFT.

### Aset awal

- 1 hero mascot.
- 3 ilustrasi utility: raffle, auction, dan lending.
- 24 artwork NFT demo untuk setiap chapter yang dapat dimint.
- Metadata JSON untuk setiap NFT dan chapter.
- 1 social-preview card khusus Ursa Arcana.

## 5. Target pengguna

### Collector

Ingin mint NFT demo, mengikuti raffle, memasang bid, atau menjelajahi koleksi.

### NFT owner

Ingin menggunakan NFT sebagai hadiah raffle, aset auction, atau collateral pinjaman.

### Lender

Ingin mendanai loan request dengan terms yang terlihat jelas dan menerima repayment dalam USDC.

### Builder/tester Arc

Ingin melihat contoh nyata ERC-721, escrow, USDC transfer, event reading, dan wallet interaction di Arc Testnet.

## 6. Struktur aplikasi

### Route utama

- `/` — landing, lore, statistik, CTA, dan penjelasan tiga utility.
- `/mint` — halaman mint terpisah untuk lima koleksi NFT.
- `/raffles` — daftar raffle aktif dan selesai.
- `/raffles/[id]` — detail raffle, pembelian tiket, reveal, winner, atau refund.
- `/auctions` — daftar auction aktif dan selesai.
- `/auctions/[id]` — detail auction, bid history, bid form, settlement, dan claim.
- `/lend` — daftar loan request dan filter status.
- `/lend/[id]` — detail request, fund, repayment, collateral, dan default.
- `/vault` — aset serta posisi pengguna.
- `/learn` — penjelasan Arc Testnet, risiko testnet, dan cara mendapatkan testnet USDC.

### Navigasi

- Logo dan nama Ursa Arcana.
- `Mint`
- `Raffles`
- `Auctions`
- `Lending`
- `Vault`
- `Learn`
- `Connect Wallet`
- Indikator jaringan Arc Testnet.
- Saldo USDC jika wallet terhubung.

## 7. Functional requirements

### 7.1 Wallet dan jaringan

- Gunakan injected EVM wallets melalui `wagmi` dan `viem`.
- Dukung MetaMask, Rabby, Coinbase Wallet, dan wallet EVM kompatibel lainnya.
- Deteksi chain yang salah.
- Sediakan aksi `Add Arc Testnet` dan `Switch to Arc Testnet`.
- Tampilkan alamat wallet secara terpotong.
- Tampilkan status transaksi: signing, pending, confirmed, failed.
- Jangan pernah menyimpan private key di frontend.

Parameter Arc Testnet:

| Parameter | Nilai |
|---|---|
| Chain ID | `5042002` |
| RPC utama aplikasi | `https://rpc.drpc.testnet.arc.network` |
| RPC fallback | Blockdaemon, QuickNode, lalu Circle primary |
| Explorer | `https://testnet.arcscan.app` |
| Native gas | USDC, 18 decimals |
| ERC-20 USDC | `0x3600000000000000000000000000000000000000` |
| ERC-20 decimals | 6 |

Referensi: [Arc Connect Docs](https://docs.arc.io/arc/references/connect-to-arc), [Contract Addresses](https://docs.arc.io/arc/references/contract-addresses).

### 7.2 Ursa Arcana NFT collections

Frontend mengelompokkan lima alamat koleksi NFT berdasarkan nama chapter:

1. `Genesis Keepers` — koleksi utama, free mint, maksimum 24 NFT.
2. `Legacy Keepers` — koleksi hasil migrasi, read-only pada halaman mint, tetap tersedia di Vault dan utility.
3. `Blue Hour` — koleksi baru, mint price 1 USDC per NFT.
4. `Deep Current` — koleksi baru, mint price 2 USDC per NFT.
5. `Night Ledger` — koleksi baru, mint price 3 USDC per NFT.

Ketentuan bersama untuk koleksi yang dapat dimint:

- Menggunakan ERC-721 standard.
- Max supply setiap koleksi: 24.
- Maksimum 10 mint per wallet.
- Genesis menggunakan `UrsaArcanaNFT` dengan free mint; pengguna tetap membayar gas.
- Blue Hour, Deep Current, dan Night Ledger menggunakan `UrsaArcanaPaidNFT` dengan pembayaran ERC-20 USDC.
- Mint berbayar membutuhkan approval USDC ke alamat kontrak NFT sebelum transaksi `mint(quantity)`.
- `adminMint` tersedia untuk seed awal dan testing.
- `setBaseURI` hanya dapat dilakukan admin.
- `setMintPrice` dan `setTreasury` tersedia pada paid collection dan hanya dapat dilakukan admin.
- Metadata berupa `name`, `description`, `image`, dan `attributes`.
- NFT dapat digunakan pada raffle, auction, dan lending jika alamat koleksinya masuk allowlist.
- Setiap kontrak NFT mendukung pause darurat.

#### Mint page

- Seluruh aktivitas mint berada pada route khusus `/mint`, terpisah dari landing page dan Vault.
- Halaman menampilkan lima collection card dalam urutan Genesis, Legacy, Blue Hour, Deep Current, dan Night Ledger.
- Setiap card menampilkan nama koleksi, contract badge, deskripsi, mint price, total supply, dan batas mint wallet.
- Legacy ditampilkan sebagai archive/read-only collection tanpa tombol mint.
- Pengguna dapat mengatur quantity selama tidak melewati sisa supply atau batas wallet.
- Jika wallet belum terhubung, tombol mint membuka dialog connect wallet.
- Free mint langsung memanggil `mint(quantity)` setelah konfirmasi wallet.
- Paid mint memeriksa allowance, meminta approval ERC-20 USDC jika diperlukan, lalu memanggil `mint(quantity)` pada kontrak koleksi yang dipilih.
- Setelah transaksi confirmed, supply, minted count, ownership Vault, dan saldo diperbarui.

### 7.3 NFT raffle

#### Pembuatan

Seller/creator melakukan:

1. Approve NFT ke kontrak raffle.
2. Menentukan ticket price dalam USDC.
3. Menentukan max tickets.
4. Menentukan waktu selesai.
5. Menyediakan secret commitment.
6. Memindahkan NFT hadiah ke escrow.

Pilihan waktu selesai di UI:

- Unit `Hours`: 1 jam, 4 jam, atau 12 jam.
- Unit `Days`: 1 hari, 3 hari, 7 hari, atau 14 hari.

#### Pembelian tiket

- Pengguna approve USDC.
- Pengguna membeli satu atau beberapa tiket.
- Setiap tiket dicatat ke pemiliknya.
- V1 memakai batas tiket kecil agar winner lookup tetap sederhana dan aman.
- Ticket purchase tidak dapat dibatalkan setelah confirmed.
- Harga tiket dan total satu transaksi pembelian tiket maksimum 5 USDC.

#### Penentuan pemenang

- `commitment = keccak256(secret, creator, raffleId)`.
- Secret baru dapat dibuka setelah raffle selesai atau sold out.
- Winner index dihitung dari hash secret dan metadata raffle.
- Pemenang tidak langsung menerima NFT; pemenang melakukan claim.
- Creator melakukan claim terhadap proceeds.
- Jika creator tidak reveal sampai reveal deadline, peserta dapat meminta refund.

#### Batasan

- Tidak menggunakan `PREVRANDAO`, `blockhash`, atau timestamp sebagai randomness utama.
- Platform fee V1: 0%.
- NFT tetap berada di kontrak sampai winner atau refund flow selesai.

### 7.4 NFT auction

V1 menggunakan English auction dengan USDC.

#### Parameter auction

- NFT yang dilelang.
- Waktu mulai.
- Waktu selesai.
- Reserve price opsional.
- Minimum bid increment: 5%.
- Bid extension window: 10 menit.
- Maximum total extension: 1 jam.
- Reserve price dan setiap bid maksimum 5 USDC.
- Pilihan durasi auction memakai unit `Hours` (1, 4, atau 12 jam) atau `Days` (1, 3, 7, atau 14 hari).

#### Alur

1. Seller meng-escrow NFT.
2. Seller membuat auction.
3. Bidder approve USDC dan submit bid.
4. Bid harus lebih besar dari bid tertinggi sebelumnya + minimum increment.
5. Bidder sebelumnya mendapatkan saldo yang dapat ditarik.
6. Bid pada 10 menit terakhir memperpanjang auction 10 menit.
7. Setelah selesai, siapa pun dapat memanggil settlement.
8. Jika reserve tercapai:
   - winner claim NFT;
   - seller claim proceeds.
9. Jika reserve tidak tercapai:
   - seller claim kembali NFT;
   - bidder menarik kembali USDC.

#### Pembatalan

- Seller hanya dapat membatalkan sebelum ada bid.
- Setelah ada bid, auction harus diselesaikan atau berakhir tanpa reserve.
- Platform fee V1: 0%.

### 7.5 P2P NFT lending

V1 memakai borrower-request model.

#### Pembuatan request

Borrower menentukan:

- NFT contract dan token ID.
- Jumlah principal USDC.
- Bunga tetap USDC.
- Batas waktu pendanaan.
- Durasi pinjaman setelah funded.

Pilihan waktu lending di UI:

- Funding window memiliki unit `Hours` (1, 4, atau 12 jam) atau `Days` (1, 3, 7, atau 14 hari).
- Loan term memiliki unit `Hours` (1, 4, atau 12 jam) atau `Days` (1, 3, 7, atau 14 hari).
- Total repayment `principal + interest` maksimum 5 USDC.

NFT dikunci ke kontrak lending saat request dibuat.

#### Pendanaan

- Lender memilih request aktif.
- Lender approve USDC.
- Kontrak mengirim principal kepada borrower.
- Loan menjadi aktif.
- Due date dihitung dari waktu funding.

#### Repayment

- Borrower membayar principal + bunga sebelum due date.
- Lender dapat claim repayment.
- Borrower dapat claim kembali NFT.

#### Default

- Setelah due date terlewati, lender dapat claim collateral.
- Borrower tidak dapat claim NFT setelah default.
- Setiap claim harus one-time only.

#### Batasan

- Tidak ada pool lending.
- Tidak ada oracle harga NFT.
- Tidak ada LTV otomatis.
- Hanya koleksi allowlisted.
- Platform fee V1: 0%.

### 7.6 Vault

Vault menampilkan:

- NFT available yang saat ini dimiliki langsung oleh wallet.
- NFT yang di-escrow, lengkap dengan jenis posisi dan link ke raffle, auction, atau loan terkait.
- NFT dikelompokkan berdasarkan nama koleksi: Genesis, Legacy, Blue Hour, Deep Current, dan Night Ledger.
- Koleksi legacy diberi label read-only, tetapi tetap dapat digunakan pada utility yang allowlisted.
- Raffle yang dibuat atau diikuti.
- Auction yang dibuat atau diikuti.
- Bid yang dapat ditarik.
- Loan request aktif.
- Loan yang didanai.
- Collateral yang dapat di-claim.

### 7.7 Pengelompokan utility berdasarkan koleksi

- Listing raffle, auction, dan lending dikelompokkan berdasarkan `nftContract` dari setiap posisi onchain.
- Urutan dan identitas grup mengikuti katalog koleksi frontend: Genesis, Legacy, Blue Hour, Deep Current, dan Night Ledger.
- Setiap grup menampilkan nama koleksi, deskripsi, contract badge, dan alamat kontrak terpotong.
- Card serta halaman detail tetap menampilkan identitas koleksi dari NFT terkait.
- Posisi dengan alamat kontrak yang belum terdaftar ditempatkan pada grup `Unregistered collection`, bukan dicampur dengan koleksi resmi.
- Modal pembuatan raffle, auction, atau loan dapat memilih NFT available dari seluruh koleksi yang dikonfigurasi.
- Kontrak utility tetap menjadi shared contracts; kategorisasi dilakukan berdasarkan alamat kontrak NFT, bukan dengan mendeploy utility contract terpisah untuk setiap koleksi.

## 8. Smart contract interfaces

### `UrsaArcanaNFT`

```text
mint(quantity)
adminMint(to, quantity)
setBaseURI(uri)
pause()
unpause()
```

### `UrsaArcanaPaidNFT`

```text
mint(quantity)
adminMint(to, quantity)
setBaseURI(uri)
setMintPrice(price)
setTreasury(treasury)
pause()
unpause()
```

### `UrsaRaffle`

```text
createRaffle(nftContract, tokenId, ticketPrice, maxTickets, endAt, commitment)
buyTickets(raffleId, quantity)
revealWinner(raffleId, secret)
cancelUnrevealed(raffleId)
claimPrize(raffleId)
claimProceeds(raffleId)
claimRefund(raffleId)
```

### `UrsaAuction`

```text
createAuction(nftContract, tokenId, startAt, endAt, reservePrice, minIncrementBps)
placeBid(auctionId, amount)
withdrawBid(auctionId)
cancelAuction(auctionId)
settleAuction(auctionId)
claimNFT(auctionId)
claimProceeds(auctionId)
```

### `UrsaLending`

```text
createLoanRequest(nftContract, tokenId, principal, interest, fundingDeadline, duration)
cancelLoanRequest(loanId)
fundLoan(loanId)
repayLoan(loanId)
claimLenderRepayment(loanId)
claimBorrowerCollateral(loanId)
claimDefaultCollateral(loanId)
```

## 9. Technical architecture

### Frontend

- React 19, TypeScript, dan Vite.
- `wagmi` + `viem`.
- Contract ABIs dipetakan di frontend dari interface kontrak yang digunakan.
- Direct Arc RPC reads for V1.
- React Query read model dengan polling dan invalidasi setelah transaksi.
- No private credentials in client code.
- Public reads memakai fallback RPC berurutan: dRPC, Blockdaemon, QuickNode, lalu Circle primary.
- Vault membaca ownership melalui `totalSupply` dan `ownerOf`, mendukung partial RPC failure, dan menampilkan error/retry bila scan gagal total.
- Vault memindai seluruh alamat koleksi yang dikonfigurasi, termasuk Genesis, Legacy, dan tiga paid collection.
- Mint page mengambil supply, wallet limit, dan minted count dari setiap kontrak yang aktif.

### Contracts

- Hardhat karena runtime Node tersedia.
- OpenZeppelin contracts.
- Deployment script terpisah per contract.
- `deploy-collections.cjs` mendeploy Blue Hour, Deep Current, dan Night Ledger dengan harga 1, 2, dan 3 USDC.
- `allowlist-nft.cjs` dan `deploy-utilities.cjs` memasukkan seluruh koleksi ke raffle, auction, dan lending.
- Contract verification melalui ArcScan/Blockscout.
- Semua addresses disimpan dalam environment variables setelah deployment.

### Konfigurasi publik

```text
NEXT_PUBLIC_ARC_RPC_URL
NEXT_PUBLIC_USDC_ADDRESS
NEXT_PUBLIC_URSA_NFT_ADDRESS
NEXT_PUBLIC_LEGACY_NFT_ADDRESS
NEXT_PUBLIC_URSA_BLUE_HOUR_ADDRESS
NEXT_PUBLIC_URSA_DEEP_CURRENT_ADDRESS
NEXT_PUBLIC_URSA_NIGHT_LEDGER_ADDRESS
NEXT_PUBLIC_RAFFLE_ADDRESS
NEXT_PUBLIC_AUCTION_ADDRESS
NEXT_PUBLIC_LENDING_ADDRESS
NEXT_PUBLIC_ARC_EXPLORER_URL

# Deployment only
ARC_RPC_URL
USDC_ADDRESS
NFT_BASE_URI
NFT_BASE_URI_BLUE_HOUR
NFT_BASE_URI_DEEP_CURRENT
NFT_BASE_URI_NIGHT_LEDGER
NFT_TREASURY
DEPLOYER_PRIVATE_KEY
```

## 10. Security requirements

- Reentrancy protection pada semua fungsi transfer.
- Pull payment untuk proceeds, refunds, dan outbid balances.
- Safe ERC-721 transfer.
- Safe ERC-20 transfer.
- Allowlist NFT collection.
- Pause capability untuk admin.
- Tidak ada arbitrary external call dari contract.
- Validasi waktu menggunakan block timestamp hanya untuk expiry, bukan randomness.
- Secret raffle tidak pernah disimpan plaintext di contract sebelum reveal.
- Semua fungsi claim idempotent.
- Test terhadap malicious ERC-721 receiver dan failed token transfer.

## 11. Testing dan acceptance criteria

### Contract tests

- NFT supply dan mint limits.
- Paid mint price, treasury transfer USDC, dan mint limit untuk tiga koleksi baru.
- NFT aktif memiliki limit 10 mint per wallet; NFT legacy tetap dapat terbaca dan digunakan melalui allowlist.
- Allowlist enforcement untuk seluruh lima koleksi.
- Raffle escrow, ticket, reveal, winner, proceeds, dan refund.
- Auction reserve, minimum increment, outbid withdrawal, extension, settlement, dan no-sale.
- Lending escrow, funding, repayment, collateral claim, dan default.
- Double claim.
- Reentrancy.
- Invalid state transition.
- USDC decimal conversion.
- Cap maksimum 5 USDC pada raffle purchase, auction bid/reserve, dan total repayment loan.

### Frontend tests

- Wallet connect.
- Wrong-chain handling.
- Loading, success, dan error transaction states.
- Empty states.
- Responsive layout.
- Reload setelah transaksi tetap menampilkan state terbaru.
- Disabled states ketika user bukan owner, bukan lender, bukan winner, atau auction sudah selesai.
- Selector waktu menampilkan pilihan 1/4/12 saat unit `Hours`, dan 1/3/7/14 saat unit `Days`.
- Mint page menampilkan kelima koleksi, harga yang benar, supply, dan wallet mint limit.
- Paid mint melakukan approval ERC-20 USDC sebelum memanggil `mint(quantity)`.
- Vault menampilkan NFT dari seluruh koleksi yang benar-benar dimiliki wallet berdasarkan state onchain.
- Raffle, auction, lending, dan posisi Vault dikelompokkan berdasarkan nama serta alamat koleksi.

### Final acceptance

- Semua route dapat dibuka.
- Route `/mint` menampilkan lima koleksi secara terpisah.
- Wallet dapat berpindah ke Arc Testnet.
- User dapat free mint Genesis atau paid mint Blue Hour, Deep Current, dan Night Ledger.
- User dapat membuat dan mengikuti raffle.
- User dapat membuat dan mengikuti auction.
- User dapat membuat, mendanai, melunasi, atau default loan.
- Semua aset tetap berada di pihak yang benar setelah settlement.
- Kontrak berhasil diverifikasi di ArcScan.
- `npm run build` berhasil.
- `npm run lint` berhasil.
- `npm run contracts:test` berhasil.
- `npm run contracts:verify:utilities` mengonfirmasi lima koleksi sudah di-allowlist.
- Situs dapat dipublikasikan melalui Sites.

## 12. Referensi

- [Famous Fox Federation](https://famousfoxes.com/)
- [Arc Homepage](https://www.arc.io/)
- [Arc Developer Documentation](https://docs.arc.io/)
- [Arc Community / Arc House](https://community.arc.io/)
- [Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc)
- [Arc EVM Differences](https://docs.arc.io/arc/references/evm-differences)
- [Arc Contract Addresses](https://docs.arc.io/arc/references/contract-addresses)
- [Deploy Contracts on Arc](https://docs.arc.io/arc/tutorials/deploy-contracts)

## 13. Assumsi V1

- Nama produk tetap Ursa Arcana.
- Semua transaksi memakai Arc Testnet.
- Setiap koleksi mintable memiliki maksimum 24 NFT dan maksimum 10 mint per wallet.
- Frontend mengelola lima alamat koleksi: Genesis, Legacy, Blue Hour, Deep Current, dan Night Ledger.
- Legacy tidak menerima mint baru, tetapi tetap dibaca di Vault dan diterima semua utility.
- Blue Hour, Deep Current, dan Night Ledger memiliki mint price tetap masing-masing 1, 2, dan 3 USDC saat deployment aktif ini.
- Raffle memakai tiket USDC.
- Auction memakai English auction.
- Lending memakai borrower-request P2P.
- NFT yang diterima harus masuk allowlist.
- Platform fee dan royalty belum diaktifkan pada V1.
- Metadata awal memakai hosting situs; IPFS menjadi langkah sebelum mainnet.

## 14. Deployment Arc Testnet aktif

Snapshot status berikut diverifikasi pada 30 Juli 2026.

### NFT collections

| Koleksi | Contract | Mint price | Supply terverifikasi |
|---|---|---:|---:|
| Genesis Keepers | `0x09d7D7015964b18B847cF484fa77E879A4913dd7` | Free | 7 / 24 |
| Legacy Keepers | `0x0Af21679b58591799e20F790EBCc55de84690D01` | Read-only | 4 / 24 |
| Blue Hour | `0x51f7241946b27E2092158Bd60437415369CBd0bf` | 1 USDC | 0 / 24 |
| Deep Current | `0xA0b35566294E4924c37dC68366a45E6c0939AdB1` | 2 USDC | 0 / 24 |
| Night Ledger | `0xe1821ab9Db5F22E3452F1e7d576aFE4c3E92aF09` | 3 USDC | 0 / 24 |

### Utility contracts

| Contract | Address | Posisi terverifikasi |
|---|---|---:|
| UrsaRaffle | `0x250498F74EE7Cd123496997443E9cF83C4688aA7` | 1 raffle |
| UrsaAuction | `0x3e3d155eB55553Ef72CE30dc496902E3AF0208e4` | 1 auction |
| UrsaLending | `0x36a07654AE19c1311Fa71f0980FBb208baa04Ae7` | 3 loans |

- Seluruh lima koleksi memiliki `allowedCollections=true` pada UrsaRaffle, UrsaAuction, dan UrsaLending.
- Genesis menjadi free-mint collection aktif; Legacy tetap read-only pada mint page.
- Blue Hour, Deep Current, dan Night Ledger menerima paid mint ERC-20 USDC melalui kontrak terpisah.
- Vault memindai seluruh koleksi dan mengelompokkan NFT available maupun escrowed berdasarkan alamat kontraknya.
- Listing raffle, auction, dan lending dikelompokkan berdasarkan koleksi NFT.
- Status deployment dan allowlist terakhir diverifikasi dengan `npm run contracts:verify:utilities`.
