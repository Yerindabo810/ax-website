import { create } from 'zustand';
import {
  Product,
  Category,
  Sale,
  Customer,
  BusinessProfile,
  DashboardSummary,
  Expense,
  Supplier,
  CloudUser,
  CloudBusiness,
  PaymentMethod,
} from '../types';
import { cloudApi } from '../services/cloudApi';

export interface CartItem {
  product: Product;
  quantity: number;
  price: number;
  isWholesale?: boolean;
}

interface DesktopStoreState {
  // Navigation
  activeTab: 'pos' | 'products' | 'stock' | 'debts' | 'expenses' | 'shifts' | 'settings';
  setActiveTab: (tab: 'pos' | 'products' | 'stock' | 'debts' | 'expenses' | 'shifts' | 'settings') => void;

  // Business Profile
  profile: BusinessProfile;
  updateProfile: (partial: Partial<BusinessProfile>) => void;

  // Cloud Account
  cloudUser: CloudUser | null;
  cloudBusiness: CloudBusiness | null;
  isOnline: boolean;
  setOnlineStatus: (status: boolean) => void;
  setCloudAuth: (user: CloudUser | null, biz: CloudBusiness | null) => void;

  // Catalog
  products: Product[];
  categories: Category[];
  setProducts: (products: Product[]) => void;
  setCategories: (categories: Category[]) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;

  // Active POS Cart
  cart: CartItem[];
  addToCart: (product: Product, isWholesale?: boolean) => void;
  removeFromCart: (productId: number) => void;
  updateCartQty: (productId: number, qty: number) => void;
  clearCart: () => void;
  selectedCustomer: Customer | null;
  setSelectedCustomer: (cust: Customer | null) => void;
  cartPaymentMethod: PaymentMethod;
  setCartPaymentMethod: (method: PaymentMethod) => void;

  // Sales & History
  sales: Sale[];
  addSale: (sale: Sale) => void;

  // Customers & Debts
  customers: Customer[];

  // Expenses
  expenses: Expense[];

  // Suppliers
  suppliers: Supplier[];

  // Analytics
  summary: DashboardSummary;
}

