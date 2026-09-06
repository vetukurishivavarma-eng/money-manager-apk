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
  excluded: number;
  manual: number;
  needs_review: number;
  is_cash: number;
  balance: number | null;
  refund_of: number | null;
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
  month: string; // period label, e.g. "September 2026" or "26 Aug – 25 Sep"
  spent: number;
  budget: number; // effective (incl. rollover)
  baseBudget: number;
  rollover: number;
  income: number;
  todaySpent: number;
  state: 'none' | 'ok' | 'warn' | 'over';
  safePerDay: number; // for the rest of the period
  safeToday: number; // safePerDay minus what's already gone today
  projected: number;
  daysLeft: number;
  updatedAt: number;
  topCategory: { name: string; spent: number } | null;
}
