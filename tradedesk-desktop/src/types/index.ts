export type SyncStatus = 'pending' | 'synced';

export interface CloudUser {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  branch_id?: string | number | null;
  two_factor_enabled?: boolean;
}

export interface CloudBusiness {
  id: number;
  name: string;
  subdomain: string;
  category: string;
  location: string;
  phone?: string;
  currency: string;
  logo_url?: string;
  tin_number?: string;
  wallet_balance?: number;
  plan?: string;
  trial_ends_at?: string | null;
  subscription_expires_at?: string | null;
}

export interface BusinessProfile {
  id: number;
  uuid: string;
  shop_name: string;
  owner_name: string;
  phone: string;
  address: string;
  business_type: string;
  currency: string;
  receipt_footer: string;
  pin_code: string | null;
  mtn_merchant_code: string;
  airtel_merchant_code: string;
  logo_uri?: string | null;
  tin_number?: string | null;
  cloud_email: string | null;
  cloud_token: string | null;
  cloud_user_json?: string | null;
  cloud_business_json?: string | null;
  cloud_api_url?: string | null;
  last_synced_at?: string | null;
  onboarded: number;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  subscription_status?: 'trial' | 'active' | 'expired';
  subscription_expires_at?: string | null;
  updated_at: string;
}

export interface TrialStatus {
  isTrial: boolean;
  isExpired: boolean;
  daysRemaining: number;
  trialStartedAt: string;
  trialEndsAt: string;
  planName: string;
  subscriptionStatus: 'trial' | 'active' | 'expired';
}

