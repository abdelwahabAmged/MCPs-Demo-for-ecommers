const HEADER_SVG = {
  logo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
};

function siteHeader(activePage: string, showAdmin = false): string {
  return `<header class="site-header">
  <div class="site-header-inner">
    <a href="/" class="site-logo">${HEADER_SVG.logo} Acme Store</a>
    <nav class="site-nav">
      <a href="/"${activePage === 'shop' ? ' class="active"' : ''}>Shop</a>
      <a href="/orders"${activePage === 'orders' ? ' class="active"' : ''}>Orders</a>
      <a href="/support"${activePage === 'support' ? ' class="active"' : ''}>Support</a>
      ${showAdmin ? `<a href="/admin?admin=1"${activePage === 'admin' ? ' class="active"' : ''}>Admin</a>` : ''}
    </nav>
    <a href="/cart" class="header-cart-link" title="Cart">${HEADER_SVG.cart}</a>
    <div class="user-bar" id="user-bar"></div>
  </div>
</header>`;
}

export function renderProductsPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shop — Acme Store</title>
  <link rel="icon" type="image/svg+xml" href="/static/favicon.svg">
  <link rel="stylesheet" href="/static/app.css">
  <link rel="stylesheet" href="/static/products.css">
</head>
<body>
  ${siteHeader('shop')}
  <div class="page-container">
    <div class="products-layout">
      <aside class="category-sidebar">
        <h3>Categories</h3>
        <ul class="category-list" id="category-list">
          <li><span style="color:#8e8e93;font-size:13px;padding:8px 12px;display:block">Loading...</span></li>
        </ul>
      </aside>
      <div class="products-area">
        <div class="products-toolbar">
          <h2 id="products-toolbar-title">All Products</h2>
          <div class="search-box">
            ${HEADER_SVG.search}
            <input type="text" id="product-search" placeholder="Search products...">
          </div>
        </div>
        <div class="product-grid" id="product-grid"></div>
        <div id="scroll-sentinel"></div>
      </div>
    </div>
    <footer class="sw-footer">
      <div class="sw-footer-inner">
        <a href="https://scandiweb.ai/ai-app" target="_blank" rel="noopener" class="sw-logo">
          <span class="sw-logo-word">scandiweb</span>
          <span class="sw-footer-dot">&middot;</span>
          <span class="sw-footer-label">AI App Demo</span>
        </a>
      </div>
    </footer>
  </div>
  <div id="toast" class="toast"></div>
  <script src="/static/app.js"></script>
  <script src="/static/products.js"></script>
</body>
</html>`;
}

export function renderProductDetailPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Product — Acme Store</title>
  <link rel="icon" type="image/svg+xml" href="/static/favicon.svg">
  <link rel="stylesheet" href="/static/app.css">
  <link rel="stylesheet" href="/static/pdp.css">
</head>
<body>
  ${siteHeader('shop')}
  <div class="page-container pdp-container">
    <div id="pdp-content">
      <div class="pdp-loading"><div class="spinner"></div></div>
    </div>
    <footer class="sw-footer">
      <div class="sw-footer-inner">
        <a href="https://scandiweb.ai/ai-app" target="_blank" rel="noopener" class="sw-logo">
          <span class="sw-logo-word">scandiweb</span>
          <span class="sw-footer-dot">&middot;</span>
          <span class="sw-footer-label">AI App Demo</span>
        </a>
      </div>
    </footer>
  </div>
  <div id="toast" class="toast"></div>
  <script src="/static/app.js"></script>
  <script src="/static/pdp.js"></script>
</body>
</html>`;
}

export function renderCartPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Cart — Acme Store</title>
  <link rel="icon" type="image/svg+xml" href="/static/favicon.svg">
  <link rel="stylesheet" href="/static/app.css">
  <link rel="stylesheet" href="/static/cart.css">
</head>
<body>
  ${siteHeader('cart')}
  <div class="page-container" style="max-width:1000px">
    <div class="cart-page-title">
      <h1>Shopping Cart <span id="cart-title-count" style="color:#8e8e93;font-weight:400;font-size:18px"></span></h1>
    </div>
    <div class="cart-layout">
      <div id="cart" class="cart-card">
        <div class="cart-loading"><div class="spinner"></div>Loading your cart...</div>
      </div>
      <div id="cart-summary"></div>
    </div>
    <footer class="sw-footer">
      <div class="sw-footer-inner">
        <a href="https://scandiweb.ai/ai-app" target="_blank" rel="noopener" class="sw-logo">
          <span class="sw-logo-word">scandiweb</span>
          <span class="sw-footer-dot">&middot;</span>
          <span class="sw-footer-label">AI App Demo</span>
        </a>
      </div>
    </footer>
  </div>
  <div id="toast" class="toast"></div>
  <script src="/static/app.js"></script>
  <script src="/static/cart.js"></script>
