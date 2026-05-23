import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { createHash, pbkdf2Sync, randomBytes } from "node:crypto";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const env = globalThis.process?.env || {};
const port = Number(env.PORT || 4173);
const dbFile = resolve(root, "ethiocrypto-db.json");
const platformWallet = "0xHABESHA-EXCHANGE-DEPOSIT-VAULT-2026";
const assets = {
  BTC: { name: "Bitcoin", price: 69420.12, networks: ["Bitcoin"] },
  ETH: { name: "Ethereum", price: 3564.55, networks: ["Ethereum", "Arbitrum", "Base"] },
  USDT: { name: "Tether", price: 1, networks: ["TRC20", "ERC20", "BEP20", "TON"] },
  TON: { name: "Toncoin", price: 6.42, networks: ["TON"] },
  TRX: { name: "TRON", price: 0.13, networks: ["TRON"] },
  SOL: { name: "Solana", price: 182.11, networks: ["Solana"] },
  BNB: { name: "BNB", price: 612.4, networks: ["BNB Smart Chain", "BEP2"] },
  ADA: { name: "Cardano", price: 0.62, networks: ["Cardano"] }
};
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png"
};

let db = await loadDb();
normalizeDb();
await saveDb();

async function loadDb() {
  try {
    const loaded = JSON.parse(await readFile(dbFile, "utf8"));
    return { users: [], sessions: {}, deposits: [], withdrawals: [], sends: [], adminNotifications: [], ...loaded };
  } catch {
    return { users: [], sessions: {}, deposits: [], withdrawals: [], sends: [], adminNotifications: [] };
  }
}

async function saveDb() {
  await writeFile(dbFile, JSON.stringify(db, null, 2));
}

function json(response, status, payload, headers = {}) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt] = stored.split(":");
  return hashPassword(password, salt) === stored;
}

