// Pure, dependency-free parser for Indian bank transaction SMS.
// parseSms(body, sender, tsMs) -> null | { direction, amount, account?, counterparty?, ref_no?, balance?, channel?, ts }
const P = require('./patterns');

const AMT =
  /(?:inr|rs|₹)\s*\.?\s*([0-9](?:[0-9,]*)?(?:\.[0-9]{1,2})?)/i;
const ACCT =
  /(?:a\/?c(?:\s?no)?|account|acct|ac|card|wallet)\s*(?:no\.?|number|ending(?:\s?in)?|is)?\s*[x*.]*\s*([0-9]{3,6})\b/i;
const VPA = /\b([a-z0-9][a-z0-9._-]{1,}@[a-z]{2,})\b/i;
const REF =
  /(?:ref(?:erence)?(?:\s*(?:no|id|#))?|upi(?:\s*ref)?(?:\s*no)?|txn(?:\s*(?:no|id))?|transaction\s*id|rrn|utr)\s*[:.#=-]?\s*([a-z0-9]{6,20})/i;
const BAL =
  /(?:avl\.?\s*bal|available\s*bal(?:ance)?|a\/?c\s*bal|clr\s*bal|bal(?:ance)?)\s*[:.]?\s*(?:inr|rs|₹)?\s*\.?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i;
const TO =
  /(?:\btrf to\b|\btransfer to\b|\bpaid to\b|\bsent to\b|\bto\b|\btowards\b|\bat\b|\bin favou?r of\b|\bvpa\b)\s+([A-Za-z0-9][A-Za-z0-9 &'._@\/-]{1,49}?)(?=\s+(?:on|via|ref|upi|a\/?c|acct|txn|dt|dated|from|for|thru|through|not\b)\b|[.,;!\n]|$)/i;
const FROM =
  /(?:\breceived from\b|\bcredited by\b|\bfrom\b|\bby\b)\s+([A-Za-z0-9][A-Za-z0-9 &'._@\/-]{1,49}?)(?=\s+(?:on|via|ref|upi|to|a\/?c|acct|txn|dt|dated|info|for)\b|[.,;!\n]|$)/i;

function num(s) {
  if (!s) return undefined;
  const n = parseFloat(String(s).replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function detectChannel(b) {
  if (/\bupi\b|\bvpa\b|@ok|@ybl|@paytm|@ibl|@axl|@apl|\bp2m\b/i.test(b)) return 'UPI';
  if (/\b(pos|swipe|ecom|e-com|merchant)\b/i.test(b) || /\bcard\b/i.test(b)) return 'CARD';
  if (/\batm\b|cash withdrawal|cash wdl/i.test(b)) return 'ATM';
  if (/\bimps\b/i.test(b)) return 'IMPS';
  if (/\bneft\b/i.test(b)) return 'NEFT';
  if (/\brtgs\b/i.test(b)) return 'RTGS';
  if (/\bach\b|\bnach\b|e-?mandate|autopay|standing instruction|\bsi\b/i.test(b)) return 'AUTOPAY';
  return undefined;
}

function cleanParty(s) {
  if (!s) return undefined;
  let x = s
    .replace(/\b(on|via|upi|ref|txn|dated|dt|info|not\b.*)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[\s.,;:*_/-]+$/, '')
    .trim();
  if (x.length < 2) return undefined;
  // strip a trailing bare number that is really a ref fragment
  x = x.replace(/\s+\d{4,}$/, '').trim();
  return x || undefined;
}

function parseSms(body, sender = '', tsMs = Date.now()) {
  if (!body || typeof body !== 'string') return null;
  const b = body.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  const low = b.toLowerCase();

  if (P.IGNORE.test(low)) return null;

  const amtM = b.match(AMT);
  const amount = num(amtM && amtM[1]);
  if (!amount || amount <= 0) return null;

  const looksBank =
    P.BANK_SENDERS.test(sender) || /\ba\/?c\b|\bupi\b|\bcard\b|\bbank\b|\bwallet\b/i.test(low);
  if (!looksBank) return null;

  let direction;
  if (/\b(refund|reversed|reversal|cashback)\b/i.test(low)) direction = 'credit';
  else if (P.DEBIT.test(low)) direction = 'debit';
  else if (P.CREDIT.test(low)) direction = 'credit';
  else return null;

  if (direction !== 'credit' && P.FAILED.test(low)) return null;

  const vpa = (b.match(VPA) || [])[1];
  let counterparty = cleanParty(((direction === 'debit' ? b.match(TO) : b.match(FROM)) || [])[1]);
  if ((!counterparty || /^[0-9]+$/.test(counterparty)) && vpa) counterparty = vpa;

  const acct = (b.match(ACCT) || [])[1];

  return {
    direction,
    amount,
    account: acct ? 'xx' + acct : undefined,
    counterparty,
    ref_no: (b.match(REF) || [])[1] || undefined,
    balance: num((b.match(BAL) || [])[1]),
    channel: detectChannel(b),
    ts: tsMs,
  };
}

module.exports = { parseSms };