</body>
</html>`;
}

export function renderCheckoutPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Checkout — Acme Store</title>
  <link rel="icon" type="image/svg+xml" href="/static/favicon.svg">
  <link rel="stylesheet" href="/static/app.css">
  <link rel="stylesheet" href="/static/checkout.css">
</head>
<body>
  ${siteHeader('checkout')}
  <div class="page-container" style="max-width:1000px">
    <div class="checkout-page-title">
      <h1>Checkout</h1>
      <p>Review your order and complete the purchase.</p>
    </div>
    <div class="checkout-layout">
      <div class="checkout-form-card" id="checkout-form">
        <div class="checkout-loading"><div class="spinner"></div>Loading checkout...</div>
      </div>
      <div id="checkout-sidebar"></div>
    </div>
    <footer class="sw-footer">
      <div class="sw-footer-inner">
        <a href="https://scandiweb.ai/ai-app" target="_blank" rel="noopener" class="sw-logo">
          <span class="sw-logo-word">scandiweb</span>
          <span class="sw-footer-dot">&middot;</span>
          <span class="sw-footer-label">AI App Demo</span>
        </a>
      </div>
    </footer>
  </div>
  <div id="toast" class="toast"></div>
  <script src="/static/app.js"></script>
  <script src="/static/checkout.js"></script>
</body>
</html>`;
}

export function renderOrdersPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Orders — Acme Store</title>
  <link rel="icon" type="image/svg+xml" href="/static/favicon.svg">
  <link rel="stylesheet" href="/static/app.css">
  <link rel="stylesheet" href="/static/orders.css">
</head>
<body>
  ${siteHeader('orders')}
  <div class="page-container">
    <div class="orders-page-title">
      <h1>My Orders <span id="orders-count" style="color:#8e8e93;font-weight:400;font-size:18px"></span></h1>
    </div>
    <div id="orders-content">
      <div class="orders-loading"><div class="spinner"></div>Loading orders...</div>
    </div>
    <footer class="sw-footer">
      <div class="sw-footer-inner">
        <a href="https://scandiweb.ai/ai-app" target="_blank" rel="noopener" class="sw-logo">
          <span class="sw-logo-word">scandiweb</span>
          <span class="sw-footer-dot">&middot;</span>
          <span class="sw-footer-label">AI App Demo</span>
        </a>
      </div>
    </footer>
  </div>
  <script src="/static/app.js"></script>
  <script src="/static/orders.js"></script>
</body>
</html>`;
}

export function renderOrderDetailPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Details — Acme Store</title>
  <link rel="icon" type="image/svg+xml" href="/static/favicon.svg">
  <link rel="stylesheet" href="/static/app.css">
  <link rel="stylesheet" href="/static/orders.css">
</head>
<body>
  ${siteHeader('orders')}
  <div class="page-container">
    <div id="orders-content">
      <div class="orders-loading"><div class="spinner"></div>Loading order...</div>
    </div>
    <footer class="sw-footer">
      <div class="sw-footer-inner">
        <a href="https://scandiweb.ai/ai-app" target="_blank" rel="noopener" class="sw-logo">
          <span class="sw-logo-word">scandiweb</span>
          <span class="sw-footer-dot">&middot;</span>
          <span class="sw-footer-label">AI App Demo</span>
        </a>
      </div>
    </footer>
  </div>
  <script src="/static/app.js"></script>
  <script src="/static/orders.js"></script>
</body>
</html>`;
}

export interface LoginPageOptions {
  hasGoogle: boolean;
  hasGithub: boolean;
}

export function renderTicketsPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Support Tickets — Acme Store</title>
  <link rel="icon" type="image/svg+xml" href="/static/favicon.svg">
  <link rel="stylesheet" href="/static/app.css">
  <link rel="stylesheet" href="/static/tickets.css">
</head>
<body>
  ${siteHeader('support')}
  <div class="page-container" style="max-width:900px">
    <div class="tickets-page-title">
      <h1>Support Tickets <span id="tickets-count" style="color:#8e8e93;font-weight:400"></span></h1>
      <p>Track issues with your orders and get help from our team.</p>
    </div>
    <div class="tickets-toolbar">
      <div></div>
      <button class="new-ticket-btn" id="new-ticket-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New Ticket
      </button>
    </div>
    <div id="tickets-content">
      <div class="tickets-loading"><div class="spinner"></div>Loading tickets...</div>
    </div>
  </div>
  <script src="/static/app.js"></script>
  <script src="/static/tickets.js"></script>
