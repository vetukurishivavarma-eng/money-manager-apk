export type Direction = 'debit' | 'credit';

export interface Txn {
  id: number;
  sms_id: string | null;
  ts: number;
  amount: number;
  direction: Direction;
  category: string;
  subcategory: string | null;
  counterparty: string | null;
  account: string | null;
  channel: string | null;
  ref_no: string | null;
  note: string | null;
  excluded: number; // 0 | 1
  manual: number; // 0 | 1
  needs_review: number; // 0 | 1
  raw: string | null;
}

export interface ParsedTxn {
  direction: Direction;
  amount: number;
  account?: string;
  counterparty?: string;
  ref_no?: string;
  balance?: number;
  channel?: string;
  ts: number;
}

export interface BudgetSnapshot {
  month: string; // "September 2026"
  spent: number;
  budget: number;
  income: number;
  state: 'none' | 'ok' | 'warn' | 'over';
  safePerDay: number;
  projected: number;
  updatedAt: number;
  topCategory: { name: string; spent: number } | null;
}