function makeId(prefix) {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function getCookie(request, name) {
  const cookies = request.headers.cookie || "";
  return cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.split("=")[1];
}

function sessionUser(request) {
  const token = getCookie(request, "ec_session");
  const userId = token && db.sessions[token];
  return db.users.find((user) => user.id === userId);
}

function setSession(response, user) {
  const token = randomBytes(32).toString("hex");
  db.sessions[token] = user.id;
  response.setHeader("Set-Cookie", `ec_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`);
}

function clearSession(response, request) {
  const token = getCookie(request, "ec_session");
  if (token) delete db.sessions[token];
  response.setHeader("Set-Cookie", "ec_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
}

function publicUser(user) {
  return { id: user.id, email: user.email, provider: user.provider, isAdmin: isAdmin(user) };
}

function isAdmin(user) {
  return user?.role === "admin" || user?.email === "admin@ethiocrypto.local" || user?.email?.startsWith("admin@");
}

function normalizeDb() {
  db.sends ||= [];
  db.deposits ||= [];
  db.withdrawals ||= [];
  db.adminNotifications ||= [];
  db.users.forEach((user) => {
    user.dashboard ||= createDashboard(user.email);
    user.dashboard.balances ||= [];
    Object.entries(assets).forEach(([symbol, asset]) => {
      if (!user.dashboard.balances.some((balance) => balance.symbol === symbol)) {
        user.dashboard.balances.push({ symbol, name: asset.name, amount: "0.0000", usd: 0 });
      }
    });
    if (isAdmin(user)) user.role = "admin";
  });
  db.deposits.forEach((deposit) => {
    deposit.status = normalizeDepositStatus(deposit.status);
    deposit.amountUsd = Number(deposit.amountUsd ?? deposit.usdAmount ?? deposit.amount ?? 0);
    deposit.network ||= assets[deposit.asset]?.networks?.[0] || "Manual";
    deposit.txHash ||= "";
  });
}

function normalizeDepositStatus(status) {
  if (status === "Pending admin review" || status === "Pending") return "Pending";
  if (status === "Completed" || status === "Approved") return "Approved";
  if (status === "Rejected") return "Rejected";
  return "Pending";
}

function applyApprovedDeposit(user, deposit) {
  const asset = assets[deposit.asset] || assets.USDT;
  const amountUsd = Number(deposit.amountUsd || 0);
  const amountCrypto = amountUsd / asset.price;
  const balance = user.dashboard.balances.find((item) => item.symbol === deposit.asset);
  if (!balance) {
    user.dashboard.balances.push({ symbol: deposit.asset, name: asset.name, amount: amountCrypto.toFixed(6), usd: amountUsd });
  } else {
    balance.amount = (Number(balance.amount || 0) + amountCrypto).toFixed(6);
    balance.usd = Number(balance.usd || 0) + amountUsd;
  }
  user.dashboard.portfolioValue = Number(user.dashboard.portfolioValue || 0) + amountUsd;
  user.dashboard.activity.unshift({
    type: "credit",
    title: `Deposit approved: ${deposit.asset}`,
    amount: `+${moneyText(amountUsd)}`,
    date: new Date().toLocaleString()
  });
}

function moneyText(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function createDashboard(seed) {
  const n = Number.parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 4), 16);
  const btc = (0.014 + (n % 8) / 1000).toFixed(5);
  const eth = (0.32 + (n % 12) / 100).toFixed(4);
  const usdt = (740 + (n % 230)).toFixed(2);
  return {
    portfolioValue: 4200 + (n % 3100),
    dailyChange: (1.2 + (n % 24) / 10).toFixed(2),
    balances: [
      { symbol: "BTC", name: "Bitcoin", amount: btc, usd: Number(btc) * 69420.12 },
      { symbol: "ETH", name: "Ethereum", amount: eth, usd: Number(eth) * 3564.55 },
      { symbol: "USDT", name: "Tether", amount: usdt, usd: Number(usdt) },
      { symbol: "TON", name: "Toncoin", amount: "0.0000", usd: 0 },
      { symbol: "TRX", name: "TRON", amount: "0.0000", usd: 0 },
      { symbol: "SOL", name: "Solana", amount: "0.0000", usd: 0 },
      { symbol: "BNB", name: "BNB", amount: "0.0000", usd: 0 },
      { symbol: "ADA", name: "Cardano", amount: "0.0000", usd: 0 }
    ],
    activity: [
      { type: "credit", title: "Welcome portfolio created", amount: "+mock balance", date: "Today" },
      { type: "debit", title: "Security review completed", amount: "manual checks", date: "Yesterday" },
      { type: "credit", title: "Market watchlist synced", amount: "BTC ETH USDT", date: "2 days ago" }
    ],
    transactions: [
      { type: "Deposit", asset: "USDT", amount: "250.00", status: "Completed", date: "Mock data" },
      { type: "Trade", asset: "ETH", amount: "0.12", status: "Filled", date: "Mock data" }
    ]
  };
}

function dashboardFor(user) {
  const deposits = db.deposits.filter((item) => item.userId === user.id);
  const withdrawals = db.withdrawals.filter((item) => item.userId === user.id);
  const sends = db.sends.filter((item) => item.userId === user.id);
  const pendingDepositTotal = deposits
    .filter((item) => item.status === "Pending")
    .reduce((sum, item) => sum + Number(item.amountUsd || 0), 0);
  return {
    ...user.dashboard,
    pendingDepositTotal,
    deposits,
    withdrawals,
    sends,
    transactions: [
      ...deposits.map((item) => ({ type: "Deposit", asset: item.asset, amount: item.amount || moneyText(item.amountUsd), status: item.status, date: item.date })),
      ...withdrawals.map((item) => ({ type: "Withdrawal", asset: item.asset, amount: item.amount, status: item.status, date: item.date })),
      ...sends.map((item) => ({ type: "Send", asset: item.asset, amount: item.amount, status: item.status, date: item.date })),
      ...user.dashboard.transactions
    ]
  };
}

function requireUser(request, response) {
  const user = sessionUser(request);
  if (!user) {
    json(response, 401, { error: "Login required" });
    return null;
  }
  return user;
}

async function handleApi(request, response, url) {
  if (url.pathname === "/api/signup" && request.method === "POST") {
    const body = await readBody(request);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || password.length < 6) return json(response, 400, { error: "Email and 6 character password required" });
    if (db.users.some((user) => user.email === email)) return json(response, 409, { error: "Account already exists" });

    const user = { id: makeId("usr"), email, passwordHash: hashPassword(password), provider: "email", role: email.startsWith("admin@") ? "admin" : "user", dashboard: createDashboard(email) };
    db.users.push(user);
    setSession(response, user);
    await saveDb();
    return json(response, 201, { user: publicUser(user), dashboard: dashboardFor(user), assets });
  }

  if (url.pathname === "/api/login" && request.method === "POST") {
    const body = await readBody(request);
    const email = String(body.email || "").trim().toLowerCase();
    const user = db.users.find((item) => item.email === email && item.passwordHash);
    if (!user || !verifyPassword(String(body.password || ""), user.passwordHash)) return json(response, 401, { error: "Invalid email or password" });
    setSession(response, user);
    await saveDb();
    return json(response, 200, { user: publicUser(user), dashboard: dashboardFor(user), assets });
  }

  if (url.pathname === "/api/logout" && request.method === "POST") {
    clearSession(response, request);
    await saveDb();
    return json(response, 200, { ok: true });
  }

  if (url.pathname === "/api/me" && request.method === "GET") {
    const user = requireUser(request, response);
    if (!user) return;
    return json(response, 200, { user: publicUser(user), dashboard: dashboardFor(user), depositWallet: platformWallet, assets });
  }

  if (url.pathname === "/api/dashboard" && request.method === "GET") {
    const user = requireUser(request, response);
    if (!user) return;
    return json(response, 200, { dashboard: dashboardFor(user), assets });
  }

  if (url.pathname === "/api/deposits" && request.method === "POST") {
    const user = requireUser(request, response);
    if (!user) return;
    const body = await readBody(request);
    const assetSymbol = String(body.asset || "USDT").toUpperCase();
    const amountUsd = Number(body.amountUsd || body.amount || 0);
    if (!assets[assetSymbol]) return json(response, 400, { error: "Unsupported asset" });
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) return json(response, 400, { error: "Enter a valid deposit amount" });
    const item = {
      id: makeId("dep"),
      userId: user.id,
      userEmail: user.email,
      asset: assetSymbol,
      amountUsd,
      amount: moneyText(amountUsd),
      network: String(body.network || assets[assetSymbol].networks[0]),
      txHash: String(body.txHash || ""),
      status: "Pending",
      depositWallet: platformWallet,
      date: new Date().toLocaleString()
    };
    db.deposits.unshift(item);
    db.adminNotifications.unshift({ id: makeId("note"), type: "deposit", userId: user.id, message: `${user.email} submitted ${moneyText(amountUsd)} ${item.asset} deposit`, date: item.date });
    await saveDb();
    return json(response, 201, { deposit: item });
  }

  if (url.pathname === "/api/withdrawals" && request.method === "POST") {
    const user = requireUser(request, response);
    if (!user) return;
    const body = await readBody(request);
    const assetSymbol = String(body.asset || "USDT").toUpperCase();
    const item = {
      id: makeId("wd"),
      userId: user.id,
      userEmail: user.email,
      asset: assetSymbol,
      amount: String(body.amount || "0"),
      network: String(body.network || assets[assetSymbol]?.networks?.[0] || "Manual"),
      address: String(body.address || ""),
      status: "Pending manual send",
      date: new Date().toLocaleString()
    };
    db.withdrawals.unshift(item);
    db.adminNotifications.unshift({ id: makeId("note"), type: "withdrawal", userId: user.id, message: `${user.email} requested ${item.amount} ${item.asset} withdrawal`, date: item.date });
    await saveDb();
    return json(response, 201, { withdrawal: item });
  }

  if (url.pathname === "/api/sends" && request.method === "POST") {
    const user = requireUser(request, response);
    if (!user) return;
    const body = await readBody(request);
    const assetSymbol = String(body.asset || "USDT").toUpperCase();
    const item = {
      id: makeId("send"),
      userId: user.id,
      userEmail: user.email,
      asset: assetSymbol,
      amount: String(body.amount || "0"),
      network: String(body.network || assets[assetSymbol]?.networks?.[0] || "Manual"),
      address: String(body.address || ""),
      status: "Pending manual send",
      date: new Date().toLocaleString()
    };
    db.sends.unshift(item);
    db.adminNotifications.unshift({ id: makeId("note"), type: "send", userId: user.id, message: `${user.email} created a ${item.amount} ${item.asset} send request`, date: item.date });
    await saveDb();
    return json(response, 201, { send: item });
  }

  if (url.pathname === "/api/admin/deposits" && request.method === "GET") {
    const user = requireUser(request, response);
    if (!user) return;
    if (!isAdmin(user)) return json(response, 403, { error: "Admin access required" });
    return json(response, 200, { deposits: db.deposits });
  }

  const adminDepositMatch = url.pathname.match(/^\/api\/admin\/deposits\/([^/]+)$/);
  if (adminDepositMatch && request.method === "PATCH") {
    const admin = requireUser(request, response);
    if (!admin) return;
    if (!isAdmin(admin)) return json(response, 403, { error: "Admin access required" });
    const body = await readBody(request);
    const deposit = db.deposits.find((item) => item.id === adminDepositMatch[1]);
    if (!deposit) return json(response, 404, { error: "Deposit request not found" });
    if (deposit.status !== "Pending") return json(response, 409, { error: "Deposit already reviewed" });
    const nextStatus = body.status === "Approved" ? "Approved" : body.status === "Rejected" ? "Rejected" : "";
    if (!nextStatus) return json(response, 400, { error: "Use Approved or Rejected" });

    deposit.status = nextStatus;
    deposit.reviewedAt = new Date().toLocaleString();
    deposit.reviewedBy = admin.email;
    if (nextStatus === "Approved") {
      const owner = db.users.find((item) => item.id === deposit.userId);
      if (owner) applyApprovedDeposit(owner, deposit);
    }
    db.adminNotifications.unshift({ id: makeId("note"), type: "deposit-review", userId: deposit.userId, message: `${admin.email} marked ${deposit.id} ${nextStatus}`, date: deposit.reviewedAt });
    await saveDb();
    return json(response, 200, { deposit });
  }

  return json(response, 404, { error: "API route not found" });
}