</body>
</html>`;
}

export function renderTicketDetailPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket Details — Acme Store</title>
  <link rel="icon" type="image/svg+xml" href="/static/favicon.svg">
  <link rel="stylesheet" href="/static/app.css">
  <link rel="stylesheet" href="/static/tickets.css">
</head>
<body>
  ${siteHeader('support')}
  <div class="page-container" style="max-width:1000px">
    <div id="tickets-content">
      <div class="tickets-loading"><div class="spinner"></div>Loading ticket details...</div>
    </div>
  </div>
  <script src="/static/app.js"></script>
  <script src="/static/tickets.js"></script>
</body>
</html>`;
}

export function renderAdminDashboardPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Dashboard — Acme Store</title>
  <link rel="icon" type="image/svg+xml" href="/static/favicon.svg">
  <link rel="stylesheet" href="/static/app.css">
  <link rel="stylesheet" href="/static/admin.css">
</head>
<body data-admin-view="dashboard">
  ${siteHeader('admin', true)}
  <main class="admin-shell">
    <div class="admin-topbar">
      <div>
        <h1>Store Attention</h1>
        <p>Weekly operational signals across stock, sales, traffic, conversion, and support.</p>
      </div>
      <nav class="admin-tabs">
        <a href="/admin?admin=1" class="active">Attention</a>
        <a href="/admin/analytics?admin=1">Analytics</a>
        <a href="/admin/support?admin=1">Support</a>
      </nav>
      <button class="admin-reset-btn" id="admin-reset-btn" type="button">Reset Demo</button>
    </div>
    <section id="admin-content" class="admin-loading">Loading attention report...</section>
  </main>
  <script src="/static/app.js"></script>
  <script src="/static/admin.js"></script>
</body>
</html>`;
}

export function renderAdminAnalyticsPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Analytics — Acme Store</title>
  <link rel="icon" type="image/svg+xml" href="/static/favicon.svg">
  <link rel="stylesheet" href="/static/app.css">
  <link rel="stylesheet" href="/static/admin.css">
</head>
<body data-admin-view="analytics">
  ${siteHeader('admin', true)}
  <main class="admin-shell">
    <div class="admin-topbar">
      <div>
        <h1>Product Analytics</h1>
        <p>Traffic, conversion, units sold, revenue, stock, and incoming reorder state.</p>
      </div>
      <nav class="admin-tabs">
        <a href="/admin?admin=1">Attention</a>
        <a href="/admin/analytics?admin=1" class="active">Analytics</a>
        <a href="/admin/support?admin=1">Support</a>
      </nav>
      <button class="admin-reset-btn" id="admin-reset-btn" type="button">Reset Demo</button>
    </div>
    <section id="admin-content" class="admin-loading">Loading product analytics...</section>
  </main>
  <script src="/static/app.js"></script>
  <script src="/static/admin.js"></script>
</body>
</html>`;
}

export function renderAdminSupportPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Support — Acme Store</title>
  <link rel="icon" type="image/svg+xml" href="/static/favicon.svg">
  <link rel="stylesheet" href="/static/app.css">
  <link rel="stylesheet" href="/static/admin.css">
</head>
<body data-admin-view="support">
  ${siteHeader('admin', true)}
  <main class="admin-shell">
    <div class="admin-topbar">
      <div>
        <h1>Support Inbox</h1>
        <p>Operator view of tickets and logged customer replies.</p>
      </div>
      <nav class="admin-tabs">
        <a href="/admin?admin=1">Attention</a>
        <a href="/admin/analytics?admin=1">Analytics</a>
        <a href="/admin/support?admin=1" class="active">Support</a>
      </nav>
      <button class="admin-reset-btn" id="admin-reset-btn" type="button">Reset Demo</button>
    </div>
    <section id="admin-content" class="admin-loading">Loading support inbox...</section>
  </main>
  <script src="/static/app.js"></script>
  <script src="/static/admin.js"></script>
