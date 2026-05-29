(function () {
  var state = {
    products: [],
    categories: [],
    activeCategory: null,
    searchQuery: ''
  };

  function renderStars(rating) {
    var full = Math.floor(rating);
    var half = rating - full >= 0.5 ? 1 : 0;
    var empty = 5 - full - half;
    return '<span class="stars">' +
      '\u2605'.repeat(full) +
      (half ? '\u00BD' : '') +
      '\u2606'.repeat(empty) +
      '</span>';
  }

  function stockLabel(status) {
    switch (status) {
      case 'in_stock':  return '<span class="product-card-stock stock-in">In Stock</span>';
      case 'low_stock': return '<span class="product-card-stock stock-low">Low Stock</span>';
      case 'out_of_stock': return '<span class="product-card-stock stock-out">Out of Stock</span>';
      default: return '';
    }
  }

  function filterProducts() {
    var items = state.products;
    if (state.activeCategory) {
      items = items.filter(function (p) { return p.category === state.activeCategory; });
    }
    if (state.searchQuery) {
      var q = state.searchQuery.toLowerCase();
      items = items.filter(function (p) {
        return p.name.toLowerCase().indexOf(q) !== -1 ||
               p.brand.toLowerCase().indexOf(q) !== -1 ||
               p.category.toLowerCase().indexOf(q) !== -1 ||
               (p.subcategory && p.subcategory.toLowerCase().indexOf(q) !== -1);
      });
    }
    return items;
  }

  function renderCategories() {
    var list = document.getElementById('category-list');
    if (!list) return;

    var allCount = state.products.length;
    var html = '<li><a href="#" data-category="" class="' + (!state.activeCategory ? 'active' : '') + '">' +
      'All Products <span class="cat-count">' + allCount + '</span></a></li>';

    state.categories.forEach(function (cat) {
      var count = state.products.filter(function (p) { return p.category === cat; }).length;
      var isActive = state.activeCategory === cat;
      html += '<li><a href="#" data-category="' + cat + '" class="' + (isActive ? 'active' : '') + '">' +
        cat + ' <span class="cat-count">' + count + '</span></a></li>';
    });

    list.innerHTML = html;

    list.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        state.activeCategory = this.getAttribute('data-category') || null;
        renderCategories();
        renderProducts();
      });
    });
  }

  function renderProducts() {
    var grid = document.getElementById('product-grid');
    var toolbar = document.getElementById('products-toolbar-title');
    if (!grid) return;

    var items = filterProducts();

    if (toolbar) {
      var title = state.activeCategory || 'All Products';
      toolbar.innerHTML = title + ' <span class="result-count">(' + items.length + ')</span>';
    }

    if (!items.length) {
      grid.innerHTML =
        '<div class="products-empty">' +
          '<div class="empty-icon">\uD83D\uDD0D</div>' +
          '<h3>No products found</h3>' +
          '<p>Try a different category or search term.</p>' +
        '</div>';
      return;
    }

    grid.innerHTML = items.map(function (p) {
      var img = p.image_url
        ? '<img class="product-card-img" src="' + p.image_url + '" alt="' + p.name.replace(/"/g, '&quot;') + '" loading="lazy">'
        : '<div class="product-card-img-placeholder"></div>';

      return '<div class="product-card">' +
        img +
        '<div class="product-card-body">' +
          '<div class="product-card-category">' + (p.subcategory || p.category) + '</div>' +
          '<div class="product-card-name">' + p.name + '</div>' +
          '<div class="product-card-brand">' + p.brand + '</div>' +
          '<div class="product-card-footer">' +
            '<span class="product-card-price">\u20ac' + p.price.toFixed(2) + '</span>' +
            '<span class="product-card-rating">' + renderStars(p.rating) + ' ' + p.rating.toFixed(1) + '</span>' +
          '</div>' +
          stockLabel(p.stock_status) +
        '</div>' +
      '</div>';
    }).join('');
  }

  function loadProducts() {
    fetch('/api/products')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        state.products = data.products;
        state.categories = data.categories;
        renderCategories();
        renderProducts();
      })
      .catch(function () {
        var grid = document.getElementById('product-grid');
        if (grid) {
          grid.innerHTML =
            '<div class="products-empty">' +
              '<div class="empty-icon">\u26A0\uFE0F</div>' +
              '<h3>Failed to load products</h3>' +
              '<p>Please try refreshing the page.</p>' +
            '</div>';
        }
      });
  }

  var searchInput = document.getElementById('product-search');
  if (searchInput) {
    var timeout;
    searchInput.addEventListener('input', function () {
      clearTimeout(timeout);
      var val = this.value;
      timeout = setTimeout(function () {
        state.searchQuery = val;
        renderProducts();
      }, 200);
    });
  }

  loadProducts();
})();
