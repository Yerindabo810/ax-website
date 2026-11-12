import React, { useState } from 'react';
import { useDesktopStore } from './store/useDesktopStore';
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
  ShieldCheck,
  CheckCircle,
  Smartphone,
  Banknote,
  DollarSign,
  AlertCircle,
  Barcode
} from 'lucide-react';

export default function App() {
  const {
    activeTab,
    setActiveTab,
    products,
    categories,
    cart,
    addToCart,
    removeFromCart,
    updateCartQty,
    clearCart,
    profile,
    isOnline,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
  } = useDesktopStore();

  const [wholesaleMode, setWholesaleMode] = useState(false);
  const [checkoutModal, setCheckoutModal] = useState(false);
  const [paymentType, setPaymentType] = useState<'CASH' | 'MTN_MOMO' | 'AIRTEL_MONEY' | 'DEBT'>('CASH');
  const [customerPhone, setCustomerPhone] = useState('');
  const [cashTendered, setCashTendered] = useState('');
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  // Filter products by search and category
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'ALL' || String(p.category_id) === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const changeDue = Math.max(0, Number(cashTendered || 0) - cartSubtotal);

  const handleCompleteSale = () => {
    setCheckoutSuccess(true);
    setTimeout(() => {
      clearCart();
      setCheckoutSuccess(false);
      setCheckoutModal(false);
      setCashTendered('');
      setCustomerPhone('');
    }, 1800);
  };

  return (
    <div style={styles.appContainer}>
      {/* 1. TOP STATUS BAR */}
      <header style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <img src="logo.png" alt="TradeDesk Logo" style={styles.brandLogo} />
          <div>
            <div style={styles.brandTitle}>Trade<span style={{ color: '#F26A0E' }}>Desk</span> POS</div>
            <div style={styles.brandSub}>{profile.shop_name} &bull; Desktop Edition</div>
          </div>
        </div>

        <div style={styles.topBarRight}>
          <div style={styles.onlineBadge(isOnline)}>
            {isOnline ? <Wifi size={14} color="#16A34A" /> : <WifiOff size={14} color="#DC2626" />}
            <span>{isOnline ? 'Cloud Synced' : 'Offline Mode (Local SQLite)'}</span>
          </div>
          <div style={styles.shortcutHint}>
            <span>F1: Search</span> &bull; <span>F5: Pay Cash</span> &bull; <span>F9: MoMo</span>
          </div>
        </div>
      </header>

      {/* 2. MAIN LAYOUT: SIDEBAR + CONTENT */}
      <div style={styles.mainLayout}>
        {/* SIDEBAR NAVIGATION */}
        <aside style={styles.sidebar}>
          <button
            style={styles.navButton(activeTab === 'pos')}
            onClick={() => setActiveTab('pos')}
          >
            <ShoppingCart size={20} />
            <span>POS Register</span>
          </button>
          <button
            style={styles.navButton(activeTab === 'products')}
            onClick={() => setActiveTab('products')}
          >
            <Package size={20} />
            <span>Products</span>
          </button>
          <button
            style={styles.navButton(activeTab === 'stock')}
            onClick={() => setActiveTab('stock')}
          >
            <Layers size={20} />
            <span>Stock & Batches</span>
          </button>
          <button
            style={styles.navButton(activeTab === 'debts')}
            onClick={() => setActiveTab('debts')}
          >
            <Users size={20} />
            <span>Customer Debts</span>
          </button>
          <button
            style={styles.navButton(activeTab === 'expenses')}
            onClick={() => setActiveTab('expenses')}
          >
            <CreditCard size={20} />
            <span>Expenses</span>
          </button>
          <button
            style={styles.navButton(activeTab === 'shifts')}
            onClick={() => setActiveTab('shifts')}
          >
            <History size={20} />
            <span>Shifts & Sales</span>
          </button>
          <button
            style={styles.navButton(activeTab === 'settings')}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={20} />
            <span>Settings</span>
          </button>
        </aside>

        {/* ACTIVE WORKSPACE */}
        <main style={styles.contentArea}>
          {activeTab === 'pos' && (
            <div style={styles.posGrid}>
              {/* LEFT: PRODUCT CATALOG / SEARCH / CATEGORIES */}
              <div style={styles.catalogSection}>
                {/* Search Bar + Wholesale Toggle */}
                <div style={styles.searchBarRow}>
                  <div style={styles.searchInputWrap}>
                    <Search size={18} color="#64748B" />
                    <input
                      type="text"
                      placeholder="Scan barcode or search name/SKU... (Press / to focus)"
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
                    title="Toggle between Single-Piece Retail and Bulk Wholesale pricing"
                  >
                    <span>{wholesaleMode ? '📦 Wholesale Pricing' : '🏷️ Retail Pricing'}</span>
                  </button>
                </div>

                {/* Categories Row */}
                <div style={styles.categoryPillsRow}>
                  <button
                    style={styles.categoryPill(selectedCategory === 'ALL')}
                    onClick={() => setSelectedCategory('ALL')}
                  >
                    All Categories
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

                {/* Products Grid */}
                <div style={styles.productsScrollGrid}>
                  {filteredProducts.map((p) => {
                    const price = wholesaleMode ? (p.wholesale_price || p.selling_price) : p.selling_price;
                    return (
                      <div
                        key={p.id}
                        style={styles.productCard}
                        onClick={() => addToCart(p, wholesaleMode)}
                      >
                        <div style={styles.productCardTop}>
                          <span style={styles.productSku}>{p.sku}</span>
                          <span style={styles.stockBadge(Number(p.current_stock ?? 0) <= Number(p.min_stock_alert || 5))}>
                            {p.current_stock ?? 0} {p.unit}
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
              </div>

              {/* RIGHT: TILL RECEIPT & CHECKOUT PANEL */}
              <div style={styles.cartSection}>
                <div style={styles.cartHeader}>
                  <div style={styles.cartHeaderTitle}>
                    <ShoppingCart size={18} color="#0B4FB8" />
                    <span>Active Cashier Till</span>
                  </div>
                  {cart.length > 0 && (
                    <button style={styles.clearBtn} onClick={clearCart}>
                      <Trash2 size={15} /> Clear Till
                    </button>
                  )}
                </div>

                {/* Cart Items List */}
                <div style={styles.cartItemsScroll}>
                  {cart.length === 0 ? (
                    <div style={styles.emptyCartBox}>
                      <Barcode size={48} color="#CBD5E1" />
                      <div style={{ fontWeight: 700, color: '#475569', marginTop: 12 }}>Till is empty</div>
                      <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>
                        Click products or scan barcode to add
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

                {/* Cart Summary & Pay Actions */}
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
                      <span>Cash Checkout (F5)</span>
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
                      <span>Mobile Money (F9)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab !== 'pos' && (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>
                {activeTab.toUpperCase()} Module
              </div>
              <p>Reused and synced with TradeDesk Mobile SQLite database & backend.</p>
              <button
                style={{
                  marginTop: 20,
                  padding: '10px 20px',
                  background: '#0B4FB8',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                onClick={() => setActiveTab('pos')}
              >
                Return to POS Register
              </button>
            </div>
          )}
        </main>
      </div>

      {/* CHECKOUT MODAL */}
      {checkoutModal && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>Complete POS Sale</div>
              <button style={styles.closeModalBtn} onClick={() => setCheckoutModal(false)}>×</button>
            </div>

            {checkoutSuccess ? (
              <div style={styles.successState}>
                <CheckCircle size={56} color="#16A34A" />
                <div style={styles.successTitle}>Transaction Approved!</div>
                <div style={styles.successSub}>UGX {cartSubtotal.toLocaleString()} recorded to local SQLite</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button style={styles.printBtn}><Printer size={16} /> Print 80mm Receipt</button>
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

                {/* Payment Method Selector */}
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
                    style={styles.methodTab(paymentType === 'DEBT')}
                    onClick={() => setPaymentType('DEBT')}
                  >
                    Customer Debt
                  </button>
                </div>

                {paymentType === 'CASH' && (
                  <div style={{ marginTop: 18 }}>
                    <label style={styles.inputLabel}>Cash Tendered by Customer (UGX)</label>
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
                    <label style={styles.inputLabel}>Recipient Phone Number for STK Push</label>
                    <input
                      type="tel"
                      placeholder="e.g. 0772 123 456"
                      style={styles.modalInput}
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      autoFocus
                    />
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 6 }}>
                      Customer will receive an instant PIN prompt on their phone.
                    </div>
                  </div>
                )}

                <button
                  style={styles.confirmCheckoutBtn}
                  onClick={handleCompleteSale}
                >
                  Confirm & Finalize Sale
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, any> = {
  appContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    backgroundColor: '#F8FAFC',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    overflow: 'hidden',
  },
  topBar: {
    height: 64,
    backgroundColor: '#FFFFFF',
    borderBottom: '1px solid #E2E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    flexShrink: 0,
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  brandLogo: {
    width: 38,
    height: 38,
    objectFit: 'contain',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: '#071E4A',
  },
  brandSub: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: 600,
  },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  onlineBadge: (online: boolean) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 12px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    backgroundColor: online ? '#F0FDF4' : '#FEF2F2',
    color: online ? '#16A34A' : '#DC2626',
    border: `1px solid ${online ? '#BBF7D0' : '#FECACA'}`,
  }),
  shortcutHint: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: 600,
  },
  mainLayout: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: 220,
    backgroundColor: '#FFFFFF',
    borderRight: '1px solid #E2E8F0',
    display: 'flex',
    flexDirection: 'column',
    padding: 12,
    gap: 6,
    flexShrink: 0,
  },
  navButton: (active: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    color: active ? '#0B4FB8' : '#475569',
    backgroundColor: active ? '#EFF6FF' : 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
  }),
  contentArea: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  posGrid: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  catalogSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: 20,
    overflow: 'hidden',
    borderRight: '1px solid #E2E8F0',
  },
  searchBarRow: {
    display: 'flex',
    gap: 12,
    marginBottom: 14,
  },
  searchInputWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    border: '1.5px solid #CBD5E1',
    borderRadius: 12,
    padding: '0 14px',
    height: 48,
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: 14.5,
    fontFamily: 'inherit',
    color: '#0F172A',
  },
  clearSearchBtn: {
    background: 'none',
    border: 'none',
    fontSize: 18,
    cursor: 'pointer',
    color: '#94A3B8',
  },
  wholesaleToggle: (active: boolean) => ({
    padding: '0 18px',
    borderRadius: 12,
    fontSize: 13.5,
    fontWeight: 800,
    cursor: 'pointer',
    border: active ? '1.5px solid #F26A0E' : '1.5px solid #E2E8F0',
    backgroundColor: active ? '#FFF7ED' : '#FFFFFF',
    color: active ? '#EA580C' : '#475569',
  }),
  categoryPillsRow: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    paddingBottom: 8,
    marginBottom: 14,
  },
  categoryPill: (active: boolean) => ({
    padding: '6px 14px',
    borderRadius: 999,
    fontSize: 12.5,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    border: active ? '1.5px solid #0B4FB8' : '1px solid #E2E8F0',
    backgroundColor: active ? '#0B4FB8' : '#FFFFFF',
    color: active ? '#FFFFFF' : '#475569',
  }),
  productsScrollGrid: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 14,
    overflowY: 'auto',
    paddingRight: 6,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    border: '1.5px solid #E2E8F0',
    borderRadius: 14,
    padding: 14,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    transition: 'all 0.15s ease',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
  },
  productCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  productSku: {
    fontSize: 11,
    fontWeight: 700,
    color: '#64748B',
  },
  stockBadge: (isLow: boolean) => ({
    fontSize: 10.5,
    fontWeight: 800,
    padding: '2px 8px',
    borderRadius: 999,
    backgroundColor: isLow ? '#FEF2F2' : '#F1F5F9',
    color: isLow ? '#DC2626' : '#475569',
  }),
  productName: {
    fontSize: 14,
    fontWeight: 800,
    color: '#0F172A',
    marginBottom: 12,
    lineHeight: '1.3',
  },
  productPriceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    fontSize: 14.5,
    fontWeight: 900,
    color: '#0B4FB8',
  },
  addIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EFF6FF',
    color: '#0B4FB8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartSection: {
    width: 420,
    backgroundColor: '#FFFFFF',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  cartHeader: {
    height: 56,
    borderBottom: '1px solid #E2E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
  },
  cartHeaderTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontWeight: 800,
    color: '#0F172A',
    fontSize: 15,
  },
  clearBtn: {
    background: 'none',
    border: 'none',
    color: '#DC2626',
    fontSize: 12.5,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    cursor: 'pointer',
  },
  cartItemsScroll: {
    flex: 1,
    overflowY: 'auto',
    padding: 16,
  },
  emptyCartBox: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid #F1F5F9',
    gap: 12,
  },
  cartItemName: {
    fontSize: 13.5,
    fontWeight: 700,
    color: '#0F172A',
  },
  cartItemMeta: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  qtyControl: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: 8,
    padding: 2,
  },
  qtyBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    border: 'none',
    background: '#FFFFFF',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 13,
    fontWeight: 800,
    minWidth: 20,
    textAlign: 'center',
  },
  cartItemTotal: {
    fontSize: 13.5,
    fontWeight: 800,
    color: '#0B4FB8',
    minWidth: 70,
    textAlign: 'right',
  },
  cartFooter: {
    borderTop: '1px solid #E2E8F0',
    padding: 20,
    backgroundColor: '#F8FAFC',
  },
  subtotalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  subtotalLabel: {
    fontSize: 15,
    fontWeight: 700,
    color: '#475569',
  },
  subtotalValue: {
    fontSize: 22,
    fontWeight: 900,
    color: '#0B4FB8',
  },
  payButtonsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  payActionBtn: {
    height: 50,
    borderRadius: 12,
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(0,0,0,0.06)',
  },
  modalBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  modalCard: {
    width: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: '#0F172A',
  },
  closeModalBtn: {
    background: 'none',
    border: 'none',
    fontSize: 24,
    cursor: 'pointer',
    color: '#64748B',
  },
  amountDueBox: {
    textAlign: 'center',
    padding: '16px',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    border: '1px solid #BFDBFE',
    marginBottom: 16,
  },
  methodTabsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 6,
    marginBottom: 16,
  },
  methodTab: (active: boolean) => ({
    padding: '10px 4px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    textAlign: 'center',
    cursor: 'pointer',
    border: active ? '1.5px solid #0B4FB8' : '1px solid #E2E8F0',
    backgroundColor: active ? '#0B4FB8' : '#FFFFFF',
    color: active ? '#FFFFFF' : '#475569',
  }),
  inputLabel: {
    display: 'block',
    fontSize: 12.5,
    fontWeight: 700,
    color: '#334155',
    marginBottom: 6,
  },
  modalInput: {
    width: '100%',
    height: 48,
    padding: '0 14px',
    border: '1.5px solid #CBD5E1',
    borderRadius: 10,
    fontSize: 15,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    outline: 'none',
  },
  changeDueRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    padding: '10px 14px',
    backgroundColor: '#F0FDF4',
    border: '1px solid #BBF7D0',
    borderRadius: 8,
  },
  confirmCheckoutBtn: {
    width: '100%',
    height: 50,
    marginTop: 20,
    backgroundColor: '#0B4FB8',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
  },
  successState: {
    textAlign: 'center',
    padding: '24px 0',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: '#0F172A',
    marginTop: 12,
  },
  successSub: {
    fontSize: 13.5,
    color: '#64748B',
    marginTop: 4,
  },
  printBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    border: '1px solid #CBD5E1',
    background: '#FFFFFF',
    cursor: 'pointer',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
};

