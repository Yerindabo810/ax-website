# TradeDesk Desktop — Standalone Offline-First POS & Inventory Suite

A high-velocity, 100% offline-first desktop POS application engineered for wholesale and retail stores in Uganda.

### Architecture
- **Desktop Runtime**: Electron + Vite + React + TypeScript
- **Database Engine**: Local SQLite 3 (`sql.js` / local storage with auto-persisted file writes)
- **Shared Mobile Backend**: Connects directly to the live TradeDesk Mobile cloud API at `https://axtechnologies.net/tradedeskmobile/api/` for:
  - Account Sign-In / 2FA Email OTP
  - MTN & Airtel Mobile Money STK Push
  - Value Added Services (Airtime, Internet Data, Yaka Electricity, NWSC Water & Pay-TV)
  - Bi-directional Sales & Inventory Sync (`/sync/push` & `/sync/pull`)