export const useDesktopStore = create<DesktopStoreState>((set, get) => ({
  activeTab: 'pos',
  setActiveTab: (tab) => set({ activeTab: tab }),

  profile: {
    id: 1,
    uuid: 'prof-default',
    shop_name: 'TradeDesk Wholesale & Retail',
    owner_name: 'Anthony Yerindabo',
    phone: '0772651444',
    address: 'Kampala, Uganda',
    currency: 'UGX',
    business_type: 'General Retail & Wholesale',
    receipt_footer: 'Thank you for shopping with us! Goods once sold are not returnable.',
    pin_code: null,
    mtn_merchant_code: '',
    airtel_merchant_code: '',
    cloud_email: 'anthonyerindabo01@gmail.com',
    cloud_token: null,
    onboarded: 1,
    updated_at: new Date().toISOString(),
  },
  updateProfile: (partial) =>
    set((state) => ({ profile: { ...state.profile, ...partial } })),

  cloudUser: null,
  cloudBusiness: null,
  isOnline: navigator.onLine,
  setOnlineStatus: (status) => set({ isOnline: status }),
  setCloudAuth: (user, biz) => set({ cloudUser: user, cloudBusiness: biz }),

  products: [
    {
      id: 1,
      uuid: 'p-1',
      name: 'Sugar 1kg (Kakira)',
      sku: 'SUG-01',
      barcode: '6001234567890',
      unit: 'Pcs',
      category_id: 1,
      cost_price: 3800,
      selling_price: 4500,
      wholesale_price: 4200,
      pack_name: 'Carton (25 Pcs)',
      pack_size: 25,
      pack_price: 100000,
      current_stock: 48,
      stock_quantity: 48,
      min_stock_alert: 10,
      low_stock_threshold: 10,
      is_active: 1,
      is_deleted: 0,
      sync_status: 'synced',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 2,
      uuid: 'p-2',
      name: 'Cooking Oil 1L (Fortune)',
      sku: 'OIL-01',
      barcode: '6009876543210',
      unit: 'Bottles',
      category_id: 1,
      cost_price: 6800,
      selling_price: 8000,
      wholesale_price: 7500,
      pack_name: 'Box (12 Bottles)',
      pack_size: 12,
      pack_price: 88000,
      current_stock: 32,
      stock_quantity: 32,
      min_stock_alert: 8,
      low_stock_threshold: 8,
      is_active: 1,
      is_deleted: 0,
      sync_status: 'synced',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 3,
      uuid: 'p-3',
      name: 'Maize Flour 2kg (Magenda)',
      sku: 'POSHO-02',
      barcode: '6005551234567',
      unit: 'Bags',
      category_id: 1,
      cost_price: 4200,
      selling_price: 5000,
      wholesale_price: 4600,
      pack_name: 'Bale (12 Bags)',
      pack_size: 12,
      pack_price: 54000,
      current_stock: 60,
      stock_quantity: 60,
      min_stock_alert: 15,
      low_stock_threshold: 15,
      is_active: 1,
      is_deleted: 0,
      sync_status: 'synced',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 4,
      uuid: 'p-4',
      name: 'Colgate Toothpaste 100ml',
      sku: 'COL-100',
      barcode: '6007778889990',
      unit: 'Tubes',
      category_id: 2,
      cost_price: 2500,
      selling_price: 3500,
      wholesale_price: 3000,
      pack_name: 'Box (24 Tubes)',
      pack_size: 24,
      pack_price: 70000,
      current_stock: 45,
      stock_quantity: 45,
      min_stock_alert: 12,
      low_stock_threshold: 12,
      is_active: 1,
      is_deleted: 0,
      sync_status: 'synced',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 5,
      uuid: 'p-5',
      name: 'Panadol Extra (Pack of 10)',
      sku: 'PAN-EXT',
      barcode: '6001112223334',
      unit: 'Packs',
      category_id: 3,
      cost_price: 1800,
      selling_price: 2500,
      wholesale_price: 2200,
      pack_name: 'Card (20 Packs)',
      pack_size: 20,
      pack_price: 42000,
      current_stock: 80,
      stock_quantity: 80,
      min_stock_alert: 20,
      low_stock_threshold: 20,
      is_active: 1,
      is_deleted: 0,
      sync_status: 'synced',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  categories: [
    { id: 1, uuid: 'c-1', name: 'Groceries & Foods', color: '#0B4FB8', updated_at: new Date().toISOString(), sync_status: 'synced' },
    { id: 2, uuid: 'c-2', name: 'Personal Care & Detergents', color: '#16A34A', updated_at: new Date().toISOString(), sync_status: 'synced' },
    { id: 3, uuid: 'c-3', name: 'Healthcare & OTC', color: '#F26A0E', updated_at: new Date().toISOString(), sync_status: 'synced' },
  ],
  setProducts: (products) => set({ products }),
  setCategories: (categories) => set({ categories }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  selectedCategory: 'ALL',
  setSelectedCategory: (cat) => set({ selectedCategory: cat }),

  cart: [],
  addToCart: (product, isWholesale = false) => {
    const { cart } = get();
    const existing = cart.find(
      (item) => item.product.id === product.id && item.isWholesale === isWholesale
    );
    const unitPrice = isWholesale ? (product.wholesale_price || product.selling_price) : product.selling_price;

    if (existing) {
      set({
        cart: cart.map((item) =>
          item.product.id === product.id && item.isWholesale === isWholesale
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ),
      });
    } else {
      set({
        cart: [...cart, { product, quantity: 1, price: unitPrice, isWholesale }],
      });
    }
  },
  removeFromCart: (productId) =>
    set((state) => ({ cart: state.cart.filter((item) => item.product.id !== productId) })),
  updateCartQty: (productId, qty) => {
    if (qty <= 0) {
      get().removeFromCart(productId);
    } else {
      set((state) => ({
        cart: state.cart.map((item) =>
          item.product.id === productId ? { ...item, quantity: qty } : item
        ),
      }));
    }
  },
  clearCart: () => set({ cart: [], selectedCustomer: null }),
  selectedCustomer: null,
  setSelectedCustomer: (cust) => set({ selectedCustomer: cust }),
  cartPaymentMethod: 'CASH',
  setCartPaymentMethod: (method) => set({ cartPaymentMethod: method }),

  sales: [],
  addSale: (sale) => set((state) => ({ sales: [sale, ...state.sales] })),

  customers: [
    {
      id: 1,
      uuid: 'cust-1',
      name: 'Mama Brian Shop',
      phone: '0772111222',
      address: 'Kalerwe Market',
      notes: '',
      total_debt: 45000,
      total_credit_balance: 45000,
      total_spent: 320000,
      last_purchase_at: new Date().toISOString(),
      is_deleted: 0,
      updated_at: new Date().toISOString(),
      sync_status: 'synced',
    },
    {
      id: 2,
      uuid: 'cust-2',
      name: 'Kato Hardware',
      phone: '0703333444',
      address: 'Bwaise',
      notes: '',
      total_debt: 0,
      total_credit_balance: 0,
      total_spent: 850000,
      last_purchase_at: new Date().toISOString(),
      is_deleted: 0,
      updated_at: new Date().toISOString(),
      sync_status: 'synced',
    },
  ],

  expenses: [],
  suppliers: [],

  summary: {
    todaySales: 345000,
    todaySalesCount: 14,
    todayTransactions: 14,
    todayGrossProfit: 68500,
    todayExpenses: 25000,
    todayNetProfit: 43500,
    todayCashSales: 220000,
    todayMomoSales: 125000,
    todayMerchantSales: 0,
    todayCreditSales: 0,
    todayItemsSold: 28,
    todayDebtCollected: 15000,
    totalStockCostValue: 12500000,
    totalStockRetailValue: 16800000,
    totalProducts: 5,
    lowStockCount: 2,
    totalReceivables: 45000,
    outOfStockCount: 0,
    expiringSoonCount: 0,
    expiredCount: 0,
    totalCustomerDebt: 45000,
    debtorsCount: 1,
    totalSupplierPayables: 0,
  },
}));

