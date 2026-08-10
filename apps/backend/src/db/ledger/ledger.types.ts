import type { walletTxnTypeEnum } from '../schema';

export type WalletOwnerType = 'user' | 'driver' | 'fleet';
export type WalletTxnType = (typeof walletTxnTypeEnum.enumValues)[number];

export interface WalletOwner {
  ownerType: WalletOwnerType;
  ownerId: string;
}

/** Stable map key for an owner — wallets are unique on `(ownerType, ownerId)`. */
export function ownerKey(owner: WalletOwner): string {
  return `${owner.ownerType}:${owner.ownerId}`;
}

export interface LedgerLeg {
  owner: WalletOwner;
  type: WalletTxnType;
  /** Signed integer paise: credits positive, debits negative, never zero. */
  amountPaise: number;
  reason: string;
  /** The booking / payout / refund this leg is about. */
  refId?: string;
  /** Always built by `ledgerKeys.*` — never a literal, never a fresh UUID. */
  idempotencyKey: string;
}

export interface PostedEntry {
  /** Null when the leg was a replay — nothing was inserted this time. */
  id: string | null;
  walletId: string;
  owner: WalletOwner;
  amountPaise: number;
  /** True when this exact key was already in the ledger. */
  replayed: boolean;
}

export interface PostResult {
  entries: PostedEntry[];
  /** True only when EVERY leg was already present — the post was a total no-op. */
  replayed: boolean;
  /** Post-commit balances by `ownerKey`, in paise. */
  balances: ReadonlyMap<string, number>;
}

export interface PostOptions {
  /**
   * Runs INSIDE the row locks, after every balance is read and before any
   * insert. Throw to abort the whole transaction.
   *
   * This is how a caller gets read-check-write atomicity without opening its
   * own transaction — which is what keeps `LedgerService` the sole writer in
   * spirit as well as in fact. `PayoutsService` uses it for the balance check.
   */
  precondition?: (balances: ReadonlyMap<string, number>) => void;
}
