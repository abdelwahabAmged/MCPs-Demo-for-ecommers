export function renderCartPage(cartId: string): string {
  return `<!DOCTYPE html>
<html lang="en" data-cart-id="${cartId}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Cart — Acme Store</title>
  <link rel="stylesheet" href="/static/cart.css">
</head>
<body>
  <div class="header">
    <h1>Acme Store</h1>
    <p>Your Shopping Cart</p>
  </div>
  <div class="container">
    <div id="cart" class="cart-card">
      <div class="empty"><div class="empty-icon">⏳</div><h2>Loading cart...</h2></div>
    </div>
    <div class="demo-badge"><span>Preview Environment</span></div>
  </div>
  <div id="toast" class="toast"></div>
  <script src="/static/cart.js"></script>
</body>
</html>`;
}
