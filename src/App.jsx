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
  Loader2,
  MapPin,
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
import { formatPostalCode, lookupPostalCode } from "./services/postalCode";
import { loadProducts } from "./services/products";

const categories = ["Todos", "Buquês", "Plantas"];

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
    return sum + (product?.price ?? 0) * item.quantity;
  }, 0);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    document.body.classList.toggle("no-scroll", cartOpen || checkoutOpen);
    return () => document.body.classList.remove("no-scroll");
  }, [cartOpen, checkoutOpen]);

  const itemQuantity = (id) =>
    cart.find((item) => item.id === id)?.quantity ?? 0;

  const addToCart = (product) => {
    const current = itemQuantity(product.id);
    if (product.stock === 0 || current >= product.stock) {
      setToast("Não há mais unidades disponíveis.");
      return;
    }
    setCart((currentCart) => {
      const found = currentCart.find((item) => item.id === product.id);
      if (found) {
        return currentCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...currentCart, { id: product.id, quantity: 1 }];
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
    };

    setCheckoutLoading(true);
    setCheckoutError("");

    try {
      const result = await createOrder({ customer, cart, products });

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
      setOrderResult(result);
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
              <span className="eyebrow">Feito para presentear</span>
              <h2 id="catalog-title">Flores e plantas</h2>
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

        <section className="hero shell" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="eyebrow">Floricultura em Guaratuba</span>
            <h1 id="hero-title">Flores que dizem o que importa.</h1>
            <p>
              Buquês e plantas escolhidos com delicadeza para celebrar,
              acolher e transformar pequenos momentos em boas lembranças.
            </p>
            <button
              className="outline-button"
              type="button"
              onClick={() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })}
            >
              Voltar ao catálogo <ArrowRight size={18} />
            </button>
          </div>
          <div className="hero-image" role="img" aria-label="Buquê delicado em tons naturais">
            <div className="hero-note">
              <Sparkles size={16} />
              <span>Preparado à mão para cada ocasião</span>
            </div>
          </div>
        </section>

        <section className="editorial-banner shell">
          <div>
            <span className="eyebrow">Um gesto que permanece</span>
            <h2>Afeto em cada<br />detalhe.</h2>
          </div>
          <p>
            Cada composição é preparada com cuidado e pode levar uma mensagem
            especial para tornar a entrega ainda mais pessoal.
          </p>
          <a href="#catalogo">Encontre o presente ideal <ArrowRight size={17} /></a>
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
        onClose={closeCheckout}
        onSubmit={finishOrder}
      />
      {toast && (
        <div className="toast" role="status">
          <Check size={18} /> {toast}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, quantity, favorite, onFavorite, onAdd }) {
  const remaining = Math.max(0, product.stock - quantity);
  const stockClass = product.stock === 0 ? "out" : product.stock <= 3 ? "low" : "available";
  const stockLabel =
    product.stock === 0
      ? "Indisponível"
      : remaining <= 3
        ? `${remaining} ${remaining === 1 ? "unidade" : "unidades"}`
        : "Em estoque";

  return (
    <article className={`product-card ${product.stock === 0 ? "sold-out" : ""}`}>
      <div className="product-visual">
        <img src={product.image} alt={product.name} loading="lazy" />
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
        <h3>{product.name}</h3>
        <div className="product-meta">
          <strong>{formatCurrency(product.price)}</strong>
          <span className={`stock ${stockClass}`}>
            <i /> {stockLabel}
          </span>
        </div>
        <button className="add-button" type="button" onClick={onAdd} disabled={remaining === 0}>
          {product.stock === 0 ? "Avise-me quando chegar" : quantity > 0 ? `Adicionar mais · ${quantity} no carrinho` : "Adicionar ao carrinho"}
        </button>
      </div>
    </article>
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
              {items.map(({ product, quantity }) => (
                <article className="cart-item" key={product.id}>
                  <img src={product.image} alt="" />
                  <div>
                    <p>{product.category}</p>
                    <h3>{product.name}</h3>
                    <strong>{formatCurrency(product.price)}</strong>
                    <div className="quantity-control" aria-label={`Quantidade de ${product.name}`}>
                      <button type="button" aria-label="Diminuir quantidade" onClick={() => onUpdate(product.id, -1)}><Minus size={15} /></button>
                      <span>{quantity}</span>
                      <button type="button" aria-label="Aumentar quantidade" disabled={quantity >= product.stock} onClick={() => onUpdate(product.id, 1)}><Plus size={15} /></button>
                    </div>
                  </div>
                  <button className="remove-item" type="button" aria-label={`Remover ${product.name}`} onClick={() => onRemove(product.id)}><Trash2 size={17} /></button>
                </article>
              ))}
            </div>
            <div className="cart-summary">
              <div><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div>
              <div><span>Entrega</span><span>Calculada no checkout</span></div>
              <div className="shipping-progress shipping-local"><span /><p>Retirada em Guaratuba sem taxa.</p></div>
              <button className="primary-button checkout-button" type="button" onClick={onCheckout}>Finalizar compra <ArrowRight size={18} /></button>
              <small>O pedido será registrado. O pagamento permanece simulado nesta versão.</small>
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
  const shipping = deliveryMethod === "pickup" ? 0 : 14.9;
  const total = subtotal + shipping;
  const minDeliveryDate = new Date().toISOString().split("T")[0];

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
            <p>O pedido foi salvo e o estoque já foi atualizado. O pagamento desta versão é apenas uma simulação.</p>
            <div className="success-summary"><span>Total</span><strong>{formatCurrency(result.total)}</strong></div>
            <div className="success-actions"><button className="primary-button" type="button" onClick={onClose}>Voltar à loja</button><a className="outline-button" href="/pedido">Acompanhar pedido</a></div>
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
                <Truck size={20} /><span><strong>Entrega em Guaratuba</strong><small>Taxa calculada: {formatCurrency(14.9)}</small></span>
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
              <div><strong>Pagamento simulado</strong><span>Nenhuma cobrança real será realizada.</span></div>
              <Check size={17} />
            </div>

            {error && <div className="checkout-error" role="alert"><AlertCircle size={18} />{error}</div>}

            <div className="checkout-prices">
              <div><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div>
              <div><span>Frete</span><strong>{shipping === 0 ? "Grátis" : formatCurrency(shipping)}</strong></div>
            </div>
            <div className="checkout-total"><span>Total do pedido</span><strong>{formatCurrency(total)}</strong></div>
            <button className="primary-button checkout-button" type="submit" disabled={loading}>
              {loading ? <><Loader2 className="spin" size={18} /> Registrando pedido...</> : <>Confirmar pedido <ArrowRight size={18} /></>}
            </button>
            <div className="checkout-security"><MapPin size={16} /> Os dados serão usados somente para este pedido demonstrativo.</div>
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
        <div><h3>Projeto</h3><p>Modelo funcional de uma floricultura digital.</p><a className="admin-link" href="/admin">Abrir painel administrativo <ArrowRight size={15} /></a></div>
      </div>
      <div className="footer-bottom shell"><span>© 2026 Rosinski Floricultura. Modelo demonstrativo.</span><span>Privacidade · Termos</span></div>
    </footer>
  );
}

export default App;
