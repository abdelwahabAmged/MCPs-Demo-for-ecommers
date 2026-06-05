(function () {
  var sku = window.location.pathname.split("/product/")[1];
  if (!sku) {
    window.location.href = "/";
    return;
  }

  function esc(s) {
    if (!s) return "";
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function stars(rating) {
    var full = Math.round(rating);
    var empty = 5 - full;
    return "\u2605".repeat(full) + "\u2606".repeat(Math.max(0, empty));
  }

  function stockText(status, qty) {
    switch (status) {
      case "in_stock":
        return { dot: "in_stock", text: "In Stock", detail: qty > 50 ? "" : qty + " available" };
      case "low_stock":
        return { dot: "low_stock", text: "Low Stock", detail: "Only " + qty + " left — order soon" };
      case "out_of_stock":
        return { dot: "out_of_stock", text: "Out of Stock", detail: "Currently unavailable" };
      default:
        return { dot: "in_stock", text: "Available", detail: "" };
    }
  }

  function optimizeImg(url, size) {
    if (!url) return "";
    if (url.indexOf("m.media-amazon.com") !== -1) {
      return url.replace(/\._[A-Z]{2}_[A-Z]{2,}\d*_\./, "._AC_UL" + (size || 600) + "_.");
    }
    return url;
  }

  function showToast(msg) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(function () { t.classList.remove("show"); }, 2400);
  }

  fetch("/api/products/" + encodeURIComponent(sku))
    .then(function (res) {
      if (!res.ok) throw new Error("Not found");
      return res.json();
    })
    .then(function (data) {
      var p = data.product;
      var fbt = data.fbtProducts || [];
      var reviews = data.reviews || [];

      document.title = p.name + " — Acme Store";

      var stock = stockText(p.stock_status, p.stock_qty);

      // Breadcrumb
      var breadcrumb =
        '<nav class="pdp-breadcrumb">' +
          '<a href="/">Shop</a>' +
          '<span class="bc-sep">›</span>' +
          '<a href="/?category=' + encodeURIComponent(p.category) + '">' + esc(p.category) + "</a>" +
          (p.subcategory ? '<span class="bc-sep">›</span><span>' + esc(p.subcategory) + "</span>" : "") +
          '<span class="bc-sep">›</span>' +
          '<span class="bc-current">' + esc(p.name).substring(0, 50) + "</span>" +
        "</nav>";

      // Image gallery
      var allImages = (p.images && p.images.length > 0) ? p.images : (p.image_url ? [p.image_url] : []);
      var mainImgUrl = allImages.length > 0 ? optimizeImg(allImages[0], 800) : "";

      var thumbsHtml = "";
      if (allImages.length > 1) {
        thumbsHtml = '<div class="pdp-thumbs">';
        allImages.forEach(function (url, idx) {
          var thumbUrl = optimizeImg(url, 120);
          thumbsHtml +=
            '<button class="pdp-thumb' + (idx === 0 ? " active" : "") + '" data-idx="' + idx + '">' +
              '<img src="' + thumbUrl + '" alt="View ' + (idx + 1) + '">' +
            "</button>";
        });
        thumbsHtml += "</div>";
      }

      var badgeOverlay = "";
      if (p.badge) {
        badgeOverlay = '<div class="pdp-product-badge">' + esc(p.badge) + "</div>";
      } else if (p.discount) {
        badgeOverlay = '<div class="pdp-badge">' + esc(p.discount) + "</div>";
      }

      var gallery =
        '<div class="pdp-gallery">' +
          '<div class="pdp-image-main" id="pdp-main-image">' +
            badgeOverlay +
            (mainImgUrl ? '<img src="' + mainImgUrl + '" alt="' + esc(p.name) + '" id="pdp-main-img">' : "") +
          "</div>" +
          thumbsHtml +
        "</div>";

      // Rating row
      var ratingRow =
        '<div class="pdp-rating-row">' +
          '<span class="pdp-stars">' + stars(p.rating) + "</span>" +
          '<span class="pdp-rating-num">' + p.rating.toFixed(1) + "</span>" +
          '<span class="pdp-review-count">' + p.review_count + " reviews</span>" +
          (p.bought_past_month ? '<span class="pdp-bought">' + p.bought_past_month.toLocaleString() + "+ bought last month</span>" : "") +
        "</div>";

      // Price
      var priceBlock =
        '<div class="pdp-price-block">' +
          '<div class="pdp-price-row">' +
            '<span class="pdp-price">$' + p.price.toFixed(2) + "</span>" +
            (p.original_price ? '<span class="pdp-original-price">$' + p.original_price.toFixed(2) + "</span>" : "") +
            (p.discount ? '<span class="pdp-discount-tag">' + esc(p.discount) + "</span>" : "") +
          "</div>" +
          (p.original_price ? '<div class="pdp-price-note">You save $' + (p.original_price - p.price).toFixed(2) + "</div>" : "") +
        "</div>";

      // Variations
      var variationsHtml = "";
      if (p.variations && p.variations.length > 0) {
        variationsHtml =
          '<div class="pdp-variations">' +
            '<div class="pdp-variations-label">Available options</div>' +
            '<div class="pdp-variations-list">' +
            p.variations.map(function (v) {
              return '<span class="pdp-variation-chip">' + esc(v) + "</span>";
            }).join("") +
            "</div>" +
          "</div>";
      }

      // Availability
      var deliveryText = p.delivery || ("Estimated: " + (p.delivery_estimate || "3-7 business days"));
      var availability =
        '<div class="pdp-availability">' +
          '<div class="pdp-stock-row">' +
            '<span class="pdp-stock-dot ' + stock.dot + '"></span>' +
            '<span class="pdp-stock-text ' + stock.dot + '">' + stock.text + "</span>" +
            (stock.detail ? '<span style="color:#6b7280;font-size:13px">— ' + stock.detail + "</span>" : "") +
          "</div>" +
          '<div class="pdp-delivery-row">' +
            '<span class="pdp-delivery-icon">📦</span>' +
            '<span class="pdp-delivery-text">' + esc(deliveryText) + "</span>" +
          "</div>" +
        "</div>";

      // CTA
      var actions =
        '<div class="pdp-actions">' +
          '<button class="pdp-btn-cart" id="pdp-add-cart">' +
            '<svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>' +
            "Add to Cart" +
          "</button>" +
          '<button class="pdp-btn-wishlist" id="pdp-wishlist" title="Save to wishlist">' +
            '<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
          "</button>" +
        "</div>";

      // Description
      var description = p.description
        ? '<div class="pdp-description"><h3 class="pdp-section-title">About this product</h3><p>' + esc(p.description) + "</p></div>"
        : "";

      // Features
      var featuresHtml = "";
      if (p.features && p.features.length > 0) {
        featuresHtml =
          '<div class="pdp-features"><h3 class="pdp-section-title">Key Features</h3><ul>' +
          p.features
            .map(function (f) { return "<li>" + esc(f) + "</li>"; })
            .join("") +
          "</ul></div>";
      }

      // Specs
      var specs = [];
      if (p.brand) specs.push({ label: "Brand", value: p.brand });
      if (p.manufacturer && p.manufacturer !== p.brand) specs.push({ label: "Manufacturer", value: p.manufacturer });
      if (p.model_number) specs.push({ label: "Model", value: p.model_number });
      if (p.weight) specs.push({ label: "Weight", value: p.weight });
      if (p.dimensions) specs.push({ label: "Dimensions", value: p.dimensions });
      if (p.department) specs.push({ label: "Department", value: p.department });
      if (p.country_of_origin) specs.push({ label: "Country of Origin", value: p.country_of_origin });
      if (p.date_first_available) specs.push({ label: "Available Since", value: p.date_first_available });
      specs.push({ label: "SKU", value: p.sku });

      var specsHtml = "";
      if (specs.length > 0) {
        specsHtml =
          '<div class="pdp-specs"><h3 class="pdp-section-title">Product Details</h3><div class="pdp-specs-grid">' +
          specs
            .map(function (s) {
              return '<div class="pdp-spec-item"><span class="pdp-spec-label">' + esc(s.label) + '</span><span class="pdp-spec-value">' + esc(s.value) + "</span></div>";
            })
            .join("") +
          "</div></div>";
      }

      // FBT
      var fbtHtml = "";
      if (fbt.length > 0) {
        fbtHtml =
          '<div class="pdp-fbt"><h2 class="pdp-fbt-title">Frequently Bought Together</h2><div class="pdp-fbt-grid">' +
          fbt
            .map(function (f) {
              var fImg = optimizeImg(f.image_url, 320);
              return (
                '<a href="/product/' + f.sku + '" class="pdp-fbt-card">' +
                (fImg ? '<img src="' + fImg + '" alt="' + esc(f.name) + '" loading="lazy">' : "") +
                '<div class="pdp-fbt-body">' +
                  '<div class="pdp-fbt-name">' + esc(f.name) + "</div>" +
                  '<div class="pdp-fbt-price">$' + f.price.toFixed(2) + "</div>" +
                  '<div class="pdp-fbt-rating"><span class="stars">' + stars(f.rating) + "</span> " + f.rating.toFixed(1) + "</div>" +
                "</div></a>"
              );
            })
            .join("") +
          "</div></div>";
      }

      // Top Review (separate from generated reviews)
      var topReviewHtml = "";
      if (p.top_review) {
        topReviewHtml =
          '<div class="pdp-top-review">' +
            '<h2 class="pdp-top-review-title">Top Review</h2>' +
            '<div class="pdp-top-review-card">' +
              '<div class="pdp-top-review-quote">\u201C</div>' +
              '<p class="pdp-top-review-text">' + esc(p.top_review) + "</p>" +
              '<div class="pdp-top-review-badge">Verified Customer</div>' +
            "</div>" +
          "</div>";
      }

      // Reviews
      var reviewsHtml = "";
      if (reviews.length > 0) {
        reviewsHtml =
          '<div class="pdp-reviews">' +
          '<div class="pdp-reviews-header"><h2 class="pdp-reviews-title">Customer Reviews</h2></div>' +
          reviews
            .map(function (r) {
              var initials = r.author ? r.author.charAt(0).toUpperCase() : "?";
              return (
                '<div class="pdp-review-card">' +
                '<div class="pdp-review-header">' +
                  '<div class="pdp-review-author">' +
                    '<div class="pdp-review-avatar">' + initials + "</div>" +
                    "<div>" +
                      '<div class="pdp-review-name">' + esc(r.author) + "</div>" +
                      '<div class="pdp-review-date">' + esc(r.created_at) + "</div>" +
                    "</div>" +
                  "</div>" +
                  (r.verified_purchase ? '<span class="pdp-review-verified">Verified Purchase</span>' : "") +
                "</div>" +
                '<div class="pdp-review-stars">' + stars(r.rating) + "</div>" +
                (r.title ? '<div class="pdp-review-title-text">' + esc(r.title) + "</div>" : "") +
                '<div class="pdp-review-body">' + esc(r.body) + "</div>" +
                "</div>"
              );
            })
            .join("") +
          "</div>";
      }

      // Render
      var badgeInline = p.badge
        ? '<span class="pdp-inline-badge">' + esc(p.badge) + "</span>"
        : "";

      var el = document.getElementById("pdp-content");
      el.innerHTML =
        breadcrumb +
        '<div class="pdp-main">' +
          gallery +
          '<div class="pdp-info">' +
            '<div class="pdp-brand">' + esc(p.brand) + badgeInline + "</div>" +
            '<h1 class="pdp-title">' + esc(p.name) + "</h1>" +
            ratingRow +
            priceBlock +
            variationsHtml +
            availability +
            actions +
            "<hr class='pdp-divider'>" +
            description +
            featuresHtml +
            specsHtml +
          "</div>" +
        "</div>" +
        topReviewHtml +
        fbtHtml +
        reviewsHtml;

      // Scroll to top
      window.scrollTo(0, 0);

      var addCartBtn = document.getElementById("pdp-add-cart");
      addCartBtn.addEventListener("click", function () {
        addCartBtn.disabled = true;
        addCartBtn.textContent = "Adding...";

        fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sku: p.sku, quantity: 1 }),
        })
          .then(function (res) {
            if (res.status === 401) {
              window.location.href = "/login";
              return null;
            }
            return res.json();
          })
          .then(function (data) {
            addCartBtn.disabled = false;
            addCartBtn.innerHTML =
              '<svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>Add to Cart';
            if (data) {
              showToast("\u2713 Added to cart — " + data.totalItems + " item" + (data.totalItems !== 1 ? "s" : "") + " ($" + data.totalPrice.toFixed(2) + ")");
              updateCartBadge(data.totalItems);
            }
          })
          .catch(function () {
            addCartBtn.disabled = false;
            addCartBtn.innerHTML =
              '<svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>Add to Cart';
            showToast("Failed to add to cart. Please try again.");
          });
      });

      document.getElementById("pdp-wishlist").addEventListener("click", function () {
        showToast("\u2661 Use the AI assistant to save to your wishlist");
      });

      // Thumbnail gallery switching with fade transition
      var thumbs = document.querySelectorAll(".pdp-thumb");
      if (thumbs.length > 0) {
        thumbs.forEach(function (btn) {
          btn.addEventListener("click", function () {
            var idx = parseInt(this.getAttribute("data-idx"));
            var mainImg = document.getElementById("pdp-main-img");
            var container = document.getElementById("pdp-main-image");
            if (!mainImg || !allImages[idx]) return;

            var newSrc = optimizeImg(allImages[idx], 800);
            if (mainImg.src === newSrc) return;

            thumbs.forEach(function (t) { t.classList.remove("active"); });
            btn.classList.add("active");

            mainImg.classList.add("pdp-img-fading");
            container.classList.add("pdp-img-loading");

            var next = new Image();
            next.onload = function () {
              mainImg.src = newSrc;
              mainImg.classList.remove("pdp-img-fading");
              container.classList.remove("pdp-img-loading");
            };
            next.onerror = function () {
              mainImg.src = newSrc;
              mainImg.classList.remove("pdp-img-fading");
              container.classList.remove("pdp-img-loading");
            };
            next.src = newSrc;
          });
        });
      }

    })
    .catch(function () {
      var el = document.getElementById("pdp-content");
      el.innerHTML =
        '<div style="text-align:center;padding:80px 20px">' +
        '<div style="font-size:48px;margin-bottom:16px">\uD83D\uDD0D</div>' +
        "<h2>Product Not Found</h2>" +
        '<p style="color:#6b7280;margin-top:8px">This product doesn\'t exist or has been removed.</p>' +
        '<a href="/" style="display:inline-block;margin-top:20px;padding:10px 24px;background:#111827;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">Back to Shop</a>' +
        "</div>";
    });

  function updateCartBadge(count) {
    if (window.updateCartBadge) window.updateCartBadge(count);
  }
})();
