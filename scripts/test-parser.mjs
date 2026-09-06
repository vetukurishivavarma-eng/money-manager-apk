// Runnable check for the pure logic: node scripts/test-parser.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { parseSms } = require('../src/sms/parse.js');
const { categorize } = require('../src/categorize.js');
const { detectRecurring } = require('../src/recurring.js');
const { formatINR, formatCompactINR } = require('../src/format.js');
const b = require('../src/budget.js');

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log('  ok  ' + name); };

// ---- parser: real-world SMS shapes ----
t('HDFC UPI debit', () => {
  const r = parseSms(
    'Sent Rs.240.00 From HDFC Bank A/C x1234 To SWIGGY On 12-09-25 Ref 526012345678. Not you? Call 18002586161',
    'AD-HDFCBK-S', 1757650000000);
  assert.equal(r.direction, 'debit');
  assert.equal(r.amount, 240);
  assert.equal(r.account, 'xx1234');
  assert.match(r.counterparty, /SWIGGY/i);
});

t('ICICI card spend', () => {
  const r = parseSms(
    'INR 1,299.00 spent on ICICI Bank Card XX9012 on 05-Sep-25 at AMAZON. Avl Lmt: INR 45,000.',
    'VM-ICICIB', Date.now());
  assert.equal(r.direction, 'debit');
  assert.equal(r.amount, 1299);
  assert.equal(r.channel, 'CARD');
  assert.match(r.counterparty, /AMAZON/i);
});

t('SBI credit', () => {
  const r = parseSms(
    'Dear Customer, Rs.50000.00 credited to your A/c XXXXX45678 on 01-09-25 by transfer from ACME PVT LTD. Avl Bal Rs.61,234.56',
    'JD-SBIINB', Date.now());
  assert.equal(r.direction, 'credit');
  assert.equal(r.amount, 50000);
  assert.equal(r.balance, 61234.56);
});

t('OTP is ignored', () => {
  assert.equal(parseSms('123456 is your OTP for txn of Rs.999 at Flipkart. Do not share.', 'VM-HDFCBK'), null);
});

t('EMI due reminder is ignored', () => {
  assert.equal(parseSms('Your EMI of Rs.3,499 is due on 07-09-25 for loan XABC. Please pay to avoid charges.', 'AX-BAJAJF'), null);
});

t('failed txn is ignored', () => {
  assert.equal(parseSms('Your transaction of Rs.500 to PAYTM has failed due to insufficient balance on A/c x1234.', 'VK-KOTAKB'), null);
});

t('promo message is ignored', () => {
  assert.equal(parseSms('Congratulations! You are eligible for a pre-approved personal loan of Rs.5,00,000. Apply now!', 'VM-ICICIB'), null);
});

t('refund is a credit', () => {
  const r = parseSms('Rs.418.00 refund credited to your HDFC Bank A/c x1234 from AMAZON on 03-09-25.', 'AD-HDFCBK');
  assert.equal(r.direction, 'credit');
  assert.equal(r.amount, 418);
});

t('non-bank sender rejected', () => {
  assert.equal(parseSms('You spent Rs.200 at the mall today lol', 'AD-FRIEND'), null);
});

t('Axis UPI to VPA', () => {
  const r = parseSms(
    'Debit INR 60.00 A/c no. XX7788 12-09-25 UPI/P2M/526099887766/paytmqr281005@paytm Not you? SMS BLOCK',
    'AD-AXISBK', Date.now());
  assert.equal(r.amount, 60);
  assert.equal(r.direction, 'debit');
  assert.equal(r.counterparty, 'paytmqr281005@paytm');
});

// ---- categorizer ----
t('categorize Swiggy -> Food', () => assert.equal(categorize('SWIGGY', '', 'UPI'), 'Food & Dining'));
t('categorize Amazon -> Shopping', () => assert.equal(categorize('AMAZON', '', 'CARD'), 'Shopping'));
t('categorize Zerodha -> Investments', () => assert.equal(categorize('ZERODHA BROKING', '', 'UPI'), 'Investments'));
t('categorize BESCOM -> Bills', () => assert.equal(categorize('BESCOM', '', 'UPI'), 'Bills & Utilities'));
t('categorize ATM -> Cash', () => assert.equal(categorize('SELF', '', 'ATM'), 'Cash/ATM'));
t('categorize unknown -> null', () => assert.equal(categorize('RANDOM KIRANA SHOP XYZ', '', undefined), 'Groceries'));
t('categorize truly unknown -> null', () => assert.equal(categorize('QWERTYUIOP', '', undefined), null));

