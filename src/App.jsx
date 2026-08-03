import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  CreditCard,
  Heart,
  Camera,
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
  Trash2,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import AdminPage from "./AdminPage";
import { defaultProducts, formatCurrency } from "./data";
import { isSupabaseConfigured } from "./lib/supabase";
import { createOrder } from "./services/orders";
import { formatPostalCode, lookupPostalCode } from "./services/postalCode";
import { loadProducts } from "./services/products";

const categories = ["Todos", "Casa", "Moda", "Beleza", "Acessórios"];

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

  if (isAdmin) {
    return (
      <AdminPage
        products={products}
        setProducts={setProducts}
        reloadProducts={reloadProducts}
      />
    );
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
          ? "A atualização V3 do banco ainda não foi executada. Siga o arquivo supabase/v3-orders.sql."
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
        <span>Frete grátis para compras acima de R$ 299</span>
        <span className="announcement-extra">Troca fácil em até 30 dias</span>
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

          <a className="logo" href="/" aria-label="NOVA - início">
            NOVA
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
            <button className="icon-button desktop-action" type="button" aria-label="Minha conta">
              <UserRound size={22} />
            </button>
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
        <section className="hero shell" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="eyebrow">Coleção essencial · 2026</span>
            <h1 id="hero-title">Essenciais para viver bem.</h1>
            <p>
              Peças escolhidas com intenção para transformar sua rotina com
              beleza, aconchego e propósito.
            </p>
            <button
              className="primary-button"
              type="button"
              onClick={() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })}
            >
              Explorar coleção <ArrowRight size={18} />
            </button>
          </div>
          <div className="hero-image" role="img" aria-label="Ambiente aconchegante com peças de decoração">
            <div className="hero-note">
              <Sparkles size={16} />
              <span>Curadoria para uma vida mais leve</span>
            </div>
          </div>
        </section>

        <section className="trust-strip shell" aria-label="Benefícios da loja">
          <div>
            <Truck size={22} />
            <span><strong>Frete grátis</strong> acima de R$ 299</span>
          </div>
          <div>
            <ShieldCheck size={22} />
            <span><strong>Compra segura</strong> do início ao fim</span>
          </div>
          <div>
            <PackageCheck size={22} />
            <span><strong>Troca fácil</strong> em até 30 dias</span>
          </div>
        </section>

        <section className="catalog shell" id="catalogo" aria-labelledby="catalog-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Nossa curadoria</span>
              <h2 id="catalog-title">Seleção da semana</h2>
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

        <section className="editorial-banner shell">
          <div>
            <span className="eyebrow">Escolhas conscientes</span>
            <h2>Menos excesso.<br />Mais significado.</h2>
          </div>
          <p>
            Acreditamos em objetos que permanecem. Nossa seleção prioriza
            materiais honestos, desenho atemporal e produtores cuidadosos.
          </p>
          <a href="#catalogo">Conheça a curadoria <ArrowRight size={17} /></a>
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
          <span className="logo">NOVA</span>
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
        <div className="mobile-account"><UserRound size={19} /> Minha conta</div>
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
              <div><span>Frete</span><span>{subtotal >= 299 ? "Grátis" : "Calculado no checkout"}</span></div>
              {subtotal < 299 && (
                <div className="shipping-progress">
                  <span style={{ width: `${Math.min(100, (subtotal / 299) * 100)}%` }} />
                  <p>Faltam {formatCurrency(299 - subtotal)} para frete grátis</p>
                </div>
              )}
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
    if (!open) return undefined;
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
        setPostalStatus({
          type: "success",
          message: "Endereço preenchido. Confira os dados e informe o número.",
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
  }, [address.postal_code, open]);

  if (!open) return null;
  const shipping = subtotal >= 299 ? 0 : 24.9;
  const total = subtotal + shipping;

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      <button className="panel-backdrop" type="button" aria-label="Fechar checkout" onClick={onClose} />
      <div className="checkout-modal">
        <button className="modal-close icon-button" type="button" onClick={onClose} aria-label="Fechar"><X /></button>
        {result ? (
          <div className="order-success">
            <div className="success-icon"><Check size={29} /></div>
            <span className="eyebrow">Pedido registrado</span>
            <h2>Obrigada por escolher a NOVA.</h2>
            <div className="order-number"><span>Número do pedido</span><strong>{result.order_number}</strong></div>
            <p>O pedido foi salvo e o estoque já foi atualizado. O pagamento desta versão é apenas uma simulação.</p>
            <div className="success-summary"><span>Total</span><strong>{formatCurrency(result.total)}</strong></div>
            <button className="primary-button" type="button" onClick={onClose}>Voltar à loja</button>
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

            <div className="checkout-section-title"><span>2</span><strong>Endereço de entrega</strong></div>
            <div className="form-grid address-grid">
              <label className="postal-code-label">
                CEP
                <span className="postal-code-input">
                  <input
                    required
                    name="postal_code"
                    autoComplete="postal-code"
                    inputMode="numeric"
                    placeholder="00000-000"
                    value={address.postal_code}
                    onChange={(event) => {
                      const nextPostalCode = formatPostalCode(event.target.value);
                      setAddress((current) => ({
                        ...current,
                        postal_code: nextPostalCode,
                        state: nextPostalCode === current.postal_code ? current.state : "",
                        address_line: nextPostalCode === current.postal_code ? current.address_line : "",
                        neighborhood: nextPostalCode === current.postal_code ? current.neighborhood : "",
                        city: nextPostalCode === current.postal_code ? current.city : "",
                      }));
                    }}
                  />
                  {postalStatus.type === "loading" && <Loader2 className="spin" size={17} />}
                </span>
                {postalStatus.message && (
                  <small className={`postal-message ${postalStatus.type}`}>
                    {postalStatus.type === "success" && <Check size={13} />}
                    {postalStatus.type === "error" && <AlertCircle size={13} />}
                    {postalStatus.message}
                  </small>
                )}
              </label>
              <label>
                Estado
                <input
                  required
                  name="state"
                  autoComplete="address-level1"
                  maxLength="2"
                  placeholder="PR"
                  value={address.state}
                  onChange={(event) =>
                    setAddress((current) => ({
                      ...current,
                      state: event.target.value.toUpperCase().slice(0, 2),
                    }))
                  }
                />
              </label>
              <label className="full">
                Rua ou avenida
                <input
                  required
                  name="address_line"
                  autoComplete="address-line1"
                  placeholder="Nome da rua"
                  value={address.address_line}
                  onChange={(event) =>
                    setAddress((current) => ({
                      ...current,
                      address_line: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Número
                <input
                  required
                  name="address_number"
                  placeholder="123"
                  value={address.address_number}
                  onChange={(event) =>
                    setAddress((current) => ({
                      ...current,
                      address_number: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Complemento
                <input
                  name="complement"
                  autoComplete="address-line2"
                  placeholder="Apartamento, bloco..."
                  value={address.complement}
                  onChange={(event) =>
                    setAddress((current) => ({
                      ...current,
                      complement: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Bairro
                <input
                  required
                  name="neighborhood"
                  placeholder="Seu bairro"
                  value={address.neighborhood}
                  onChange={(event) =>
                    setAddress((current) => ({
                      ...current,
                      neighborhood: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Cidade
                <input
                  required
                  name="city"
                  autoComplete="address-level2"
                  placeholder="Sua cidade"
                  value={address.city}
                  onChange={(event) =>
                    setAddress((current) => ({
                      ...current,
                      city: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <div className="checkout-section-title"><span>3</span><strong>Pagamento</strong></div>
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
        <div className="footer-brand"><span className="logo">NOVA</span><p>Peças escolhidas para uma vida com beleza, intenção e significado.</p><a href="https://instagram.com" aria-label="Instagram"><Camera size={20} /></a></div>
        <div><h3>Loja</h3><a href="#catalogo">Novidades</a><a href="#catalogo">Casa</a><a href="#catalogo">Moda</a><a href="#catalogo">Beleza</a></div>
        <div><h3>Ajuda</h3><a href="#">Entregas</a><a href="#">Trocas e devoluções</a><a href="#">Perguntas frequentes</a><a href="#">Fale conosco</a></div>
        <div><h3>Projeto</h3><p>Este é um modelo funcional de e-commerce.</p><a className="admin-link" href="/admin">Abrir gestão de estoque <ArrowRight size={15} /></a></div>
      </div>
      <div className="footer-bottom shell"><span>© 2026 NOVA. Modelo demonstrativo.</span><span>Privacidade · Termos</span></div>
    </footer>
  );
}

export default App;
