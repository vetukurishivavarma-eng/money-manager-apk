// Sender-id fragments for Indian banks / bank-like wallets (Android sends e.g. "AD-HDFCBK-S").
const BANK_SENDERS =
  /HDFC|ICICI|SBIIN|SBICR|SBIINB|SBI|AXIS|AXISBK|KOTAK|KKBK|YESBK|YESB|IDFCFB|IDFCB|IDFB|PNBSMS|PNBINB|PNB|BOIIND|BOB|BARB|CANBNK|CANBK|CANARA|UNIONB|UBIN|INDBNK|INDUS|INDUSB|FEDBNK|FEDERAL|RBLBNK|RBL|DBSBNK|DBSS|CITIBK|CITI|HSBC|SCBANK|SCBL|SCB|AUBANK|AUFB|BANDHAN|BDBL|CBSSBI|PAYTMB|PYTM|PAYTM|FINOBK|FINO|AIRTLB|AIRBAN|JUPITR|JUPITER|SLICEIT|SLICE|ONECRD|ONECARD|CREDCLUB|CRED|AMEX|FAMPAY|NIYOIN|NIYO|DIGIBK|MAHABK|IOBCHN|IOB|KVBANK|KVB|SIBANK|SIB|DCBBNK|DCB|BOMBK|EQTASF|EQUITAS|UJJIVN|UJJIVAN|JANASF|JANA|ESAFBK|ESAF/i;

// Non-transaction messages we must never turn into a spend.
const IGNORE =
  /\b(otp|one[ -]?time\s?password|do not share|never share|verification code|sms code|login code|secure code|will expire|valid for \d|e-?mandate (registered|created|set)|mandate (registration|created|will)|autopay .*(set|registered)|has been set up|si (has been )?registered|standing instruction|requested money|collect request|payment request|requesting rs|will be (debited|charged|deducted)|is due on|due date|reminder|overdue|kindly pay|please pay|apply now|pre-?approved|you are eligible|loan offer|instant loan|personal loan|credit card offer|congratulations|you (have )?won|claim your|redeem now|reward points|earn \d|upgrade your|activate your|statement (is )?(ready|generated|available)|min(imum)? amount due|total amount due|bill generated|balance is rs|available balance is|avl bal is rs.*as on)\b/i;

// A failed / declined / not-processed attempt (skip). "reversed"/"refund" handled separately as credit.
const FAILED =
  /\b(failed|declined|not (successful|processed|completed)|unsuccessful|could not be (processed|completed)|transaction cancelled|has been cancelled|insufficient (balance|funds)|limit exceeded)\b/i;

const DEBIT =
  /\b(debited|debit|spent|paid|sent|withdrawn|withdrawal|purchase|deducted|transferred to|txn of|payment of|charged|towards)\b/i;

const CREDIT =
  /\b(credited|credit|received|deposited|added to your|money received|has been received)\b/i;

module.exports = { BANK_SENDERS, IGNORE, FAILED, DEBIT, CREDIT };