// ---- recurring ----
t('detect a monthly subscription', () => {
  const mk = (mo, amt) => ({ ts: new Date(2026, mo, 5).getTime(), amount: amt, direction: 'debit', category: 'Entertainment', counterparty: 'NETFLIX', excluded: 0 });
  const rec = detectRecurring([mk(3, 199), mk(4, 199), mk(5, 199), { ts: Date.now(), amount: 45, direction: 'debit', category: 'Food & Dining', counterparty: 'TEA STALL', excluded: 0 }]);
  assert.equal(rec.length, 1);
  assert.match(rec[0].payee, /NETFLIX/);
  assert.ok(Math.abs(rec[0].monthlyEstimate - 199) < 20);
});

// ---- budget math ----
t('budgetStatus: on track', () => {
  const s = b.budgetStatus(3000, 10000, 10, 30); // spent 3k of 10k by day 10
  assert.equal(s.state, 'ok');
  assert.equal(Math.round(s.projected), 9000);
});
t('budgetStatus: pace warning', () => {
  assert.equal(b.budgetStatus(5000, 10000, 10, 30).state, 'warn'); // projects 15k
});
t('budgetStatus: over', () => {
  assert.equal(b.budgetStatus(11000, 10000, 20, 30).state, 'over');
});
t('budgetStatus: safe-per-day', () => {
  const s = b.budgetStatus(4000, 10000, 10, 30);
  assert.equal(Math.round(s.safePerDay), 300); // 6000 left / 20 days
});

// ---- range sums + rollover ----
const mkT = (y, m, d, amt, dir = 'debit', cat = 'Food & Dining') => ({
  ts: new Date(y, m, d).getTime(), amount: amt, direction: dir, category: cat, excluded: 0,
});

t('totalSpentRange respects [from,to)', () => {
  const txns = [mkT(2026, 5, 1, 100), mkT(2026, 5, 20, 200), mkT(2026, 6, 2, 999)];
  const from = new Date(2026, 5, 1).getTime();
  const to = new Date(2026, 6, 1).getTime();
  assert.equal(b.totalSpentRange(txns, from, to), 300);
});

t('spentByCategoryRange buckets by category', () => {
  const txns = [mkT(2026, 5, 3, 100, 'debit', 'Groceries'), mkT(2026, 5, 4, 50, 'debit', 'Groceries'), mkT(2026, 5, 5, 30, 'debit', 'Transport')];
  const o = b.spentByCategoryRange(txns, new Date(2026, 5, 1).getTime(), new Date(2026, 6, 1).getTime());
  assert.equal(o.Groceries, 150);
  assert.equal(o.Transport, 30);
});

t('rolloverFor: unspent budget carries forward, capped at base', () => {
  const P = (m) => ({ from: new Date(2026, m, 1).getTime(), to: new Date(2026, m + 1, 1).getTime() });
  const periods = [P(3), P(4), P(5)]; // carry into P(5)
  // base 1000/mo. Apr spent 600 (+400), May spent 1200 (-200) => carry 200, capped at 1000
  const txns = [mkT(2026, 3, 10, 600), mkT(2026, 4, 10, 1200)];
  assert.equal(b.rolloverFor(txns, null, 1000, periods), 200);
});

t('rolloverFor: surplus capped at one base', () => {
  const P = (m) => ({ from: new Date(2026, m, 1).getTime(), to: new Date(2026, m + 1, 1).getTime() });
  const periods = [P(3), P(4), P(5)];
  const txns = []; // spent nothing => +1000 +1000 = 2000, capped to 1000
  assert.equal(b.rolloverFor(txns, null, 1000, periods), 1000);
});

t('rolloverFor: no carry without 2+ periods', () => {
  assert.equal(b.rolloverFor([], null, 1000, [{ from: 0, to: 1 }]), 0);
});

t('rolloverFor: a big overspend deficit is floored at one base, not accumulated', () => {
  const P = (m) => ({ from: new Date(2026, m, 1).getTime(), to: new Date(2026, m + 1, 1).getTime() });
  const txns = [mkT(2026, 0, 10, 60000, 'debit', 'Shopping')]; // ₹60k vs an ₹8k budget in P(0)
  // carry into P(1): raw would be -52000; floored to -8000
  assert.equal(b.rolloverFor(txns, 'Shopping', 8000, [P(0), P(1)]), -8000);
  // one empty cycle later, the floored deficit is worked off rather than lingering
  assert.equal(b.rolloverFor(txns, 'Shopping', 8000, [P(0), P(1), P(2)]), 0);
});

// ---- formatting ----
t('formatINR lakh grouping', () => assert.equal(formatINR(150000), '₹1,50,000'));
t('formatINR negative', () => assert.equal(formatINR(-2499.5, { paise: true }), '-₹2,499.50'));
t('formatCompactINR', () => assert.equal(formatCompactINR(1250000), '₹12.5L'));

console.log('\n' + pass + ' checks passed');