export interface Category {
  id: number;
  uuid: string;
  name: string;
  color: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface Product {
  id: number;
  uuid: string;
  name: string;
  sku: string;
  barcode: string;
  category_id: number | null;
  category_name?: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  wholesale_price: number;
  current_stock?: number;
  min_stock_alert?: number;
  is_active?: number;
  created_at?: string;
  pack_name?: string;
  pack_size?: number;
  pack_price?: number;
  sub_unit_name?: string;
  sub_unit_cost?: number;
  sub_unit_wholesale?: number;
  sub_unit_barcode?: string;
  batch_number?: string;
  expiry_date?: string | null;
  brand?: string;
  image_uri?: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  is_deleted: number;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface StockMovement {
  id: number;
  uuid: string;
  product_id: number;
  product_name?: string;
  type: 'IN' | 'OUT' | 'ADJUST' | 'SALE' | 'VOID' | 'BREAK_BULK' | 'SUPPLIER_GRN';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  unit_cost: number;
  note: string;
  created_at: string;
  sync_status: SyncStatus;
}

export interface Customer {
  id: number;
  uuid: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  total_debt: number;
  total_credit_balance?: number;
  total_spent: number;
  last_purchase_at: string | null;
  is_deleted: number;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
  cost_price: number;
  discount: number;
  price_mode?: 'retail' | 'wholesale' | 'pack' | 'custom';
  unit_label?: string;
  pack_multiplier?: number;
}

export interface ParkedCart {
  id: string;
  label: string;
  customer_name?: string;
  items: CartItem[];
  discount: number;
  created_at: string;
}

export type PaymentMethod =
  | 'CASH'
  | 'MTN_MOMO'
  | 'AIRTEL_MONEY'
  | 'MERCHANT_PAY'
  | 'VISA'
  | 'CREDIT';

export interface SaleItem {
  id?: number;
  uuid: string;
  sale_id?: number;
  product_id: number;
  product_name: string;
  unit: string;
  quantity: number;
  cost_price: number;
  unit_price: number;
  discount: number;
  subtotal: number;
  profit: number;
}

export interface Sale {
  id: number;
  uuid: string;
  receipt_number: string;
  customer_id: number | null;
  customer_name: string;
  customer_phone: string;
  subtotal: number;
  discount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  change_amount: number;
  total_profit: number;
  payment_method: PaymentMethod;
  payment_status: 'PAID' | 'PARTIAL' | 'CREDIT' | 'VOIDED';
  momo_phone: string;
  momo_ref: string;
  notes: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  items?: SaleItem[];
}

export interface DebtPayment {
  id: number;
  uuid: string;
  customer_id: number;
  customer_name?: string;
  sale_id: number | null;
  amount: number;
  payment_method: 'CASH' | 'MTN_MOMO' | 'AIRTEL_MONEY' | 'VISA';
  reference: string;
  note: string;
  created_at: string;
  sync_status: SyncStatus;
}

export interface Expense {
  id: number;
  uuid: string;
  title: string;
  category: string;
  amount: number;
  payment_method: 'CASH' | 'MOMO' | 'MTN_MOMO' | 'AIRTEL_MONEY' | 'VISA' | 'BANK';
  note: string;
  expense_date: string;
  created_at: string;
  sync_status: SyncStatus;
}

export interface Supplier {
  id: number;
  uuid: string;
  name: string;
  phone: string;
  products_supplied: string;
  address: string;
  balance_owed: number;
  updated_at: string;
}

export interface SupplierPurchase {
  id: number;
  uuid: string;
  supplier_id: number;
  supplier_name: string;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  amount_paid: number;
  balance_due: number;
  payment_method: 'CASH' | 'MOMO' | 'MTN_MOMO' | 'AIRTEL_MONEY' | 'VISA' | 'CREDIT';
  batch_number: string;
  expiry_date: string | null;
  note: string;
  created_at: string;
}

export interface SupplierPayment {
  id: number;
  uuid: string;
  supplier_id: number;
  supplier_name: string;
  amount: number;
  payment_method: 'CASH' | 'MOMO' | 'MTN_MOMO' | 'AIRTEL_MONEY' | 'VISA' | 'BANK';
  reference: string;
  note: string;
  created_at: string;
}

export type WalletType =
  | 'CASH'
  | 'MOMO'
  | 'BANK'
  | 'MTN_MOMO'
  | 'AIRTEL_MONEY';

export interface TreasuryTransaction {
  id: number;
  uuid: string;
  wallet: WalletType;
  target_wallet?: WalletType | null;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';
  amount: number;
  reference: string;
  note: string;
  created_at: string;
}

export interface TreasurySummary {
  cashBalance: number;
  momoBalance: number; // Unified Mobile Money & Card Wallet (MTN • Airtel • Visa) - stored as ONE on API
  mtnMomoBalance: number;
  airtelMoneyBalance: number;
  bankBalance: number;
  totalLiquidCash: number;
}

export interface BalanceSheetData {
  treasury: TreasurySummary;
  stockCostValue: number;
  stockRetailValue: number;
  customerReceivables: number;
  totalAssets: number;
  supplierPayables: number;
  totalLiabilities: number;
  netWorthEquity: number;
}

export interface DailyShift {
  id: number;
  uuid: string;
  shift_date: string;
  opened_at: string;
  closed_at: string | null;
  opening_float: number;
  cash_sales: number;
  momo_sales: number;
  merchant_sales?: number;
  credit_sales: number;
  debt_collected_cash: number;
  cash_in_drops: number;
  cash_out_payouts: number;
  expenses_cash: number;
  expected_cash: number;
  actual_counted_cash: number | null;
  variance: number | null;
  notes: string;
  status: 'OPEN' | 'CLOSED';
}

export interface DailyChartPoint {
  date: string;
  label: string;
  sales: number;
  profit: number;
  expenses: number;
}

export interface DashboardSummary {
  todaySales: number;
  todaySalesCount: number;
  todayTransactions?: number;
  todayGrossProfit: number;
  todayExpenses: number;
  todayNetProfit: number;
  todayCashSales: number;
  todayMomoSales: number;
  todayMerchantSales: number;
  todayCreditSales: number;
  todayItemsSold: number;
  todayDebtCollected: number;
  totalStockCostValue: number;
  totalStockRetailValue: number;
  totalProducts: number;
  lowStockCount: number;
  totalReceivables?: number;
  outOfStockCount: number;
  expiringSoonCount: number;
  expiredCount: number;
  totalCustomerDebt: number;
  debtorsCount: number;
  totalSupplierPayables: number;
}

export interface PeriodReport {
  totalSales: number;
  salesCount: number;
  cogs: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  cashSales: number;
  mtnSales: number;
  airtelSales: number;
  creditSales: number;
  debtCollected: number;
  topProducts: Array<{
    product_name: string;
    qty_sold: number;
    revenue: number;
    profit: number;
  }>;
  expensesByCategory: Array<{
    category: string;
    total: number;
  }>;
}

export interface AppNotification {
  id: number;
  type: 'SALE' | 'PAYMENT' | 'SYNC' | 'ALERT';
  title: string;
  message: string;
  is_read: number;
  data_json?: string | null;
  created_at: string;
}

