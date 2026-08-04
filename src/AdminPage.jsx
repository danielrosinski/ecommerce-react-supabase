import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Box,
  Check,
  ClipboardList,
  Database,
  Eye,
  EyeOff,
  ImageIcon,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  Minus,
  Pencil,
  Phone,
  Plus,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { formatCurrency } from "./data";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { loadOrders, updateOrderStatus } from "./services/orders";
import {
  createProduct,
  deleteProduct,
  restoreExampleProducts,
  saveProductChange,
} from "./services/products";

const orderStatuses = [
  { value: "received", label: "Pedido recebido" },
  { value: "confirmed", label: "Confirmado" },
  { value: "preparing", label: "Em preparação" },
  { value: "shipped", label: "Saiu para entrega" },
  { value: "delivered", label: "Entregue" },
  { value: "cancelled", label: "Cancelado" },
];

const formatOrderDate = (value) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

function AdminPage({ products, setProducts, reloadProducts }) {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [isAdmin, setIsAdmin] = useState(!isSupabaseConfigured);
  const [accessError, setAccessError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;

    let mounted = true;

    const checkAccess = async (nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setAccessError("");

      if (!nextSession) {
        setIsAdmin(false);
        setAuthLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", nextSession.user.id)
        .maybeSingle();

      if (!mounted) return;
      if (error) {
        setIsAdmin(false);
        setAccessError(
          "Não foi possível verificar o acesso. Confirme se o arquivo schema.sql foi executado.",
        );
      } else {
        setIsAdmin(Boolean(data));
        if (data) {
          await reloadProducts();
        }
      }
      setAuthLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => checkAccess(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setAuthLoading(true);
      window.setTimeout(() => checkAccess(nextSession), 0);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (authLoading) {
    return <AdminLoading />;
  }

  if (isSupabaseConfigured && !session) {
    return <AdminLogin />;
  }

  if (isSupabaseConfigured && !isAdmin) {
    return (
      <AccessDenied
        email={session?.user?.email}
        message={accessError}
        onSignOut={() => supabase.auth.signOut()}
      />
    );
  }

  return (
    <InventoryManager
      products={products}
      setProducts={setProducts}
      reloadProducts={reloadProducts}
      connected={isSupabaseConfigured}
      email={session?.user?.email}
    />
  );
}

function AdminLoading() {
  return (
    <div className="admin-auth-page">
      <div className="admin-auth-card admin-loading-card" role="status">
        <RefreshCw className="spin" size={27} />
        <p>Verificando acesso administrativo...</p>
      </div>
    </div>
  );
}

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError("E-mail ou senha inválidos. Verifique os dados e tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div className="admin-auth-page">
      <header className="admin-auth-header">
        <a className="logo floral-logo" href="/">ROSINSKI <small>Floricultura</small></a>
        <a className="outline-button" href="/"><ArrowLeft size={17} /> Voltar à loja</a>
      </header>
      <main className="admin-auth-main">
        <section className="admin-auth-card" aria-labelledby="admin-login-title">
          <div className="auth-icon"><LockKeyhole size={25} /></div>
          <span className="eyebrow">Acesso protegido</span>
          <h1 id="admin-login-title">Painel administrativo</h1>
          <p>Entre com o usuário administrador cadastrado no banco de dados.</p>

          {error && <div className="auth-error" role="alert"><AlertCircle size={17} />{error}</div>}

          <form onSubmit={handleSubmit}>
            <label>
              E-mail
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@sualoja.com"
              />
            </label>
            <label>
              Senha
              <span className="password-field">
                <input
                  required
                  minLength="6"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Sua senha"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            <button className="primary-button auth-submit" type="submit" disabled={loading}>
              {loading ? <><RefreshCw className="spin" size={17} /> Entrando...</> : "Entrar no painel"}
            </button>
          </form>

          <div className="auth-security-note">
            <ShieldCheck size={18} />
            <span>As permissões são verificadas no banco, não apenas na tela.</span>
          </div>
        </section>
      </main>
    </div>
  );
}

function AccessDenied({ email, message, onSignOut }) {
  return (
    <div className="admin-auth-page">
      <main className="admin-auth-main">
        <section className="admin-auth-card access-denied-card">
          <div className="auth-icon warning"><AlertCircle size={25} /></div>
          <span className="eyebrow">Acesso não autorizado</span>
          <h1>Este usuário não é administrador.</h1>
          <p>
            {message || `O usuário ${email ?? "informado"} está autenticado, mas não possui permissão para gerenciar a loja.`}
          </p>
          <div className="access-actions">
            <button className="primary-button" type="button" onClick={onSignOut}>Sair e tentar outra conta</button>
            <a className="outline-button" href="/"><ArrowLeft size={17} /> Voltar à loja</a>
          </div>
        </section>
      </main>
    </div>
  );
}

function InventoryManager({
  products,
  setProducts,
  reloadProducts,
  connected,
  email,
}) {
  const [view, setView] = useState("products");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [savingId, setSavingId] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(connected);
  const [ordersError, setOrdersError] = useState("");
  const [savingOrderId, setSavingOrderId] = useState(null);
  const [productEditor, setProductEditor] = useState(null);
  const [productSaving, setProductSaving] = useState(false);

  const totalStock = products.reduce((sum, product) => sum + product.stock, 0);
  const lowStock = products.filter(
    (product) => product.stock > 0 && product.stock <= 3,
  ).length;
  const outOfStock = products.filter((product) => product.stock === 0).length;
  const confirmedOrders = orders.filter((order) => order.status === "confirmed").length;
  const preparingOrders = orders.filter((order) => order.status === "preparing").length;
  const shippedOrders = orders.filter((order) => order.status === "shipped").length;

  const refreshOrders = async () => {
    if (!connected) {
      setOrders([]);
      setOrdersLoading(false);
      return;
    }

    setOrdersLoading(true);
    setOrdersError("");

    try {
      setOrders(await loadOrders());
    } catch (error) {
      const missingTable =
        error?.code === "42P01" ||
        error?.code === "PGRST205" ||
        error?.message?.includes("orders");
      setOrdersError(
        missingTable
          ? "A atualização de pedidos ainda não foi instalada. Execute supabase/v3-orders.sql."
          : error?.message || "Não foi possível carregar os pedidos.",
      );
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    refreshOrders();
    // A lista é recarregada quando o painel autenticado é aberto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  useEffect(() => {
    if (!status.message) return undefined;
    const timer = window.setTimeout(
      () => setStatus({ type: "", message: "" }),
      3200,
    );
    return () => window.clearTimeout(timer);
  }, [status]);

  const updateProduct = async (id, field, value) => {
    const previous = products.find((product) => product.id === id);
    if (!previous || previous[field] === value) return;

    setSavingId(id);
    setProducts((current) =>
      current.map((product) =>
        product.id === id ? { ...product, [field]: value } : product,
      ),
    );

    try {
      const saved = await saveProductChange(id, { [field]: value });
      setProducts((current) =>
        current.map((product) =>
          product.id === id ? { ...product, ...saved } : product,
        ),
      );
      setStatus({
        type: "success",
        message: connected
          ? "Alteração salva no banco de dados."
          : "Alteração salva neste navegador.",
      });
    } catch (error) {
      setProducts((current) =>
        current.map((product) => (product.id === id ? previous : product)),
      );
      setStatus({
        type: "error",
        message: error.message || "Não foi possível salvar a alteração.",
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const restored = await restoreExampleProducts();
      setProducts(restored);
      setStatus({
        type: "success",
        message: "Produtos de exemplo restaurados.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Não foi possível restaurar os produtos.",
      });
    } finally {
      setRestoring(false);
    }
  };

  const handleProductSave = async (formProduct) => {
    setProductSaving(true);

    try {
      if (productEditor.mode === "create") {
        const created = await createProduct(formProduct);
        setProducts((current) => [...current, created]);
        setStatus({ type: "success", message: "Produto cadastrado com sucesso." });
      } else {
        const saved = await saveProductChange(productEditor.product.id, formProduct);
        setProducts((current) =>
          current.map((product) =>
            product.id === saved.id ? { ...product, ...saved } : product,
          ),
        );
        setStatus({ type: "success", message: "Produto atualizado com sucesso." });
      }
      setProductEditor(null);
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Não foi possível salvar o produto.",
      });
    } finally {
      setProductSaving(false);
    }
  };

  const handleDeleteProduct = async (product) => {
    const confirmed = window.confirm(
      `Excluir “${product.name}”? Essa ação não pode ser desfeita.`,
    );
    if (!confirmed) return;

    setSavingId(product.id);
    try {
      await deleteProduct(product.id);
      setProducts((current) => current.filter((item) => item.id !== product.id));
      setStatus({ type: "success", message: "Produto excluído com sucesso." });
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error?.code === "23503"
            ? "Este produto faz parte de um pedido e não pode ser excluído. Use o status Oculto."
            : error.message || "Não foi possível excluir o produto.",
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleOrderStatus = async (order, nextStatus) => {
    if (order.status === nextStatus) return;
    if (
      nextStatus === "cancelled" &&
      !window.confirm(
        "Cancelar este pedido? As unidades serão devolvidas ao estoque e o pedido não poderá ser reativado.",
      )
    ) {
      return;
    }

    setSavingOrderId(order.id);
    try {
      const updated = await updateOrderStatus(order.id, nextStatus);
      setOrders((current) =>
        current.map((item) => (item.id === order.id ? updated : item)),
      );
      if (nextStatus === "cancelled") await reloadProducts();
      setStatus({
        type: "success",
        message:
          nextStatus === "cancelled"
            ? "Pedido cancelado e estoque restaurado."
            : "Status do pedido atualizado.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Não foi possível atualizar o pedido.",
      });
    } finally {
      setSavingOrderId(null);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <a className="logo floral-logo" href="/">ROSINSKI <small>Floricultura</small></a>
        <div>
          <span className={`database-status ${connected ? "connected" : "demo"}`}>
            <Database size={15} /> {connected ? "Banco conectado" : "Modo demonstração"}
          </span>
          {connected && email && <span className="admin-email">{email}</span>}
          {connected && (
            <button
              className="icon-button"
              type="button"
              aria-label="Sair do painel"
              onClick={() => supabase.auth.signOut()}
            >
              <LogOut size={19} />
            </button>
          )}
          <a className="outline-button" href="/">
            <ArrowLeft size={17} /> Voltar à loja
          </a>
        </div>
      </header>

      <main className="admin-main">
        <div className="admin-title">
          <div>
            <span className="eyebrow">Área administrativa</span>
            <h1>Gestão da loja</h1>
            <p>Controle produtos, estoque e pedidos em um único lugar.</p>
          </div>
          <div className="admin-title-actions">
            {view === "products" ? (
              <>
                <button
                  className="primary-button new-product-button"
                  type="button"
                  onClick={() => setProductEditor({ mode: "create", product: null })}
                >
                  <PlusCircle size={16} /> Novo produto
                </button>
                <button className="text-button" type="button" onClick={reloadProducts}>
                  <RefreshCw size={14} /> Atualizar produtos
                </button>
                <button
                  className="text-button"
                  type="button"
                  onClick={handleRestore}
                  disabled={restoring}
                >
                  {restoring ? "Restaurando..." : "Restaurar dados de exemplo"}
                </button>
              </>
            ) : (
              <button
                className="text-button"
                type="button"
                onClick={refreshOrders}
                disabled={ordersLoading}
              >
                <RefreshCw className={ordersLoading ? "spin" : ""} size={14} />
                Atualizar pedidos
              </button>
            )}
          </div>
        </div>

        <nav className="admin-tabs" aria-label="Seções administrativas">
          <button
            type="button"
            className={view === "products" ? "active" : ""}
            onClick={() => setView("products")}
          >
            <Box size={18} /> Produtos
          </button>
          <button
            type="button"
            className={view === "orders" ? "active" : ""}
            onClick={() => setView("orders")}
          >
            <ClipboardList size={18} /> Pedidos
            {orders.length > 0 && <span>{orders.length}</span>}
          </button>
        </nav>

        {status.message && (
          <div className={`admin-feedback ${status.type}`} role="status">
            {status.type === "success" ? (
              <Check size={17} />
            ) : (
              <AlertCircle size={17} />
            )}
            {status.message}
          </div>
        )}

        {view === "products" ? (
          <>
            <div className="admin-metrics">
              <div><span>Produtos cadastrados</span><strong>{products.length}</strong></div>
              <div><span>Unidades em estoque</span><strong>{totalStock}</strong></div>
              <div><span>Estoque baixo</span><strong>{lowStock}</strong></div>
              <div><span>Sem estoque</span><strong>{outOfStock}</strong></div>
            </div>

            <section className="inventory-table-wrap" aria-labelledby="inventory-title">
              <div className="inventory-heading">
                <div>
                  <h2 id="inventory-title">Produtos</h2>
                  <p>As alterações aparecem na loja assim que são salvas.</p>
                </div>
                <span>{products.filter((product) => product.active).length} ativos</span>
              </div>
              <div className="inventory-table">
                <div className="inventory-row inventory-labels">
                  <span>Produto</span><span>Preço</span><span>Estoque</span><span>Destaque</span><span>Status</span><span>Ações</span>
                </div>
                {products.map((product) => (
                  <div
                    className={`inventory-row ${savingId === product.id ? "saving" : ""}`}
                    key={product.id}
                  >
                    <div className="inventory-product">
                      <img src={product.image} alt="" />
                      <div><strong>{product.name}</strong><span>{product.category}</span></div>
                    </div>
                    <label>
                      <span className="mobile-label">Preço</span>
                      <div className="price-input">
                        <span>R$</span>
                        <input
                          key={`${product.id}-price-${product.price}`}
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={product.price}
                          onBlur={(event) =>
                            updateProduct(
                              product.id,
                              "price",
                              Math.max(0, Number(event.target.value)),
                            )
                          }
                        />
                      </div>
                    </label>
                    <label>
                      <span className="mobile-label">Estoque</span>
                      <div className="stock-stepper">
                        <button
                          type="button"
                          aria-label="Diminuir estoque"
                          disabled={savingId === product.id}
                          onClick={() =>
                            updateProduct(
                              product.id,
                              "stock",
                              Math.max(0, product.stock - 1),
                            )
                          }
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          key={`${product.id}-stock-${product.stock}`}
                          aria-label={`Estoque de ${product.name}`}
                          type="number"
                          min="0"
                          defaultValue={product.stock}
                          onBlur={(event) =>
                            updateProduct(
                              product.id,
                              "stock",
                              Math.max(0, Number(event.target.value)),
                            )
                          }
                        />
                        <button
                          type="button"
                          aria-label="Aumentar estoque"
                          disabled={savingId === product.id}
                          onClick={() =>
                            updateProduct(product.id, "stock", product.stock + 1)
                          }
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </label>
                    <label className="switch-label">
                      <span className="mobile-label">Destaque</span>
                      <input
                        type="checkbox"
                        checked={product.featured}
                        disabled={savingId === product.id}
                        onChange={(event) =>
                          updateProduct(product.id, "featured", event.target.checked)
                        }
                      />
                      <span className="switch" />
                    </label>
                    <label className="status-toggle">
                      <span className="mobile-label">Status</span>
                      <button
                        className={product.active ? "active" : "inactive"}
                        type="button"
                        disabled={savingId === product.id}
                        onClick={() =>
                          updateProduct(product.id, "active", !product.active)
                        }
                      >
                        {product.active ? "Ativo" : "Oculto"}
                      </button>
                    </label>
                    <div className="product-actions">
                      <button
                        type="button"
                        aria-label={`Editar ${product.name}`}
                        title="Editar produto"
                        disabled={savingId === product.id}
                        onClick={() =>
                          setProductEditor({ mode: "edit", product })
                        }
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="delete"
                        type="button"
                        aria-label={`Excluir ${product.name}`}
                        title="Excluir produto"
                        disabled={savingId === product.id}
                        onClick={() => handleDeleteProduct(product)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="admin-note">
              <ShieldCheck size={20} />
              <p>
                {connected ? (
                  <>
                    <strong>Dados protegidos.</strong> Somente administradores podem alterar os produtos.
                  </>
                ) : (
                  <>
                    <strong>Modo demonstração.</strong> Configure o Supabase para salvar as alterações.
                  </>
                )}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="admin-metrics order-metrics">
              <div><span>Total de pedidos</span><strong>{orders.length}</strong></div>
              <div><span>Confirmados</span><strong>{confirmedOrders}</strong></div>
              <div><span>Em preparação</span><strong>{preparingOrders}</strong></div>
              <div><span>Saiu para entrega</span><strong>{shippedOrders}</strong></div>
            </div>

            <section className="orders-wrap" aria-labelledby="orders-title">
              <div className="inventory-heading">
                <div>
                  <h2 id="orders-title">Pedidos recentes</h2>
                  <p>Acompanhe clientes, itens, entrega e andamento.</p>
                </div>
                <span>{orders.length} registrados</span>
              </div>

              {ordersLoading ? (
                <div className="orders-state" role="status">
                  <RefreshCw className="spin" size={24} />
                  <p>Carregando pedidos...</p>
                </div>
              ) : ordersError ? (
                <div className="orders-state error" role="alert">
                  <AlertCircle size={24} />
                  <h3>Pedidos indisponíveis</h3>
                  <p>{ordersError}</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="orders-state">
                  <ClipboardList size={28} />
                  <h3>Nenhum pedido recebido</h3>
                  <p>Os novos pedidos aparecerão aqui automaticamente.</p>
                </div>
              ) : (
                <div className="orders-list">
                  {orders.map((order) => (
                    <article className="order-card" key={order.id}>
                      <header className="order-card-header">
                        <div>
                          <span>Pedido</span>
                          <h3>{order.order_number}</h3>
                          <time dateTime={order.created_at}>
                            {formatOrderDate(order.created_at)}
                          </time>
                        </div>
                        <label className={`order-status status-${order.status}`}>
                          <span className="sr-only">Status do pedido</span>
                          <select
                            value={order.status}
                            disabled={
                              savingOrderId === order.id ||
                              order.status === "cancelled"
                            }
                            onChange={(event) =>
                              handleOrderStatus(order, event.target.value)
                            }
                          >
                            {orderStatuses.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </header>

                      <div className="order-details-grid">
                        <section>
                          <h4>Cliente</h4>
                          <strong>{order.customer_name}</strong>
                          <a href={`mailto:${order.customer_email}`}>
                            <Mail size={14} /> {order.customer_email}
                          </a>
                          <a href={`tel:${order.customer_phone}`}>
                            <Phone size={14} /> {order.customer_phone}
                          </a>
                        </section>
                        <section>
                          <h4>Entrega</h4>
                          <strong>{order.recipient_name || order.customer_name}</strong>
                          {order.recipient_phone && <a href={`tel:${order.recipient_phone}`}><Phone size={14} /> {order.recipient_phone}</a>}
                          {order.delivery_method === "pickup" ? (
                            <span>Retirada na floricultura</span>
                          ) : (
                            <address>
                              <MapPin size={15} />
                              <span>{order.address_line}, {order.address_number}{order.complement ? ` · ${order.complement}` : ""}<br />{order.neighborhood} · {order.city}/{order.state}<br />CEP {order.postal_code}</span>
                            </address>
                          )}
                          <span>{order.delivery_date ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${order.delivery_date}T12:00:00`)) : "Data a combinar"} · {order.delivery_period || "horário flexível"}</span>
                        </section>
                        <section>
                          <h4>Pagamento</h4>
                          <strong>Simulado</strong>
                          <span>Nenhuma cobrança realizada</span>
                        </section>
                      </div>

                      {(order.gift_message || order.delivery_instructions || order.occasion) && (
                        <div className="order-gift-details">
                          <div><strong>Ocasião</strong><span>{order.occasion || "Não informada"}</span></div>
                          <div><strong>Cartão</strong><span>{order.gift_message || "Sem mensagem"}{order.anonymous_delivery ? " · Entrega anônima" : ""}</span></div>
                          <div><strong>Observações</strong><span>{order.delivery_instructions || "Nenhuma"}</span></div>
                        </div>
                      )}

                      <div className="order-items">
                        <h4>Itens do pedido</h4>
                        {order.order_items.map((item) => (
                          <div key={item.id}>
                            <span>{item.quantity}× {item.product_name}</span>
                            <strong>{formatCurrency(item.line_total)}</strong>
                          </div>
                        ))}
                      </div>

                      <footer className="order-card-footer">
                        <div><span>Subtotal</span><strong>{formatCurrency(order.subtotal)}</strong></div>
                        <div><span>Frete</span><strong>{order.shipping === 0 ? "Grátis" : formatCurrency(order.shipping)}</strong></div>
                        <div className="order-total"><span>Total</span><strong>{formatCurrency(order.total)}</strong></div>
                      </footer>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <div className="admin-note">
              <ShieldCheck size={20} />
              <p>
                <strong>Fluxo protegido.</strong> O banco valida preços, confere o estoque e registra o pedido em uma única operação.
              </p>
            </div>
          </>
        )}
      </main>
      {productEditor && (
        <ProductEditor
          mode={productEditor.mode}
          product={productEditor.product}
          saving={productSaving}
          onClose={() => setProductEditor(null)}
          onSave={handleProductSave}
        />
      )}
    </div>
  );
}

function ProductEditor({ mode, product, saving, onClose, onSave }) {
  const [form, setForm] = useState({
    name: product?.name ?? "",
    category: product?.category ?? "Buquês",
    price: product?.price ?? "",
    stock: product?.stock ?? 0,
    tag: product?.tag ?? "",
    image: product?.image ?? "",
    featured: product?.featured ?? false,
    active: product?.active ?? true,
  });

  useEffect(() => {
    document.body.classList.add("no-scroll");
    return () => document.body.classList.remove("no-scroll");
  }, []);

  const updateField = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({
      ...form,
      name: form.name.trim(),
      tag: form.tag.trim(),
      image: form.image.trim(),
      price: Math.max(0, Number(form.price)),
      stock: Math.max(0, Number(form.stock)),
    });
  };

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="product-editor-title">
      <button className="panel-backdrop" type="button" aria-label="Fechar editor" onClick={onClose} />
      <form className="product-editor-modal" onSubmit={handleSubmit}>
        <button className="modal-close icon-button" type="button" onClick={onClose} aria-label="Fechar">
          <X size={20} />
        </button>
        <span className="eyebrow">Catálogo</span>
        <h2 id="product-editor-title">
          {mode === "create" ? "Novo produto" : "Editar produto"}
        </h2>
        <p>Preencha as informações que serão exibidas na loja.</p>

        <div className="product-editor-layout">
          <div className="product-image-preview">
            {form.image ? (
              <img src={form.image} alt="Prévia do produto" />
            ) : (
              <div><ImageIcon size={28} /><span>Prévia da imagem</span></div>
            )}
          </div>

          <div className="product-form-grid">
            <label className="full">
              Nome do produto
              <input required value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Ex.: Buquê Jardim Rosé" />
            </label>
            <label>
              Categoria
              <select value={form.category} onChange={(event) => updateField("category", event.target.value)}>
                <option>Buquês</option>
                <option>Plantas</option>
              </select>
            </label>
            <label>
              Etiqueta
              <input required value={form.tag} onChange={(event) => updateField("tag", event.target.value)} placeholder="Ex.: Nova coleção" />
            </label>
            <label>
              Preço
              <input required type="number" min="0" step="0.01" value={form.price} onChange={(event) => updateField("price", event.target.value)} placeholder="0,00" />
            </label>
            <label>
              Estoque inicial
              <input required type="number" min="0" step="1" value={form.stock} onChange={(event) => updateField("stock", event.target.value)} />
            </label>
            <label className="full">
              URL da imagem
              <input required type="url" value={form.image} onChange={(event) => updateField("image", event.target.value)} placeholder="https://exemplo.com/imagem.jpg" />
            </label>
            <label className="product-check">
              <input type="checkbox" checked={form.featured} onChange={(event) => updateField("featured", event.target.checked)} />
              <span>Mostrar como destaque</span>
            </label>
            <label className="product-check">
              <input type="checkbox" checked={form.active} onChange={(event) => updateField("active", event.target.checked)} />
              <span>Produto visível na loja</span>
            </label>
          </div>
        </div>

        <div className="product-editor-actions">
          <button className="outline-button" type="button" onClick={onClose}>Cancelar</button>
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? <><RefreshCw className="spin" size={16} /> Salvando...</> : mode === "create" ? "Cadastrar produto" : "Salvar alterações"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default AdminPage;
