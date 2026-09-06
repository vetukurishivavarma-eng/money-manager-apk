// Indian-numbering currency + date helpers. Pure.
function formatINR(n, opts = {}) {
  const { paise = false, sign = false } = opts;
  const v = Number(n) || 0;
  const neg = v < 0;
  let s = Math.abs(v).toFixed(paise ? 2 : 0);
  let [int, frac] = s.split('.');
  const last3 = int.length > 3 ? int.slice(-3) : int;
  let rest = int.length > 3 ? int.slice(0, -3) : '';
  rest = rest.replace(/\B(?=(\d\d)+(?!\d))/g, ',');
  const body = '₹' + (rest ? rest + ',' : '') + last3 + (frac ? '.' + frac : '');
  if (neg) return '-' + body;
  return sign ? '+' + body : body;
}

// compact: 12300 -> "₹12.3k", 1500000 -> "₹15.0L"
function formatCompactINR(n) {
  const v = Math.abs(Number(n) || 0);
  const sgn = (Number(n) || 0) < 0 ? '-' : '';
  if (v >= 1e7) return sgn + '₹' + (v / 1e7).toFixed(2) + 'Cr';
  if (v >= 1e5) return sgn + '₹' + (v / 1e5).toFixed(1) + 'L';
  if (v >= 1e3) return sgn + '₹' + (v / 1e3).toFixed(1) + 'k';
  return sgn + '₹' + Math.round(v);
}

module.exports = { formatINR, formatCompactINR };
