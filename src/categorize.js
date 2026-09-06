// Keyword -> category. First match wins. Pure; no deps.
const RULES = [
  [/swiggy|zomato|domino|mcdonald|kfc|pizza|burger|restaurant|cafe|café|coffee|starbucks|barista|bakery|biryani|eatfit|box8|faasos|dunkin|barbeque|barbeq|behrouz|freshmenu|wow ?momo|haldiram|chaayos|third wave|blue tokai|subway|theobroma|social|dhaba/i, 'Food & Dining'],
  [/bigbasket|big ?basket|blinkit|zepto|dmart|d-?mart|jiomart|jio ?mart|grofers|instamart|super ?market|kirana|reliance ?fresh|reliance ?smart|more ?retail|more ?megastore|spencer|nature'?s basket|licious|country delight|milkbasket|fraazo|otipy/i, 'Groceries'],
  [/uber|ola\b|olacabs|rapido|namma ?yatri|blu ?smart|irctc|redbus|abhibus|indigo|air ?india|vistara|spicejet|akasa|petrol|diesel|\bhpcl\b|\biocl\b|\bbpcl\b|indian ?oil|shell|nayara|\bfuel\b|filling station|fastag|\bpaytm ?fastag\b|parking|\bbmtc\b|\bdmrc\b|\bbest\b|namma ?metro|metro ?rail|\bmtc\b/i, 'Transport'],
  [/\bmakemytrip\b|\bmmt\b|goibibo|cleartrip|yatra|ixigo|easemytrip|booking\.?com|agoda|airbnb|oyo|treebo|fabhotels|\bhotel\b|resort|\bvilla\b|trivago|expedia/i, 'Travel'],
  [/amazon(?! ?pay ?to)|amzn|flipkart|myntra|ajio|nykaa|meesho|tatacliq|tata ?cliq|snapdeal|lifestyle|pantaloons|shoppers ?stop|westside|max ?fashion|decathlon|croma|reliance ?digital|vijay ?sales|ikea|urban ?ladder|pepperfry|fabindia|zara|\bh&m\b|uniqlo|lenskart|titan|tanishq|firstcry|\bgap\b|\bnike\b|adidas|puma/i, 'Shopping'],
  [/electricity|\bbescom\b|\bmseb\b|\btneb\b|\bbses\b|tata ?power|adani ?electricity|torrent ?power|\bwater bill\b|\bgas bill\b|indane|\bhp gas\b|bharatgas|\bpng\b|broadband|\bwifi\b|\bairtel\b|\bjio\b(?! ?mart)|\bvi\b|vodafone|\bbsnl\b|act ?fibernet|\bhathway\b|\bden\b|tikona|excitel|recharge|\bdth\b|tata ?play|\bdish ?tv\b|\bd2h\b|sun ?direct|postpaid|prepaid|mobile bill|landline|\bpiped gas\b/i, 'Bills & Utilities'],
  [/netflix|hotstar|disney|\bsonyliv\b|\bzee5\b|jiocinema|jio ?cinema|\bprime video\b|spotify|gaana|wynk|youtube ?premium|\byt ?premium\b|apple ?music|audible|kindle|bookmyshow|\bbms\b|\bpvr\b|\binox\b|cinepolis|district|\bgame\b|steam|playstation|xbox|dream11|\brummy\b|\bmpl\b/i, 'Entertainment'],
  [/pharmacy|pharmeasy|\b1mg\b|tata ?1mg|netmeds|apollo|medplus|med ?plus|wellness ?forever|\bhospital\b|\bclinic\b|diagnostic|\blab\b|thyrocare|healthians|\bdr\.? |doctor|practo|cult\.?fit|cultfit|\bgym\b|fitness|\bhealthkart\b|manipal|fortis|\bmax health\b|medanta|narayana/i, 'Health'],
  [/\brent\b|\bno ?broker\b|nestaway|\bzolo\b|\bstanza\b|\bcolive\b|maintenance|society due|apartment|housing ?society|\bmygate\b/i, 'Rent'],
  [/\bemi\b|\bloan\b|bajaj ?fin|\bhdb\b|\bhomecredit\b|home credit|\bkreditbee\b|\bmoneyview\b|\bcashe\b|\bfibe\b|\bearlysalary\b|repayment|\bcredit card\b payment|\bcc\b payment|card ?bill|bill ?payment.*card|amazon ?pay ?later|\blazypay\b|\bsimpl\b|\bicici ?bank card\b/i, 'EMI & Loans'],
  [/zerodha|\bgroww\b|upstox|\bcoin\b|\bkuvera\b|\bindmoney\b|ind ?money|\bsmallcase\b|paytm ?money|\betmoney\b|\bnps\b|\bppf\b|mutual ?fund|\bsip\b|\bmf\b purchase|\bnav\b|\bcams\b|kfintech|\bkarvy\b|zerodha ?broking|angel ?one|angelbroking|\bdhan\b|\bpocketful\b|gold ?bond|\bsgb\b|\bnippon\b|\bhdfc amc\b/i, 'Investments'],
  [/udemy|coursera|byju|\bunacademy\b|vedantu|physics ?wallah|\bpw\b|\bwhitehat\b|\bcuemath\b|\bskillshare\b|\bupgrad\b|great ?learning|\bschool\b|\bcollege\b|\buniversity\b|tuition|\bcoaching\b|\bexam\b fee|admission|\bfees\b/i, 'Education'],
  [/\bsalary\b|\bsal\b cr|\bpayroll\b|\bstipend\b|\bwages\b|neft.*\bsal\b/i, 'Income'],
];

function normalizeText(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// counterparty + optional note + channel  ->  category string or null
function categorize(counterparty, note, channel) {
  const hay = normalizeText([counterparty, note].filter(Boolean).join(' '));
  if (hay) {
    for (const [re, cat] of RULES) if (re.test(hay)) return cat;
  }
  if (channel === 'ATM') return 'Cash/ATM';
  if (channel === 'AUTOPAY') return 'Bills & Utilities';
  return null;
}

// Best-effort sub-category from the same haystack. Returns string or null.
const SUBRULES = [
  [/swiggy|zomato|eatfit|box8|faasos|freshmenu|dominos|pizza|behrouz/i, 'Food Delivery'],
  [/restaurant|dhaba|biryani|barbeque|barbeq|haldiram|social|subway|kfc|mcdonald|burger/i, 'Restaurants'],
  [/cafe|café|coffee|starbucks|barista|chaayos|third wave|blue tokai|tea/i, 'Cafe & Coffee'],
  [/blinkit|zepto|instamart|dunzo|fraazo|otipy/i, 'Quick Commerce'],
  [/bigbasket|dmart|d-?mart|jiomart|reliance ?fresh|reliance ?smart|more ?retail|spencer|super ?market/i, 'Supermarket'],
  [/uber|ola\b|rapido|namma ?yatri|blu ?smart/i, 'Cab & Auto'],
  [/petrol|diesel|hpcl|iocl|bpcl|indian ?oil|shell|nayara|fuel|filling station/i, 'Fuel'],
  [/fastag|toll|parking/i, 'Parking & Tolls'],
  [/irctc|redbus|abhibus/i, 'Trains & Bus'],
  [/indigo|air ?india|vistara|spicejet|akasa/i, 'Flights'],
  [/oyo|treebo|fabhotel|hotel|resort|airbnb|booking\.?com|agoda/i, 'Hotels & Stays'],
  [/netflix|hotstar|disney|sonyliv|zee5|jiocinema|prime video|spotify|gaana|youtube ?premium|audible/i, 'Streaming (OTT)'],
  [/bookmyshow|\bpvr\b|\binox\b|cinepolis|district/i, 'Movies & Events'],
  [/pharmeasy|1mg|netmeds|medplus|pharmacy|apollo/i, 'Pharmacy'],
  [/cult\.?fit|cultfit|gym|fitness|healthkart/i, 'Fitness & Gym'],
  [/zerodha|groww|upstox|angel ?one|dhan/i, 'Stocks'],
  [/mutual ?fund|\bsip\b|\bmf\b|cams|kfintech|kuvera|indmoney/i, 'Mutual Funds & SIP'],
  [/amazon|flipkart|myntra|ajio|nykaa|meesho|tatacliq/i, 'Marketplace'],
  [/zara|h&m|uniqlo|max ?fashion|pantaloons|lifestyle|westside|nike|adidas|puma|bata/i, 'Clothing & Footwear'],
  [/croma|reliance ?digital|vijay ?sales|\bnike\b/i, 'Electronics'],
  [/electricity|bescom|mseb|tneb|bses|tata ?power|adani ?electricity|torrent ?power/i, 'Electricity'],
  [/airtel|jio|vodafone|\bvi\b|bsnl|recharge|postpaid|prepaid/i, 'Mobile Recharge'],
  [/broadband|wifi|act ?fibernet|hathway|excitel|tikona/i, 'Broadband'],
  [/\brent\b|nobroker|nestaway/i, 'House Rent'],
  [/\bemi\b|bajaj ?fin|home credit|kreditbee/i, 'Loan EMI'],
  [/credit card|card ?bill|cc ?payment/i, 'Credit Card Bill'],
  [/salary|payroll|stipend/i, 'Salary'],
  [/atm|cash withdrawal|cash wdl/i, 'ATM Withdrawal'],
];

function subcategorize(category, text) {
  const hay = normalizeText(text);
  if (!hay) return null;
  for (const [re, sub] of SUBRULES) if (re.test(hay)) return sub;
  return null;
}

module.exports = { categorize, subcategorize, normalizeText, RULES };