</body>
</html>`;
}

export function renderLoginPage(options: LoginPageOptions): string {
  const googleBtn = options.hasGoogle
    ? `<button class="social-btn google-btn" onclick="signIn('google')">
        <svg viewBox="0 0 24 24" width="20" height="20"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Continue with Google
      </button>`
    : "";

  const githubBtn = options.hasGithub
    ? `<button class="social-btn github-btn" onclick="signIn('github')">
        <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>
        Continue with GitHub
      </button>`
    : "";

  const noProviders = !options.hasGoogle && !options.hasGithub;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In — Acme Store</title>
  <link rel="icon" type="image/svg+xml" href="/static/favicon.svg">
  <link rel="stylesheet" href="/static/app.css">
  <style>
    .login-container {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      min-height: calc(100vh - 52px - 50px);
    }
    .login-card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 2px 16px rgba(0,0,0,0.08);
      padding: 40px;
      max-width: 420px;
      width: 100%;
      text-align: center;
    }
    .login-card h2 {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .login-card .subtitle {
      color: #666;
      font-size: 14px;
      margin-bottom: 32px;
      line-height: 1.5;
    }
    .social-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      width: 100%;
      padding: 14px 20px;
      border: 1px solid #ddd;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
      background: white;
      color: #333;
      margin-bottom: 12px;
    }
    .social-btn:hover {
      background: #f8f8fa;
      border-color: #bbb;
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .social-btn:active { transform: translateY(0); }
    .google-btn:hover { border-color: #4285F4; }
    .github-btn { background: #24292e; color: white; border-color: #24292e; }
    .github-btn:hover { background: #2f363d; border-color: #2f363d; }
    .divider {
      display: flex;
      align-items: center;
      margin: 24px 0;
      color: #aaa;
      font-size: 12px;
    }
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      border-top: 1px solid #eee;
    }
    .divider span { padding: 0 12px; }
    .info-text {
      color: #888;
      font-size: 13px;
      line-height: 1.5;
    }
    .no-providers {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 8px;
      padding: 16px;
      font-size: 13px;
      color: #664d03;
      line-height: 1.5;
    }
    .no-providers code {
      background: #f8f9fa;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
    }
    .user-card {
      display: none;
      padding: 20px;
      text-align: center;
    }
    .user-card.visible { display: block; }
    .login-user-avatar {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      margin: 0 auto 12px;
      background: #e8e8ed;
      object-fit: cover;
    }
    .user-name-text { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .user-email-text { color: #666; font-size: 14px; margin-bottom: 16px; }
    .sign-out-btn {
      background: none;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 8px 20px;
      font-size: 13px;
      cursor: pointer;
      color: #666;
    }
    .sign-out-btn:hover { background: #f5f5f7; border-color: #bbb; }
    .loading { opacity: 0.5; pointer-events: none; }
  </style>
</head>
<body>
  ${siteHeader('login')}
  <div class="login-container">
    <div class="login-card">
      <div id="login-form">
        <h2>Welcome</h2>
        <p class="subtitle">Sign in to track orders, manage your cart, and checkout.</p>
        ${
          noProviders
            ? `<div class="no-providers">
              No auth providers configured.<br><br>
              Set <code>GOOGLE_CLIENT_ID</code> + <code>GOOGLE_CLIENT_SECRET</code><br>
              or <code>GITHUB_CLIENT_ID</code> + <code>GITHUB_CLIENT_SECRET</code><br>
              as environment variables and restart the server.
            </div>`
            : `${googleBtn}${githubBtn}
            <div class="divider"><span>secure sign-in</span></div>
            <p class="info-text">We only access your name, email, and profile picture. No passwords stored.</p>`
        }
      </div>
      <div id="user-card" class="user-card">
        <img id="login-user-avatar" class="login-user-avatar" src="" alt="">
        <div id="user-name-text" class="user-name-text"></div>
        <div id="user-email-text" class="user-email-text"></div>
        <p style="color:#2d7a2d;font-size:14px;margin-bottom:16px">Signed in successfully</p>
        <button class="sign-out-btn" onclick="signOut()">Sign out</button>
      </div>
    </div>
  </div>
  <footer class="sw-footer">
      <div class="sw-footer-inner">
        <a href="https://scandiweb.ai/ai-app" target="_blank" rel="noopener" class="sw-logo">
          <span class="sw-logo-word">scandiweb</span>
          <span class="sw-footer-dot">&middot;</span>
          <span class="sw-footer-label">AI App Demo</span>
        </a>
      </div>
    </footer>
  <script src="/static/app.js"></script>
  <script>
    async function checkUser() {
      try {
        const res = await fetch('/api/me');
        const data = await res.json();
        if (data.user) {
          showUser(data.user);
          return true;
        }
      } catch {}
      return false;
    }

    function showUser(user) {
      document.getElementById('login-form').style.display = 'none';
      var card = document.getElementById('user-card');
      card.classList.add('visible');
      document.getElementById('user-name-text').textContent = user.name;
      document.getElementById('user-email-text').textContent = user.email;
      if (user.image) {
        document.getElementById('login-user-avatar').src = user.image;
      }
    }

    function signIn(provider) {
      var callbackURL = window.location.origin + '/login';
      fetch('/api/auth/sign-in/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider: provider, callbackURL: callbackURL })
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.url) window.location.href = data.url;
      })
      .catch(function(err) { console.error('Sign-in error', err); });
    }

    function signOut() {
      fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' })
        .then(function() { window.location.reload(); });
    }

    checkUser();
  </script>
</body>
</html>`;
}