function googleConfig() {
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackUrl: env.GOOGLE_CALLBACK_URL || `http://127.0.0.1:${port}/auth/google/callback`
  };
}

async function signInDemoGoogle(response) {
  const email = "google.demo@habesha.local";
  let user = db.users.find((item) => item.email === email);
  if (!user) {
    user = { id: makeId("usr"), email, passwordHash: "", provider: "google", role: "user", dashboard: createDashboard(email) };
    db.users.push(user);
    normalizeDb();
  }
  setSession(response, user);
  await saveDb();
  response.writeHead(302, { Location: "/" });
  response.end();
}

async function handleGoogleAuth(request, response, url) {
  const config = googleConfig();
  if (!config.clientId || !config.clientSecret) {
    return await signInDemoGoogle(response);
  }

  if (url.pathname === "/auth/google") {
    const state = randomBytes(18).toString("hex");
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.callbackUrl,
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account"
    });
    response.setHeader("Set-Cookie", `ec_oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`);
    response.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
    response.end();
    return;
  }

  if (url.pathname === "/auth/google/callback") {
    const expectedState = getCookie(request, "ec_oauth_state");
    if (!expectedState || expectedState !== url.searchParams.get("state")) {
      response.writeHead(302, { Location: "/?google=invalid-state" });
      response.end();
      return;
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: url.searchParams.get("code") || "",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.callbackUrl,
        grant_type: "authorization_code"
      })
    });
    const tokenData = await tokenResponse.json();
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile = await profileResponse.json();
    const email = String(profile.email || "").toLowerCase();
    let user = db.users.find((item) => item.email === email);
    if (!user) {
      user = { id: makeId("usr"), email, passwordHash: "", provider: "google", dashboard: createDashboard(email) };
      db.users.push(user);
    }
    setSession(response, user);
    await saveDb();
    response.writeHead(302, { Location: "/" });
    response.end();
  }
}

async function serveStatic(response, url) {
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = resolve(root, `.${pathname}`);
  if (filePath !== root && !filePath.startsWith(root + sep)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, { "Content-Type": types[extname(filePath)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) return await handleApi(request, response, url);
    if (url.pathname.startsWith("/auth/google")) return await handleGoogleAuth(request, response, url);
    return await serveStatic(response, url);
  } catch (error) {
    return json(response, 500, { error: error.message || "Server error" });
  }
});

function listen(startPort) {
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE") {
      listen(startPort + 1);
      return;
    }
    throw error;
  });
  server.listen(startPort, "127.0.0.1", () => {
  console.log(`Habesha Exchange running at http://127.0.0.1:${startPort}`);
  });
}

listen(port);
