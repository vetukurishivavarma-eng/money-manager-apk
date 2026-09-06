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

// ---- formatting ----
t('formatINR lakh grouping', () => assert.equal(formatINR(150000), '₹1,50,000'));
t('formatINR negative', () => assert.equal(formatINR(-2499.5, { paise: true }), '-₹2,499.50'));
t('formatCompactINR', () => assert.equal(formatCompactINR(1250000), '₹12.5L'));

console.log('\n' + pass + ' checks passed');
