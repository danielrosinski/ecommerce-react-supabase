import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  ClipboardList,
  CreditCard,
  Camera,
  Heart,
  Leaf,
  Loader2,
  MapPin,
  MessageCircle,
  Menu,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Store,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import AdminPage from "./AdminPage";
import OrderLookupPage from "./OrderLookupPage";
import { defaultProducts, formatCurrency } from "./data";
import { isSupabaseConfigured } from "./lib/supabase";
import { createOrder } from "./services/orders";
import { createPagBankCheckout } from "./services/payments";
import { formatPostalCode, lookupPostalCode } from "./services/postalCode";
import { loadProducts } from "./services/products";
import {
  defaultDeliveryZones,
  loadDeliveryZones,
  validateCoupon,
} from "./services/storeSettings";

const categories = ["Todos", "Buquês", "Plantas"];

const productSizes = (product) =>
  Array.isArray(product?.size_options) && product.size_options.length
    ? product.size_options
    : [{ id: "standard", label: "Tamanho único", price_delta: 0 }];

const productAddons = (product) =>
  Array.isArray(product?.addons) ? product.addons : [];

const configuredUnitPrice = (product, item = {}) => {
  const size = productSizes(product).find(
    (option) => option.id === item.size_id,
  ) ?? productSizes(product)[0];
  const addonIds = Array.isArray(item.addon_ids) ? item.addon_ids : [];
  const addonTotal = productAddons(product)
    .filter((addon) => addonIds.includes(addon.id))
    .reduce((sum, addon) => sum + Number(addon.price ?? 0), 0);

  return Number(product?.price ?? 0) + Number(size.price_delta ?? 0) + addonTotal;
};

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function App() {
  const [products, setProducts] = useState(() =>
    isSupabaseConfigured
      ? defaultProducts
      : readStorage("nova-products", defaultProducts),
  );
  const [dataStatus, setDataStatus] = useState(
    isSupabaseConfigured ? "loading" : "demo",
  );
  const [cart, setCart] = useState(() => readStorage("nova-cart", []));
  const [favorites, setFavorites] = useState(() =>
    readStorage("nova-favorites", []),
  );

  useEffect(() => {
    if (!isSupabaseConfigured) {
      localStorage.setItem("nova-products", JSON.stringify(products));
    }
  }, [products]);

  const reloadProducts = async () => {
    if (!isSupabaseConfigured) {
      setDataStatus("demo");
      return products;
    }

    setDataStatus("loading");
    try {
      const nextProducts = await loadProducts();
      setProducts(nextProducts);
      setDataStatus("connected");
      return nextProducts;
    } catch (error) {
      console.error("Não foi possível carregar os produtos:", error);
      setDataStatus("error");
      return products;
    }
  };

  useEffect(() => {
    reloadProducts();
    // A carga inicial acontece somente quando o aplicativo é aberto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem("nova-cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem("nova-favorites", JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    if (isSupabaseConfigured && dataStatus !== "connected") return;

    setCart((currentCart) => {
      let changed = false;
      const nextCart = currentCart.flatMap((item) => {
        const product = products.find((candidate) => candidate.id === item.id);

        if (!product || !product.active || product.stock <= 0) {
          changed = true;
          return [];
        }

        const quantity = Math.min(item.quantity, product.stock);
        if (quantity !== item.quantity) changed = true;
        return [{ ...item, quantity }];
      });

      return changed ? nextCart : currentCart;
    });

    setFavorites((currentFavorites) => {
      const productIds = new Set(products.map((product) => product.id));
      const nextFavorites = currentFavorites.filter((id) => productIds.has(id));
      return nextFavorites.length === currentFavorites.length
        ? currentFavorites
        : nextFavorites;
    });
  }, [dataStatus, products]);

  const isAdmin = window.location.pathname.startsWith("/admin");
  const isOrderLookup = window.location.pathname.startsWith("/pedido");

  if (isAdmin) {
    return (
      <AdminPage
        products={products}
        setProducts={setProducts}
        reloadProducts={reloadProducts}
      />
    );
  }

  if (isOrderLookup) {
    return <OrderLookupPage />;
  }

  return (
    <Storefront
      products={products}
      setProducts={setProducts}
      cart={cart}
      setCart={setCart}
      favorites={favorites}
      setFavorites={setFavorites}
      connectedInventory={dataStatus === "connected"}
      databaseReady={dataStatus !== "error"}
      reloadProducts={reloadProducts}
    />
  );
}

