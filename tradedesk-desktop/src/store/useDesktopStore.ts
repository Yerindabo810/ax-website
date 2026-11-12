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
  DailyShift,
  TreasurySummary,
  StockMovement,
} from '../types';
import { cloudApi, setCloudApiConfig } from '../services/cloudApi';

export interface CartItem {
  product: Product;
  quantity: number;
  price: number;
  isWholesale?: boolean;
}

export interface ParkedCart {
  id: string;
  name: string;
  items: CartItem[];
  created_at: string;
}

export type MoreTabKey =
  | 'REPORTS'
  | 'WALLETS'
  | 'SHIFTS'
  | 'VAS_BILLS'
  | 'EXPENSES'
  | 'SUPPLIERS'
  | 'SALES'
  | 'SETTINGS';

interface DesktopStoreState {
  // Main Tab Navigation matching Mobile App
  activeTab: 'dashboard' | 'pos' | 'inventory' | 'debts' | 'more';
  setActiveTab: (tab: 'dashboard' | 'pos' | 'inventory' | 'debts' | 'more') => void;
  moreSubTab: MoreTabKey;
  setMoreSubTab: (sub: MoreTabKey) => void;

  // Business Profile
  profile: BusinessProfile;
  updateProfile: (partial: Partial<BusinessProfile>) => void;

  // Cloud Account & Connectivity
  cloudUser: CloudUser | null;
  cloudBusiness: CloudBusiness | null;
  cloudToken: string | null;
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  setOnlineStatus: (status: boolean) => void;
  setCloudAuth: (user: CloudUser | null, biz: CloudBusiness | null, token?: string | null) => void;
  syncWithCloud: () => Promise<{ success: boolean; message: string }>;
  restoreFromCloudBackup: () => Promise<{ success: boolean; message: string }>;
  uploadBackupToCloud: () => Promise<{ success: boolean; message: string }>;
  syncLiveMoMoBalance: () => Promise<void>;

  // Catalog
  products: Product[];
  categories: Category[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  addOrUpdateProduct: (productData: Partial<Product> & { name: string; selling_price: number }) => void;
  deleteProduct: (id: number) => void;
  adjustStock: (productId: number, qtyDelta: number, reason: string, type: 'IN' | 'OUT' | 'ADJUST') => void;
  breakBulk: (sourceProductId: number, packCount: number, unitsPerPack: number) => void;
  addCategory: (name: string, color?: string) => void;
  deleteCategory: (id: number) => void;
  clearAllShopData: () => void;

  // Active POS Till
  cart: CartItem[];
  parkedCarts: ParkedCart[];
  addToCart: (product: Product, isWholesale?: boolean) => void;
  removeFromCart: (productId: number) => void;
  updateCartQty: (productId: number, qty: number) => void;
  clearCart: () => void;
  parkCart: (name?: string) => void;
  restoreParkedCart: (id: string) => void;
  deleteParkedCart: (id: string) => void;

  // POS Checkout Sale
  checkoutSale: (payload: {
    paymentMethod: PaymentMethod;
    amountPaid: number;
    customerId?: number | null;
    customerPhone?: string;
    notes?: string;
  }) => Sale;

  // Sales History & Receipts
  sales: Sale[];
  activeReceiptSale: Sale | null;
  setActiveReceiptSale: (sale: Sale | null) => void;

  // Customers & Debtors
  customers: Customer[];
  addOrUpdateCustomer: (cust: Partial<Customer> & { name: string; phone: string }) => void;
  recordDebtPayment: (customerId: number, amount: number, method: 'CASH' | 'MTN_MOMO' | 'AIRTEL_MONEY', note?: string) => void;

  // Expenses
  expenses: Expense[];
  addExpense: (category: string, amount: number, note: string) => void;
  deleteExpense: (id: number) => void;

  // Suppliers & GRN
  suppliers: Supplier[];
  addOrUpdateSupplier: (sup: Partial<Supplier> & { name: string; phone: string }) => void;
  recordGRN: (supplierId: number, productId: number, qty: number, unitCost: number, amountPaid: number, method: string) => void;
  recordSupplierPayment: (supplierId: number, amount: number, method: string, note?: string) => void;

  // Shifts & Cash Register
  currentShift: DailyShift | null;
  dailyShifts: DailyShift[];
  openShift: (openingFloat: number, notes?: string) => void;
  closeShift: (countedCash: number, notes?: string) => DailyShift | null;
  recordCashMovement: (type: 'DROP' | 'PAYOUT', amount: number, reason: string) => void;

  // Treasury & Wallets
  treasury: TreasurySummary;
  recordWalletTransfer: (from: string, to: string, amount: number, note: string) => void;

  // Stock Movement Audit Log
  stockMovements: StockMovement[];

  // Dynamic Real-time Calculations
  getDashboardSummary: () => DashboardSummary;
}

const LOCAL_STORAGE_KEY = 'tradedesk_desktop_clean_store';

// Load persisted user data if available
const loadPersistedState = () => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Failed to read persisted state:', err);
  }
  return null;
};

