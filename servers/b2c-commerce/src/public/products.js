(function () {
  var PAGE_SIZE = 24;

  var state = {
    categories: [],
    categoryCounts: {},
    activeCategory: null,
    searchQuery: "",
    page: 1,
    hasMore: true,
    loading: false,
    totalCount: 0,
  };

  function renderStars(rating) {
    var full = Math.floor(rating);
    var half = rating - full >= 0.3 ? 1 : 0;
    var empty = 5 - full - half;
    return (
      '<span class="stars">' +
      "\u2605".repeat(full) +
      (half ? "\u2605" : "") +
      "\u2606".repeat(Math.max(0, 5 - full - half)) +
      "</span>"
    );
  }

  function stockLabel(status) {
    switch (status) {
      case "in_stock":
        return '<span class="product-card-stock stock-in">In Stock</span>';
      case "low_stock":
        return '<span class="product-card-stock stock-low">Low Stock</span>';
      case "out_of_stock":
        return '<span class="product-card-stock stock-out">Out of Stock</span>';
      default:
        return "";
    }
  }

  /* Amazon CDN images support resize via URL suffix — request only the size we need */
  function optimizeImageUrl(url) {
    if (!url) return null;
    if (url.indexOf("m.media-amazon.com") !== -1) {
      return url.replace(/\._[A-Z]{2}_[A-Z]{2,}\d*_\./, "._AC_UL320_.");
    }
    return url;
  }

  function renderCard(p) {
    var thumbUrl = optimizeImageUrl(p.image_url);
    var img = thumbUrl
      ? '<img class="product-card-img" data-src="' +
        thumbUrl +
        '" alt="' +
        p.name.replace(/"/g, "&quot;") +
        '" loading="lazy">'
      : '<div class="product-card-img-placeholder"></div>';

    var discountHtml = "";
    if (p.discount && p.original_price) {
      discountHtml =
        '<span class="product-card-original-price">$' +
        p.original_price.toFixed(2) +
        "</span>" +
        '<span class="product-card-discount">' +
        p.discount +
        "</span>";
    }

    return (
      '<a href="/product/' + p.sku + '" class="product-card">' +
      (p.discount
        ? '<div class="product-card-badge">' + p.discount + "</div>"
        : "") +
      img +
      '<div class="product-card-body">' +
      '<div class="product-card-category">' +
      (p.subcategory || p.category) +
      "</div>" +
      '<div class="product-card-name">' +
      p.name +
      "</div>" +
      '<div class="product-card-brand">' +
      p.brand +
      "</div>" +
      '<div class="product-card-footer">' +
      '<span class="product-card-price">$' +
      p.price.toFixed(2) +
      " " +
      discountHtml +
      "</span>" +
      '<span class="product-card-rating">' +
      renderStars(p.rating) +
      " " +
      p.rating.toFixed(1) +
      "</span>" +
      "</div>" +
      stockLabel(p.stock_status) +
      "</div>" +
      "</a>"
    );
  }

  /* ── Lazy image loading with IntersectionObserver ──────── */

  var imageObserver;

  function setupImageObserver() {
    if (imageObserver) return;
    if (!("IntersectionObserver" in window)) {
      revealAllImages();
      return;
    }

    imageObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var img = entry.target;
            if (img.dataset.src) {
              img.onload = function () {
                img.classList.add("img-loaded");
              };
              img.src = img.dataset.src;
              img.removeAttribute("data-src");
              if (img.complete) img.classList.add("img-loaded");
            }
            imageObserver.unobserve(img);
          }
        });
      },
      { rootMargin: "200px 0px" },
    );
  }

  function observeNewImages(container) {
    if (!imageObserver) {
      revealAllImages();
      return;
    }
    var imgs = container.querySelectorAll("img[data-src]");
    imgs.forEach(function (img) {
      imageObserver.observe(img);
    });
  }

  function revealAllImages() {
    var imgs = document.querySelectorAll("img[data-src]");
    imgs.forEach(function (img) {
      img.src = img.dataset.src;
      img.removeAttribute("data-src");
    });
  }

  /* ── Categories ───────────────────────────────────────── */

  function renderCategories() {
    var list = document.getElementById("category-list");
    if (!list) return;

    var allCount = state.totalCount;
    var html =
      '<li><a href="#" data-category="" class="' +
      (!state.activeCategory ? "active" : "") +
      '">' +
      'All Products <span class="cat-count">' +
      allCount +
      "</span></a></li>";

    state.categories.forEach(function (cat) {
      var count = state.categoryCounts[cat] || 0;
      var isActive = state.activeCategory === cat;
      html +=
        '<li><a href="#" data-category="' +
        cat +
        '" class="' +
        (isActive ? "active" : "") +
        '">' +
        cat +
        ' <span class="cat-count">' +
        count +
        "</span></a></li>";
    });

    list.innerHTML = html;

    list.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        var newCat = this.getAttribute("data-category") || null;
        if (newCat !== state.activeCategory) {
          state.activeCategory = newCat;
          state.page = 1;
          state.hasMore = true;
          renderCategories();
          resetAndLoad();
        }
      });
    });
  }

  /* ── API fetch ────────────────────────────────────────── */

  function buildUrl(page) {
    var url = "/api/products?page=" + page + "&limit=" + PAGE_SIZE;
    if (state.activeCategory) {
      url += "&category=" + encodeURIComponent(state.activeCategory);
    }
    if (state.searchQuery) {
      url += "&search=" + encodeURIComponent(state.searchQuery);
    }
    return url;
  }

  function fetchPage(page, append) {
    if (state.loading) return;
    state.loading = true;

    var grid = document.getElementById("product-grid");
    var sentinel = document.getElementById("scroll-sentinel");

    if (sentinel) {
      sentinel.innerHTML =
        '<div class="load-more-spinner"><div class="spinner"></div></div>';
    }

    fetch(buildUrl(page))
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        state.categories = data.categories;
        state.categoryCounts = data.categoryCounts || {};
        state.page = data.pagination.page;
        state.hasMore = data.pagination.hasMore;
        state.totalCount = data.pagination.total;

        var toolbar = document.getElementById("products-toolbar-title");
        if (toolbar) {
          var title = state.activeCategory || "All Products";
          toolbar.innerHTML =
            title +
            ' <span class="result-count">(' +
            data.pagination.total +
            ")</span>";
        }

        if (!data.products.length && !append) {
          grid.innerHTML =
            '<div class="products-empty">' +
            '<div class="empty-icon">\uD83D\uDD0D</div>' +
            "<h3>No products found</h3>" +
            "<p>Try a different category or search term.</p>" +
            "</div>";
          if (sentinel) sentinel.innerHTML = "";
          state.loading = false;
          renderCategories();
          return;
        }

        var html = data.products.map(renderCard).join("");

        if (append && grid) {
          var frag = document.createElement("div");
          frag.innerHTML = html;
          while (frag.firstChild) {
            grid.appendChild(frag.firstChild);
          }
          observeNewImages(grid);
        } else if (grid) {
          grid.innerHTML = html;
          observeNewImages(grid);
        }

        if (sentinel) {
          sentinel.innerHTML = state.hasMore
            ? '<div class="scroll-sentinel-inner"></div>'
            : '<div class="end-of-list">You\'ve seen all products</div>';
        }

        if (page === 1) {
          renderCategories();
        }

        state.loading = false;
      })
      .catch(function () {
        state.loading = false;
        if (!append && grid) {
          grid.innerHTML =
            '<div class="products-empty">' +
            '<div class="empty-icon">\u26A0\uFE0F</div>' +
            "<h3>Failed to load products</h3>" +
            "<p>Please try refreshing the page.</p>" +
            "</div>";
        }
      });
  }

  function resetAndLoad() {
    state.page = 1;
    state.hasMore = true;
    fetchPage(1, false);
  }

  /* ── Infinite scroll with IntersectionObserver ────────── */

  function setupInfiniteScroll() {
    var sentinel = document.getElementById("scroll-sentinel");
    if (!sentinel || !("IntersectionObserver" in window)) return;

    var scrollObserver = new IntersectionObserver(
      function (entries) {
        if (entries[0].isIntersecting && state.hasMore && !state.loading) {
          fetchPage(state.page + 1, true);
        }
      },
      { rootMargin: "400px 0px" },
    );

    scrollObserver.observe(sentinel);
  }

  /* ── Search ───────────────────────────────────────────── */

  var searchInput = document.getElementById("product-search");
  if (searchInput) {
    var timeout;
    searchInput.addEventListener("input", function () {
      clearTimeout(timeout);
      var val = this.value;
      timeout = setTimeout(function () {
        state.searchQuery = val;
        resetAndLoad();
      }, 300);
    });
  }

  /* ── Init ─────────────────────────────────────────────── */

  setupImageObserver();
  setupInfiniteScroll();
  fetchPage(1, false);
})();