function Storefront({
  products,
  setProducts,
  cart,
  setCart,
  favorites,
  setFavorites,
  connectedInventory,
  databaseReady,
  reloadProducts,
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [sort, setSort] = useState("featured");
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [deliveryZones, setDeliveryZones] = useState(defaultDeliveryZones);
  const [commerceReady, setCommerceReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    let active = true;
    loadDeliveryZones()
      .then((zones) => {
        if (!active) return;
        setDeliveryZones(zones.length ? zones : defaultDeliveryZones);
        setCommerceReady(true);
      })
      .catch((error) => {
        console.error("Não foi possível carregar as taxas de entrega:", error);
        if (active) setCommerceReady(false);
      });
    return () => { active = false; };
  }, []);

  const activeProducts = products.filter((product) => product.active);
  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    let list = activeProducts.filter((product) => {
      const matchesCategory =
        category === "Todos" || product.category === category;
      const matchesQuery =
        !normalized ||
        `${product.name} ${product.category} ${product.tag}`
          .toLowerCase()
          .includes(normalized);
      return matchesCategory && matchesQuery;
    });

    if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "featured") {
      list = [...list].sort((a, b) => Number(b.featured) - Number(a.featured));
    }
    return list;
  }, [activeProducts, query, category, sort]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => {
    const product = products.find((candidate) => candidate.id === item.id);
    return sum + configuredUnitPrice(product, item) * item.quantity;
  }, 0);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    document.body.classList.toggle(
      "no-scroll",
      cartOpen || checkoutOpen || Boolean(selectedProduct),
    );
    return () => document.body.classList.remove("no-scroll");
  }, [cartOpen, checkoutOpen, selectedProduct]);

  const itemQuantity = (id) =>
    cart.find((item) => item.id === id)?.quantity ?? 0;

  const addToCart = (product, selection = {}) => {
    const current = itemQuantity(product.id);
    if (product.stock === 0 || current >= product.stock) {
      setToast("Não há mais unidades disponíveis.");
      return;
    }
    setCart((currentCart) => {
      const found = currentCart.find((item) => item.id === product.id);
      const sizeId = selection.sizeId ?? found?.size_id ?? productSizes(product)[0].id;
      const addonIds = selection.addonIds ?? found?.addon_ids ?? [];
      if (found) {
        return currentCart.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                size_id: sizeId,
                addon_ids: addonIds,
              }
            : item,
        );
      }
      return [
        ...currentCart,
        { id: product.id, quantity: 1, size_id: sizeId, addon_ids: addonIds },
      ];
    });
    setToast(`${product.name} adicionado ao carrinho.`);
  };

  const updateQuantity = (id, amount) => {
    const product = products.find((candidate) => candidate.id === id);
    setCart((currentCart) =>
      currentCart
        .map((item) => {
          if (item.id !== id) return item;
          const next = Math.min(product?.stock ?? 0, item.quantity + amount);
          return { ...item, quantity: next };
        })
        .filter((item) => item.quantity > 0),
    );
  };

  const toggleFavorite = (id) => {
    setFavorites((current) =>
      current.includes(id)
        ? current.filter((favoriteId) => favoriteId !== id)
        : [...current, id],
    );
  };

  const selectCategory = (nextCategory) => {
    setCategory(nextCategory);
    setMobileOpen(false);
    window.setTimeout(
      () => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" }),
      30,
    );
  };

  const finishOrder = async (event) => {
    event.preventDefault();
    if (checkoutLoading || cart.length === 0) return;
    if (!databaseReady || !commerceReady) {
      setCheckoutError("A atualização V8 do banco ainda não foi executada. Use o arquivo supabase/v8-loja.sql antes de registrar pedidos.");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const customer = {
      name: formData.get("name")?.trim(),
      email: formData.get("email")?.trim(),
      phone: formData.get("phone")?.trim(),
      postal_code: formData.get("postal_code")?.trim(),
      address_line: formData.get("address_line")?.trim(),
      address_number: formData.get("address_number")?.trim(),
      complement: formData.get("complement")?.trim(),
      neighborhood: formData.get("neighborhood")?.trim(),
      city: formData.get("city")?.trim(),
      state: formData.get("state")?.trim(),
      delivery_method: formData.get("delivery_method")?.trim(),
      recipient_name: formData.get("recipient_name")?.trim(),
      recipient_phone: formData.get("recipient_phone")?.trim(),
      delivery_date: formData.get("delivery_date")?.trim(),
      delivery_period: formData.get("delivery_period")?.trim(),
      occasion: formData.get("occasion")?.trim(),
      gift_message: formData.get("gift_message")?.trim(),
      anonymous_delivery: formData.get("anonymous_delivery") === "on",
      delivery_instructions: formData.get("delivery_instructions")?.trim(),
      coupon_code: formData.get("coupon_code")?.trim(),
    };

    setCheckoutLoading(true);
    setCheckoutError("");

    try {
      const result = await createOrder({ customer, cart, products });
      let completedResult = result;

      if (!result.demo) {
        try {
          const payment = await createPagBankCheckout(result.order_number, customer.email);
          completedResult = {
            ...result,
            checkout_url: payment.checkoutUrl ?? "",
            payment_approved: Boolean(payment.approved),
          };
        } catch (paymentError) {
          completedResult = {
            ...result,
            payment_error: paymentError.message || "O pagamento não pôde ser iniciado agora.",
          };
        }
      }

      if (connectedInventory) {
        await reloadProducts();
      } else {
        setProducts((currentProducts) =>
          currentProducts.map((product) => {
            const item = cart.find((cartItem) => cartItem.id === product.id);
            return item
              ? { ...product, stock: Math.max(0, product.stock - item.quantity) }
              : product;
          }),
        );
      }

      setCart([]);
      setOrderResult(completedResult);
    } catch (error) {
      console.error("Não foi possível registrar o pedido:", error);
      const missingFunction =
        error?.code === "PGRST202" || error?.message?.includes("create_order");
      setCheckoutError(
        missingFunction
          ? "A atualização V5 do banco ainda não foi executada. Siga o arquivo supabase/v5-floricultura.sql."
          : error?.message || "Não foi possível confirmar o pedido. Atualize a página e tente novamente.",
      );
    } finally {
      setCheckoutLoading(false);
    }
  };

  const closeCheckout = () => {
    setCheckoutOpen(false);
    setOrderResult(null);
    setCheckoutError("");
  };

  return (
    <div className="storefront">
      <a className="skip-link" href="#catalogo">
        Ir para os produtos
      </a>
      <div className="announcement">
        <span>Flores frescas preparadas em Guaratuba</span>
        <span className="announcement-extra">Entrega local ou retirada</span>
      </div>

      <header className="site-header">
        <div className="header-main shell">
          <button
            className="icon-button mobile-menu-button"
            type="button"
            aria-label="Abrir menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={23} />
          </button>

          <a className="logo floral-logo" href="/" aria-label="Rosinski Floricultura - início">
            ROSINSKI <small>Floricultura</small>
          </a>

          <label className="search-field">
            <Search size={20} aria-hidden="true" />
            <span className="sr-only">Buscar produtos</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar produtos"
            />
            {query && (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => setQuery("")}
              >
                <X size={17} />
              </button>
            )}
          </label>

          <div className="header-actions">
            <a className="icon-button desktop-action" href="/pedido" aria-label="Acompanhar pedido" title="Acompanhar pedido">
              <ClipboardList size={22} />
            </a>
            <button className="icon-button desktop-action" type="button" aria-label={`${favorites.length} favoritos`}>
              <Heart size={22} />
              {favorites.length > 0 && <span className="mini-count">{favorites.length}</span>}
            </button>
            <button
              className="cart-button"
              type="button"
              aria-label={`Abrir carrinho com ${cartCount} itens`}
              onClick={() => setCartOpen(true)}
            >
              <ShoppingBag size={22} />
              <span className="cart-label">Carrinho</span>
              <span className="cart-count">{cartCount}</span>
            </button>
          </div>
        </div>

        <nav className="desktop-nav shell" aria-label="Categorias principais">
          {categories.map((item) => (
            <button
              className={category === item ? "active" : ""}
              type="button"
              key={item}
              onClick={() => selectCategory(item)}
            >
              {item === "Todos" ? "Novidades" : item}
            </button>
          ))}
        </nav>
      </header>

      <main>
        <section className="catalog shell" id="catalogo" aria-labelledby="catalog-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Escolhas para presentear</span>
              <h2 id="catalog-title">Flores para cada ocasião</h2>
            </div>
            <p>{filteredProducts.length} produtos encontrados</p>
          </div>

          <div className="catalog-toolbar">
            <div className="category-pills" aria-label="Filtrar por categoria">
              {categories.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={category === item ? "active" : ""}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <label className="sort-field">
              <SlidersHorizontal size={17} />
              <span className="sr-only">Ordenar produtos</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="featured">Destaques</option>
                <option value="price-asc">Menor preço</option>
                <option value="price-desc">Maior preço</option>
                <option value="name">Nome</option>
              </select>
              <ChevronDown size={15} />
            </label>
          </div>

          {filteredProducts.length > 0 ? (
            <div className="product-grid">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  quantity={itemQuantity(product.id)}
                  favorite={favorites.includes(product.id)}
                  onFavorite={() => toggleFavorite(product.id)}
                  onAdd={() => addToCart(product)}
                  onDetails={() => setSelectedProduct(product)}
                />
              ))}
            </div>
          ) : (
            <div className="empty-search">
              <Search size={28} />
              <h3>Nenhum produto encontrado</h3>
              <p>Tente outro termo ou escolha uma categoria diferente.</p>
              <button type="button" onClick={() => { setQuery(""); setCategory("Todos"); }}>
                Limpar filtros
              </button>
            </div>
          )}
        </section>

        <section className="trust-strip shell" aria-label="Benefícios da loja">
          <div>
            <Truck size={22} />
            <span><strong>Entrega local</strong> calculada em Guaratuba</span>
          </div>
          <div>
            <ShieldCheck size={22} />
            <span><strong>Pedido acompanhado</strong> do preparo à entrega</span>
          </div>
          <div>
            <PackageCheck size={22} />
            <span><strong>Retirada disponível</strong> sem taxa de entrega</span>
          </div>
        </section>

        <section className="brand-story shell" aria-labelledby="brand-story-title">
          <div className="brand-story-image" role="img" aria-label="Flores preparadas artesanalmente">
            <span><Sparkles size={15} /> Preparado à mão em Guaratuba</span>
          </div>
          <div className="brand-story-copy">
            <span className="eyebrow">Rosinski Floricultura</span>
            <h2 id="brand-story-title">Delicadeza em cada escolha.</h2>
            <p>
              Flores e plantas selecionadas com cuidado para celebrar momentos,
              levar carinho e transformar gestos simples em boas lembranças.
            </p>
            <a href="#catalogo">Conheça o catálogo <ArrowRight size={17} /></a>
          </div>
        </section>
      </main>

      <Footer />

      <MobileMenu
        open={mobileOpen}
        category={category}
        onClose={() => setMobileOpen(false)}
        onSelect={selectCategory}
      />
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        products={products}
        subtotal={subtotal}
        onUpdate={updateQuantity}
        onRemove={(id) => setCart((current) => current.filter((item) => item.id !== id))}
        onCheckout={() => {
          setCartOpen(false);
          setCheckoutOpen(true);
        }}
      />
      <CheckoutModal
        open={checkoutOpen}
        subtotal={subtotal}
        result={orderResult}
        loading={checkoutLoading}
        error={checkoutError}
        deliveryZones={deliveryZones}
        onClose={closeCheckout}
        onSubmit={finishOrder}
      />
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          quantity={itemQuantity(selectedProduct.id)}
          favorite={favorites.includes(selectedProduct.id)}
          onFavorite={() => toggleFavorite(selectedProduct.id)}
          onClose={() => setSelectedProduct(null)}
          onAdd={(selection) => {
            addToCart(selectedProduct, selection);
            setSelectedProduct(null);
          }}
        />
      )}
      <a
        className="whatsapp-float"
        href="https://wa.me/5542000000000?text=Olá%2C%20gostaria%20de%20saber%20mais%20sobre%20os%20produtos%20da%20Rosinski%20Floricultura."
        target="_blank"
        rel="noreferrer"
        aria-label="Conversar com a Rosinski Floricultura pelo WhatsApp"
      >
        <MessageCircle size={24} />
      </a>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} /> {toast}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, quantity, favorite, onFavorite, onAdd, onDetails }) {
  const remaining = Math.max(0, product.stock - quantity);
  const stockClass = product.stock === 0 ? "out" : product.stock <= 3 ? "low" : "available";
  const stockLabel =
    product.stock === 0
      ? "Indisponível"
      : remaining <= 3
        ? `${remaining} ${remaining === 1 ? "unidade" : "unidades"}`
        : "Em estoque";

  const hasChoices = productSizes(product).length > 1 || productAddons(product).length > 0;

  return (
    <article className={`product-card ${product.stock === 0 ? "sold-out" : ""}`}>
      <div className="product-visual">
        <button className="product-image-link" type="button" onClick={onDetails} aria-label={`Ver detalhes de ${product.name}`}>
          <img src={product.image} alt={product.name} loading="lazy" />
        </button>
        <span className="product-tag">{product.tag}</span>
        <button
          className={`favorite-button ${favorite ? "active" : ""}`}
          type="button"
          aria-label={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          aria-pressed={favorite}
          onClick={onFavorite}
        >
          <Heart size={19} fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="product-info">
        <p className="product-category">{product.category}</p>
        <button className="product-title-button" type="button" onClick={onDetails}><h3>{product.name}</h3></button>
        <div className="product-meta">
          <strong>{formatCurrency(product.price)}</strong>
          {(stockClass !== "available") && <span className={`stock ${stockClass}`}><i /> {stockLabel}</span>}
        </div>
        <button className="add-button" type="button" onClick={hasChoices ? onDetails : onAdd} disabled={remaining === 0}>
          {product.stock === 0 ? "Indisponível" : hasChoices ? "Ver opções" : quantity > 0 ? `Adicionar mais · ${quantity}` : "Adicionar ao carrinho"}
        </button>
      </div>
    </article>
  );
}

function ProductDetailModal({ product, quantity, favorite, onFavorite, onClose, onAdd }) {
  const sizes = productSizes(product);
  const addons = productAddons(product);
  const [sizeId, setSizeId] = useState(sizes[0].id);
  const [addonIds, setAddonIds] = useState([]);
  const selection = { size_id: sizeId, addon_ids: addonIds };
  const total = configuredUnitPrice(product, selection);
  const remaining = Math.max(0, product.stock - quantity);

  const toggleAddon = (id) => {
    setAddonIds((current) =>
      current.includes(id)
        ? current.filter((addonId) => addonId !== id)
        : [...current, id],
    );
  };

  return (
    <div className="modal-layer product-detail-layer" role="dialog" aria-modal="true" aria-labelledby="product-detail-title">
      <button className="panel-backdrop" type="button" aria-label="Fechar detalhes" onClick={onClose} />
      <article className="product-detail-modal">
        <button className="modal-close icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        <div className="product-detail-image"><img src={product.image} alt={product.name} /><span>{product.tag}</span></div>
        <div className="product-detail-content">
          <p className="product-category">{product.category}</p>
          <h2 id="product-detail-title">{product.name}</h2>
          <p className="product-detail-description">{product.description || "Uma escolha preparada com cuidado para tornar o momento ainda mais especial."}</p>

          <fieldset className="option-group">
            <legend>Escolha o tamanho</legend>
            <div className="size-options">
              {sizes.map((size) => (
                <label className={sizeId === size.id ? "selected" : ""} key={size.id}>
                  <input type="radio" name={`size-${product.id}`} checked={sizeId === size.id} onChange={() => setSizeId(size.id)} />
                  <span>{size.label}</span>
                  <strong>{Number(size.price_delta) === 0 ? "Incluso" : `+ ${formatCurrency(size.price_delta)}`}</strong>
                </label>
              ))}
            </div>
          </fieldset>

          {addons.length > 0 && (
            <fieldset className="option-group">
              <legend>Complete o presente</legend>
              <div className="addon-options">
                {addons.map((addon) => (
                  <label className={addonIds.includes(addon.id) ? "selected" : ""} key={addon.id}>
                    <input type="checkbox" checked={addonIds.includes(addon.id)} onChange={() => toggleAddon(addon.id)} />
                    <span>{addon.label}</span><strong>+ {formatCurrency(addon.price)}</strong>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="care-note"><Leaf size={18} /><span><strong>Como cuidar</strong>{product.care_instructions || "Mantenha em local fresco e siga as orientações enviadas com o produto."}</span></div>
          <div className="product-detail-footer">
            <div><span>Total desta escolha</span><strong>{formatCurrency(total)}</strong></div>
            <button className="primary-button" type="button" disabled={remaining === 0} onClick={() => onAdd({ sizeId, addonIds })}>
              {remaining === 0 ? "Produto indisponível" : "Adicionar ao carrinho"}
            </button>
          </div>
          <button className={`detail-favorite ${favorite ? "active" : ""}`} type="button" onClick={onFavorite}><Heart size={16} fill={favorite ? "currentColor" : "none"} />{favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}</button>
        </div>
      </article>
    </div>
  );
}

function MobileMenu({ open, category, onClose, onSelect }) {
  return (
    <div className={`mobile-panel ${open ? "open" : ""}`} aria-hidden={!open}>
      <button className="panel-backdrop" type="button" aria-label="Fechar menu" onClick={onClose} />
      <aside className="mobile-menu" aria-label="Menu móvel">
        <div className="drawer-header">
          <span className="logo floral-logo">ROSINSKI <small>Floricultura</small></span>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar menu"><X /></button>
        </div>
        <p className="drawer-kicker">Navegue por categoria</p>
        <nav>
          {categories.map((item) => (
            <button className={category === item ? "active" : ""} type="button" key={item} onClick={() => onSelect(item)}>
              {item}<ArrowRight size={18} />
            </button>
          ))}
        </nav>
        <a className="mobile-account" href="/pedido"><ClipboardList size={19} /> Acompanhar pedido</a>
      </aside>
    </div>
  );
}

function CartDrawer({ open, onClose, cart, products, subtotal, onUpdate, onRemove, onCheckout }) {
  const items = cart
    .map((item) => ({ ...item, product: products.find((product) => product.id === item.id) }))
    .filter((item) => item.product);

  return (
    <div className={`cart-panel ${open ? "open" : ""}`} aria-hidden={!open}>
      <button className="panel-backdrop" type="button" aria-label="Fechar carrinho" onClick={onClose} />
      <aside className="cart-drawer" aria-label="Seu carrinho">
        <div className="drawer-header">
          <div>
            <p className="drawer-kicker">Sua seleção</p>
            <h2>Carrinho <span>{cart.reduce((sum, item) => sum + item.quantity, 0)}</span></h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar carrinho"><X /></button>
        </div>

        {items.length === 0 ? (
          <div className="empty-cart">
            <ShoppingBag size={35} />
            <h3>Seu carrinho está vazio</h3>
            <p>Explore nossa seleção e encontre algo especial.</p>
            <button className="primary-button" type="button" onClick={onClose}>Continuar comprando</button>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {items.map(({ product, quantity, size_id, addon_ids }) => {
                const size = productSizes(product).find((option) => option.id === size_id) ?? productSizes(product)[0];
                const selectedAddons = productAddons(product).filter((addon) => (addon_ids ?? []).includes(addon.id));
                const unitPrice = configuredUnitPrice(product, { size_id, addon_ids });
                return (
                <article className="cart-item" key={product.id}>
                  <img src={product.image} alt="" />
                  <div>
                    <p>{product.category}</p>
                    <h3>{product.name}</h3>
                    <span className="cart-item-options">{size.label}{selectedAddons.length ? ` · ${selectedAddons.map((addon) => addon.label).join(", ")}` : ""}</span>
                    <strong>{formatCurrency(unitPrice)}</strong>
                    <div className="quantity-control" aria-label={`Quantidade de ${product.name}`}>
                      <button type="button" aria-label="Diminuir quantidade" onClick={() => onUpdate(product.id, -1)}><Minus size={15} /></button>
                      <span>{quantity}</span>
                      <button type="button" aria-label="Aumentar quantidade" disabled={quantity >= product.stock} onClick={() => onUpdate(product.id, 1)}><Plus size={15} /></button>
                    </div>
                  </div>
                  <button className="remove-item" type="button" aria-label={`Remover ${product.name}`} onClick={() => onRemove(product.id)}><Trash2 size={17} /></button>
                </article>
                );
              })}
            </div>
            <div className="cart-summary">
              <div><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div>
              <div><span>Entrega</span><span>Calculada no checkout</span></div>
              <div className="shipping-progress shipping-local"><span /><p>Retirada em Guaratuba sem taxa.</p></div>
              <button className="primary-button checkout-button" type="button" onClick={onCheckout}>Finalizar compra <ArrowRight size={18} /></button>
              <small>O pedido será reservado antes do redirecionamento ao PagBank.</small>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function CheckoutModal({
  open,
  subtotal,
  result,
  loading,
  error,
  deliveryZones,
  onClose,
  onSubmit,
}) {
  const [deliveryMethod, setDeliveryMethod] = useState("delivery");
  const [address, setAddress] = useState({
    postal_code: "",
    state: "",
    address_line: "",
    address_number: "",
    complement: "",
    neighborhood: "",
    city: "",
  });
  const [postalStatus, setPostalStatus] = useState({
    type: "idle",
    message: "",
  });
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponStatus, setCouponStatus] = useState({ type: "idle", message: "" });

  useEffect(() => {
    if (open) return;
    setDeliveryMethod("delivery");
    setAddress({
      postal_code: "",
      state: "",
      address_line: "",
      address_number: "",
      complement: "",
      neighborhood: "",
      city: "",
    });
    setPostalStatus({ type: "idle", message: "" });
    setCouponInput("");
    setAppliedCoupon(null);
    setCouponStatus({ type: "idle", message: "" });
  }, [open]);

  useEffect(() => {
    if (!open || deliveryMethod === "pickup") return undefined;
    const digits = address.postal_code.replace(/\D/g, "");

    if (digits.length !== 8) {
      setPostalStatus({ type: "idle", message: "" });
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPostalStatus({ type: "loading", message: "Consultando CEP..." });
      try {
        const result = await lookupPostalCode(digits, controller.signal);
        setAddress((current) => ({
          ...current,
          postal_code: result.postal_code,
          state: result.state,
          address_line: result.address_line,
          neighborhood: result.neighborhood,
          city: result.city,
          complement: current.complement || result.suggested_complement,
        }));
        const servesAddress =
          result.city.trim().toLowerCase() === "guaratuba" &&
          result.state.trim().toUpperCase() === "PR";
        setPostalStatus({
          type: servesAddress ? "success" : "error",
          message: servesAddress
            ? "Endereço preenchido. Confira os dados e informe o número."
            : "A entrega está disponível somente em Guaratuba/PR. Você também pode escolher retirada.",
        });
      } catch (postalError) {
        if (postalError.name === "AbortError") return;
        setPostalStatus({
          type: "error",
          message: postalError.message,
        });
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [address.postal_code, deliveryMethod, open]);

  if (!open) return null;
  const normalizedNeighborhood = address.neighborhood.trim().toLocaleLowerCase("pt-BR");
  const activeZones = deliveryZones.filter((zone) => zone.active);
  const matchedZone = activeZones.find(
    (zone) => zone.neighborhood.trim().toLocaleLowerCase("pt-BR") === normalizedNeighborhood,
  ) ?? activeZones.find((zone) => zone.neighborhood === "*");
  const shipping = deliveryMethod === "pickup" ? 0 : Number(matchedZone?.fee ?? 14.9);
  const discount = Number(appliedCoupon?.discount ?? 0);
  const total = Math.max(0, subtotal - discount) + shipping;
  const minDeliveryDate = new Date().toISOString().split("T")[0];

  const applyCoupon = async () => {
    setCouponStatus({ type: "loading", message: "Validando cupom..." });
    setAppliedCoupon(null);
    try {
      const result = await validateCoupon(couponInput, subtotal);
      setAppliedCoupon(result);
      setCouponInput(result.code);
      setCouponStatus({ type: "success", message: `Cupom aplicado: ${formatCurrency(result.discount)} de desconto.` });
    } catch (couponError) {
      setCouponStatus({ type: "error", message: couponError.message || "Cupom inválido ou indisponível." });
    }
  };

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      <button className="panel-backdrop" type="button" aria-label="Fechar checkout" onClick={onClose} />
      <div className="checkout-modal">
        <button className="modal-close icon-button" type="button" onClick={onClose} aria-label="Fechar"><X /></button>
        {result ? (
          <div className="order-success">
            <div className="success-icon"><Check size={29} /></div>
            <span className="eyebrow">Pedido registrado</span>
            <h2>Obrigada por escolher a Rosinski.</h2>
            <div className="order-number"><span>Número do pedido</span><strong>{result.order_number}</strong></div>
            <p>
              {result.payment_approved
                ? "O pagamento já está aprovado e o pedido foi recebido."
                : result.checkout_url
                  ? "O pedido foi reservado. Conclua o pagamento no ambiente seguro do PagBank."
                  : result.payment_error
                    ? "O pedido foi registrado, mas o checkout não pôde ser aberto. Consulte o pedido para tentar novamente."
                    : "O pedido foi salvo e o estoque já foi atualizado."}
            </p>
            {result.payment_error && <div className="payment-start-error"><AlertCircle size={17} />{result.payment_error}</div>}
            <div className="success-summary"><span>Total</span><strong>{formatCurrency(result.total)}</strong></div>
            <div className="success-actions">
              {result.checkout_url && <a className="primary-button" href={result.checkout_url}><CreditCard size={17} /> Pagar com PagBank</a>}
              <a className="outline-button" href={`/pedido?pedido=${encodeURIComponent(result.order_number)}`}>Acompanhar pedido</a>
              <button className="text-button" type="button" onClick={onClose}>Voltar à loja</button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <span className="eyebrow">Checkout seguro</span>
            <h2 id="checkout-title">Finalize sua compra</h2>
            <p>Preencha os dados para registrar o pedido e reservar os produtos.</p>

            <div className="checkout-section-title"><span>1</span><strong>Dados pessoais</strong></div>
            <div className="form-grid">
              <label>Nome completo<input required name="name" autoComplete="name" placeholder="Seu nome" /></label>
              <label>E-mail<input required name="email" type="email" autoComplete="email" placeholder="voce@email.com" /></label>
              <label className="full">Telefone<input required name="phone" type="tel" autoComplete="tel" placeholder="(00) 00000-0000" /></label>
            </div>

            <div className="checkout-section-title"><span>2</span><strong>Entrega ou retirada</strong></div>
            <div className="delivery-options">
              <label className={deliveryMethod === "delivery" ? "selected" : ""}>
                <input type="radio" name="delivery_method" value="delivery" checked={deliveryMethod === "delivery"} onChange={() => setDeliveryMethod("delivery")} />
                <Truck size={20} /><span><strong>Entrega em Guaratuba</strong><small>{address.neighborhood ? `Taxa para ${address.neighborhood}: ${formatCurrency(shipping)}` : `A partir de ${formatCurrency(shipping)}`}</small></span>
              </label>
              <label className={deliveryMethod === "pickup" ? "selected" : ""}>
                <input type="radio" name="delivery_method" value="pickup" checked={deliveryMethod === "pickup"} onChange={() => setDeliveryMethod("pickup")} />
                <Store size={20} /><span><strong>Retirada</strong><small>Sem taxa de entrega</small></span>
              </label>
            </div>

            <div className="checkout-section-title"><span>3</span><strong>Quem vai receber</strong></div>
            <div className="form-grid">
              <label>Nome do destinatário<input required name="recipient_name" placeholder="Nome de quem receberá" /></label>
              <label>Telefone do destinatário<input required name="recipient_phone" type="tel" placeholder="(00) 00000-0000" /></label>
              <label>Data desejada<input required name="delivery_date" type="date" min={minDeliveryDate} /></label>
              <label>Período<select required name="delivery_period" defaultValue="afternoon"><option value="morning">Manhã · 8h às 12h</option><option value="afternoon">Tarde · 12h às 18h</option><option value="evening">Noite · 18h às 21h</option><option value="flexible">Horário flexível</option></select></label>
            </div>

            {deliveryMethod === "delivery" && (
              <>
                <div className="checkout-subtitle"><MapPin size={17} /><strong>Endereço em Guaratuba</strong></div>
                <div className="form-grid address-grid">
                  <label className="postal-code-label">
                    CEP
                    <span className="postal-code-input">
                      <input required name="postal_code" autoComplete="postal-code" inputMode="numeric" placeholder="00000-000" value={address.postal_code} onChange={(event) => {
                        const nextPostalCode = formatPostalCode(event.target.value);
                        setAddress((current) => ({ ...current, postal_code: nextPostalCode, state: nextPostalCode === current.postal_code ? current.state : "", address_line: nextPostalCode === current.postal_code ? current.address_line : "", neighborhood: nextPostalCode === current.postal_code ? current.neighborhood : "", city: nextPostalCode === current.postal_code ? current.city : "" }));
                      }} />
                      {postalStatus.type === "loading" && <Loader2 className="spin" size={17} />}
                    </span>
                    {postalStatus.message && <small className={`postal-message ${postalStatus.type}`}>{postalStatus.type === "success" && <Check size={13} />}{postalStatus.type === "error" && <AlertCircle size={13} />}{postalStatus.message}</small>}
                  </label>
                  <label>Estado<input required name="state" autoComplete="address-level1" maxLength="2" placeholder="PR" value={address.state} onChange={(event) => setAddress((current) => ({ ...current, state: event.target.value.toUpperCase().slice(0, 2) }))} /></label>
                  <label className="full">Rua ou avenida<input required name="address_line" autoComplete="address-line1" placeholder="Nome da rua" value={address.address_line} onChange={(event) => setAddress((current) => ({ ...current, address_line: event.target.value }))} /></label>
                  <label>Número<input required name="address_number" placeholder="123" value={address.address_number} onChange={(event) => setAddress((current) => ({ ...current, address_number: event.target.value }))} /></label>
                  <label>Complemento<input name="complement" autoComplete="address-line2" placeholder="Casa, apartamento..." value={address.complement} onChange={(event) => setAddress((current) => ({ ...current, complement: event.target.value }))} /></label>
                  <label>Bairro<input required name="neighborhood" placeholder="Bairro" value={address.neighborhood} onChange={(event) => setAddress((current) => ({ ...current, neighborhood: event.target.value }))} /></label>
                  <label>Cidade<input required name="city" autoComplete="address-level2" placeholder="Guaratuba" value={address.city} onChange={(event) => setAddress((current) => ({ ...current, city: event.target.value }))} /></label>
                </div>
              </>
            )}

            {deliveryMethod === "pickup" && <input type="hidden" name="postal_code" value="83280-000" />}
            {deliveryMethod === "pickup" && <input type="hidden" name="state" value="PR" />}
            {deliveryMethod === "pickup" && <input type="hidden" name="address_line" value="Retirada na floricultura" />}
            {deliveryMethod === "pickup" && <input type="hidden" name="address_number" value="S/N" />}
            {deliveryMethod === "pickup" && <input type="hidden" name="complement" value="" />}
            {deliveryMethod === "pickup" && <input type="hidden" name="neighborhood" value="Centro" />}
            {deliveryMethod === "pickup" && <input type="hidden" name="city" value="Guaratuba" />}

            <div className="checkout-section-title"><span>4</span><strong>Detalhes do presente</strong></div>
            <div className="form-grid gift-grid">
              <label>Ocasião<select name="occasion" defaultValue=""><option value="">Selecione, se desejar</option><option>Aniversário</option><option>Amor e romance</option><option>Agradecimento</option><option>Parabéns</option><option>Melhoras</option><option>Condolências</option><option>Outro momento</option></select></label>
              <label className="full">Mensagem para o cartão<textarea name="gift_message" maxLength="300" placeholder="Escreva uma mensagem carinhosa..." /></label>
              <label className="full">Instruções para a entrega<textarea name="delivery_instructions" maxLength="300" placeholder="Referência do local, portaria ou observações..." /></label>
              <label className="check-field full"><input type="checkbox" name="anonymous_delivery" /><span>Não identificar quem enviou o presente</span></label>
            </div>

            <div className="checkout-section-title"><span>5</span><strong>Pagamento</strong></div>
            <div className="payment-demo-card">
              <CreditCard size={21} />
              <div><strong>Pix ou cartão pelo PagBank</strong><span>Você será direcionado ao ambiente seguro após registrar o pedido.</span></div>
              <ShieldCheck size={17} />
            </div>

            <div className="coupon-box">
              <label htmlFor="coupon-code">Cupom de desconto</label>
              <div><input id="coupon-code" value={couponInput} onChange={(event) => { setCouponInput(event.target.value.toUpperCase()); setAppliedCoupon(null); setCouponStatus({ type: "idle", message: "" }); }} placeholder="Digite o código" /><button type="button" onClick={applyCoupon} disabled={!couponInput.trim() || couponStatus.type === "loading"}>{couponStatus.type === "loading" ? "Validando..." : "Aplicar"}</button></div>
              {couponStatus.message && <small className={couponStatus.type}>{couponStatus.message}</small>}
              <input type="hidden" name="coupon_code" value={appliedCoupon?.code ?? ""} />
            </div>

            {error && <div className="checkout-error" role="alert"><AlertCircle size={18} />{error}</div>}

            <div className="checkout-prices">
              <div><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div>
              {discount > 0 && <div className="discount-line"><span>Desconto</span><strong>− {formatCurrency(discount)}</strong></div>}
              <div><span>Frete</span><strong>{shipping === 0 ? "Grátis" : formatCurrency(shipping)}</strong></div>
            </div>
            <div className="checkout-total"><span>Total do pedido</span><strong>{formatCurrency(total)}</strong></div>
            <button className="primary-button checkout-button" type="submit" disabled={loading}>
              {loading ? <><Loader2 className="spin" size={18} /> Preparando pagamento...</> : <>Registrar e ir para o pagamento <ArrowRight size={18} /></>}
            </button>
            <div className="checkout-security"><ShieldCheck size={16} /> O token do PagBank permanece protegido no servidor.</div>
          </form>
        )}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div className="footer-brand"><span className="logo floral-logo">ROSINSKI <small>Floricultura</small></span><p>Flores, plantas e gestos de afeto preparados em Guaratuba.</p><span className="footer-social"><Camera size={19} /> Instagram em breve</span></div>
        <div><h3>Flores</h3><a href="#catalogo">Buquês</a><a href="#catalogo">Plantas</a><a href="#catalogo">Destaques</a></div>
        <div><h3>Atendimento</h3><a href="/pedido">Acompanhar pedido</a><span>(42) 00000-0000</span><span>Guaratuba · Paraná</span><span>Entrega ou retirada</span></div>
      </div>
      <div className="footer-bottom shell"><span>© 2026 Rosinski Floricultura. Modelo demonstrativo.</span><span>Privacidade · Termos</span></div>
    </footer>
  );
}

export default App;
