const app = document.querySelector("#app");
const themeStorageKey = "habesha-theme";

function getInitialTheme() {
  try {
    return localStorage.getItem(themeStorageKey) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

const state = {
  user: null,
  page: "dashboard",
  authMode: "login",
  marketsQuery: "",
  marketsFilter: "all",
  tradeSide: "buy",
  dashboard: null,
  assets: {},
  adminDeposits: [],
  depositDraft: null,
  theme: getInitialTheme(),
  toastTimer: null
};

applyTheme(state.theme);

const marketData = [
  { symbol: "BTC", name: "Bitcoin", price: 69420.12, change: 2.84, volume: "1.8B", category: "major" },
  { symbol: "ETH", name: "Ethereum", price: 3564.55, change: 1.92, volume: "1.1B", category: "major" },
  { symbol: "USDT", name: "Tether", price: 1.0, change: 0.01, volume: "4.6B", category: "stable" },
  { symbol: "TON", name: "Toncoin", price: 6.42, change: 3.21, volume: "281M", category: "major" },
  { symbol: "TRX", name: "TRON", price: 0.13, change: 1.04, volume: "322M", category: "alt" },
  { symbol: "BNB", name: "BNB", price: 612.4, change: -0.48, volume: "391M", category: "major" },
  { symbol: "SOL", name: "Solana", price: 182.11, change: 5.18, volume: "812M", category: "major" },
  { symbol: "ADA", name: "Cardano", price: 0.62, change: -1.16, volume: "166M", category: "alt" }
];

const platformWallet = "0xHABESHA-EXCHANGE-DEPOSIT-VAULT-2026";
const defaultAssets = {
  BTC: { name: "Bitcoin", price: 69420.12, networks: ["Bitcoin"] },
  ETH: { name: "Ethereum", price: 3564.55, networks: ["Ethereum", "Arbitrum", "Base"] },
  USDT: { name: "Tether", price: 1, networks: ["TRC20", "ERC20", "BEP20", "TON"] },
  TON: { name: "Toncoin", price: 6.42, networks: ["TON"] },
  TRX: { name: "TRON", price: 0.13, networks: ["TRON"] },
  SOL: { name: "Solana", price: 182.11, networks: ["Solana"] },
  BNB: { name: "BNB", price: 612.4, networks: ["BNB Smart Chain", "BEP2"] },
  ADA: { name: "Cardano", price: 0.62, networks: ["Cardano"] }
};
const birrFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function money(value) {
  return birrFormatter.format(Number(value || 0));
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "same-origin",
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function loadMe() {
  try {
    const data = await api("/me");
    state.user = data.user;
    state.dashboard = data.dashboard;
    state.assets = data.assets || defaultAssets;
  } catch {
    state.user = null;
    state.dashboard = null;
    state.assets = defaultAssets;
  }
}

function layout(content) {
  const nav = ["dashboard", "markets", "trade", "wallet", ...(state.user?.isAdmin ? ["admin"] : []), "profile"];
  const authed = Boolean(state.user);
  return `
    <div class="app-shell">
      <header class="topbar">
        <a class="brand" href="#dashboard" data-page="dashboard">
          <span class="brand-mark">EC</span>
          <span><strong>Habesha Exchange</strong><span>Habesha digital asset exchange</span></span>
        </a>
        <button class="theme-toggle" type="button" data-theme-toggle aria-label="Switch theme">
          <span>${state.theme === "dark" ? "Dark" : "Light"}</span>
          <strong>${state.theme === "dark" ? "Light mode" : "Dark mode"}</strong>
        </button>
        ${authed ? `
          <nav class="nav" aria-label="App navigation">
            ${nav.map((item) => `<button type="button" class="${state.page === item ? "active" : ""}" data-page="${item}">${label(item)}</button>`).join("")}
          </nav>
          <div class="user-chip">
            <span class="avatar">${state.user.email[0].toUpperCase()}</span>
            <span class="muted">${state.user.email}</span>
          </div>
        ` : ""}
      </header>
      ${content}
      ${depositModal()}
      <div class="toast" id="toast" role="status" aria-live="polite"></div>
    </div>
  `;
}

function label(page) {
  return page === "trade" ? "Trading" : page[0].toUpperCase() + page.slice(1);
}

function setTheme(theme) {
  state.theme = theme === "dark" ? "dark" : "light";
  try {
    localStorage.setItem(themeStorageKey, state.theme);
  } catch {}
  applyTheme(state.theme);
}

function themeSettingsControl() {
  return `
    <div class="theme-settings">
      <span>Appearance</span>
      <div class="segmented-control" role="group" aria-label="Theme mode">
        <button class="${state.theme === "light" ? "active" : ""}" type="button" data-theme-set="light">Light</button>
        <button class="${state.theme === "dark" ? "active" : ""}" type="button" data-theme-set="dark">Dark</button>
      </div>
    </div>
  `;
}

function renderAuth() {
  const isLogin = state.authMode === "login";
  app.innerHTML = layout(`
    <main class="main">
      <section class="auth-layout">
        <div class="auth-showcase">
          <div class="showcase-kicker">
            <span class="live-dot"></span>
            <span>Habesha market desk</span>
          </div>
          <h1>Trade, deposit, and manage crypto with Habesha Exchange.</h1>
          <p class="showcase-copy">A dark exchange workspace for balances, markets, manual deposits, withdrawals, and admin approvals.</p>

          <div class="exchange-preview">
            <div class="preview-head">
              <div>
                <span class="muted">BTC / USDT</span>
                <strong>${money(69420.12)}</strong>
              </div>
              <span class="gain">+2.84%</span>
            </div>
            <div class="preview-chart" aria-hidden="true">
              <svg viewBox="0 0 520 180">
                <path d="M8 132 C54 108 78 118 116 82 S178 34 229 63 S300 142 351 78 S441 30 512 44" fill="none" stroke="#21c46b" stroke-width="5"/>
                <path d="M8 132 C54 108 78 118 116 82 S178 34 229 63 S300 142 351 78 S441 30 512 44 L512 180 L8 180 Z" fill="rgba(33,196,107,0.12)"/>
              </svg>
            </div>
            <div class="depth-lines">
              <span></span><span></span><span></span>
            </div>
          </div>

          <div class="auth-metrics">
            <div><strong>8</strong><span>Assets</span></div>
            <div><strong>24/7</strong><span>Markets</span></div>
            <div><strong>Manual</strong><span>Deposit review</span></div>
          </div>
        </div>

        <section class="auth-card">
          <p class="eyebrow">${isLogin ? "Secure login" : "Create account"}</p>
          <h2>${isLogin ? "Welcome back" : "Start trading"}</h2>
          <p class="muted">${isLogin ? "Use your email and password, or continue with Google OAuth." : "Your account gets its own saved dashboard and wallet data."}</p>
          <form class="auth-form" id="authForm">
            <label class="field">
              <span>Email</span>
              <input name="email" type="text" inputmode="email" autocomplete="email" required placeholder="you@example.com">
            </label>
            <label class="field">
              <span>Password</span>
              <input name="password" type="password" required minlength="6" placeholder="Minimum 6 characters">
            </label>
            <div class="auth-actions">
              <button class="button" type="submit">${isLogin ? "Log in" : "Sign up"}</button>
              <a class="google-button" href="/auth/google" aria-label="Continue with Google">
                <span class="google-logo" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"/>
                  </svg>
                </span>
                <span>Continue with Google</span>
              </a>
            </div>
          </form>
          <p class="auth-switch">
            ${isLogin ? "No account yet?" : "Already have an account?"}
            <button type="button" data-auth-mode="${isLogin ? "signup" : "login"}">${isLogin ? "Sign up" : "Log in"}</button>
          </p>
          <p class="helper">Local preview uses demo Google login. Add OAuth environment variables when you connect a real Google app.</p>
        </section>
      </section>
    </main>
  `);
}

function renderApp() {
  if (!state.user) {
    renderAuth();
    return;
  }

  const pages = {
    dashboard: dashboardPage,
    markets: marketsPage,
    trade: tradingPage,
    wallet: walletPage,
    admin: adminPage,
    profile: profilePage
  };
  app.innerHTML = layout(`<main class="main">${pages[state.page]()}</main>`);
}

function dashboardPage() {
  const dashboard = state.dashboard;
  const positiveBalances = dashboard.balances.filter((asset) => Number(asset.usd || 0) > 0);
  const activeAssets = positiveBalances.length;
  return `
    <section class="section">
      <div class="section-head">
        <div>
          <p class="eyebrow">Account dashboard</p>
          <h2>Portfolio command center</h2>
        </div>
        <button class="ghost-button" type="button" data-refresh>Refresh</button>
      </div>
      <div class="dashboard-hero">
        <article class="portfolio-card">
          <div class="portfolio-topline">
            <span class="muted">Estimated portfolio value</span>
            <span class="status-badge approved">Verified session</span>
          </div>
          <div class="portfolio-value">${money(dashboard.portfolioValue)}</div>
          <div class="portfolio-meta">
            <span class="gain">+${dashboard.dailyChange}% today</span>
            ${dashboard.pendingDepositTotal ? `<span class="status-badge pending">Pending: ${money(dashboard.pendingDepositTotal)} (Waiting for confirmation)</span>` : `<span class="muted">No pending deposits</span>`}
          </div>
          <div class="portfolio-actions">
            <button class="button" type="button" data-page="wallet">Deposit</button>
            <button class="ghost-button" type="button" data-page="wallet">Withdraw</button>
            <button class="ghost-button" type="button" data-page="trade">Trade</button>
          </div>
          <div class="allocation-strip" aria-label="Portfolio allocation">
            ${allocationSegments(positiveBalances, dashboard.portfolioValue)}
          </div>
        </article>

        <article class="dashboard-side-card">
          <h3>Exchange status</h3>
          <div class="status-list">
            <div><span>Active assets</span><strong>${activeAssets}</strong></div>
            <div><span>Deposit review</span><strong>Manual</strong></div>
            <div><span>Market mode</span><strong class="gain">Online</strong></div>
          </div>
        </article>
      </div>

      <div class="dashboard-kpis">
        <article class="kpi-card"><span>Total value</span><strong>${money(dashboard.portfolioValue)}</strong></article>
        <article class="kpi-card"><span>Pending deposits</span><strong>${money(dashboard.pendingDepositTotal || 0)}</strong></article>
        <article class="kpi-card"><span>Watchlist volume</span><strong>$7.9B</strong></article>
        <article class="kpi-card"><span>Primary quote</span><strong>USDT</strong></article>
      </div>

      <div class="dashboard-grid">
        <article class="stat-card holdings-card">
          <h3>Top holdings</h3>
          <div class="stat-list">
            ${positiveBalances.map((asset) => assetRow(asset, dashboard.portfolioValue)).join("")}
          </div>
        </article>
        <article class="stat-card activity-card">
          <h3>Recent activity</h3>
          <div class="activity-list">
            ${dashboard.activity.map((item) => `
              <div class="activity">
                <div><strong>${item.title}</strong><small>${item.date}</small></div>
                <span class="${item.type === "credit" ? "gain" : "loss"}">${item.amount}</span>
              </div>
            `).join("")}
          </div>
        </article>
      </div>
    </section>
    <section>
      <div class="section-head"><div><p class="eyebrow">Market summary</p><h2>Watchlist</h2></div></div>
      <div class="market-grid">
        ${marketData.slice(0, 3).map(marketCard).join("")}
      </div>
    </section>
  `;
}

function marketCard(item) {
  return `
    <article class="market-card">
      <div class="market-card-head">
        <div class="coin">
          <span class="coin-icon">${item.symbol[0]}</span>
          <div><strong>${item.symbol}/USDT</strong><div class="market-meta">${item.name}</div></div>
        </div>
        <span class="${item.change >= 0 ? "gain" : "loss"}">${item.change >= 0 ? "+" : ""}${item.change}%</span>
      </div>
      <div class="market-price">${money(item.price)}</div>
      <div class="sparkline ${item.change >= 0 ? "up" : "down"}" aria-hidden="true">
        <svg viewBox="0 0 180 54"><path d="${item.change >= 0 ? "M4 40 C32 30 48 36 70 22 S118 10 176 16" : "M4 14 C34 20 52 15 74 28 S126 43 176 36"}"/></svg>
      </div>
    </article>
  `;
}

function allocationSegments(balances, total) {
  if (!balances.length || !total) return `<span style="width: 100%"></span>`;
  return balances.slice(0, 5).map((asset) => {
    const width = Math.max(7, Math.min(100, (Number(asset.usd || 0) / total) * 100));
    return `<span title="${asset.symbol}" style="width: ${width}%"></span>`;
  }).join("");
}

function assetRow(asset, total = 0) {
  const share = total ? Math.min(100, Math.max(2, (Number(asset.usd || 0) / total) * 100)) : 0;
  return `
    <div class="asset">
      <div class="coin">
        <span class="coin-icon">${asset.symbol[0]}</span>
        <div><strong>${asset.symbol}</strong><small>${asset.name}</small></div>
      </div>
      <div class="asset-amount"><strong>${asset.amount}</strong><small>${money(asset.usd)}</small></div>
      ${total ? `<div class="asset-bar"><span style="width: ${share}%"></span></div>` : ""}
    </div>
  `;
}

function assetOptions(selected = "USDT") {
  return Object.keys(state.assets || defaultAssets)
    .map((symbol) => `<option value="${symbol}" ${symbol === selected ? "selected" : ""}>${symbol} - ${(state.assets || defaultAssets)[symbol].name}</option>`)
    .join("");
}

function networkOptions(asset = "USDT", selected = "") {
  const networks = (state.assets || defaultAssets)[asset]?.networks || ["Manual"];
  return networks.map((network) => `<option value="${network}" ${network === selected ? "selected" : ""}>${network}</option>`).join("");
}

function statusBadge(status) {
  const normalized = String(status || "Pending").toLowerCase();
  return `<span class="status-badge ${normalized}">${status}</span>`;
}

function estimateCryptoAmount(draft) {
  const asset = (state.assets || defaultAssets)[draft?.asset] || defaultAssets.USDT;
  const amountUsd = Number(draft?.amountUsd || 0);
  if (!asset.price || !amountUsd) return "0.000000";
  return (amountUsd / asset.price).toFixed(6);
}

function depositModal() {
  if (!state.depositDraft) return "";
  const draft = state.depositDraft;
  return `
    <div class="modal-layer" role="dialog" aria-modal="true" aria-labelledby="depositModalTitle">
      <section class="modal-card">
        <div class="drawer-head">
          <div>
            <p class="eyebrow">Deposit instructions</p>
            <h2 id="depositModalTitle">Send exact amount</h2>
          </div>
          <button class="icon-button" type="button" data-close-deposit aria-label="Close deposit instructions">x</button>
        </div>
        <div class="deposit-summary">
          <div><span>Amount</span><strong>${money(draft.amountUsd)}</strong></div>
          <div><span>Crypto</span><strong>${draft.asset}</strong></div>
          <div><span>Network</span><strong>${draft.network}</strong></div>
          <div><span>Estimated receive</span><strong>${estimateCryptoAmount(draft)} ${draft.asset}</strong></div>
        </div>
        <p class="helper strong-helper">Send exact amount to the address below. After sending, come back and click “I sent the money”.</p>
        <div class="deposit-address">
          <code>${platformWallet}</code>
          <button class="ghost-button" type="button" data-copy="${platformWallet}">Copy wallet address</button>
        </div>
        <label class="field">
          <span>Transaction hash (optional)</span>
          <input id="depositTxHash" placeholder="Paste hash after sending, if you have it">
        </label>
        <div class="form-row">
          <button class="button" type="button" data-confirm-deposit>I sent the money</button>
          <button class="ghost-button" type="button" data-close-deposit>Cancel</button>
        </div>
      </section>
    </div>
  `;
}

function marketsPage() {
  const filtered = marketData.filter((item) => {
    const matchesQuery = `${item.symbol} ${item.name}`.toLowerCase().includes(state.marketsQuery.toLowerCase());
    const matchesFilter = state.marketsFilter === "all" || item.category === state.marketsFilter;
    return matchesQuery && matchesFilter;
  });

  return `
    <section>
      <div class="section-head">
        <div><p class="eyebrow">Markets</p><h2>Crypto list</h2></div>
      </div>
      <div class="table-card">
        <div class="searchbar">
          <input id="marketSearch" value="${escapeAttr(state.marketsQuery)}" placeholder="Search BTC, ETH, USDT">
          <select id="marketFilter">
            <option value="all" ${state.marketsFilter === "all" ? "selected" : ""}>All markets</option>
            <option value="major" ${state.marketsFilter === "major" ? "selected" : ""}>Major coins</option>
            <option value="stable" ${state.marketsFilter === "stable" ? "selected" : ""}>Stablecoins</option>
            <option value="alt" ${state.marketsFilter === "alt" ? "selected" : ""}>Altcoins</option>
          </select>
        </div>
        <table>
          <thead><tr><th>Asset</th><th>Last price</th><th>24h change</th><th>Volume</th><th>Action</th></tr></thead>
          <tbody>
            ${filtered.map((item) => `
              <tr>
                <td><div class="coin"><span class="coin-icon">${item.symbol[0]}</span><strong>${item.symbol}</strong><span class="muted">${item.name}</span></div></td>
                <td>${money(item.price)}</td>
                <td class="${item.change >= 0 ? "gain" : "loss"}">${item.change >= 0 ? "+" : ""}${item.change}%</td>
                <td>${item.volume}</td>
                <td><button class="ghost-button" type="button" data-trade="${item.symbol}">Trade</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function tradingPage() {
  return `
    <section>
      <div class="section-head">
        <div><p class="eyebrow">Trading interface</p><h2>BTC / USDT</h2></div>
        <span class="gain">Mock price ${money(69420.12)}</span>
      </div>
      <div class="trading-grid">
        <article class="trade-panel">
          <div class="buy-sell-tabs">
            <button class="${state.tradeSide === "buy" ? "active" : ""}" type="button" data-side="buy">Buy</button>
            <button class="${state.tradeSide === "sell" ? "active" : ""}" type="button" data-side="sell">Sell</button>
          </div>
          <form class="auth-form" id="tradeForm">
          <label class="field"><span>Asset</span><select name="asset">${assetOptions("BTC")}</select></label>
            <label class="field"><span>Amount</span><input name="amount" type="number" min="0" step="0.0001" placeholder="0.00"></label>
            <label class="field"><span>Price</span><input name="price" type="number" min="0" step="0.01" value="69420.12"></label>
            <button class="button" type="submit">${state.tradeSide === "buy" ? "Place buy order" : "Place sell order"}</button>
          </form>
        </article>
        <article class="trade-panel">
          <h3>Price chart</h3>
          <div class="chart" aria-label="Mock price chart">
            <svg viewBox="0 0 600 360" role="img">
              <path d="M20 285 C90 240 115 260 160 205 S250 128 306 164 S396 246 450 145 S540 82 580 104" fill="none" stroke="#21c46b" stroke-width="5"/>
              <path d="M20 285 C90 240 115 260 160 205 S250 128 306 164 S396 246 450 145 S540 82 580 104 L580 360 L20 360 Z" fill="rgba(33,196,107,0.12)"/>
            </svg>
          </div>
        </article>
        <article class="trade-panel">
          <h3>Order book</h3>
          <div class="orderbook">
            ${[69450, 69436, 69428].map((price, index) => `<div class="book-row sell"><span>${money(price)}</span><span>${(0.18 + index * 0.07).toFixed(4)} BTC</span></div>`).join("")}
            <div class="book-row"><strong>${money(69420.12)}</strong><span class="muted">Spread 0.03%</span></div>
            ${[69412, 69398, 69380].map((price, index) => `<div class="book-row buy"><span>${money(price)}</span><span>${(0.22 + index * 0.08).toFixed(4)} BTC</span></div>`).join("")}
          </div>
        </article>
      </div>
    </section>
  `;
}

function walletPage() {
  const dashboard = state.dashboard;
  const deposits = dashboard.deposits || [];
  return `
    <section>
      <div class="section-head"><div><p class="eyebrow">Wallet</p><h2>Assets and manual requests</h2></div></div>
      <div class="wallet-grid">
        ${dashboard.balances.map(assetRow).join("")}
      </div>
    </section>
    <section class="dashboard-grid">
      <article class="panel">
        <h3>Deposit crypto</h3>
        <p class="muted">Enter the crypto type, network, and USD amount first. The deposit wallet appears in a secure popup before the admin request is created.</p>
        <p class="helper">Deposits are manual. Your balance changes only after admin approval.</p>
        <form class="auth-form" id="depositForm">
          <label class="field"><span>Crypto type</span><select name="asset" data-network-source="depositNetwork">${assetOptions("USDT")}</select></label>
          <label class="field"><span>Blockchain network</span><select name="network" id="depositNetwork">${networkOptions("USDT")}</select></label>
          <label class="field"><span>Deposit amount (USD)</span><input name="amountUsd" type="number" min="1" step="0.01" required placeholder="10, 50, 100"></label>
          <button class="button" type="submit">Show deposit address</button>
        </form>
      </article>
      <article class="panel">
        <h3>Request withdrawal</h3>
        <p class="muted">Withdrawals notify the admin. Admin sends funds manually and marks the request completed.</p>
        <form class="auth-form" id="withdrawForm">
          <label class="field"><span>Coin</span><select name="asset" data-network-source="withdrawNetwork">${assetOptions("USDT")}</select></label>
          <label class="field"><span>Blockchain network</span><select name="network" id="withdrawNetwork">${networkOptions("USDT")}</select></label>
          <label class="field"><span>Amount</span><input name="amount" type="number" min="0" step="0.0001" required placeholder="0.00"></label>
          <label class="field"><span>Your wallet address</span><input name="address" required placeholder="Destination wallet address"></label>
          <button class="button" type="submit">Request withdrawal</button>
        </form>
      </article>
    </section>
    <section class="panel">
      <div class="section-head"><div><p class="eyebrow">Send crypto</p><h2>Manual send request</h2></div></div>
      <form class="auth-form compact-form" id="sendForm">
        <label class="field"><span>Coin</span><select name="asset" data-network-source="sendNetwork">${assetOptions("USDT")}</select></label>
        <label class="field"><span>Blockchain network</span><select name="network" id="sendNetwork">${networkOptions("USDT")}</select></label>
        <label class="field"><span>Amount</span><input name="amount" type="number" min="0" step="0.0001" required placeholder="0.00"></label>
        <label class="field"><span>Recipient wallet</span><input name="address" required placeholder="Recipient wallet address"></label>
        <button class="button" type="submit">Create send request</button>
      </form>
    </section>
    <section class="table-card">
      <div class="section-head"><div><p class="eyebrow">Deposit requests</p><h2>Pending approval system</h2></div></div>
      <table>
        <thead><tr><th>Date</th><th>Crypto</th><th>Network</th><th>Amount</th><th>Status</th><th>Tx hash</th></tr></thead>
        <tbody>
          ${deposits.length ? deposits.map((deposit) => `
            <tr>
              <td>${deposit.date}</td>
              <td>${deposit.asset}</td>
              <td>${deposit.network || "-"}</td>
              <td>${money(deposit.amountUsd || 0)}</td>
              <td>${statusBadge(deposit.status)}</td>
              <td>${deposit.txHash || "Optional / not provided"}</td>
            </tr>
          `).join("") : `<tr><td colspan="6">No deposit requests yet.</td></tr>`}
        </tbody>
      </table>
    </section>
    <section class="table-card">
      <div class="section-head"><div><p class="eyebrow">History</p><h2>Transactions</h2></div></div>
      <table>
        <thead><tr><th>Type</th><th>Asset</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>
          ${dashboard.transactions.map((tx) => `<tr><td>${tx.type}</td><td>${tx.asset}</td><td>${tx.amount}</td><td>${tx.status}</td><td>${tx.date}</td></tr>`).join("")}
        </tbody>
      </table>
    </section>
  `;
}

function adminPage() {
  if (!state.user?.isAdmin) {
    return `<section class="panel"><h2>Admin access required</h2><p class="muted">This route is protected for admin users only.</p></section>`;
  }
  const deposits = state.adminDeposits || [];
  const pending = deposits.filter((deposit) => deposit.status === "Pending");
  return `
    <section class="table-card">
      <div class="section-head">
        <div><p class="eyebrow">Admin panel</p><h2>Deposit Requests</h2></div>
        <button class="ghost-button" type="button" data-load-admin>Refresh requests</button>
      </div>
      <p class="muted">Manual verification only. Approving a request credits the user balance; rejecting it leaves balances unchanged.</p>
      <table>
        <thead><tr><th>Date</th><th>User</th><th>Asset</th><th>Network</th><th>Amount</th><th>Status</th><th>Tx hash</th><th>Action</th></tr></thead>
        <tbody>
          ${deposits.length ? deposits.map((deposit) => `
            <tr>
              <td>${deposit.date}</td>
              <td>${deposit.userEmail || deposit.userId}</td>
              <td>${deposit.asset}</td>
              <td>${deposit.network || "-"}</td>
              <td>${money(deposit.amountUsd || 0)}</td>
              <td>${statusBadge(deposit.status)}</td>
              <td>${deposit.txHash || "Optional"}</td>
              <td>
                ${deposit.status === "Pending" ? `
                  <div class="table-actions">
                    <button class="button small-button" type="button" data-review-deposit="${deposit.id}" data-status="Approved">Approve</button>
                    <button class="danger-button small-button" type="button" data-review-deposit="${deposit.id}" data-status="Rejected">Reject</button>
                  </div>
                ` : "Reviewed"}
              </td>
            </tr>
          `).join("") : `<tr><td colspan="8">No deposit requests found.</td></tr>`}
        </tbody>
      </table>
      <p class="helper">${pending.length} pending deposit request${pending.length === 1 ? "" : "s"} waiting for confirmation.</p>
    </section>
  `;
}

function profilePage() {
  return `
    <section class="settings-grid">
      <article class="panel">
        <p class="eyebrow">Profile</p>
        <h2>Account details</h2>
        <div class="profile-list">
          <div class="profile-row"><span>Email</span><strong>${state.user.email}</strong></div>
          <div class="profile-row"><span>User ID</span><strong>${state.user.id}</strong></div>
          <div class="profile-row"><span>Auth provider</span><strong>${state.user.provider}</strong></div>
          <div class="profile-row"><span>Status</span><strong class="gain">Verified UI</strong></div>
        </div>
      </article>
      <article class="panel">
        <p class="eyebrow">Security</p>
        <h2>Settings</h2>
          <div class="profile-list">
          ${themeSettingsControl()}
          <div class="profile-row"><span>Two-factor authentication</span><button class="ghost-button" type="button">Enable</button></div>
          <div class="profile-row"><span>Login alerts</span><strong class="gain">On</strong></div>
          <div class="profile-row"><span>Withdrawal approval</span><strong>Manual admin review</strong></div>
        </div>
        <br>
        <button class="danger-button" type="button" data-logout>Logout</button>
      </article>
    </section>
  `;
}

function escapeAttr(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

async function refreshDashboard() {
  const data = await api("/dashboard");
  state.dashboard = data.dashboard;
  renderApp();
}

async function loadAdminDeposits() {
  if (!state.user?.isAdmin) return;
  const data = await api("/admin/deposits");
  state.adminDeposits = data.deposits;
}

app.addEventListener("click", async (event) => {
  const pageButton = event.target.closest("[data-page]");
  const authMode = event.target.closest("[data-auth-mode]");
  const tradeButton = event.target.closest("[data-trade]");
  const sideButton = event.target.closest("[data-side]");
  const logoutButton = event.target.closest("[data-logout]");
  const refreshButton = event.target.closest("[data-refresh]");
  const copyButton = event.target.closest("[data-copy]");
  const loadAdminButton = event.target.closest("[data-load-admin]");
  const reviewDepositButton = event.target.closest("[data-review-deposit]");
  const closeDepositButton = event.target.closest("[data-close-deposit]");
  const confirmDepositButton = event.target.closest("[data-confirm-deposit]");
  const themeToggleButton = event.target.closest("[data-theme-toggle]");
  const themeSetButton = event.target.closest("[data-theme-set]");

  if (themeToggleButton) {
    setTheme(state.theme === "dark" ? "light" : "dark");
    renderApp();
  }
  if (themeSetButton) {
    setTheme(themeSetButton.dataset.themeSet);
    renderApp();
  }
  if (pageButton) {
    event.preventDefault();
    if (!state.user) return;
    state.page = pageButton.dataset.page;
    if (state.page === "admin") await loadAdminDeposits();
    renderApp();
  }
  if (authMode) {
    state.authMode = authMode.dataset.authMode;
    renderAuth();
  }
  if (tradeButton) {
    state.page = "trade";
    renderApp();
  }
  if (sideButton) {
    state.tradeSide = sideButton.dataset.side;
    renderApp();
  }
  if (logoutButton) {
    await api("/logout", { method: "POST", body: "{}" });
    state.user = null;
    state.dashboard = null;
    renderAuth();
    showToast("Logged out");
  }
  if (refreshButton) {
    await refreshDashboard();
    showToast("Dashboard refreshed");
  }
  if (copyButton) {
    try {
      await navigator.clipboard.writeText(copyButton.dataset.copy);
      showToast("Wallet address copied");
    } catch {
      showToast("Copy failed. Select the address and copy it manually.");
    }
  }
  if (closeDepositButton) {
    state.depositDraft = null;
    renderApp();
  }
  if (confirmDepositButton && state.depositDraft) {
    const payload = {
      ...state.depositDraft,
      txHash: document.querySelector("#depositTxHash")?.value || ""
    };
    await api("/deposits", { method: "POST", body: JSON.stringify(payload) });
    state.depositDraft = null;
    await refreshDashboard();
    showToast("Admin notified. Deposit is pending confirmation.");
  }
  if (loadAdminButton) {
    await loadAdminDeposits();
    renderApp();
    showToast("Deposit requests refreshed");
  }
  if (reviewDepositButton) {
    const status = reviewDepositButton.dataset.status;
    await api(`/admin/deposits/${reviewDepositButton.dataset.reviewDeposit}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    await loadAdminDeposits();
    renderApp();
    showToast(`Deposit ${status.toLowerCase()}`);
  }
});

app.addEventListener("input", (event) => {
  if (event.target.id === "marketSearch") {
    state.marketsQuery = event.target.value;
    renderApp();
  }
  if (event.target.id === "marketFilter") {
    state.marketsFilter = event.target.value;
    renderApp();
  }
  if (event.target.matches("[data-network-source]")) {
    const networkSelect = document.querySelector(`#${event.target.dataset.networkSource}`);
    if (networkSelect) networkSelect.innerHTML = networkOptions(event.target.value);
  }
});

app.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const payload = Object.fromEntries(new FormData(form));

  try {
    if (form.id === "authForm") {
      const path = state.authMode === "login" ? "/login" : "/signup";
      const data = await api(path, { method: "POST", body: JSON.stringify(payload) });
      state.user = data.user;
      state.dashboard = data.dashboard;
      state.assets = data.assets || defaultAssets;
      state.page = "dashboard";
      renderApp();
      showToast(state.authMode === "login" ? "Logged in" : "Account created");
    }
    if (form.id === "depositForm") {
      state.depositDraft = payload;
      renderApp();
      showToast("Copy the wallet address, then confirm after sending");
    }
    if (form.id === "withdrawForm") {
      await api("/withdrawals", { method: "POST", body: JSON.stringify(payload) });
      await refreshDashboard();
      showToast("Withdrawal request sent to admin");
    }
    if (form.id === "sendForm") {
      await api("/sends", { method: "POST", body: JSON.stringify(payload) });
      await refreshDashboard();
      showToast("Send request created for manual processing");
    }
    if (form.id === "tradeForm") {
      showToast(`${state.tradeSide === "buy" ? "Buy" : "Sell"} order preview created`);
    }
  } catch (error) {
    showToast(error.message);
  }
});

(async function init() {
  await loadMe();
  renderApp();
})();
