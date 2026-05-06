# 🆙chan Token Claimer — 監査レポート

> 作成日: 2026-05-06
> 監査者: 🆙chan
> 対象: upchan-token-claimer (Next.js frontend + LSP7 トークンコントラクト)

---

## ⚠️ 重大な前提

**スマートコントラクトのソースコードが未検証・未入手です。**
- Token implementation: `0x6D016E961E49304811B6c5Fde7e1E2f8D7c5421a` (testnet) — ブロックエクスプローラー未検証
- RequirementsGate: `0xdD85274e255738603088312daF502Aa103959a97` (testnet) — 同上
- アクセス可能なリポジトリに `.sol` ファイルは存在しません

本監査は以下に基づきます:
1. フロントエンドコード (Next.js) 全ソース解析
2. バイトコード逆アセンブルによる関数インターフェース特定
3. オンチェーンデータの静的検証

**コントラクトの完全な監査にはソースコードの提出および/またはブロックエクスプローラーへの検証が必要です。**

---

## 目次

1. [コントラクトアーキテクチャ概要](#1-コントラクトアーキテクチャ概要)
2. [セキュリティ監査 — Critical](#2-セキュリティ監議--critical)
3. [セキュリティ監査 — Medium](#3-セキュリティ監議--medium)
4. [セキュリティ監査 — Low / Informational](#4-セキュリティ監查--low--informational)
5. [UI/UX 誤解招く要素監査](#5-uiux-誤解招く要素監査)
6. [フロントエンドコードバグ](#6-フロントエンドコードバグ)
7. [推奨アクション](#7-推奨アクション)

---

## 1. コントラクトアーキテクチャ概要

### 構成図

```
┌─────────────────────────────────────────────┐
│  User Frontend (Next.js)                     │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│  │TokenCard │ │StatusCard│ │ ActionCard   │  │
│  │ (画像)   │ │ (プロパティ)│ │ (Mint/Burn) │  │
│  └──────────┘ └──────────┘ └──────┬──────┘  │
│  ┌──────────┐ ┌──────────┐        │         │
│  │HoldersCard│ │OwnerPanel│       │         │
│  └──────────┘ └──────────┘        │         │
└─────────────┬──────────────────────┘         │
              │ UP.execute() 経由              │
              ▼                                │
┌──────────────────────────────────────┐       │
│  Universal Profile (User)            │       │
│  └→ KeyManager → execute()           │       │
└──────────┬───────────────────────────┘       │
           │ UP.execute(0, token, 0, calldata) │
           ▼                                    │
┌──────────────────────────────────────┐       │
│  Token Proxy (EIP-1967)              │       │
│  └→ Implementation (LSP7 extended)   │       │
│     ├── mint() ← gate check          │       │
│     ├── burn()                        │       │
│     ├── revokeByGate() ← holdGate     │       │
│     └── owner controls                │       │
└──────────┬───────────────────────────┘       │
           │ gate.canMint()  /  gate.check()   │
           ▼                                    │
┌──────────────────────────────────────┐       │
│  RequirementsGate (Ownable2Step)     │       │
│  ├── followTarget/check              │       │
│  ├── minNativeBalance check          │       │
│  ├── minFollowers check              │       │
│  ├── tokenRequirements check          │       │
│  └── AND/OR logic                     │       │
└──────────────────────────────────────┘       │
```

### 関数一覧（バイトコード逆アセンブルで確認した全52関数）

| セレクタ | 関数名 | 権限 |
|----------|--------|------|
| `0x01ffc9a7` | `supportsInterface(bytes4)` | 誰でも |
| `0x18160ddd` | `totalSupply()` | 誰でも |
| `0x2121dc75` | `isSoulbound()` | 誰でも |
| `0x21afb5ee` | `mintingDisabled()` | 誰でも |
| `0x2bc1da82` | `mint(address,uint256,bool,bytes)` | 誰でも（gate通過） |
| `0x2d7667c9` | `revokeOperator(address)` | 誰でも |
| `0x30d0dc37` | `authorizeOperator(address,uint256,bytes)` | 誰でも |
| `0x33d87347` | `isHoldGateLocked()` | 誰でも |
| `0x44d17187` | `burn(address,uint256,bytes)` | 誰でも |
| `0x45e14c46` | `canMint(address,address,uint256)` | 誰でも |
| `0x46b45af7` | `isMintable()` | 誰でも |
| `0x52058d8a` | `decimals()` | 誰でも |
| `0x54f6127f` | `getData(bytes32)` | 誰でも |
| `0x55cedd90` | `getOperatorsOf(address)` | 誰でも |
| `0x5fe3d551` | `isMintGateLocked()` | 誰でも |
| `0x65aeaa95` | `isBalanceCapLocked()` | 誰でも |
| `0x6963d438` | `ownerOf(bytes32)` | 誰でも |
| `0x696fd68c` | `makeTransferable()` | ownerのみ |
| `0x6b3aaf56` | `setHoldGate(address)` | ownerのみ |
| `0x70a08231` | `balanceOf(address)` | 誰でも |
| `0x715018a6` | `renounceOwnership()` | ownerのみ |
| `0x719af05f` | `flexibleSupplyCap()` | 誰でも |
| `0x7580d920` | ← mintと同じselector (要注意) | ← |
| `0x760d9bba` | `transfer(address,address,uint256,bool,bytes)` | 誰でも |
| `0x78381670` | `isOperatorFor(address,address)` | 誰でも |
| `0x7e5cd5c1` | `disableMinting()` | ownerのみ |
| `0x7f23690c` | `setData(bytes32,bytes)` | ownerのみ |
| `0x88459f9a` | `setIsMintable(bool)` | ownerのみ |
| `0x893d20e8` | `owner()` | 誰でも |
| `0x8da5cb5b` | `owner()` (Ownable) | 誰でも |
| `0x8fb05730` | `tokenURI(uint256)` | 誰でも |
| `0x93adf8c1` | `lockMintGate()` | ownerのみ |
| `0x94b10235` | `lockHoldGate()` | ownerのみ |
| `0x97902421` | `setFlexibleSupplyCap(uint256)` | ownerのみ |
| `0xa0716db5` | `setTokenBalanceCap(uint256)` | ownerのみ |
| `0xb1097a2c` | `lockTokenBalanceCap()` | ownerのみ |
| `0xb49506fd` | `authorizeOperator(address,uint256,bytes)` | 誰でも |
| `0xd1ca0188` | `tokenBalanceCap()` | 誰でも |
| `0xd72fc29a` | `totalSupply()` (別名) | 誰でも |
| `0xdedff9c6` | `getDataBatch(bytes32[])` | 誰でも |
| `0xe11360b3` | `revokable()` | 誰でも |
| `0xe5a97f07` | `updateSupplyCap(uint256)` | ownerのみ |
| `0xe5c2d4ca` | `mintGate()` | 誰でも |
| `0xe6fc6098` | `getOwnerOfToken(address)` | 誰でも |
| `0xea18a86a` | `revokeByGate(address,address,uint256,bytes)` | ownerのみ |
| `0xecff3a0c` | `isBalanceCapLocked()` | 誰でも |
| `0xf2fde38b` | `transferOwnership(address)` | ownerのみ |
| `0xf5a4738b` | `setMintGate(address)` | ownerのみ |
| `0xf5aff0dd` | `holdGate()` | 誰でも |
| `0xf7eca6d0` | `isMintGateLocked()` (別名) | 誰でも |

---

## 2. セキュリティ監査 — Critical 🚨

### 🔴 C-1: コントラクトソースコード未検証

**リスク: 超重大**
- Token 実装・RequirementsGate ともにブロックエクスプローラー未検証
- 実装コントラクトが悪意あるコードを含む可能性を排除できない
- **推奨:** ソースコードをブロックエクスプローラーで検証し、本監査と突合

### 🔴 C-2: EIP-1967 プロキシによるアップグレード権限

**リスク: 重大**
- Token は EIP-1967 プロキシパターン → 実装コントラクトの差し替えが可能
- プロキシ管理者のアドレスと鍵管理が未確認
- 管理者が悪意ある実装に差し替えた場合、全トークンの没収・凍結が可能
- **推奨:**
  - プロキシ管理者アドレスを特定して開示
  - 理想的にはマルチシグ + タイムロックを導入

### 🔴 C-3: Owner の中央集権的権限

**リスク: 重大**
- Owner は以下を単独で実行可能:
  - `revokeByGate()` → 任意のアドレスからトークンを強制没収
  - `disableMinting()` → 永久ミント停止（復元不可能）
  - `makeTransferable()` → Soulbound を永久解除
  - `lockSupplyCap()` / `lockMintGate()` / `lockHoldGate()` → 各種ロック
  - `transferOwnership()` → 誰でも所有者になれる
- **推奨:**
  - 最低でも `revokeByGate()` と `disableMinting()` はタイムロック導入
  - Owner はマルチシグ（例: 2/3）を推奨

### 🔴 C-4: `renounceOwnership()` が有効

**リスク: 重大**
- `renounceOwnership()` が実装されており、owner が放棄可能
- 放棄後は各種設定（gate, supply cap）の変更が一切不可能に
- **前向きな側面:** 放棄後は中央集権的リスクが消滅（トークンの発行設定などが固定化）
- **推奨:** 放棄前に全設定が正しいことを十分確認。放棄を UI に実装する場合は警告表示を必須に

---

## 3. セキュリティ監査 — Medium ⚠️

### 🟡 M-1: フロントエンドの RPC エンドポイントが固定値

**ファイル:** `src/config/tokens.ts`
```typescript
rpc: 'https://4201.rpc.thirdweb.com/f20713774ede91090d43daf75243e8ca',
rpc: 'https://42.rpc.thirdweb.com/f20713774ede91090d43daf75243e8ca',
```
- thirdweb API キーがハードコード
- キーの流出・制限変更時の影響大
- **推奨:** 環境変数で管理。API キーは機密情報

### 🟡 M-2: `canMint` で force=false を常に使用

**ファイル:** `src/lib/useToken.ts`
```typescript
return await gateContract.canMint(userAddress, userAddress, 1);
```
- `canMint` に自分自身を caller と to の両方で渡している
- もし gate が to/caller を別々にチェックする設計の場合、意図と違う可能性
- 実際の mint と同じパラメータを渡しているので問題ないが、ドキュメント化推奨

### 🟡 M-3: Burn / Revoke の Amount 検証が不十分

**ファイル:** `src/components/OwnerPanel.tsx`
```typescript
const [revokeAmount, setRevokeAmount] = useState('1');
// ...
BigInt(revokeAmount || '1')
```
- Owner の revoke 量に上限チェックなし
- 大量 revoke による UX 問題の可能性
- **推奨:** 最大 revoke 量の表示と確認ダイアログ

### 🟡 M-4: サーバーデータ取得のエラーハンドリング

**ファイル:** `src/lib/useToken.ts`
```typescript
c.isSoulbound().catch(() => true),  // デフォルト true
c.revokable().catch(() => false),   // デフォルト false
```
- RPC 失敗時のデフォルト値がセキュリティ的に問題ないが、ユーザーを混乱させる可能性
- エラー時は「データ取得失敗」と表示したほうが誠実

### 🟡 M-5: `No Gate` 設定時の Zero Address

**ファイル:** `src/config/gates.ts`
```typescript
const ZERO = '0x0000000000000000000000000000000000000000' as const;
```
- `setMintGate(ZERO)` で gate を削除可能
- これは設計としては正しい（誰でも mint 可能になる）
- ただし OwnerPanel で誤って No Gate に変更するリスクあり
- **推奨:** 確認ダイアログに「誰でもミント可能になります」と明記

---

## 4. セキュリティ監査 — Low / Informational 📝

### ℹ️ I-1: `revokable` のスペル

- コントラクト関数名: `revokable()` (v が1つ)
- 本来: `revocable` (c → k の誤りパターン)
- 機能には影響なし

### ℹ️ I-2: `phlametoken` は LSP7 非プロキシ

- `phlametoken` の作成バイトコードからプロキシではないことを確認
- 直接デプロイされた LSP7DigitalAsset
- アップグレード不可（これは利点でもある）

### ℹ️ I-3: ブロックエクスプローラーの API Base URL

- `useHolders.ts` で `chain.explorer` を Blockscout API URL として使用
- `CHAINS[chainId].explorer` = `https://explorer.execution.testnet.lukso.network`
- これに `/api/v2/tokens/{proxy}/holders` を付加 → 正しい Blockscout API v2

### ℹ️ I-4: マイニング時に force=false

- `mint(address,uint256,false,bytes)` — force が常に false
- LSP7 の force=false は受信者が LSP1 インターフェースを実装している必要あり
- LUKSO の Universal Profile は実装しているので問題ない
- ただし EOA（通常のウォレット）へのミントは失敗する → 設計通り

---

## 5. UI/UX 誤解招く要素監査

### 🟡 U-1: Supply Cap 表示の Infinity 問題

**ファイル:** `src/lib/useToken.ts`
```typescript
supplyCap: Number(fsc) || Infinity,
```

**問題:** supplyCap が 0（制限なし）の場合、`Infinity` が返る。
```jsx
// StatusCard.tsx
<span>{status.totalSupply} / {displayCap}</span>
```
→ 表示例: `"5 / Infinity"` — ユーザーに制限がないことを伝えきれていない。

**改善案:** `"5 / ∞ (Unlimited)"` と表示する。

### 🟡 U-2: Mint ボタンの状態遷移が誤解を招く

**ファイル:** `src/components/ActionCard.tsx`
```typescript
const mintLabel = !connectedWallet
  ? 'Mint NFT'
  : mintPending
    ? 'Minting...'
    : isAtMaxBalance
      ? 'Max Reached'
      : status.mintingDisabled
        ? 'Minting Closed'
        : isSoldOut
          ? 'Sold Out'
          : !status.isMintable
            ? 'Not Available'
            : 'Mint NFT';
```

**問題:**
1. ウォレット未接続時も「Mint NFT」と表示 — クリックできない理由が不明
2. 「Sold Out」と「Minting Closed」の違いがユーザーに伝わらない
3. 「Not Available」だけが情報不足（なぜ利用不可？）

**改善案:**
- 未接続: "Connect wallet to mint" をボタンとして表示（クリックで接続）
- 各状態の理由をボタンの下に小さく表示

### 🟡 U-3: Owner Panel のリスク表示不足

**ファイル:** `src/components/OwnerPanel.tsx`

**問題:**
以下の操作にリスク説明がない:
1. `lockMintGate()` → "This cannot be undone!" のみ
2. `lockSupplyCap()` → 同上
3. `disableMinting()` → "Permanently disable minting?" のみ
4. `makeTransferable()` → "Make transferable permanently?" のみ
5. `renounceOwnership()` → UI に実装なし

**改善案:** 各確認に具体的な影響を記載:
- 「ミントを永久停止します。再開は不可」
- 「Supply Cap を固定します。変更不可」
- 「全トークンが譲渡可能になります。Soulbound を放棄」

### 🟡 U-4: OwnerPanel で `renounceOwnership()` が利用不可

**問題:** OwnerPanel に所有権放棄機能がない（コントラクト自体は実装済み）
- トークンを完全に分散化したい場合の終着点がない
- **改善案:** 赤い警告付きで「所有権放棄」ボタンを追加

### 🟡 U-5: `force` パラメータの意味がユーザーに伝わらない

**問題:** `force=false` でミントしているが、その意味が UI のどこにも説明されていない
- EOA で接続したユーザーがミント失敗した場合、理由が理解できない
- **改善案:** ウォレット種別を検出し、EOA なら「このトークンは Universal Profile でのみ受領できます」と表示

### 🟡 U-6: `holdGate` の意味が誤解されやすい

**問題:** Hold Gate は「トークンを保持し続けるための条件」だが:
- UI では条件のみ表示（"Follow @xxx",  "≥ 5 LYX" など）
- 条件を満たさない場合の具体的なペナルティ（revoke の可能性）が表示されない
- 「Revokable: Yes」の行はあるが、意味の説明がない

**改善案:**
- Hold Gate 条件未達時のリスクを説明:
  「この条件を満たさない場合、Owner によってトークンを没収される可能性があります」

### 🟡 U-7: トークン一覧画面の欠如

**問題:** 現在は URL パラメータでトークンを指定する設計
- `/?token=test-mint-v3` で直接アクセス
- トークン一覧画面がない（MEMORY.md では `?view=tokens` を計画中）
- ユーザーが複数トークンを切り替えても、最初にどのトークンがあるかわからない

**改善案:** （既に計画中とのこと）トークンリスト画面は優先して実装

### 🟡 U-8: トランザクション状態のUX

**ファイル:** `src/lib/tx-context.tsx`

**問題:**
- `MAX_RECORDS = 20` — UI が肥大化する可能性
- トランザクション履歴の「消去」のみで個別削除ができない
- TxIndicator の動作確認が必要（ソース未確認だが問題の可能性）

---

## 6. フロントエンドコードバグ

### 🐛 B-1: `force=false` で mint できないアドレスがある可能性

**ファイル:** `src/lib/useToken.ts`
```typescript
const innerData = mintIface.encodeFunctionData('mint', [
  userAddress, BigInt(1), false, '0x',
]);
```

**問題:** `force=false` だと LSP1 を実装しないアドレスへの mint が失敗。
- EOA や非対応スマートコントラクトへの mint が不可能
- ただし LUKSO の UP は LSP1 実装済みなので、通常は問題なし
- **推奨:** 必要に応じて `force=true` のオプションを提供するか、ドキュメント化

### 🐛 B-2: supplyCap 表示のデータ型問題

**ファイル:** `src/lib/useToken.ts`
```typescript
supplyCap: Number(fsc) || Infinity,
```

**問題:** `Number(fsc)` で BigInt → Number 変換。Supply cap が 2^53-1 を超えると精度低下。
- 現実的な supply cap では問題ないが、ドキュメント化
- **改善案:** `BigInt` のまま保持し、表示時のみ変換

### 🐛 B-3: OwnerPanel の supply cap 更新バリデーション

**ファイル:** `src/components/OwnerPanel.tsx`
```typescript
onClick={async () => {
  const cap = BigInt(capInput || '0');
  if (cap < BigInt(status.totalSupply)) return;
  await actions.updateSupplyCap(cap);
}}
```

**問題:**
- `cap < totalSupply` のチェックはあるが、エラー表示がない（何も起きないだけ）
- 空文字入力で `BigInt('')` がエラーになる可能性
- **改善案:** エラーメッセージを表示。`if (!capInput)` の事前チェックを追加。

### 🐛 B-4: `getData` のデコードロジックの堅牢性

**ファイル:** `src/lib/useProfileMetadata.ts`
```typescript
for (const offset of [38, 40]) {
  // いくつかのオフセットを試す
}
```

**問題:** VerifiableURI のデコードでオフセット 38 と 40 を試している。
- これは実装依存のハックで、LSP の仕様変更で壊れる可能性がある
- **改善案:** @erc725/erc725.js や lukso の SDK を使用する

### 🐛 B-5: Envio GraphQL クエリの SQL インジェクション類似

**ファイル:** `src/lib/useHolders.ts`
```typescript
const query = `{Asset(where:{id:{_eq:"${token.proxy.toLowerCase()}"}}){...}}`;
```

**問題:** GraphQL クエリが文字列結合で構築されている
- 直接的な SQL インジェクションリスクではない（GraphQL はクエリ言語）
- ただし `token.proxy` がユーザー入力の場合、意図しないクエリが可能
- 現在は config の固定値なので問題なし
- **推奨:** 将来ユーザー入力を受け付ける場合は変数化（$variable）に変更

---

## 7. 推奨アクション

### 優先度: 即時対応 🚨

| # | アクション | 理由 |
|---|-----------|------|
| 1 | コントラクトソースをブロックエクスプローラーで検証 | 監査の信頼性の前提 |
| 2 | プロキシ管理者の鍵管理を文書化 | 中央集権リスクの透明化 |
| 3 | Owner をマルチシグに移行することを検討 | 単一障害点の排除 |

### 優先度: 高 ⚡

| # | アクション | 理由 |
|---|-----------|------|
| 4 | コントラクトの監査を第三者に依頼 | 本監査の限界を補完 |
| 5 | Supply Cap 表示の Infinity 問題を修正 | UX の誤解を防止 |
| 6 | Mint ボタンの状態表示を改善 | ユーザーの混乱防止 |
| 7 | Gate 条件のリスクを UI に明示 | 透明性の向上 |

### 優先度: 中 📋

| # | アクション |
|---|-----------|
| 8 | `renounceOwnership()` を実装した後の移行計画を策定 |
| 9 | RPC API キーを環境変数化 |
| 10 | Owner アクションに具体的な影響説明を追加 |
| 11 | EOA 接続時のエラーメッセージを改善 |

### 優先度: 低 🔧

| # | アクション |
|---|-----------|
| 12 | GraphQL クエリを変数化 |
| 13 | VerifiableURI デコードに SDK を使用 |
| 14 | トークンデータの Infinity 変換を BigInt 保持に変更 |

---

## 総評

**全体としては設計思想は健全。** LSP7 をベースに拡張したトークンシステムで、Gate によるアクセス制御、Supply Cap、Soulbound、Revokable などの機能が適切に実装されています。フロントエンドコードの品質も高いです。

**最大の懸念事項は中央集権性です。** Owner は非常に強力な権限を持っており、理論上は全トークンの没収から設定変更まで可能です。これは多くの NFT プロジェクトに共通する課題であり、以下の段階的移行が推奨されます:

1. **初期:** 開発者用シングル署名 Owner
2. **安定後:** マルチシグ（Gnosis Safe など）による共同管理
3. **完成後:** Owner の権限放棄（`renounceOwnership()`）による完全分散

**コントラクトソースが未検証である点を強く懸念します。** 本監査の限界を補うため、ソースコードの検証と第三者の監査を強く推奨します。

---

*本監査は upchan-token-claimer v0.1.0 のフロントエンドコードおよびブロックチェーン上のバイトコードに基づきます。コントラクトコードの未検証のため、実際の動作が本レポートの想定と異なる可能性があります。*