const persisted = loadPersistedState();

export const useDesktopStore = create<DesktopStoreState>((set, get) => {
  const persistState = () => {
    try {
      const state = get();
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({
          profile: state.profile,
          products: state.products,
          categories: state.categories,
          customers: state.customers,
          suppliers: state.suppliers,
          expenses: state.expenses,
          sales: state.sales,
          currentShift: state.currentShift,
          dailyShifts: state.dailyShifts,
          treasury: state.treasury,
          stockMovements: state.stockMovements,
          cloudUser: state.cloudUser,
          cloudBusiness: state.cloudBusiness,
          cloudToken: state.cloudToken,
          lastSyncedAt: state.lastSyncedAt,
        })
      );
    } catch (e) {
      // ignore
    }
  };

  return {
    activeTab: 'pos',
    setActiveTab: (tab) => set({ activeTab: tab }),
    moreSubTab: 'SETTINGS',
    setMoreSubTab: (sub) => set({ moreSubTab: sub }),

    profile: persisted?.profile || {
      id: 1,
      uuid: 'prof-local',
      shop_name: 'TradeDesk POS',
      owner_name: '',
      phone: '',
      address: '',
      currency: 'UGX',
      business_type: 'Retail & Wholesale',
      receipt_footer: 'Thank you for shopping with us! Goods once sold are not returnable.',
      pin_code: null,
      mtn_merchant_code: '',
      airtel_merchant_code: '',
      cloud_email: null,
      cloud_token: null,
      onboarded: 1,
      updated_at: new Date().toISOString(),
    },
    updateProfile: (partial) => {
      set((state) => ({ profile: { ...state.profile, ...partial } }));
      persistState();
    },

    cloudUser: persisted?.cloudUser || null,
    cloudBusiness: persisted?.cloudBusiness || null,
    cloudToken: persisted?.cloudToken || null,
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSyncedAt: persisted?.lastSyncedAt || null,
    setOnlineStatus: (status) => set({ isOnline: status }),
    setCloudAuth: (user, biz, token = null) => {
      set({ cloudUser: user, cloudBusiness: biz, cloudToken: token });
      if (token) {
        setCloudApiConfig(undefined, token);
      }
      persistState();
    },

    syncWithCloud: async () => {
      set({ isSyncing: true });
      try {
        const state = get();
        if (!state.cloudUser && !state.profile.cloud_token) {
          set({ isSyncing: false });
          return {
            success: false,
            message: 'Please login to TradeDesk Cloud in Settings to sync your store.',
          };
        }
        // Direct backup/sync with cloud
        await get().uploadBackupToCloud();
        await get().syncLiveMoMoBalance();
        const now = new Date().toISOString();
        set({ isSyncing: false, lastSyncedAt: now });
        persistState();
        return {
          success: true,
          message: `Synced with cloud successfully at ${new Date().toLocaleTimeString()}!`,
        };
      } catch (err: any) {
        set({ isSyncing: false });
        return {
          success: false,
          message: err?.message || 'Sync failed. Please check internet connection.',
        };
      }
    },

    uploadBackupToCloud: async () => {
      const state = get();
      const snapshot = {
        app: 'TradeDesk Desktop',
        version: '1.0.0',
        exported_at: new Date().toISOString(),
        business_profile: state.profile,
        categories: state.categories,
        products: state.products,
        stock_movements: state.stockMovements,
        customers: state.customers,
        sales: state.sales,
        expenses: state.expenses,
        suppliers: state.suppliers,
        daily_shifts: state.dailyShifts,
      };

      const res = await cloudApi.uploadCloudBackup(snapshot, {
        products_count: state.products.length,
        sales_count: state.sales.length,
        expenses_count: state.expenses.length,
        customers_count: state.customers.length,
      });

      return { success: true, message: res.message || 'Cloud backup uploaded successfully.' };
    },

    restoreFromCloudBackup: async () => {
      set({ isSyncing: true });
      try {
        const res = await cloudApi.downloadCloudBackup();
        if (!res || !res.backup || !res.backup.snapshot) {
          set({ isSyncing: false });
          return { success: false, message: 'No cloud backup snapshot found for this account.' };
        }

        const snap = res.backup.snapshot;
        set({
          isSyncing: false,
          lastSyncedAt: res.backup.created_at || new Date().toISOString(),
          profile: snap.business_profile || get().profile,
          categories: snap.categories || [],
          products: snap.products || [],
          customers: snap.customers || [],
          suppliers: snap.suppliers || [],
          expenses: snap.expenses || [],
          sales: snap.sales || [],
          stockMovements: snap.stock_movements || [],
          dailyShifts: snap.daily_shifts || [],
          currentShift: null,
        });

        persistState();
        return {
          success: true,
          message: `Restored ${snap.products?.length || 0} products, ${snap.customers?.length || 0} customers, and ${snap.sales?.length || 0} sales from TradeDesk Cloud!`,
        };
      } catch (err: any) {
        set({ isSyncing: false });
        return {
          success: false,
          message: err?.message || 'Cloud restore failed. Please verify credentials.',
        };
      }
    },

    syncLiveMoMoBalance: async () => {
      const state = get();
      const bizId = state.cloudBusiness?.id || 1;
      try {
        const res: any = await cloudApi.getCloudMomoBalance(bizId);
        if (res && (res.status === 'success' || res.current_balance !== undefined)) {
          const liveBal = Number(res.current_balance ?? res.data?.current_balance ?? 0);
          set((s) => ({
            treasury: {
              ...s.treasury,
              momoBalance: liveBal,
              totalLiquidCash: s.treasury.cashBalance + liveBal + s.treasury.bankBalance,
            },
          }));
          persistState();
        }
      } catch (err) {
        // silent fail on offline
      }
    },

    // 100% Real, Clean state — NO dummy data
    products: persisted?.products || [],
    categories: persisted?.categories || [],
    searchQuery: '',
    setSearchQuery: (query) => set({ searchQuery: query }),
    selectedCategory: 'ALL',
    setSelectedCategory: (cat) => set({ selectedCategory: cat }),

    addOrUpdateProduct: (productData) => {
      set((state) => {
        let updated: Product[];
        if (productData.id) {
          updated = state.products.map((p) =>
            p.id === productData.id ? ({ ...p, ...productData, updated_at: new Date().toISOString() } as Product) : p
          );
        } else {
          const newId = Math.max(0, ...state.products.map((p) => p.id)) + 1;
          const newProd: Product = {
            id: newId,
            uuid: `prod_${newId}_${Date.now()}`,
            name: productData.name,
            sku: productData.sku || `SKU-${newId.toString().padStart(4, '0')}`,
            barcode: productData.barcode || `${Date.now().toString().slice(-8)}${newId}`,
            category_id: productData.category_id || null,
            unit: productData.unit || 'Pcs',
            cost_price: Number(productData.cost_price || 0),
            selling_price: Number(productData.selling_price || 0),
            wholesale_price: Number(productData.wholesale_price || productData.selling_price || 0),
            pack_name: productData.pack_name || '',
            pack_size: Number(productData.pack_size || 1),
            pack_price: Number(productData.pack_price || 0),
            stock_quantity: Number(productData.stock_quantity ?? 0),
            current_stock: Number(productData.stock_quantity ?? 0),
            low_stock_threshold: Number(productData.low_stock_threshold ?? 5),
            min_stock_alert: Number(productData.low_stock_threshold ?? 5),
            brand: productData.brand || '',
            is_active: 1,
            is_deleted: 0,
            sync_status: 'synced',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          updated = [newProd, ...state.products];
        }
        return { products: updated };
      });
      persistState();
    },

    deleteProduct: (id) => {
      set((state) => ({ products: state.products.filter((p) => p.id !== id) }));
      persistState();
    },

    adjustStock: (productId, qtyDelta, reason, type) => {
      set((state) => {
        const prod = state.products.find((p) => p.id === productId);
        if (!prod) return state;
        const previousStock = prod.stock_quantity;
        const newStock = Math.max(0, previousStock + qtyDelta);
        const updatedProducts = state.products.map((p) =>
          p.id === productId ? { ...p, stock_quantity: newStock, current_stock: newStock } : p
        );
        const newMovement: StockMovement = {
          id: Date.now(),
          uuid: `sm_${Date.now()}`,
          product_id: productId,
          product_name: prod.name,
          type,
          quantity: Math.abs(qtyDelta),
          previous_stock: previousStock,
          new_stock: newStock,
          unit_cost: prod.cost_price,
          note: reason,
          created_at: new Date().toISOString(),
          sync_status: 'synced',
        };
        return { products: updatedProducts, stockMovements: [newMovement, ...state.stockMovements] };
      });
      persistState();
    },

    breakBulk: (sourceProductId, packCount, unitsPerPack) => {
      set((state) => {
        const prod = state.products.find((p) => p.id === sourceProductId);
        if (!prod) return state;
        const looseUnitsAdded = packCount * unitsPerPack;
        const newStock = Math.max(0, prod.stock_quantity + looseUnitsAdded);
        const updatedProducts = state.products.map((p) =>
          p.id === sourceProductId ? { ...p, stock_quantity: newStock, current_stock: newStock } : p
        );
        const newMovement: StockMovement = {
          id: Date.now(),
          uuid: `sm_bb_${Date.now()}`,
          product_id: sourceProductId,
          product_name: prod.name,
          type: 'BREAK_BULK',
          quantity: looseUnitsAdded,
          previous_stock: prod.stock_quantity,
          new_stock: newStock,
          unit_cost: prod.cost_price,
          note: `Broke ${packCount} carton(s) into ${looseUnitsAdded} individual retail units`,
          created_at: new Date().toISOString(),
          sync_status: 'synced',
        };
        return { products: updatedProducts, stockMovements: [newMovement, ...state.stockMovements] };
      });
      persistState();
    },

    addCategory: (name, color = '#0B4FB8') => {
      set((state) => {
        const newId = Math.max(0, ...state.categories.map((c) => c.id)) + 1;
        const newCat: Category = {
          id: newId,
          uuid: `cat_${newId}_${Date.now()}`,
          name,
          color,
          updated_at: new Date().toISOString(),
          sync_status: 'synced',
        };
        return { categories: [...state.categories, newCat] };
      });
      persistState();
    },

    deleteCategory: (id) => {
      set((state) => ({ categories: state.categories.filter((c) => c.id !== id) }));
      persistState();
    },

    clearAllShopData: () => {
      set({
        products: [],
        categories: [],
        cart: [],
        parkedCarts: [],
        sales: [],
        customers: [],
        suppliers: [],
        expenses: [],
        currentShift: null,
        dailyShifts: [],
        stockMovements: [],
        treasury: {
          cashBalance: 0,
          momoBalance: 0,
          mtnMomoBalance: 0,
          airtelMoneyBalance: 0,
          bankBalance: 0,
          totalLiquidCash: 0,
        },
      });
      persistState();
    },

    cart: [],
    parkedCarts: [],
    addToCart: (product, isWholesale = false) => {
      set((state) => {
        const price = isWholesale ? (product.wholesale_price || product.selling_price) : product.selling_price;
        const existing = state.cart.find((i) => i.product.id === product.id && i.isWholesale === isWholesale);
        if (existing) {
          return {
            cart: state.cart.map((i) =>
              i.product.id === product.id && i.isWholesale === isWholesale
                ? { ...i, quantity: i.quantity + 1 }
                : i
            ),
          };
        }
        return {
          cart: [...state.cart, { product, quantity: 1, price, isWholesale }],
        };
      });
    },

    removeFromCart: (productId) => {
      set((state) => ({ cart: state.cart.filter((i) => i.product.id !== productId) }));
    },

    updateCartQty: (productId, qty) => {
      set((state) => {
        if (qty <= 0) {
          return { cart: state.cart.filter((i) => i.product.id !== productId) };
        }
        return {
          cart: state.cart.map((i) => (i.product.id === productId ? { ...i, quantity: qty } : i)),
        };
      });
    },

    clearCart: () => set({ cart: [] }),

    parkCart: (name) => {
      set((state) => {
        if (state.cart.length === 0) return state;
        const newPark: ParkedCart = {
          id: `park_${Date.now()}`,
          name: name || `Parked #${state.parkedCarts.length + 1} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
          items: state.cart,
          created_at: new Date().toISOString(),
        };
        return { parkedCarts: [newPark, ...state.parkedCarts], cart: [] };
      });
    },

    restoreParkedCart: (id) => {
      set((state) => {
        const park = state.parkedCarts.find((p) => p.id === id);
        if (!park) return state;
        return {
          cart: park.items,
          parkedCarts: state.parkedCarts.filter((p) => p.id !== id),
        };
      });
    },

    deleteParkedCart: (id) => {
      set((state) => ({ parkedCarts: state.parkedCarts.filter((p) => p.id !== id) }));
    },

    checkoutSale: ({ paymentMethod, amountPaid, customerId, customerPhone, notes }) => {
      const state = get();
      const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const totalProfit = state.cart.reduce(
        (sum, item) => sum + (item.price - item.product.cost_price) * item.quantity,
        0
      );
      const isDebt = paymentMethod === 'CREDIT';
      const balanceDue = isDebt ? Math.max(0, subtotal - amountPaid) : 0;
      const changeAmount = isDebt ? 0 : Math.max(0, amountPaid - subtotal);
      const receiptNo = `REC-${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${(state.sales.length + 101).toString()}`;

      const cust = customerId ? state.customers.find((c) => c.id === customerId) : null;

      const newSale: Sale = {
        id: state.sales.length + 1,
        uuid: `sale_${Date.now()}`,
        receipt_number: receiptNo,
        customer_id: customerId || null,
        customer_name: cust ? cust.name : (customerPhone ? `Customer (${customerPhone})` : 'Walk-in Customer'),
        customer_phone: customerPhone || cust?.phone || '',
        subtotal,
        discount: 0,
        total_amount: subtotal,
        amount_paid: amountPaid,
        balance_due: balanceDue,
        change_amount: changeAmount,
        total_profit: totalProfit,
        payment_method: paymentMethod,
        payment_status: isDebt ? (balanceDue === 0 ? 'PAID' : 'CREDIT') : 'PAID',
        momo_phone: customerPhone || '',
        momo_ref: '',
        notes: notes || '',
        items: state.cart.map((item, idx) => ({
          id: idx + 1,
          uuid: `item_${Date.now()}_${idx}`,
          sale_id: state.sales.length + 1,
          product_id: item.product.id,
          product_name: item.product.name,
          unit: item.product.unit,
          quantity: item.quantity,
          cost_price: item.product.cost_price,
          unit_price: item.price,
          discount: 0,
          subtotal: item.price * item.quantity,
          profit: (item.price - item.product.cost_price) * item.quantity,
        })),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'synced',
      };

      // Deduct inventory
      const updatedProducts = state.products.map((p) => {
        const cartItem = state.cart.find((c) => c.product.id === p.id);
        if (cartItem) {
          const nextStock = Math.max(0, p.stock_quantity - cartItem.quantity);
          return { ...p, stock_quantity: nextStock, current_stock: nextStock };
        }
        return p;
      });

      // Update customer debt
      let updatedCustomers = state.customers;
      if (customerId && isDebt && balanceDue > 0) {
        updatedCustomers = state.customers.map((c) =>
          c.id === customerId
            ? {
                ...c,
                total_debt: c.total_debt + balanceDue,
                total_spent: c.total_spent + subtotal,
                last_purchase_at: new Date().toISOString(),
              }
            : c
        );
      }

      // Update current shift cash / momo counts
      let updatedShift = state.currentShift;
      if (updatedShift && updatedShift.status === 'OPEN') {
        if (paymentMethod === 'CASH') {
          updatedShift = {
            ...updatedShift,
            cash_sales: updatedShift.cash_sales + (subtotal - changeAmount),
            expected_cash: updatedShift.expected_cash + (subtotal - changeAmount),
          };
        } else if (paymentMethod === 'MTN_MOMO' || paymentMethod === 'AIRTEL_MONEY') {
          updatedShift = {
            ...updatedShift,
            momo_sales: updatedShift.momo_sales + subtotal,
          };
        } else if (paymentMethod === 'CREDIT') {
          updatedShift = {
            ...updatedShift,
            credit_sales: updatedShift.credit_sales + balanceDue,
            cash_sales: updatedShift.cash_sales + amountPaid,
            expected_cash: updatedShift.expected_cash + amountPaid,
          };
        }
      }

      set({
        sales: [newSale, ...state.sales],
        products: updatedProducts,
        customers: updatedCustomers,
        currentShift: updatedShift,
        activeReceiptSale: newSale,
        cart: [],
      });

      persistState();
      return newSale;
    },

    sales: persisted?.sales || [],
    activeReceiptSale: null,
    setActiveReceiptSale: (sale) => set({ activeReceiptSale: sale }),

    customers: persisted?.customers || [],
    addOrUpdateCustomer: (custData) => {
      set((state) => {
        let updated: Customer[];
        if (custData.id) {
          updated = state.customers.map((c) =>
            c.id === custData.id ? ({ ...c, ...custData, updated_at: new Date().toISOString() } as Customer) : c
          );
        } else {
          const newId = Math.max(0, ...state.customers.map((c) => c.id)) + 1;
          const newCust: Customer = {
            id: newId,
            uuid: `cust_${newId}_${Date.now()}`,
            name: custData.name,
            phone: custData.phone,
            address: custData.address || '',
            notes: custData.notes || '',
            total_debt: Number(custData.total_debt || 0),
            total_spent: 0,
            last_purchase_at: null,
            is_deleted: 0,
            sync_status: 'synced',
            updated_at: new Date().toISOString(),
          };
          updated = [newCust, ...state.customers];
        }
        return { customers: updated };
      });
      persistState();
    },

    recordDebtPayment: (customerId, amount, method, note) => {
      set((state) => {
        const cust = state.customers.find((c) => c.id === customerId);
        if (!cust) return state;
        const newDebt = Math.max(0, cust.total_debt - amount);
        const updatedCustomers = state.customers.map((c) =>
          c.id === customerId ? { ...c, total_debt: newDebt, updated_at: new Date().toISOString() } : c
        );

        let updatedShift = state.currentShift;
        if (updatedShift && updatedShift.status === 'OPEN' && method === 'CASH') {
          updatedShift = {
            ...updatedShift,
            debt_collected_cash: updatedShift.debt_collected_cash + amount,
            expected_cash: updatedShift.expected_cash + amount,
          };
        }

        return { customers: updatedCustomers, currentShift: updatedShift };
      });
      persistState();
    },

    expenses: persisted?.expenses || [],
    addExpense: (category, amount, note) => {
      set((state) => {
        const newId = Math.max(0, ...state.expenses.map((e) => e.id)) + 1;
        const newExp: Expense = {
          id: newId,
          uuid: `exp_${newId}_${Date.now()}`,
          title: note || category,
          category,
          amount,
          payment_method: 'CASH',
          note,
          expense_date: new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString(),
          sync_status: 'synced',
        };
        let updatedShift = state.currentShift;
        if (updatedShift && updatedShift.status === 'OPEN') {
          updatedShift = {
            ...updatedShift,
            expenses_cash: updatedShift.expenses_cash + amount,
            cash_out_payouts: updatedShift.cash_out_payouts + amount,
            expected_cash: Math.max(0, updatedShift.expected_cash - amount),
          };
        }
        return { expenses: [newExp, ...state.expenses], currentShift: updatedShift };
      });
      persistState();
    },

    deleteExpense: (id) => {
      set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) }));
      persistState();
    },

    suppliers: persisted?.suppliers || [],
    addOrUpdateSupplier: (supData) => {
      set((state) => {
        let updated: Supplier[];
        if (supData.id) {
          updated = state.suppliers.map((s) =>
            s.id === supData.id ? ({ ...s, ...supData, updated_at: new Date().toISOString() } as Supplier) : s
          );
        } else {
          const newId = Math.max(0, ...state.suppliers.map((s) => s.id)) + 1;
          const newSup: Supplier = {
            id: newId,
            uuid: `sup_${newId}_${Date.now()}`,
            name: supData.name,
            phone: supData.phone,
            products_supplied: supData.products_supplied || '',
            address: supData.address || '',
            balance_owed: Number(supData.balance_owed || 0),
            updated_at: new Date().toISOString(),
          };
          updated = [newSup, ...state.suppliers];
        }
        return { suppliers: updated };
      });
      persistState();
    },

    recordGRN: (supplierId, productId, qty, unitCost, amountPaid, method) => {
      set((state) => {
        const sup = state.suppliers.find((s) => s.id === supplierId);
        const prod = state.products.find((p) => p.id === productId);
        if (!sup || !prod) return state;
        const totalCost = qty * unitCost;
        const balanceDue = Math.max(0, totalCost - amountPaid);

        const updatedSuppliers = state.suppliers.map((s) =>
          s.id === supplierId ? { ...s, balance_owed: s.balance_owed + balanceDue } : s
        );

        const updatedProducts = state.products.map((p) =>
          p.id === productId
            ? { ...p, stock_quantity: p.stock_quantity + qty, current_stock: p.stock_quantity + qty, cost_price: unitCost }
            : p
        );

        const newMovement: StockMovement = {
          id: Date.now(),
          uuid: `sm_grn_${Date.now()}`,
          product_id: productId,
          product_name: prod.name,
          type: 'SUPPLIER_GRN',
          quantity: qty,
          previous_stock: prod.stock_quantity,
          new_stock: prod.stock_quantity + qty,
          unit_cost: unitCost,
          note: `Received from ${sup.name}. Total: UGX ${totalCost.toLocaleString()}`,
          created_at: new Date().toISOString(),
          sync_status: 'synced',
        };

        return {
          suppliers: updatedSuppliers,
          products: updatedProducts,
          stockMovements: [newMovement, ...state.stockMovements],
        };
      });
      persistState();
    },

    recordSupplierPayment: (supplierId, amount, method, note) => {
      set((state) => {
        const sup = state.suppliers.find((s) => s.id === supplierId);
        if (!sup) return state;
        const newBalance = Math.max(0, sup.balance_owed - amount);
        const updatedSuppliers = state.suppliers.map((s) =>
          s.id === supplierId ? { ...s, balance_owed: newBalance } : s
        );
        return { suppliers: updatedSuppliers };
      });
      persistState();
    },

    currentShift: persisted?.currentShift || null,
    dailyShifts: persisted?.dailyShifts || [],

    openShift: (openingFloat, notes) => {
      set((state) => {
        const newShift: DailyShift = {
          id: Date.now(),
          uuid: `shift_${Date.now()}`,
          shift_date: new Date().toISOString().split('T')[0],
          opened_at: new Date().toISOString(),
          closed_at: null,
          opening_float: openingFloat,
          cash_sales: 0,
          momo_sales: 0,
          merchant_sales: 0,
          credit_sales: 0,
          debt_collected_cash: 0,
          cash_in_drops: 0,
          cash_out_payouts: 0,
          expenses_cash: 0,
          expected_cash: openingFloat,
          actual_counted_cash: null,
          variance: null,
          notes: notes || 'Register Morning Shift',
          status: 'OPEN',
        };
        return { currentShift: newShift, dailyShifts: [newShift, ...state.dailyShifts] };
      });
      persistState();
    },

    closeShift: (countedCash, notes) => {
      const state = get();
      const cur = state.currentShift;
      if (!cur) return null;
      const variance = countedCash - cur.expected_cash;
      const closedShift: DailyShift = {
        ...cur,
        closed_at: new Date().toISOString(),
        actual_counted_cash: countedCash,
        variance,
        notes: notes || cur.notes,
        status: 'CLOSED',
      };
      set({
        currentShift: null,
        dailyShifts: state.dailyShifts.map((s) => (s.id === cur.id ? closedShift : s)),
      });
      persistState();
      return closedShift;
    },

    recordCashMovement: (type, amount, reason) => {
      set((state) => {
        const shift = state.currentShift;
        if (!shift || shift.status !== 'OPEN') return state;
        let updatedShift: DailyShift;
        if (type === 'DROP') {
          updatedShift = {
            ...shift,
            cash_in_drops: shift.cash_in_drops + amount,
            expected_cash: shift.expected_cash + amount,
          };
        } else {
          updatedShift = {
            ...shift,
            cash_out_payouts: shift.cash_out_payouts + amount,
            expected_cash: Math.max(0, shift.expected_cash - amount),
          };
        }
        return { currentShift: updatedShift };
      });
      persistState();
    },

    treasury: persisted?.treasury || {
      cashBalance: 0,
      momoBalance: 0,
      mtnMomoBalance: 0,
      airtelMoneyBalance: 0,
      bankBalance: 0,
      totalLiquidCash: 0,
    },

    recordWalletTransfer: (from, to, amount, note) => {
      set((state) => {
        const cur = { ...state.treasury };
        if (from === 'CASH') cur.cashBalance = Math.max(0, cur.cashBalance - amount);
        if (from === 'MOMO') cur.momoBalance = Math.max(0, cur.momoBalance - amount);
        if (from === 'BANK') cur.bankBalance = Math.max(0, cur.bankBalance - amount);

        if (to === 'CASH') cur.cashBalance += amount;
        if (to === 'MOMO') cur.momoBalance += amount;
        if (to === 'BANK') cur.bankBalance += amount;

        cur.totalLiquidCash = cur.cashBalance + cur.momoBalance + cur.bankBalance;
        return { treasury: cur };
      });
      persistState();
    },

    stockMovements: persisted?.stockMovements || [],

    getDashboardSummary: () => {
      const state = get();
      const today = new Date().toISOString().split('T')[0];
      const todaySalesList = state.sales.filter((s) => s.created_at.startsWith(today));
      const todaySales = todaySalesList.reduce((sum, s) => sum + s.total_amount, 0);
      const todayGrossProfit = todaySalesList.reduce((sum, s) => sum + s.total_profit, 0);

      const todayCashSales = todaySalesList
        .filter((s) => s.payment_method === 'CASH')
        .reduce((sum, s) => sum + s.total_amount, 0);
      const todayMomoSales = todaySalesList
        .filter((s) => s.payment_method === 'MTN_MOMO' || s.payment_method === 'AIRTEL_MONEY')
        .reduce((sum, s) => sum + s.total_amount, 0);
      const todayCreditSales = todaySalesList
        .filter((s) => s.payment_method === 'CREDIT')
        .reduce((sum, s) => sum + s.balance_due, 0);

      const todayExpensesList = state.expenses.filter((e) => e.expense_date === today);
      const todayExpenses = todayExpensesList.reduce((sum, e) => sum + e.amount, 0);

      const totalStockCostValue = state.products.reduce((sum, p) => sum + p.cost_price * p.stock_quantity, 0);
      const totalStockRetailValue = state.products.reduce((sum, p) => sum + p.selling_price * p.stock_quantity, 0);
      const lowStockCount = state.products.filter((p) => p.stock_quantity <= p.low_stock_threshold).length;
      const totalCustomerDebt = state.customers.reduce((sum, c) => sum + c.total_debt, 0);
      const totalSupplierPayables = state.suppliers.reduce((sum, s) => sum + s.balance_owed, 0);

      return {
        todaySales,
        todaySalesCount: todaySalesList.length,
        todayTransactions: todaySalesList.length,
        todayGrossProfit,
        todayExpenses,
        todayNetProfit: todayGrossProfit - todayExpenses,
        todayCashSales,
        todayMomoSales,
        todayMerchantSales: 0,
        todayCreditSales,
        todayItemsSold: todaySalesList.reduce(
          (sum, s) => sum + (s.items?.reduce((isum, item) => isum + item.quantity, 0) || 0),
          0
        ),
        todayDebtCollected: state.currentShift?.debt_collected_cash || 0,
        totalStockCostValue,
        totalStockRetailValue,
        totalProducts: state.products.length,
        lowStockCount,
        outOfStockCount: state.products.filter((p) => p.stock_quantity <= 0).length,
        expiringSoonCount: 0,
        expiredCount: 0,
        totalCustomerDebt,
        debtorsCount: state.customers.filter((c) => c.total_debt > 0).length,
        totalSupplierPayables,
      };
    },
  };
});
