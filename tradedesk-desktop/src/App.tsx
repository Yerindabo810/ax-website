import React, { useState, useEffect } from 'react';
import { useDesktopStore, MoreTabKey } from './store/useDesktopStore';
import {
  ShoppingCart,
  Package,
  Layers,
  Users,
  CreditCard,
  History,
  Settings,
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  Wifi,
  WifiOff,
  CheckCircle,
  Smartphone,
  Banknote,
  DollarSign,
  AlertCircle,
  Barcode,
  Cloud,
  CloudDownload,
  CloudUpload,
  RefreshCw,
  TrendingUp,
  FileText,
  ShieldCheck,
  Send,
  Zap,
  Building,
  ArrowRightLeft,
  Calendar,
  X,
  Phone,
  MessageCircle,
} from 'lucide-react';
import { cloudApi } from './services/cloudApi';
import { Product, Sale, Customer, Supplier, Expense } from './types';

export default function App() {
  const store = useDesktopStore();
  const {
    activeTab,
    setActiveTab,
    moreSubTab,
    setMoreSubTab,
    products,
    categories,
    cart,
    addToCart,
    removeFromCart,
    updateCartQty,
    clearCart,
    parkCart,
    parkedCarts,
    restoreParkedCart,
    deleteParkedCart,
    checkoutSale,
    profile,
    updateProfile,
    isOnline,
    isSyncing,
    lastSyncedAt,
    syncWithCloud,
    restoreFromCloudBackup,
    uploadBackupToCloud,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    sales,
    activeReceiptSale,
    setActiveReceiptSale,
    customers,
    addOrUpdateCustomer,
    recordDebtPayment,
    expenses,
    addExpense,
    deleteExpense,
    suppliers,
    addOrUpdateSupplier,
    recordGRN,
    recordSupplierPayment,
    currentShift,
    openShift,
    closeShift,
    recordCashMovement,
    treasury,
    recordWalletTransfer,
    stockMovements,
    getDashboardSummary,
    addOrUpdateProduct,
    deleteProduct,
    adjustStock,
    breakBulk,
    cloudUser,
    setCloudAuth,
  } = store;

  const summary = getDashboardSummary();

  // POS State
  const [wholesaleMode, setWholesaleMode] = useState(false);
  const [checkoutModal, setCheckoutModal] = useState(false);
  const [paymentType, setPaymentType] = useState<'CASH' | 'MTN_MOMO' | 'AIRTEL_MONEY' | 'CREDIT'>('CASH');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [cashTendered, setCashTendered] = useState('');
  const [checkoutSuccessSale, setCheckoutSuccessSale] = useState<Sale | null>(null);

  // Modals
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Partial<Customer> | null>(null);

  const [debtPayModalOpen, setDebtPayModalOpen] = useState(false);
  const [activeDebtCustomer, setActiveDebtCustomer] = useState<Customer | null>(null);
  const [debtPayAmount, setDebtPayAmount] = useState('');
  const [debtPayMethod, setDebtPayMethod] = useState<'CASH' | 'MTN_MOMO' | 'AIRTEL_MONEY'>('CASH');

  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState('General Shop Expense');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNote, setExpenseNote] = useState('');

  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [shiftFloatInput, setShiftFloatInput] = useState('');
  const [shiftCountedInput, setShiftCountedInput] = useState('');

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferFrom, setTransferFrom] = useState('CASH');
  const [transferTo, setTransferTo] = useState('MOMO');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');

  const [grnModalOpen, setGrnModalOpen] = useState(false);
  const [grnSupplierId, setGrnSupplierId] = useState<number | ''>('');
  const [grnProductId, setGrnProductId] = useState<number | ''>('');
  const [grnQty, setGrnQty] = useState('');
  const [grnUnitCost, setGrnUnitCost] = useState('');
  const [grnAmountPaid, setGrnAmountPaid] = useState('');

  // Cloud Login Modal
  const [cloudAuthModalOpen, setCloudAuthModalOpen] = useState(false);
  const [cloudEmail, setCloudEmail] = useState(profile.cloud_email || '');
  const [cloudPassword, setCloudPassword] = useState('');
  const [cloudOtp, setCloudOtp] = useState('');
  const [cloudStep, setCloudStep] = useState<'LOGIN' | 'OTP'>('LOGIN');
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState('');

  // VAS State (Airtime & Bills with Email OTP)
  const [vasType, setVasType] = useState<'AIRTIME' | 'BILLS'>('AIRTIME');
  const [vasNetwork, setVasNetwork] = useState<'MTN' | 'AIRTEL' | 'UMEME' | 'NWSC'>('MTN');
  const [vasTargetNumber, setVasTargetNumber] = useState('');
  const [vasAmount, setVasAmount] = useState('');
  const [vasOtpModalOpen, setVasOtpModalOpen] = useState(false);
  const [vasOtpCode, setVasOtpCode] = useState('');
  const [vasLoading, setVasLoading] = useState(false);
  const [vasMessage, setVasMessage] = useState('');

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filter products by search and category
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat = selectedCategory === 'ALL' || String(p.category_id) === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const changeDue = Math.max(0, Number(cashTendered || 0) - cartSubtotal);

  // Complete POS Sale
  const handleCompleteSale = () => {
    if (cart.length === 0) return;
    const sale = checkoutSale({
      paymentMethod: paymentType,
      amountPaid: paymentType === 'CASH' ? Number(cashTendered || cartSubtotal) : cartSubtotal,
      customerId: paymentType === 'CREDIT' ? selectedCustomerId : null,
      customerPhone,
      notes: paymentType === 'CREDIT' ? 'Assigned to Customer Debt Ledger' : '',
    });
    setCheckoutSuccessSale(sale);
    setTimeout(() => {
      setCheckoutModal(false);
      setCheckoutSuccessSale(null);
      setCashTendered('');
      setCustomerPhone('');
      setSelectedCustomerId(null);
      showToast(`Sale #${sale.receipt_number} recorded successfully!`);
    }, 1500);
  };

  // Handle Cloud Login
  const handleCloudLogin = async () => {
    setCloudLoading(true);
    setCloudError('');
    try {
      const res: any = await cloudApi.portalLogin(cloudEmail.trim(), cloudPassword);
      if (res.two_factor_required) {
        setCloudStep('OTP');
        showToast('6-digit security code sent to your email.');
      } else if (res.token) {
        setCloudAuth(res.user, res.business, res.token);
        updateProfile({ cloud_email: cloudEmail.trim(), cloud_token: res.token });
        setCloudAuthModalOpen(false);
        showToast('Logged in to TradeDesk Cloud successfully!');
      } else {
        throw new Error(res.message || 'Login failed');
      }
    } catch (err: any) {
      setCloudError(err?.message || 'Login failed. Check your email and password.');
    } finally {
      setCloudLoading(false);
    }
  };

  const handleCloudVerifyOtp = async () => {
    setCloudLoading(true);
    setCloudError('');
    try {
      const res: any = await cloudApi.verifyLoginOtp(cloudEmail.trim(), cloudOtp.trim());
      if (res.token) {
        setCloudAuth(res.user, res.business, res.token);
        updateProfile({ cloud_email: cloudEmail.trim(), cloud_token: res.token });
        setCloudAuthModalOpen(false);
        showToast('TradeDesk Cloud connected!');
      } else {
        throw new Error(res.message || 'Verification failed');
      }
    } catch (err: any) {
      setCloudError(err?.message || 'Invalid or expired OTP code.');
    } finally {
      setCloudLoading(false);
    }
  };

  // VAS Request OTP
  const handleVasRequestOtp = async () => {
    if (!vasTargetNumber || !vasAmount) {
      alert('Please enter both number/meter and amount.');
      return;
    }
    setVasLoading(true);
    try {
      const res = await cloudApi.sendPaymentOtp({
        business_id: store.cloudBusiness?.id || 1,
        action_type: vasType === 'AIRTIME' ? 'airtime' : 'bill_payment',
        amount: Number(vasAmount),
        details: vasTargetNumber,
      });
      setVasOtpModalOpen(true);
      showToast('OTP authorization code sent to your registered shop email.');
    } catch (err: any) {
      alert(err?.message || 'Failed to send OTP code.');
    } finally {
      setVasLoading(false);
    }
  };

  const handleVasAuthorize = async () => {
    setVasLoading(true);
    try {
      if (vasType === 'AIRTIME') {
        const res = await cloudApi.purchaseAirtimeOrData({
          business_id: store.cloudBusiness?.id || 1,
          purchase_type: 'airtime',
          phone_number: vasTargetNumber,
          amount: Number(vasAmount),
          otp: vasOtpCode.trim(),
        });
        setVasOtpModalOpen(false);
        setVasAmount('');
        setVasTargetNumber('');
        setVasOtpCode('');
        showToast('Airtime purchase approved and dispatched!');
      } else {
        const res = await cloudApi.payBill({
          business_id: store.cloudBusiness?.id || 1,
          utility_code: vasNetwork === 'UMEME' ? 'UMEME_YAKA' : 'NWSC_WATER',
          meter_number: vasTargetNumber,
          phone_number: profile.phone || '0772651444',
          amount: Number(vasAmount),
          otp: vasOtpCode.trim(),
        });
        setVasOtpModalOpen(false);
        setVasAmount('');
        setVasTargetNumber('');
        setVasOtpCode('');
        showToast('Utility bill payment approved and token issued!');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to complete transaction.');
    } finally {
      setVasLoading(false);
    }
  };

  return (
    <div style={styles.appContainer}>
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div style={styles.toast}>
          <CheckCircle size={18} color="#16A34A" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. TOP STATUS BAR */}
      <header style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <div style={styles.brandLogoBox}>
            <span style={{ color: '#FFFFFF', fontWeight: 900, fontSize: 18 }}>TD</span>
          </div>
          <div>
            <div style={styles.brandTitle}>Trade<span style={{ color: '#F26A0E' }}>Desk</span> POS</div>
            <div style={styles.brandSub}>{profile.shop_name} &bull; Standalone Desktop Edition</div>
          </div>
        </div>

        <div style={styles.topBarRight}>
          <button
            style={styles.syncBtn(isSyncing)}
            onClick={async () => {
              const res = await syncWithCloud();
              showToast(res.message);
            }}
            title="Sync with TradeDesk Cloud Backend"
          >
            <RefreshCw size={14} className={isSyncing ? 'spinning' : ''} />
            <span>{isSyncing ? 'Syncing...' : lastSyncedAt ? `Synced ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Sync Now'}</span>
          </button>

          <div style={styles.onlineBadge(isOnline)}>
            {isOnline ? <Wifi size={14} color="#16A34A" /> : <WifiOff size={14} color="#DC2626" />}
            <span>{isOnline ? 'Online (SQLite)' : 'Offline First'}</span>
          </div>

          <div style={styles.shortcutHint}>
            <span>F1: Search</span> &bull; <span>F5: Cash</span> &bull; <span>F9: MoMo</span>
          </div>
        </div>
      </header>

      {/* 2. MAIN LAYOUT: SIDEBAR + CONTENT */}
      <div style={styles.mainLayout}>
        {/* SIDEBAR NAVIGATION MATCHING MOBILE APP */}
        <aside style={styles.sidebar}>
          <button
            style={styles.navButton(activeTab === 'dashboard')}
            onClick={() => setActiveTab('dashboard')}
          >
            <TrendingUp size={20} />
            <span>Dashboard</span>
          </button>
          <button
            style={styles.navButton(activeTab === 'pos')}
            onClick={() => setActiveTab('pos')}
          >
            <ShoppingCart size={20} />
            <span>POS Register</span>
          </button>
          <button
            style={styles.navButton(activeTab === 'inventory')}
            onClick={() => setActiveTab('inventory')}
          >
            <Package size={20} />
            <span>Inventory</span>
          </button>
          <button
            style={styles.navButton(activeTab === 'debts')}
            onClick={() => setActiveTab('debts')}
          >
            <Users size={20} />
            <span>Customer Debts</span>
          </button>
          <button
            style={styles.navButton(activeTab === 'more')}
            onClick={() => setActiveTab('more')}
          >
            <Layers size={20} />
            <span>More Modules</span>
          </button>
        </aside>

        {/* WORKSPACE AREA */}
        <main style={styles.contentArea}>
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div style={styles.scrollPage}>
              <div style={styles.pageHeaderRow}>
                <div>
                  <h1 style={styles.pageTitle}>Shop Analytics &amp; Daily Overview</h1>
                  <p style={styles.pageSubtitle}>Live sales, profit metrics, and register cash flow</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    style={styles.primaryActionBtn}
                    onClick={() => setShiftModalOpen(true)}
                  >
                    <History size={16} />
                    <span>{currentShift && currentShift.status === 'OPEN' ? 'Close Register (Z-Report)' : 'Open Morning Register'}</span>
                  </button>
                </div>
              </div>

              {/* KPI Cards Grid */}
              <div style={styles.kpiGrid}>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>Today's Total Sales</div>
                  <div style={styles.kpiValue}>UGX {summary.todaySales.toLocaleString()}</div>
                  <div style={styles.kpiMeta}>{summary.todaySalesCount} completed transaction(s)</div>
                </div>

                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>Gross Profit Today</div>
                  <div style={{ ...styles.kpiValue, color: '#16A34A' }}>UGX {summary.todayGrossProfit.toLocaleString()}</div>
                  <div style={styles.kpiMeta}>From sold inventory margin</div>
                </div>

                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>Today Expenses</div>
                  <div style={{ ...styles.kpiValue, color: '#DC2626' }}>UGX {summary.todayExpenses.toLocaleString()}</div>
                  <div style={styles.kpiMeta}>Paid out of shop register</div>
                </div>

                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>Net Profit Today</div>
                  <div style={{ ...styles.kpiValue, color: summary.todayNetProfit >= 0 ? '#0B4FB8' : '#DC2626' }}>
                    UGX {summary.todayNetProfit.toLocaleString()}
                  </div>
                  <div style={styles.kpiMeta}>Gross Profit &minus; Expenses</div>
                </div>
              </div>

              {/* Payment Split & Register Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 24 }}>
                <div style={styles.cardBox}>
                  <h3 style={styles.cardBoxTitle}>Payment Method Breakdown</h3>
                  <div style={styles.splitRow}>
                    <span>Cash Sales:</span>
                    <strong style={{ color: '#16A34A' }}>UGX {summary.todayCashSales.toLocaleString()}</strong>
                  </div>
                  <div style={styles.splitRow}>
                    <span>Mobile Money (MTN / Airtel):</span>
                    <strong style={{ color: '#0B4FB8' }}>UGX {summary.todayMomoSales.toLocaleString()}</strong>
                  </div>
                  <div style={styles.splitRow}>
                    <span>Customer Credit / Debt:</span>
                    <strong style={{ color: '#D97706' }}>UGX {summary.todayCreditSales.toLocaleString()}</strong>
                  </div>
                  <div style={styles.splitRow}>
                    <span>Debt Recoveries Collected:</span>
                    <strong style={{ color: '#059669' }}>UGX {summary.todayDebtCollected.toLocaleString()}</strong>
                  </div>
                </div>

                <div style={styles.cardBox}>
                  <h3 style={styles.cardBoxTitle}>Register Shift Status</h3>
                  {currentShift && currentShift.status === 'OPEN' ? (
                    <div>
                      <div style={{ display: 'inline-block', background: '#DCFCE7', color: '#15803D', padding: '4px 10px', borderRadius: 999, fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
                        ● Shift Open since {new Date(currentShift.opened_at).toLocaleTimeString()}
                      </div>
                      <div style={styles.splitRow}>
                        <span>Opening Cash Float:</span>
                        <strong>UGX {currentShift.opening_float.toLocaleString()}</strong>
                      </div>
                      <div style={styles.splitRow}>
                        <span>Expected Cash in Till:</span>
                        <strong style={{ color: '#0B4FB8', fontSize: 16 }}>UGX {currentShift.expected_cash.toLocaleString()}</strong>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '20px 0', textAlign: 'center', color: '#64748B' }}>
                      <div>Cash register is currently closed.</div>
                      <button
                        style={{ ...styles.primaryActionBtn, marginTop: 12 }}
                        onClick={() => setShiftModalOpen(true)}
                      >
                        Open Today's Register Float
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Sales Table */}
              <div style={{ ...styles.cardBox, marginTop: 24 }}>
                <h3 style={styles.cardBoxTitle}>Recent Completed Sales</h3>
                {sales.length === 0 ? (
                  <div style={{ padding: 30, textAlign: 'center', color: '#94A3B8' }}>
                    No sales recorded yet. Open POS Register to process your first checkout!
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>Receipt #</th>
                          <th>Time</th>
                          <th>Customer</th>
                          <th>Payment Method</th>
                          <th>Items</th>
                          <th>Total Amount</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sales.slice(0, 10).map((s) => (
                          <tr key={s.id}>
                            <td><strong>{s.receipt_number}</strong></td>
                            <td>{new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td>{s.customer_name}</td>
                            <td>
                              <span style={styles.payBadge(s.payment_method)}>{s.payment_method}</span>
                            </td>
                            <td>{s.items?.length || 0} line(s)</td>
                            <td><strong>UGX {s.total_amount.toLocaleString()}</strong></td>
                            <td>
                              <button
                                style={styles.smallTableBtn}
                                onClick={() => setActiveReceiptSale(s)}
                              >
                                <Printer size={13} /> View Receipt
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: POS REGISTER */}
          {activeTab === 'pos' && (
            <div style={styles.posGrid}>
              {/* LEFT: CATALOG / SEARCH */}
              <div style={styles.catalogSection}>
                <div style={styles.searchBarRow}>
                  <div style={styles.searchInputWrap}>
                    <Search size={18} color="#64748B" />
                    <input
                      type="text"
                      placeholder="Scan barcode or search name/SKU..."
                      style={styles.searchInput}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                    />
                    {searchQuery && (
                      <button style={styles.clearSearchBtn} onClick={() => setSearchQuery('')}>×</button>
                    )}
                  </div>

                  <button
                    style={styles.wholesaleToggle(wholesaleMode)}
                    onClick={() => setWholesaleMode(!wholesaleMode)}
                  >
                    <span>{wholesaleMode ? '📦 Wholesale Pricing' : '🏷️ Retail Pricing'}</span>
                  </button>

                  <button
                    style={styles.addProductShortcutBtn}
                    onClick={() => {
                      setEditingProduct(null);
                      setProductModalOpen(true);
                    }}
                    title="Add New Product"
                  >
                    <Plus size={16} /> <span>New Product</span>
                  </button>
                </div>

                {/* Categories */}
                {categories.length > 0 && (
                  <div style={styles.categoryPillsRow}>
                    <button
                      style={styles.categoryPill(selectedCategory === 'ALL')}
                      onClick={() => setSelectedCategory('ALL')}
                    >
                      All ({products.length})
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        style={styles.categoryPill(selectedCategory === String(c.id))}
                        onClick={() => setSelectedCategory(String(c.id))}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}

                {/* Products Grid */}
                {products.length === 0 ? (
                  <div style={styles.cleanEmptyCatalogBox}>
                    <Package size={56} color="#CBD5E1" />
                    <h3 style={{ marginTop: 14, color: '#0F172A', fontWeight: 800 }}>No Products in Catalog Yet</h3>
                    <p style={{ color: '#64748B', maxWidth: 440, margin: '8px auto 20px', lineHeight: 1.5 }}>
                      Add your inventory items manually, or connect your TradeDesk Cloud account to restore your shop catalog.
                    </p>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                      <button
                        style={styles.primaryActionBtn}
                        onClick={() => {
                          setEditingProduct(null);
                          setProductModalOpen(true);
                        }}
                      >
                        <Plus size={16} /> Add First Product
                      </button>
                      <button
                        style={styles.secondaryActionBtn}
                        onClick={async () => {
                          const res = await restoreFromCloudBackup();
                          showToast(res.message);
                        }}
                      >
                        <CloudDownload size={16} /> Restore from Cloud
                      </button>
                    </div>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div style={styles.cleanEmptyCatalogBox}>
                    <Search size={44} color="#CBD5E1" />
                    <p style={{ color: '#64748B', marginTop: 12 }}>No products matching "{searchQuery}"</p>
                  </div>
                ) : (
                  <div style={styles.productsScrollGrid}>
                    {filteredProducts.map((p) => {
                      const price = wholesaleMode ? (p.wholesale_price || p.selling_price) : p.selling_price;
                      const isLow = p.stock_quantity <= p.low_stock_threshold;
                      return (
                        <div
                          key={p.id}
                          style={styles.productCard}
                          onClick={() => addToCart(p, wholesaleMode)}
                        >
                          <div style={styles.productCardTop}>
                            <span style={styles.productSku}>{p.sku}</span>
                            <span style={styles.stockBadge(isLow)}>
                              {p.stock_quantity} {p.unit}
                            </span>
                          </div>
                          <div style={styles.productName}>{p.name}</div>
                          <div style={styles.productPriceRow}>
                            <span style={styles.productPrice}>UGX {price.toLocaleString()}</span>
                            <span style={styles.addIconCircle}><Plus size={16} /></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* RIGHT: ACTIVE TILL */}
              <div style={styles.cartSection}>
                <div style={styles.cartHeader}>
                  <div style={styles.cartHeaderTitle}>
                    <ShoppingCart size={18} color="#0B4FB8" />
                    <span>Active Till ({cart.length})</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {cart.length > 0 && (
                      <button style={styles.parkBtn} onClick={() => parkCart()} title="Hold this sale">
                        Hold
                      </button>
                    )}
                    {cart.length > 0 && (
                      <button style={styles.clearBtn} onClick={clearCart} title="Clear Till">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Parked Carts pill list */}
                {parkedCarts.length > 0 && (
                  <div style={styles.parkedCartsBar}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#D97706' }}>Held Carts:</span>
                    {parkedCarts.map((p) => (
                      <button
                        key={p.id}
                        style={styles.restoreParkPill}
                        onClick={() => restoreParkedCart(p.id)}
                      >
                        {p.name} ({p.items.length})
                      </button>
                    ))}
                  </div>
                )}

                {/* Cart Items */}
                <div style={styles.cartItemsScroll}>
                  {cart.length === 0 ? (
                    <div style={styles.emptyCartBox}>
                      <Barcode size={48} color="#CBD5E1" />
                      <div style={{ fontWeight: 700, color: '#475569', marginTop: 12 }}>Till is empty</div>
                      <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>
                        Click products or scan barcode to add to till
                      </div>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div key={`${item.product.id}-${item.isWholesale ? 'ws' : 'rt'}`} style={styles.cartRow}>
                        <div style={{ flex: 1 }}>
                          <div style={styles.cartItemName}>{item.product.name}</div>
                          <div style={styles.cartItemMeta}>
                            UGX {item.price.toLocaleString()} &bull; {item.isWholesale ? 'Wholesale' : 'Retail'}
                          </div>
                        </div>

                        <div style={styles.qtyControl}>
                          <button
                            style={styles.qtyBtn}
                            onClick={() => updateCartQty(item.product.id, item.quantity - 1)}
                          >
                            <Minus size={14} />
                          </button>
                          <span style={styles.qtyText}>{item.quantity}</span>
                          <button
                            style={styles.qtyBtn}
                            onClick={() => updateCartQty(item.product.id, item.quantity + 1)}
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        <div style={styles.cartItemTotal}>
                          UGX {(item.price * item.quantity).toLocaleString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Till Footer & Checkout */}
                <div style={styles.cartFooter}>
                  <div style={styles.subtotalRow}>
                    <span style={styles.subtotalLabel}>Total Payable:</span>
                    <span style={styles.subtotalValue}>UGX {cartSubtotal.toLocaleString()}</span>
                  </div>

                  <div style={styles.payButtonsGrid}>
                    <button
                      style={{ ...styles.payActionBtn, background: '#16A34A', color: '#FFF' }}
                      disabled={cart.length === 0}
                      onClick={() => {
                        setPaymentType('CASH');
                        setCheckoutModal(true);
                      }}
                    >
                      <Banknote size={18} />
                      <span>Cash (F5)</span>
                    </button>

                    <button
                      style={{ ...styles.payActionBtn, background: '#0B4FB8', color: '#FFF' }}
                      disabled={cart.length === 0}
                      onClick={() => {
                        setPaymentType('MTN_MOMO');
                        setCheckoutModal(true);
                      }}
                    >
                      <Smartphone size={18} />
                      <span>MoMo (F9)</span>
                    </button>

                    <button
                      style={{ ...styles.payActionBtn, background: '#D97706', color: '#FFF' }}
                      disabled={cart.length === 0}
                      onClick={() => {
                        setPaymentType('CREDIT');
                        setCheckoutModal(true);
                      }}
                    >
                      <Users size={18} />
                      <span>Credit / Debt</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INVENTORY */}
          {activeTab === 'inventory' && (
            <div style={styles.scrollPage}>
              <div style={styles.pageHeaderRow}>
                <div>
                  <h1 style={styles.pageTitle}>Inventory Management</h1>
                  <p style={styles.pageSubtitle}>All store products, stock levels, wholesale packs, and cost margins</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    style={styles.primaryActionBtn}
                    onClick={() => {
                      setEditingProduct(null);
                      setProductModalOpen(true);
                    }}
                  >
                    <Plus size={16} /> Add Product
                  </button>
                </div>
              </div>

              {/* Product Search */}
              <div style={{ ...styles.searchInputWrap, maxWidth: 450, marginBottom: 18 }}>
                <Search size={18} color="#64748B" />
                <input
                  type="text"
                  placeholder="Search products by name, SKU, or barcode..."
                  style={styles.searchInput}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {products.length === 0 ? (
                <div style={styles.cleanEmptyCatalogBox}>
                  <Package size={56} color="#CBD5E1" />
                  <h3 style={{ marginTop: 14, color: '#0F172A', fontWeight: 800 }}>No Products in Inventory</h3>
                  <p style={{ color: '#64748B', maxWidth: 440, margin: '8px auto 20px', lineHeight: 1.5 }}>
                    Your store inventory is empty. Add your real products or restore from your TradeDesk Cloud account.
                  </p>
                  <button
                    style={styles.primaryActionBtn}
                    onClick={() => {
                      setEditingProduct(null);
                      setProductModalOpen(true);
                    }}
                  >
                    <Plus size={16} /> Add New Product
                  </button>
                </div>
              ) : (
                <div style={styles.cardBox}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>SKU / Barcode</th>
                          <th>Product Name</th>
                          <th>Cost Price</th>
                          <th>Retail Price</th>
                          <th>Wholesale Price</th>
                          <th>Current Stock</th>
                          <th>Pack Size</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.map((p) => {
                          const isLow = p.stock_quantity <= p.low_stock_threshold;
                          return (
                            <tr key={p.id}>
                              <td>
                                <div><strong>{p.sku}</strong></div>
                                <div style={{ fontSize: 11, color: '#94A3B8' }}>{p.barcode}</div>
                              </td>
                              <td><strong>{p.name}</strong></td>
                              <td>UGX {p.cost_price.toLocaleString()}</td>
                              <td><strong>UGX {p.selling_price.toLocaleString()}</strong></td>
                              <td>UGX {p.wholesale_price.toLocaleString()}</td>
                              <td>
                                <span style={styles.stockBadge(isLow)}>
                                  {p.stock_quantity} {p.unit}
                                </span>
                              </td>
                              <td>{p.pack_name ? `${p.pack_name} (${p.pack_size})` : 'Single'}</td>
                              <td>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    style={styles.smallTableBtn}
                                    onClick={() => {
                                      setEditingProduct(p);
                                      setProductModalOpen(true);
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    style={{ ...styles.smallTableBtn, color: '#DC2626' }}
                                    onClick={() => {
                                      if (confirm(`Delete ${p.name}?`)) {
                                        deleteProduct(p.id);
                                        showToast('Product deleted');
                                      }
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CUSTOMER DEBTS */}
          {activeTab === 'debts' && (
            <div style={styles.scrollPage}>
              <div style={styles.pageHeaderRow}>
                <div>
                  <h1 style={styles.pageTitle}>Customer Debts &amp; Credit Ledger</h1>
                  <p style={styles.pageSubtitle}>Track customers owing money, record cash/momo repayments, send WhatsApp reminders</p>
                </div>
                <button
                  style={styles.primaryActionBtn}
                  onClick={() => {
                    setEditingCustomer(null);
                    setCustomerModalOpen(true);
                  }}
                >
                  <Plus size={16} /> Add New Customer
                </button>
              </div>

              {/* Total Debt Card */}
              <div style={styles.kpiGrid}>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>Total Outstanding Customer Debt</div>
                  <div style={{ ...styles.kpiValue, color: '#D97706' }}>
                    UGX {summary.totalCustomerDebt.toLocaleString()}
                  </div>
                  <div style={styles.kpiMeta}>{summary.debtorsCount} customer(s) with active balance</div>
                </div>
              </div>

              {customers.length === 0 ? (
                <div style={{ ...styles.cleanEmptyCatalogBox, marginTop: 24 }}>
                  <Users size={56} color="#CBD5E1" />
                  <h3 style={{ marginTop: 14, color: '#0F172A', fontWeight: 800 }}>No Customers Recorded Yet</h3>
                  <p style={{ color: '#64748B', maxWidth: 440, margin: '8px auto 20px' }}>
                    Register customers to track credit sales, record debt payments, and send WhatsApp payment reminders.
                  </p>
                  <button
                    style={styles.primaryActionBtn}
                    onClick={() => {
                      setEditingCustomer(null);
                      setCustomerModalOpen(true);
                    }}
                  >
                    <Plus size={16} /> Add First Customer
                  </button>
                </div>
              ) : (
                <div style={{ ...styles.cardBox, marginTop: 24 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>Customer Name</th>
                          <th>Phone</th>
                          <th>Address / Stall</th>
                          <th>Total Debt Balance</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customers.map((c) => (
                          <tr key={c.id}>
                            <td><strong>{c.name}</strong></td>
                            <td>{c.phone || '&mdash;'}</td>
                            <td>{c.address || '&mdash;'}</td>
                            <td>
                              <strong style={{ color: c.total_debt > 0 ? '#DC2626' : '#16A34A', fontSize: 15 }}>
                                UGX {c.total_debt.toLocaleString()}
                              </strong>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 8 }}>
                                {c.total_debt > 0 && (
                                  <button
                                    style={{ ...styles.smallTableBtn, background: '#16A34A', color: '#FFF' }}
                                    onClick={() => {
                                      setActiveDebtCustomer(c);
                                      setDebtPayAmount(String(c.total_debt));
                                      setDebtPayModalOpen(true);
                                    }}
                                  >
                                    Pay Debt
                                  </button>
                                )}
                                {c.phone && c.total_debt > 0 && (
                                  <a
                                    href={`https://wa.me/256${c.phone.replace(/^0/, '').replace(/\s+/g, '')}?text=${encodeURIComponent(
                                      `Hello ${c.name}, this is a friendly reminder from ${profile.shop_name} regarding your outstanding balance of UGX ${c.total_debt.toLocaleString()}. Please clear via Cash or MTN/Airtel MoMo. Thank you!`
                                    )}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ ...styles.smallTableBtn, background: '#25D366', color: '#FFF', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                  >
                                    <MessageCircle size={13} /> WhatsApp
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: MORE MODULES (REPORTS, WALLETS, SHIFTS, VAS_BILLS, EXPENSES, SUPPLIERS, SALES, SETTINGS) */}
          {activeTab === 'more' && (
            <div style={styles.scrollPage}>
              <div style={styles.pageHeaderRow}>
                <div>
                  <h1 style={styles.pageTitle}>Shop Management Hub</h1>
                  <p style={styles.pageSubtitle}>Wallets, profit &amp; loss reports, VAS bill payments, and cloud settings</p>
                </div>
              </div>

              {/* Sub-Tabs Pills */}
              <div style={styles.subTabsBar}>
                {(['SETTINGS', 'VAS_BILLS', 'WALLETS', 'EXPENSES', 'SUPPLIERS', 'SHIFTS', 'SALES', 'REPORTS'] as MoreTabKey[]).map((tab) => (
                  <button
                    key={tab}
                    style={styles.subTabPill(moreSubTab === tab)}
                    onClick={() => setMoreSubTab(tab)}
                  >
                    {tab === 'VAS_BILLS' ? '⚡ Airtime & Bills' : tab}
                  </button>
                ))}
              </div>

              {/* MORE SUBTAB: SETTINGS & CLOUD SYNC */}
              {moreSubTab === 'SETTINGS' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div style={styles.cardBox}>
                    <h3 style={styles.cardBoxTitle}>Business Profile</h3>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Shop / Store Name</label>
                      <input
                        type="text"
                        style={styles.modalInput}
                        value={profile.shop_name}
                        onChange={(e) => updateProfile({ shop_name: e.target.value })}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Phone Number</label>
                      <input
                        type="text"
                        style={styles.modalInput}
                        value={profile.phone}
                        onChange={(e) => updateProfile({ phone: e.target.value })}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Location / Address</label>
                      <input
                        type="text"
                        style={styles.modalInput}
                        value={profile.address}
                        onChange={(e) => updateProfile({ address: e.target.value })}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Receipt Footer Note</label>
                      <input
                        type="text"
                        style={styles.modalInput}
                        value={profile.receipt_footer}
                        onChange={(e) => updateProfile({ receipt_footer: e.target.value })}
                      />
                    </div>
                    <button
                      style={styles.primaryActionBtn}
                      onClick={() => showToast('Profile updated!')}
                    >
                      Save Profile
                    </button>
                  </div>

                  <div style={styles.cardBox}>
                    <h3 style={styles.cardBoxTitle}>TradeDesk Cloud &amp; Real Data Sync</h3>
                    <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, marginBottom: 16 }}>
                      Connected to the identical TradeDesk Mobile backend (<code>https://axtechnologies.net/tradedeskmobile/api/</code>).
                    </p>

                    {cloudUser ? (
                      <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: 14, borderRadius: 10, marginBottom: 16 }}>
                        <div style={{ fontWeight: 800, color: '#166534' }}>Connected to {cloudUser.email}</div>
                        <div style={{ fontSize: 12, color: '#15803D', marginTop: 4 }}>Role: {cloudUser.role}</div>
                      </div>
                    ) : (
                      <button
                        style={{ ...styles.primaryActionBtn, width: '100%', marginBottom: 14 }}
                        onClick={() => setCloudAuthModalOpen(true)}
                      >
                        <Cloud size={16} /> Sign In to TradeDesk Cloud
                      </button>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <button
                        style={styles.secondaryActionBtn}
                        onClick={async () => {
                          const res = await restoreFromCloudBackup();
                          showToast(res.message);
                        }}
                      >
                        <CloudDownload size={16} /> Restore Shop from Cloud Backup
                      </button>

                      <button
                        style={styles.secondaryActionBtn}
                        onClick={async () => {
                          const res = await uploadBackupToCloud();
                          showToast(res.message);
                        }}
                      >
                        <CloudUpload size={16} /> Backup Desktop Data to Cloud
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* MORE SUBTAB: VAS AIRTIME & BILLS */}
              {moreSubTab === 'VAS_BILLS' && (
                <div style={styles.cardBox}>
                  <h3 style={styles.cardBoxTitle}>Value-Added Services: Airtime &amp; Utility Bills</h3>
                  <p style={{ color: '#64748B', fontSize: 13, marginBottom: 18 }}>
                    Sell instant airtime or pay Umeme Yaka and NWSC water bills with two-factor email OTP authorization.
                  </p>

                  <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                    <button
                      style={styles.methodTab(vasType === 'AIRTIME')}
                      onClick={() => {
                        setVasType('AIRTIME');
                        setVasNetwork('MTN');
                      }}
                    >
                      Airtime Top-Up
                    </button>
                    <button
                      style={styles.methodTab(vasType === 'BILLS')}
                      onClick={() => {
                        setVasType('BILLS');
                        setVasNetwork('UMEME');
                      }}
                    >
                      Utility Bill Payment
                    </button>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Provider</label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {vasType === 'AIRTIME' ? (
                        <>
                          <button
                            style={styles.networkSelectBtn(vasNetwork === 'MTN')}
                            onClick={() => setVasNetwork('MTN')}
                          >
                            MTN Uganda
                          </button>
                          <button
                            style={styles.networkSelectBtn(vasNetwork === 'AIRTEL')}
                            onClick={() => setVasNetwork('AIRTEL')}
                          >
                            Airtel Uganda
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            style={styles.networkSelectBtn(vasNetwork === 'UMEME')}
                            onClick={() => setVasNetwork('UMEME')}
                          >
                            Umeme Yaka (Prepaid)
                          </button>
                          <button
                            style={styles.networkSelectBtn(vasNetwork === 'NWSC')}
                            onClick={() => setVasNetwork('NWSC')}
                          >
                            NWSC Water
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>
                      {vasType === 'AIRTIME' ? 'Recipient Phone Number' : 'Meter / Account Number'}
                    </label>
                    <input
                      type="text"
                      placeholder={vasType === 'AIRTIME' ? 'e.g. 0772 123 456' : 'e.g. 0423456789'}
                      style={styles.modalInput}
                      value={vasTargetNumber}
                      onChange={(e) => setVasTargetNumber(e.target.value)}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Amount (UGX)</label>
                    <input
                      type="number"
                      placeholder="e.g. 5000"
                      style={styles.modalInput}
                      value={vasAmount}
                      onChange={(e) => setVasAmount(e.target.value)}
                    />
                  </div>

                  <button
                    style={styles.primaryActionBtn}
                    disabled={vasLoading}
                    onClick={handleVasRequestOtp}
                  >
                    <Zap size={16} /> <span>{vasLoading ? 'Sending OTP...' : 'Send Email OTP & Verify'}</span>
                  </button>
                </div>
              )}

              {/* MORE SUBTAB: WALLETS & TREASURY */}
              {moreSubTab === 'WALLETS' && (
                <div>
                  <div style={styles.kpiGrid}>
                    <div style={styles.kpiCard}>
                      <div style={styles.kpiLabel}>Cash Drawer Balance</div>
                      <div style={{ ...styles.kpiValue, color: '#16A34A' }}>UGX {treasury.cashBalance.toLocaleString()}</div>
                      <div style={styles.kpiMeta}>Physical register cash</div>
                    </div>
                    <div style={styles.kpiCard}>
                      <div style={styles.kpiLabel}>Mobile Money Balance</div>
                      <div style={{ ...styles.kpiValue, color: '#0B4FB8' }}>UGX {treasury.momoBalance.toLocaleString()}</div>
                      <div style={styles.kpiMeta}>Unified MTN &amp; Airtel float</div>
                    </div>
                    <div style={styles.kpiCard}>
                      <div style={styles.kpiLabel}>Bank Account Balance</div>
                      <div style={{ ...styles.kpiValue, color: '#7C3AED' }}>UGX {treasury.bankBalance.toLocaleString()}</div>
                      <div style={styles.kpiMeta}>Shop checking account</div>
                    </div>
                    <div style={styles.kpiCard}>
                      <div style={styles.kpiLabel}>Total Liquid Capital</div>
                      <div style={{ ...styles.kpiValue, color: '#0F172A' }}>UGX {treasury.totalLiquidCash.toLocaleString()}</div>
                      <div style={styles.kpiMeta}>All liquid cash combined</div>
                    </div>
                  </div>

                  <div style={{ ...styles.cardBox, marginTop: 20 }}>
                    <h3 style={styles.cardBoxTitle}>Inter-Wallet Cash Transfers</h3>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <button
                        style={styles.primaryActionBtn}
                        onClick={() => setTransferModalOpen(true)}
                      >
                        <ArrowRightLeft size={16} /> Record Cash &harr; MoMo Transfer
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* MORE SUBTAB: EXPENSES */}
              {moreSubTab === 'EXPENSES' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={styles.cardBoxTitle}>Shop Expenses Log</h3>
                    <button
                      style={styles.primaryActionBtn}
                      onClick={() => setExpenseModalOpen(true)}
                    >
                      <Plus size={16} /> Record Expense
                    </button>
                  </div>

                  {expenses.length === 0 ? (
                    <div style={styles.cleanEmptyCatalogBox}>
                      <CreditCard size={48} color="#CBD5E1" />
                      <p style={{ marginTop: 12, color: '#64748B' }}>No expenses recorded yet.</p>
                    </div>
                  ) : (
                    <div style={styles.cardBox}>
                      <table style={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Category</th>
                            <th>Amount</th>
                            <th>Note</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {expenses.map((e) => (
                            <tr key={e.id}>
                              <td>{e.expense_date}</td>
                              <td><strong>{e.category}</strong></td>
                              <td><strong style={{ color: '#DC2626' }}>UGX {e.amount.toLocaleString()}</strong></td>
                              <td>{e.note || '&mdash;'}</td>
                              <td>
                                <button
                                  style={{ ...styles.smallTableBtn, color: '#DC2626' }}
                                  onClick={() => {
                                    if (confirm('Delete expense?')) deleteExpense(e.id);
                                  }}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* MORE SUBTAB: SUPPLIERS */}
              {moreSubTab === 'SUPPLIERS' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={styles.cardBoxTitle}>Suppliers &amp; Stock In (GRN)</h3>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        style={styles.primaryActionBtn}
                        onClick={() => {
                          setGrnSupplierId('');
                          setGrnProductId('');
                          setGrnQty('');
                          setGrnUnitCost('');
                          setGrnAmountPaid('');
                          setGrnModalOpen(true);
                        }}
                      >
                        <Plus size={16} /> Record GRN (Stock In)
                      </button>
                    </div>
                  </div>

                  {suppliers.length === 0 ? (
                    <div style={styles.cleanEmptyCatalogBox}>
                      <Building size={48} color="#CBD5E1" />
                      <p style={{ marginTop: 12, color: '#64748B' }}>No suppliers registered yet.</p>
                      <button
                        style={styles.primaryActionBtn}
                        onClick={() => {
                          const name = prompt('Supplier Name:');
                          const phone = prompt('Supplier Phone:');
                          if (name && phone) addOrUpdateSupplier({ name, phone });
                        }}
                      >
                        Add Supplier
                      </button>
                    </div>
                  ) : (
                    <div style={styles.cardBox}>
                      <table style={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Supplier</th>
                            <th>Phone</th>
                            <th>Products Supplied</th>
                            <th>Balance Owed</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {suppliers.map((s) => (
                            <tr key={s.id}>
                              <td><strong>{s.name}</strong></td>
                              <td>{s.phone}</td>
                              <td>{s.products_supplied || '&mdash;'}</td>
                              <td><strong style={{ color: s.balance_owed > 0 ? '#DC2626' : '#16A34A' }}>UGX {s.balance_owed.toLocaleString()}</strong></td>
                              <td>
                                {s.balance_owed > 0 && (
                                  <button
                                    style={styles.smallTableBtn}
                                    onClick={() => {
                                      const amt = prompt(`Pay ${s.name} (Balance: UGX ${s.balance_owed.toLocaleString()}):`);
                                      if (amt && Number(amt) > 0) {
                                        recordSupplierPayment(s.id, Number(amt), 'CASH', 'Payment to supplier');
                                        showToast('Supplier payment recorded');
                                      }
                                    }}
                                  >
                                    Pay Balance
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* MORE SUBTAB: SALES & REPORTS */}
              {(moreSubTab === 'SALES' || moreSubTab === 'REPORTS') && (
                <div style={styles.cardBox}>
                  <h3 style={styles.cardBoxTitle}>Sales History &amp; Receipts</h3>
                  {sales.length === 0 ? (
                    <p style={{ color: '#64748B' }}>No sales recorded yet.</p>
                  ) : (
                    <table style={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>Receipt #</th>
                          <th>Date</th>
                          <th>Customer</th>
                          <th>Total Amount</th>
                          <th>Profit</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sales.map((s) => (
                          <tr key={s.id}>
                            <td><strong>{s.receipt_number}</strong></td>
                            <td>{new Date(s.created_at).toLocaleString()}</td>
                            <td>{s.customer_name}</td>
                            <td><strong>UGX {s.total_amount.toLocaleString()}</strong></td>
                            <td style={{ color: '#16A34A' }}>UGX {s.total_profit.toLocaleString()}</td>
                            <td>
                              <button
                                style={styles.smallTableBtn}
                                onClick={() => setActiveReceiptSale(s)}
                              >
                                View Receipt
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* MODAL: ADD / EDIT PRODUCT */}
      {productModalOpen && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>{editingProduct?.id ? 'Edit Product' : 'Add New Product'}</div>
              <button style={styles.closeModalBtn} onClick={() => setProductModalOpen(false)}>×</button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as any;
                addOrUpdateProduct({
                  id: editingProduct?.id,
                  name: form.name.value,
                  sku: form.sku.value,
                  barcode: form.barcode.value,
                  unit: form.unit.value,
                  cost_price: Number(form.cost_price.value || 0),
                  selling_price: Number(form.selling_price.value || 0),
                  wholesale_price: Number(form.wholesale_price.value || form.selling_price.value || 0),
                  stock_quantity: Number(form.stock_quantity.value || 0),
                  low_stock_threshold: Number(form.low_stock_threshold.value || 5),
                });
                setProductModalOpen(false);
                showToast('Product saved successfully!');
              }}
            >
              <div style={styles.formGroup}>
                <label style={styles.label}>Product Name *</label>
                <input
                  name="name"
                  type="text"
                  required
                  defaultValue={editingProduct?.name || ''}
                  style={styles.modalInput}
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Barcode</label>
                  <input
                    name="barcode"
                    type="text"
                    defaultValue={editingProduct?.barcode || `${Date.now().toString().slice(-8)}`}
                    style={styles.modalInput}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>SKU / Code</label>
                  <input
                    name="sku"
                    type="text"
                    defaultValue={editingProduct?.sku || ''}
                    style={styles.modalInput}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Cost Price (UGX)</label>
                  <input
                    name="cost_price"
                    type="number"
                    defaultValue={editingProduct?.cost_price || ''}
                    style={styles.modalInput}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Retail Price (UGX) *</label>
                  <input
                    name="selling_price"
                    type="number"
                    required
                    defaultValue={editingProduct?.selling_price || ''}
                    style={styles.modalInput}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Wholesale Price</label>
                  <input
                    name="wholesale_price"
                    type="number"
                    defaultValue={editingProduct?.wholesale_price || ''}
                    style={styles.modalInput}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Unit (e.g. Kg, Pcs)</label>
                  <input
                    name="unit"
                    type="text"
                    defaultValue={editingProduct?.unit || 'Pcs'}
                    style={styles.modalInput}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Initial Stock</label>
                  <input
                    name="stock_quantity"
                    type="number"
                    defaultValue={editingProduct?.stock_quantity ?? 0}
                    style={styles.modalInput}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Low Stock Alert</label>
                  <input
                    name="low_stock_threshold"
                    type="number"
                    defaultValue={editingProduct?.low_stock_threshold ?? 5}
                    style={styles.modalInput}
                  />
                </div>
              </div>

              <button type="submit" style={{ ...styles.primaryActionBtn, width: '100%', marginTop: 14 }}>
                Save Product
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: POS CHECKOUT */}
      {checkoutModal && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>Complete POS Checkout</div>
              <button style={styles.closeModalBtn} onClick={() => setCheckoutModal(false)}>×</button>
            </div>

            {checkoutSuccessSale ? (
              <div style={styles.successState}>
                <CheckCircle size={56} color="#16A34A" />
                <div style={styles.successTitle}>Payment Approved!</div>
                <div style={styles.successSub}>
                  Receipt #{checkoutSuccessSale.receipt_number} &bull; UGX {checkoutSuccessSale.total_amount.toLocaleString()}
                </div>
              </div>
            ) : (
              <div>
                <div style={styles.amountDueBox}>
                  <div style={{ fontSize: 13, color: '#64748B' }}>Total Amount Due</div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: '#0B4FB8' }}>
                    UGX {cartSubtotal.toLocaleString()}
                  </div>
                </div>

                <div style={styles.methodTabsRow}>
                  <button
                    style={styles.methodTab(paymentType === 'CASH')}
                    onClick={() => setPaymentType('CASH')}
                  >
                    Cash
                  </button>
                  <button
                    style={styles.methodTab(paymentType === 'MTN_MOMO')}
                    onClick={() => setPaymentType('MTN_MOMO')}
                  >
                    MTN MoMo
                  </button>
                  <button
                    style={styles.methodTab(paymentType === 'AIRTEL_MONEY')}
                    onClick={() => setPaymentType('AIRTEL_MONEY')}
                  >
                    Airtel Money
                  </button>
                  <button
                    style={styles.methodTab(paymentType === 'CREDIT')}
                    onClick={() => setPaymentType('CREDIT')}
                  >
                    Credit / Debt
                  </button>
                </div>

                {paymentType === 'CASH' && (
                  <div style={{ marginTop: 18 }}>
                    <label style={styles.label}>Cash Tendered by Customer (UGX)</label>
                    <input
                      type="number"
                      placeholder={`e.g. ${cartSubtotal}`}
                      style={styles.modalInput}
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      autoFocus
                    />
                    {Number(cashTendered) > 0 && (
                      <div style={styles.changeDueRow}>
                        <span>Change to Return:</span>
                        <span style={{ fontWeight: 900, color: '#16A34A', fontSize: 18 }}>
                          UGX {changeDue.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {(paymentType === 'MTN_MOMO' || paymentType === 'AIRTEL_MONEY') && (
                  <div style={{ marginTop: 18 }}>
                    <label style={styles.label}>Customer Phone Number (for MoMo Push Prompt)</label>
                    <input
                      type="tel"
                      placeholder="e.g. 0772 123 456"
                      style={styles.modalInput}
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      autoFocus
                    />
                  </div>
                )}

                {paymentType === 'CREDIT' && (
                  <div style={{ marginTop: 18 }}>
                    <label style={styles.label}>Select Customer to Charge Debt</label>
                    <select
                      style={styles.modalInput}
                      value={selectedCustomerId || ''}
                      onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
                    >
                      <option value="">-- Choose Customer --</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} (Current Debt: UGX {c.total_debt.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  style={{ ...styles.primaryActionBtn, width: '100%', marginTop: 22, padding: '14px' }}
                  onClick={handleCompleteSale}
                >
                  Confirm &amp; Complete Sale
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: VIEW / PRINT RECEIPT */}
      {activeReceiptSale && (
        <div style={styles.modalBackdrop}>
          <div style={{ ...styles.modalCard, maxWidth: 400 }}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>Official Till Receipt</div>
              <button style={styles.closeModalBtn} onClick={() => setActiveReceiptSale(null)}>×</button>
            </div>

            <div style={styles.receiptPaper}>
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{profile.shop_name}</div>
                <div style={{ fontSize: 12, color: '#64748B' }}>{profile.address || 'Kampala, Uganda'}</div>
                <div style={{ fontSize: 12, color: '#64748B' }}>Tel: {profile.phone || '0772 651 444'}</div>
                <div style={{ borderBottom: '1px dashed #CBD5E1', margin: '10px 0' }} />
                <div style={{ fontSize: 13, fontWeight: 700 }}>Receipt #{activeReceiptSale.receipt_number}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>
                  {new Date(activeReceiptSale.created_at).toLocaleString()}
                </div>
              </div>

              <div style={{ margin: '14px 0', borderBottom: '1px dashed #CBD5E1', paddingBottom: 10 }}>
                {activeReceiptSale.items?.map((item) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span>{item.quantity}x {item.product_name}</span>
                    <span>UGX {item.subtotal.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 16 }}>
                <span>TOTAL:</span>
                <span>UGX {activeReceiptSale.total_amount.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748B', marginTop: 4 }}>
                <span>Method:</span>
                <span>{activeReceiptSale.payment_method}</span>
              </div>

              <div style={{ textAlign: 'center', marginTop: 18, fontSize: 11, color: '#64748B', borderTop: '1px dashed #CBD5E1', paddingTop: 10 }}>
                {profile.receipt_footer}
              </div>
            </div>

            <button
              style={{ ...styles.primaryActionBtn, width: '100%', marginTop: 14 }}
              onClick={() => window.print()}
            >
              <Printer size={16} /> Print Receipt
            </button>
          </div>
        </div>
      )}

      {/* MODAL: CLOUD LOGIN */}
      {cloudAuthModalOpen && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>Connect TradeDesk Cloud</div>
              <button style={styles.closeModalBtn} onClick={() => setCloudAuthModalOpen(false)}>×</button>
            </div>

            {cloudError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
                {cloudError}
              </div>
            )}

            {cloudStep === 'LOGIN' ? (
              <div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Cloud Email</label>
                  <input
                    type="email"
                    style={styles.modalInput}
                    value={cloudEmail}
                    onChange={(e) => setCloudEmail(e.target.value)}
                    placeholder="e.g. anthonyerindabo01@gmail.com"
                    autoFocus
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Password</label>
                  <input
                    type="password"
                    style={styles.modalInput}
                    value={cloudPassword}
                    onChange={(e) => setCloudPassword(e.target.value)}
                  />
                </div>
                <button
                  style={{ ...styles.primaryActionBtn, width: '100%', marginTop: 14 }}
                  disabled={cloudLoading}
                  onClick={handleCloudLogin}
                >
                  {cloudLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>
                  Enter the 6-digit verification code sent to <strong>{cloudEmail}</strong>
                </p>
                <div style={styles.formGroup}>
                  <label style={styles.label}>6-Digit OTP Code</label>
                  <input
                    type="text"
                    style={styles.modalInput}
                    value={cloudOtp}
                    onChange={(e) => setCloudOtp(e.target.value)}
                    maxLength={6}
                    autoFocus
                  />
                </div>
                <button
                  style={{ ...styles.primaryActionBtn, width: '100%', marginTop: 14 }}
                  disabled={cloudLoading}
                  onClick={handleCloudVerifyOtp}
                >
                  {cloudLoading ? 'Verifying...' : 'Verify &amp; Connect'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: VAS OTP AUTHORIZATION */}
      {vasOtpModalOpen && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>Confirm Email OTP Authorization</div>
              <button style={styles.closeModalBtn} onClick={() => setVasOtpModalOpen(false)}>×</button>
            </div>
            <p style={{ fontSize: 13, color: '#64748B', marginBottom: 14 }}>
              A security verification OTP was sent to your registered shop email to authorize this UGX {Number(vasAmount).toLocaleString()} transaction.
            </p>
            <div style={styles.formGroup}>
              <label style={styles.label}>Enter 6-Digit Email OTP</label>
              <input
                type="text"
                maxLength={6}
                placeholder="e.g. 123456"
                style={{ ...styles.modalInput, fontSize: 20, textAlign: 'center', letterSpacing: 4 }}
                value={vasOtpCode}
                onChange={(e) => setVasOtpCode(e.target.value)}
                autoFocus
              />
            </div>
            <button
              style={{ ...styles.primaryActionBtn, width: '100%', marginTop: 14 }}
              disabled={vasLoading || vasOtpCode.length < 4}
              onClick={handleVasAuthorize}
            >
              {vasLoading ? 'Authorizing...' : 'Authorize Transaction'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL: SHIFT OPEN / CLOSE */}
      {shiftModalOpen && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>
                {currentShift && currentShift.status === 'OPEN' ? 'Close Register (Z-Report)' : 'Open Daily Cash Register'}
              </div>
              <button style={styles.closeModalBtn} onClick={() => setShiftModalOpen(false)}>×</button>
            </div>

            {currentShift && currentShift.status === 'OPEN' ? (
              <div>
                <div style={{ background: '#EFF6FF', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
                  <div>Expected Cash in Drawer: <strong>UGX {currentShift.expected_cash.toLocaleString()}</strong></div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Counted Cash in Drawer (UGX)</label>
                  <input
                    type="number"
                    style={styles.modalInput}
                    placeholder={`e.g. ${currentShift.expected_cash}`}
                    value={shiftCountedInput}
                    onChange={(e) => setShiftCountedInput(e.target.value)}
                    autoFocus
                  />
                </div>
                <button
                  style={{ ...styles.primaryActionBtn, width: '100%', marginTop: 14 }}
                  onClick={() => {
                    const closed = closeShift(Number(shiftCountedInput || 0));
                    setShiftModalOpen(false);
                    setShiftCountedInput('');
                    showToast(`Register closed. Variance: UGX ${closed?.variance?.toLocaleString() || 0}`);
                  }}
                >
                  Confirm &amp; Close Register
                </button>
              </div>
            ) : (
              <div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Morning Opening Cash Float (UGX)</label>
                  <input
                    type="number"
                    style={styles.modalInput}
                    placeholder="e.g. 50000"
                    value={shiftFloatInput}
                    onChange={(e) => setShiftFloatInput(e.target.value)}
                    autoFocus
                  />
                </div>
                <button
                  style={{ ...styles.primaryActionBtn, width: '100%', marginTop: 14 }}
                  onClick={() => {
                    openShift(Number(shiftFloatInput || 0));
                    setShiftModalOpen(false);
                    setShiftFloatInput('');
                    showToast('Cash drawer opened successfully!');
                  }}
                >
                  Open Cash Register
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CUSTOMER DEBT PAYMENT */}
      {debtPayModalOpen && activeDebtCustomer && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>Record Debt Payment</div>
              <button style={styles.closeModalBtn} onClick={() => setDebtPayModalOpen(false)}>×</button>
            </div>
            <div style={{ background: '#FEF3C7', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13, color: '#92400E' }}>
              Customer: <strong>{activeDebtCustomer.name}</strong> &bull; Total Debt: <strong>UGX {activeDebtCustomer.total_debt.toLocaleString()}</strong>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Amount Paid (UGX)</label>
              <input
                type="number"
                style={styles.modalInput}
                value={debtPayAmount}
                onChange={(e) => setDebtPayAmount(e.target.value)}
                autoFocus
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Payment Method</label>
              <select
                style={styles.modalInput}
                value={debtPayMethod}
                onChange={(e: any) => setDebtPayMethod(e.target.value)}
              >
                <option value="CASH">Cash</option>
                <option value="MTN_MOMO">MTN MoMo</option>
                <option value="AIRTEL_MONEY">Airtel Money</option>
              </select>
            </div>

            <button
              style={{ ...styles.primaryActionBtn, width: '100%', marginTop: 14 }}
              onClick={() => {
                if (Number(debtPayAmount) > 0) {
                  recordDebtPayment(activeDebtCustomer.id, Number(debtPayAmount), debtPayMethod);
                  setDebtPayModalOpen(false);
                  showToast('Debt payment recorded!');
                }
              }}
            >
              Confirm Repayment
            </button>
          </div>
        </div>
      )}

      {/* MODAL: RECORD EXPENSE */}
      {expenseModalOpen && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>Record Shop Expense</div>
              <button style={styles.closeModalBtn} onClick={() => setExpenseModalOpen(false)}>×</button>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Category</label>
              <select
                style={styles.modalInput}
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
              >
                <option value="Transport & Boda">Transport &amp; Boda</option>
                <option value="Electricity (Yaka) & Water">Electricity (Yaka) &amp; Water</option>
                <option value="Shop Rent">Shop Rent</option>
                <option value="Packaging & Polythene">Packaging &amp; Polythene</option>
                <option value="Airtime & Internet Data">Airtime &amp; Internet Data</option>
                <option value="Meals & Lunch">Meals &amp; Lunch</option>
                <option value="KCCA / Market Dues">KCCA / Market Dues</option>
                <option value="General Shop Expense">General Shop Expense</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Amount (UGX)</label>
              <input
                type="number"
                style={styles.modalInput}
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                placeholder="e.g. 10000"
                autoFocus
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Note / Reason</label>
              <input
                type="text"
                style={styles.modalInput}
                value={expenseNote}
                onChange={(e) => setExpenseNote(e.target.value)}
                placeholder="e.g. Bought lunch for shop assistants"
              />
            </div>

            <button
              style={{ ...styles.primaryActionBtn, width: '100%', marginTop: 14 }}
              onClick={() => {
                if (Number(expenseAmount) > 0) {
                  addExpense(expenseCategory, Number(expenseAmount), expenseNote);
                  setExpenseModalOpen(false);
                  setExpenseAmount('');
                  setExpenseNote('');
                  showToast('Expense recorded!');
                }
              }}
            >
              Save Expense
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Clean Modern Desktop Styling
const styles = {
  appContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100vh',
    width: '100vw',
    backgroundColor: '#F8FAFC',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    color: '#0F172A',
    overflow: 'hidden',
  },
  topBar: {
    height: 60,
    backgroundColor: '#FFFFFF',
    borderBottom: '1px solid #E2E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    zIndex: 10,
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  brandLogoBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#0B4FB8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: '#0B4FB8',
    lineHeight: 1.1,
  },
  brandSub: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: 600,
  },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  syncBtn: (isSyncing: boolean) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    border: '1px solid #E2E8F0',
    backgroundColor: isSyncing ? '#EFF6FF' : '#FFFFFF',
    color: '#0B4FB8',
    cursor: 'pointer',
  }),
  onlineBadge: (online: boolean) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 12px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    backgroundColor: online ? '#DCFCE7' : '#FEE2E2',
    color: online ? '#15803D' : '#991B1B',
  }),
  shortcutHint: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: 600,
  },
  mainLayout: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: 200,
    backgroundColor: '#FFFFFF',
    borderRight: '1px solid #E2E8F0',
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '16px 10px',
    gap: 6,
  },
  navButton: (active: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    borderRadius: 10,
    border: 'none',
    backgroundColor: active ? '#0B4FB8' : 'transparent',
    color: active ? '#FFFFFF' : '#475569',
    fontSize: 13,
    fontWeight: active ? 700 : 600,
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'all 0.15s ease',
  }),
  contentArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  scrollPage: {
    padding: '24px 30px',
  },
  pageHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: '#0F172A',
    margin: 0,
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#64748B',
    margin: '4px 0 0',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
  },
  kpiCard: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 12,
    padding: 18,
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: '#64748B',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: 900,
    color: '#0F172A',
    margin: '6px 0',
  },
  kpiMeta: {
    fontSize: 12,
    color: '#94A3B8',
  },
  cardBox: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 12,
    padding: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
  },
  cardBoxTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: '#0F172A',
    margin: '0 0 14px',
  },
  splitRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #F1F5F9',
    fontSize: 13,
  },
  primaryActionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 18px',
    backgroundColor: '#0B4FB8',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(11,79,184,0.25)',
  },
  secondaryActionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 18px',
    backgroundColor: '#FFFFFF',
    color: '#0B4FB8',
    border: '1.5px solid #0B4FB8',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  subTabsBar: {
    display: 'flex',
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap' as const,
  },
  subTabPill: (active: boolean) => ({
    padding: '8px 16px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    border: 'none',
    backgroundColor: active ? '#0B4FB8' : '#E2E8F0',
    color: active ? '#FFFFFF' : '#475569',
    cursor: 'pointer',
  }),
  posGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 380px',
    height: '100%',
    overflow: 'hidden',
  },
  catalogSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    padding: 16,
    overflowY: 'auto' as const,
    borderRight: '1px solid #E2E8F0',
  },
  searchBarRow: {
    display: 'flex',
    gap: 10,
    marginBottom: 12,
  },
  searchInputWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    border: '1.5px solid #CBD5E1',
    borderRadius: 10,
    padding: '0 12px',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 42,
    border: 'none',
    outline: 'none',
    fontSize: 13,
    backgroundColor: 'transparent',
  },
  clearSearchBtn: {
    background: 'none',
    border: 'none',
    fontSize: 16,
    color: '#94A3B8',
    cursor: 'pointer',
  },
  wholesaleToggle: (active: boolean) => ({
    padding: '0 14px',
    borderRadius: 10,
    border: '1.5px solid',
    borderColor: active ? '#F26A0E' : '#CBD5E1',
    backgroundColor: active ? '#FFF7ED' : '#FFFFFF',
    color: active ? '#C2410C' : '#475569',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  }),
  addProductShortcutBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 14px',
    borderRadius: 10,
    border: 'none',
    backgroundColor: '#0B4FB8',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  categoryPillsRow: {
    display: 'flex',
    gap: 6,
    overflowX: 'auto' as const,
    paddingBottom: 8,
    marginBottom: 12,
  },
  categoryPill: (active: boolean) => ({
    padding: '6px 14px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    border: 'none',
    backgroundColor: active ? '#0B4FB8' : '#E2E8F0',
    color: active ? '#FFFFFF' : '#475569',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  }),
  cleanEmptyCatalogBox: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    textAlign: 'center' as const,
  },
  productsScrollGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 12,
    overflowY: 'auto' as const,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 10,
    padding: 12,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'space-between',
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
    transition: 'transform 0.1s, box-shadow 0.1s',
  },
  productCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  productSku: {
    fontSize: 10,
    fontWeight: 700,
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  stockBadge: (low: boolean) => ({
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: 4,
    backgroundColor: low ? '#FEE2E2' : '#DCFCE7',
    color: low ? '#991B1B' : '#15803D',
  }),
  productName: {
    fontSize: 13,
    fontWeight: 700,
    color: '#0F172A',
    marginBottom: 10,
    lineHeight: 1.3,
  },
  productPriceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    fontSize: 13,
    fontWeight: 800,
    color: '#0B4FB8',
  },
  addIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    color: '#0B4FB8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartSection: {
    backgroundColor: '#FFFFFF',
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
  },
  cartHeader: {
    padding: '14px 16px',
    borderBottom: '1px solid #E2E8F0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartHeaderTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: '#0F172A',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  parkBtn: {
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid #D97706',
    backgroundColor: '#FFFBEB',
    color: '#B45309',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
  },
  clearBtn: {
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid #FEE2E2',
    backgroundColor: '#FEF2F2',
    color: '#DC2626',
    fontSize: 11,
    cursor: 'pointer',
  },
  parkedCartsBar: {
    padding: '6px 14px',
    backgroundColor: '#FFFBEB',
    borderBottom: '1px solid #FDE68A',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    overflowX: 'auto' as const,
  },
  restoreParkPill: {
    padding: '2px 8px',
    borderRadius: 999,
    border: '1px solid #F59E0B',
    backgroundColor: '#FFFFFF',
    color: '#B45309',
    fontSize: 10,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  cartItemsScroll: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '12px 16px',
  },
  emptyCartBox: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center' as const,
  },
  cartRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 0',
    borderBottom: '1px solid #F1F5F9',
  },
  cartItemName: {
    fontSize: 13,
    fontWeight: 700,
    color: '#0F172A',
  },
  cartItemMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  qtyControl: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    padding: '3px 6px',
    borderRadius: 8,
  },
  qtyBtn: {
    border: 'none',
    backgroundColor: 'transparent',
    color: '#475569',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 13,
    fontWeight: 800,
    minWidth: 16,
    textAlign: 'center' as const,
  },
  cartItemTotal: {
    fontSize: 13,
    fontWeight: 800,
    color: '#0F172A',
    minWidth: 80,
    textAlign: 'right' as const,
  },
  cartFooter: {
    padding: 16,
    borderTop: '1px solid #E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  subtotalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  subtotalLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: '#64748B',
  },
  subtotalValue: {
    fontSize: 22,
    fontWeight: 900,
    color: '#0B4FB8',
  },
  payButtonsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 8,
  },
  payActionBtn: {
    padding: '12px 6px',
    borderRadius: 10,
    border: 'none',
    fontWeight: 800,
    fontSize: 12,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 4,
  },
  dataTable: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 13,
    textAlign: 'left' as const,
  },
  smallTableBtn: {
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid #CBD5E1',
    backgroundColor: '#FFFFFF',
    color: '#334155',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
  },
  payBadge: (m: string) => ({
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    backgroundColor: m === 'CASH' ? '#DCFCE7' : m.includes('MOMO') ? '#DBEAFE' : '#FEF3C7',
    color: m === 'CASH' ? '#15803D' : m.includes('MOMO') ? '#1E40AF' : '#92400E',
  }),
  toast: {
    position: 'fixed' as const,
    top: 20,
    right: 20,
    backgroundColor: '#FFFFFF',
    border: '1px solid #BBF7D0',
    padding: '12px 20px',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
    zIndex: 9999,
    fontWeight: 700,
    fontSize: 13,
    color: '#0F172A',
  },
  modalBackdrop: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    width: '90%',
    maxWidth: 520,
    boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: '#0F172A',
  },
  closeModalBtn: {
    border: 'none',
    background: 'none',
    fontSize: 22,
    color: '#94A3B8',
    cursor: 'pointer',
  },
  formGroup: {
    marginBottom: 12,
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 700,
    color: '#475569',
    marginBottom: 4,
  },
  modalInput: {
    width: '100%',
    height: 40,
    border: '1.5px solid #CBD5E1',
    borderRadius: 8,
    padding: '0 12px',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  amountDueBox: {
    backgroundColor: '#EFF6FF',
    border: '1px solid #BFDBFE',
    borderRadius: 10,
    padding: 14,
    textAlign: 'center' as const,
    marginBottom: 16,
  },
  methodTabsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 6,
    marginBottom: 14,
  },
  methodTab: (active: boolean) => ({
    padding: '8px 4px',
    borderRadius: 8,
    border: '1px solid',
    borderColor: active ? '#0B4FB8' : '#CBD5E1',
    backgroundColor: active ? '#0B4FB8' : '#FFFFFF',
    color: active ? '#FFFFFF' : '#475569',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center' as const,
  }),
  changeDueRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    backgroundColor: '#F0FDF4',
    border: '1px solid #BBF7D0',
    borderRadius: 8,
    marginTop: 8,
    fontSize: 13,
  },
  successState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '30px 20px',
    textAlign: 'center' as const,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 900,
    color: '#16A34A',
    marginTop: 14,
  },
  successSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
  },
  receiptPaper: {
    backgroundColor: '#FAF5FF',
    border: '1px dashed #D8B4FE',
    borderRadius: 10,
    padding: 18,
    color: '#0F172A',
  },
  networkSelectBtn: (active: boolean) => ({
    flex: 1,
    padding: '10px',
    borderRadius: 8,
    border: '1.5px solid',
    borderColor: active ? '#0B4FB8' : '#CBD5E1',
    backgroundColor: active ? '#EFF6FF' : '#FFFFFF',
    color: active ? '#0B4FB8' : '#475569',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
  }),
};
