export const C = {
  bg: '#F4F6F5',
  card: '#FFFFFF',
  ink: '#12211C',
  sub: '#5C6B65',
  line: '#E4E9E7',
  brand: '#0B3D2E',
  brandSoft: '#E7F0EC',
  ok: '#1F8A55',
  warn: '#C98A00',
  over: '#C0392B',
  debit: '#C0392B',
  credit: '#1F8A55',
};

export const stateColor = (s: string) =>
  s === 'over' ? C.over : s === 'warn' ? C.warn : s === 'ok' ? C.ok : C.sub;

export const CATEGORIES = [
  'Food & Dining', 'Groceries', 'Transport', 'Travel', 'Shopping',
  'Bills & Utilities', 'Entertainment', 'Health', 'Rent', 'EMI & Loans',
  'Investments', 'Education', 'Transfers', 'Cash/ATM', 'Income', 'Other',
] as const;
export type Category = (typeof CATEGORIES)[number];

// Category -> sub-categories. Used to populate the sub-category picker; free text also allowed.
export const TAXONOMY: Record<string, string[]> = {
  'Food & Dining': ['Restaurants', 'Food Delivery', 'Cafe & Coffee', 'Bars & Alcohol', 'Snacks & Street Food'],
  Groceries: ['Supermarket', 'Quick Commerce', 'Kirana Store', 'Dairy & Eggs', 'Meat & Fish', 'Fruits & Veg'],
  Transport: ['Cab & Auto', 'Fuel', 'Public Transport', 'Parking & Tolls', 'Vehicle Service'],
  Travel: ['Flights', 'Trains & Bus', 'Hotels & Stays', 'Holiday Packages'],
  Shopping: ['Clothing & Footwear', 'Electronics', 'Home & Furniture', 'Personal Care', 'Gifts', 'Marketplace'],
  'Bills & Utilities': ['Electricity', 'Water', 'Piped Gas', 'Mobile Recharge', 'Broadband', 'DTH', 'Society Maintenance'],
  Entertainment: ['Streaming (OTT)', 'Movies & Events', 'Games', 'Music', 'Hobbies'],
  Health: ['Pharmacy', 'Doctor & Clinic', 'Hospital', 'Diagnostics', 'Fitness & Gym', 'Health Insurance'],
  Rent: ['House Rent', 'PG / Hostel', 'Society Maintenance'],
  'EMI & Loans': ['Loan EMI', 'Credit Card Bill', 'Buy Now Pay Later'],
  Investments: ['Stocks', 'Mutual Funds & SIP', 'Gold', 'PPF / NPS', 'Crypto', 'Fixed Deposit'],
  Education: ['Online Courses', 'Tuition & Coaching', 'School / College Fees', 'Books & Stationery'],
  Transfers: ['To Self', 'To Family & Friends', 'Wallet Load'],
  'Cash/ATM': ['ATM Withdrawal', 'Cash Spend'],
  Income: ['Salary', 'Freelance / Business', 'Interest', 'Refund', 'Cashback', 'Gift'],
  Other: ['Charity & Donation', 'Fees & Charges', 'Taxes', 'Miscellaneous'],
};

export const CATEGORY_ICON: Record<string, string> = {
  'Food & Dining': 'fast-food', Groceries: 'basket', Transport: 'car',
  Travel: 'airplane', Shopping: 'bag-handle', 'Bills & Utilities': 'receipt',
  Entertainment: 'game-controller', Health: 'medkit', Rent: 'home',
  'EMI & Loans': 'card', Investments: 'trending-up', Education: 'school',
  Transfers: 'swap-horizontal', 'Cash/ATM': 'cash', Income: 'arrow-down-circle',
  Other: 'ellipsis-horizontal',
};
