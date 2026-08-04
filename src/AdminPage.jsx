import { useEffect, useMemo, useState } from "react";
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
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { formatCurrency } from "./data";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { loadOrders, updateOrderStatus } from "./services/orders";
import { cancelPagBankCheckout, refundPagBankPayment } from "./services/payments";
import {
  createProduct,
  deleteProduct,
  restoreExampleProducts,
  saveProductChange,
} from "./services/products";
import {
  createCoupon,
  createDeliveryZone,
  defaultDeliveryZones,
  deleteCoupon,
  deleteDeliveryZone,
  loadCoupons,
  loadDeliveryZones,
  updateCoupon,
  updateDeliveryZone,
  uploadProductImage,
} from "./services/storeSettings";

const orderStatuses = [
  { value: "received", label: "Pedido recebido" },
  { value: "confirmed", label: "Confirmado" },
  { value: "preparing", label: "Em preparação" },
  { value: "shipped", label: "Saiu para entrega" },
  { value: "delivered", label: "Entregue" },
  { value: "completed", label: "Finalizado" },
  { value: "cancelled", label: "Cancelado" },
  { value: "expired", label: "Reserva expirada", system: true },
  { value: "payment_review", label: "Revisar pagamento", system: true },
];

const paymentStatuses = {
  simulated: { label: "Simulado", detail: "Pedido anterior, sem cobrança real" },
  pending: { label: "Pendente", detail: "Aguardando confirmação do PagBank" },
  approved: { label: "Aprovado", detail: "Pagamento confirmado pelo PagBank" },
  refused: { label: "Não aprovado", detail: "Pagamento recusado; a reserva continua até o prazo" },
  expired: { label: "Expirado", detail: "Prazo encerrado e estoque devolvido" },
  refunded: { label: "Reembolsado", detail: "Valor devolvido pelo PagBank" },
};

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
  const [passwordRecovery, setPasswordRecovery] = useState(
    new URLSearchParams(window.location.search).get("recuperar") === "1",
  );

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
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
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

  if (isSupabaseConfigured && session && passwordRecovery) {
    return (
      <AdminPasswordReset
        onComplete={() => {
          window.history.replaceState({}, "", "/admin");
          setPasswordRecovery(false);
        }}
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
      accessToken={session?.access_token}
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
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (recoveryMode) {
      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/admin?recuperar=1` },
      );
      if (recoveryError) {
        setError("Não foi possível enviar o link. Verifique o e-mail e tente novamente.");
      } else {
        setMessage("Enviamos um link para redefinir a senha. Confira também a caixa de spam.");
      }
      setLoading(false);
      return;
    }

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
          <h1 id="admin-login-title">{recoveryMode ? "Recuperar senha" : "Painel administrativo"}</h1>
          <p>{recoveryMode ? "Informe o e-mail administrador para receber o link de recuperação." : "Entre com o usuário administrador cadastrado no banco de dados."}</p>

          {error && <div className="auth-error" role="alert"><AlertCircle size={17} />{error}</div>}
          {message && <div className="auth-success" role="status"><Check size={17} />{message}</div>}

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
            {!recoveryMode && (
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
            )}
            <button className="primary-button auth-submit" type="submit" disabled={loading}>
              {loading
                ? <><RefreshCw className="spin" size={17} /> Aguarde...</>
                : recoveryMode ? "Enviar link de recuperação" : "Entrar no painel"}
            </button>
            <button
              className="text-button auth-recovery-toggle"
              type="button"
              onClick={() => {
                setRecoveryMode((current) => !current);
                setError("");
                setMessage("");
              }}
            >
              {recoveryMode ? "Voltar para o login" : "Esqueci minha senha"}
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

function AdminPasswordReset({ onComplete }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("As senhas informadas não são iguais.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError("Não foi possível atualizar a senha. Solicite um novo link.");
      return;
    }
    onComplete();
  };

  return (
    <div className="admin-auth-page">
      <header className="admin-auth-header">
        <a className="logo floral-logo" href="/">ROSINSKI <small>Floricultura</small></a>
      </header>
      <main className="admin-auth-main">
        <section className="admin-auth-card" aria-labelledby="password-reset-title">
          <div className="auth-icon"><LockKeyhole size={25} /></div>
          <span className="eyebrow">Acesso protegido</span>
          <h1 id="password-reset-title">Crie uma nova senha</h1>
          <p>Use pelo menos 8 caracteres e evite repetir senhas de outros serviços.</p>
          {error && <div className="auth-error" role="alert"><AlertCircle size={17} />{error}</div>}
          <form onSubmit={handleSubmit}>
            <label>Nova senha<span className="password-field"><input required minLength="8" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword((current) => !current)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
            <label>Confirmar senha<input required minLength="8" type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
            <button className="primary-button auth-submit" type="submit" disabled={loading}>{loading ? <><RefreshCw className="spin" size={17} /> Salvando...</> : "Salvar nova senha"}</button>
          </form>
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
  accessToken,
}) {
  const [view, setView] = useState("products");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [savingId, setSavingId] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(connected);
  const [ordersError, setOrdersError] = useState("");
  const [savingOrderId, setSavingOrderId] = useState(null);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [productEditor, setProductEditor] = useState(null);
  const [productSaving, setProductSaving] = useState(false);

  const totalStock = products.reduce((sum, product) => sum + product.stock, 0);
  const lowStock = products.filter(
    (product) => product.stock > 0 && product.stock <= 3,
  ).length;
  const outOfStock = products.filter((product) => product.stock === 0).length;
  const lowStockProducts = products.filter((product) => product.active && product.stock <= 3);
  const paidRevenue = orders
    .filter((order) => order.payment_status === "approved")
    .reduce((sum, order) => sum + order.total, 0);
  const pendingPayments = orders.filter((order) => order.payment_status === "pending").length;
  const expiredPayments = orders.filter((order) => order.payment_status === "expired").length;
  const reviewPayments = orders.filter((order) => order.status === "payment_review").length;

  const filteredOrders = useMemo(() => {
    const normalizedSearch = orderSearch.trim().toLowerCase();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return orders.filter((order) => {
      const searchable = `${order.order_number} ${order.customer_name} ${order.customer_email}`.toLowerCase();
      if (normalizedSearch && !searchable.includes(normalizedSearch)) return false;
      if (orderStatusFilter !== "all" && order.status !== orderStatusFilter) return false;
      if (paymentFilter !== "all" && order.payment_status !== paymentFilter) return false;

      const createdAt = new Date(order.created_at).getTime();
      if (dateFilter === "today" && createdAt < startOfToday) return false;
      if (dateFilter === "7days" && createdAt < now.getTime() - 7 * 86400000) return false;
      if (dateFilter === "30days" && createdAt < now.getTime() - 30 * 86400000) return false;
      return true;
    });
  }, [orders, orderSearch, orderStatusFilter, paymentFilter, dateFilter]);

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
      `Excluir “${product.name}”? Pedidos cancelados ou finalizados continuarão preservados no histórico. Essa ação não pode ser desfeita.`,
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
          error?.code === "PGRST202" || error?.message?.includes("delete_catalog_product")
            ? "Execute o arquivo supabase/v8-1-ajustes.sql antes de excluir produtos vinculados a pedidos."
            : error.message || "Não foi possível excluir o produto.",
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleRefundOrder = async (order) => {
    if (
      !window.confirm(
        `Reembolsar ${formatCurrency(order.total)} e cancelar ${order.order_number}? O valor será devolvido pelo PagBank e as unidades retornarão ao estoque.`,
      )
    ) {
      return;
    }

    setSavingOrderId(order.id);
    try {
      await refundPagBankPayment(order.order_number, accessToken);
      await Promise.all([refreshOrders(), reloadProducts()]);
      setStatus({
        type: "success",
        message: "Pagamento reembolsado, pedido cancelado e estoque restaurado.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Não foi possível reembolsar o pagamento.",
      });
    } finally {
      setSavingOrderId(null);
    }
  };

  const handleOrderStatus = async (order, nextStatus) => {
    if (order.status === nextStatus) return;
    if (
      nextStatus === "cancelled" &&
      order.payment_provider === "pagbank" &&
      order.payment_status === "approved"
    ) {
      await handleRefundOrder(order);
      return;
    }
    if (
      nextStatus === "cancelled" &&
      !window.confirm(
        "Cancelar este pedido? As unidades serão devolvidas ao estoque e o pedido não poderá ser reativado.",
      )
    ) {
      return;
    }
    if (
      nextStatus === "completed" &&
      !window.confirm(
        "Finalizar este pedido? Ele permanecerá no histórico e não poderá ser reaberto.",
      )
    ) {
      return;
    }

    setSavingOrderId(order.id);
    try {
      if (nextStatus === "cancelled" && order.payment_provider === "pagbank") {
        await cancelPagBankCheckout(order.order_number, accessToken);
        await Promise.all([refreshOrders(), reloadProducts()]);
        setStatus({ type: "success", message: "Checkout cancelado e estoque restaurado." });
        return;
      }

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
            : nextStatus === "completed"
              ? "Pedido finalizado com sucesso."
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
            <p>Controle produtos, pedidos, entregas e promoções em um único lugar.</p>
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
            ) : view === "orders" ? (
              <button
                className="text-button"
                type="button"
                onClick={refreshOrders}
                disabled={ordersLoading}
              >
                <RefreshCw className={ordersLoading ? "spin" : ""} size={14} />
                Atualizar pedidos
              </button>
            ) : null}
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
          <button
            type="button"
            className={view === "settings" ? "active" : ""}
            onClick={() => setView("settings")}
          >
            <Settings size={18} /> Entregas e cupons
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

            {lowStockProducts.length > 0 && (
              <div className="stock-alert" role="status">
                <AlertCircle size={20} />
                <div>
                  <strong>Atenção ao estoque</strong>
                  <span>{lowStockProducts.map((product) => `${product.name} (${product.stock})`).join(" · ")}</span>
                </div>
              </div>
            )}

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
        ) : view === "orders" ? (
          <>
            <div className="admin-metrics order-metrics">
              <div><span>Total de pedidos</span><strong>{orders.length}</strong></div>
              <div><span>Faturamento aprovado</span><strong className="metric-currency">{formatCurrency(paidRevenue)}</strong></div>
              <div><span>Pagamentos pendentes</span><strong>{pendingPayments}</strong></div>
              <div><span>Expirados</span><strong>{expiredPayments}</strong></div>
            </div>

            {reviewPayments > 0 && (
              <div className="payment-review-alert" role="alert">
                <AlertCircle size={20} />
                <div><strong>{reviewPayments} pagamento(s) precisam de revisão</strong><span>O pagamento chegou depois que a reserva de estoque foi liberada. Confira e faça o reembolso.</span></div>
              </div>
            )}

            <section className="orders-wrap" aria-labelledby="orders-title">
              <div className="inventory-heading">
                <div>
                  <h2 id="orders-title">Pedidos recentes</h2>
                  <p>Acompanhe clientes, itens, entrega e andamento.</p>
                </div>
                <span>{filteredOrders.length} de {orders.length}</span>
              </div>

              <div className="order-filters" aria-label="Filtros de pedidos">
                <label className="order-search"><Search size={17} /><input type="search" value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="Pedido, cliente ou e-mail" /></label>
                <label><span>Situação</span><select value={orderStatusFilter} onChange={(event) => setOrderStatusFilter(event.target.value)}><option value="all">Todas</option>{orderStatuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <label><span>Pagamento</span><select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}><option value="all">Todos</option>{Object.entries(paymentStatuses).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}</select></label>
                <label><span>Período</span><select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}><option value="all">Todo o período</option><option value="today">Hoje</option><option value="7days">Últimos 7 dias</option><option value="30days">Últimos 30 dias</option></select></label>
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
              ) : filteredOrders.length === 0 ? (
                <div className="orders-state">
                  <Search size={28} />
                  <h3>Nenhum pedido encontrado</h3>
                  <p>Altere os filtros para visualizar outros pedidos.</p>
                </div>
              ) : (
                <div className="orders-list">
                  {filteredOrders.map((order) => (
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
                              order.status === "cancelled" ||
                              order.status === "completed" ||
                              order.status === "expired" ||
                              order.status === "payment_review"
                            }
                            onChange={(event) =>
                              handleOrderStatus(order, event.target.value)
                            }
                          >
                            {orderStatuses.map((option) =>
                              option.system && option.value !== order.status ? null : (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ),
                            )}
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
                          <strong className={`payment-status-text payment-${order.payment_status}`}>
                            {paymentStatuses[order.payment_status]?.label ?? "Pendente"}
                          </strong>
                          <span>{paymentStatuses[order.payment_status]?.detail ?? "Aguardando atualização"}</span>
                          {order.payment_provider === "pagbank" &&
                            order.payment_status === "approved" &&
                            order.status !== "completed" &&
                            order.status !== "cancelled" && (
                              <button
                                className="refund-button"
                                type="button"
                                disabled={savingOrderId === order.id}
                                onClick={() => handleRefundOrder(order)}
                              >
                                <RotateCcw size={15} /> Reembolsar e cancelar
                              </button>
                            )}
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
                            <span className="order-item-description">
                              {item.quantity}× {item.product_name}
                              {(item.selected_size || item.selected_addons?.length > 0) && (
                                <small>{[item.selected_size, ...(item.selected_addons ?? []).map((addon) => addon.label)].filter(Boolean).join(" · ")}</small>
                              )}
                            </span>
                            <strong>{formatCurrency(item.line_total)}</strong>
                          </div>
                        ))}
                      </div>

                      <footer className="order-card-footer">
                        <div><span>Subtotal</span><strong>{formatCurrency(order.subtotal)}</strong></div>
                        {order.discount > 0 && <div><span>Desconto · {order.coupon_code}</span><strong>− {formatCurrency(order.discount)}</strong></div>}
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
        ) : (
          <CommerceSettings connected={connected} />
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

function CommerceSettings({ connected }) {
  const [zones, setZones] = useState(defaultDeliveryZones);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [zoneForm, setZoneForm] = useState({ neighborhood: "", fee: "", min_order: 0, active: true });
  const [couponForm, setCouponForm] = useState({
    code: "",
    discount_type: "percentage",
    discount_value: 10,
    min_order: 0,
    max_discount: "",
    starts_at: "",
    ends_at: "",
    usage_limit: "",
    active: true,
  });

  const refresh = async () => {
    setLoading(true);
    setMessage({ type: "", text: "" });
    try {
      const [nextZones, nextCoupons] = await Promise.all([
        loadDeliveryZones(),
        loadCoupons(),
      ]);
      setZones(nextZones);
      setCoupons(nextCoupons);
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.code === "42P01" || error?.code === "PGRST205"
          ? "Execute o arquivo supabase/v8-loja.sql para liberar estas configurações."
          : error.message || "Não foi possível carregar as configurações.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  const changeZone = (id, field, value) =>
    setZones((current) => current.map((zone) => zone.id === id ? { ...zone, [field]: value } : zone));

  const saveZone = async (zone) => {
    try {
      const saved = await updateDeliveryZone(zone.id, {
        neighborhood: zone.neighborhood.trim(),
        fee: Math.max(0, Number(zone.fee)),
        min_order: Math.max(0, Number(zone.min_order)),
        active: Boolean(zone.active),
      });
      setZones((current) => current.map((item) => item.id === saved.id ? saved : item));
      setMessage({ type: "success", text: "Taxa de entrega atualizada." });
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Não foi possível salvar a taxa." });
    }
  };

  const addZone = async (event) => {
    event.preventDefault();
    try {
      const created = await createDeliveryZone(zoneForm);
      setZones((current) => [...current, created].sort((a, b) => a.neighborhood.localeCompare(b.neighborhood)));
      setZoneForm({ neighborhood: "", fee: "", min_order: 0, active: true });
      setMessage({ type: "success", text: "Bairro adicionado às entregas." });
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Não foi possível adicionar o bairro." });
    }
  };

  const removeZone = async (zone) => {
    if (!window.confirm(`Excluir a taxa de entrega para “${zone.neighborhood === "*" ? "Outros bairros" : zone.neighborhood}”?`)) return;
    try {
      await deleteDeliveryZone(zone.id);
      setZones((current) => current.filter((item) => item.id !== zone.id));
      setMessage({ type: "success", text: "Taxa removida." });
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Não foi possível remover a taxa." });
    }
  };

  const changeCoupon = (id, field, value) =>
    setCoupons((current) => current.map((coupon) => coupon.id === id ? { ...coupon, [field]: value } : coupon));

  const saveCoupon = async (coupon) => {
    try {
      const saved = await updateCoupon(coupon.id, {
        code: coupon.code.trim().toUpperCase(),
        discount_type: coupon.discount_type,
        discount_value: Math.max(0.01, Number(coupon.discount_value)),
        min_order: Math.max(0, Number(coupon.min_order)),
        max_discount: coupon.max_discount === "" ? null : Math.max(0.01, Number(coupon.max_discount)),
        ends_at: coupon.ends_at || null,
        usage_limit: coupon.usage_limit === "" ? null : Math.max(1, Number(coupon.usage_limit)),
        active: Boolean(coupon.active),
      });
      setCoupons((current) => current.map((item) => item.id === saved.id ? saved : item));
      setMessage({ type: "success", text: "Cupom atualizado." });
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Não foi possível salvar o cupom." });
    }
  };

  const addCoupon = async (event) => {
    event.preventDefault();
    try {
      const created = await createCoupon(couponForm);
      setCoupons((current) => [created, ...current]);
      setCouponForm({ code: "", discount_type: "percentage", discount_value: 10, min_order: 0, max_discount: "", starts_at: "", ends_at: "", usage_limit: "", active: true });
      setMessage({ type: "success", text: "Cupom criado com sucesso." });
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Não foi possível criar o cupom." });
    }
  };

  const removeCoupon = async (coupon) => {
    if (!window.confirm(`Excluir o cupom “${coupon.code}”?`)) return;
    try {
      await deleteCoupon(coupon.id);
      setCoupons((current) => current.filter((item) => item.id !== coupon.id));
      setMessage({ type: "success", text: "Cupom excluído." });
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Não foi possível excluir o cupom." });
    }
  };

  if (loading) {
    return <div className="settings-state"><RefreshCw className="spin" size={24} /><p>Carregando configurações...</p></div>;
  }

  return (
    <div className="commerce-settings">
      {message.text && <div className={`admin-feedback ${message.type}`} role="status">{message.type === "success" ? <Check size={17} /> : <AlertCircle size={17} />}{message.text}</div>}

      <section className="settings-card" aria-labelledby="delivery-settings-title">
        <header><div><span className="settings-icon"><MapPin size={19} /></span><div><h2 id="delivery-settings-title">Taxas de entrega</h2><p>Defina o valor por bairro. “Outros bairros” funciona como taxa padrão.</p></div></div><span>{zones.filter((zone) => zone.active).length} ativas</span></header>
        <div className="settings-list delivery-zone-list">
          {zones.map((zone) => (
            <div className="settings-row zone-row" key={zone.id}>
              <label>Bairro<input value={zone.neighborhood === "*" ? "Outros bairros" : zone.neighborhood} disabled={zone.neighborhood === "*"} onChange={(event) => changeZone(zone.id, "neighborhood", event.target.value)} /></label>
              <label>Taxa<input type="number" min="0" step="0.01" value={zone.fee} onChange={(event) => changeZone(zone.id, "fee", event.target.value)} /></label>
              <label>Pedido mínimo<input type="number" min="0" step="0.01" value={zone.min_order} onChange={(event) => changeZone(zone.id, "min_order", event.target.value)} /></label>
              <label className="settings-check"><input type="checkbox" checked={zone.active} onChange={(event) => changeZone(zone.id, "active", event.target.checked)} />Ativa</label>
              <div className="settings-actions"><button type="button" onClick={() => saveZone(zone)}>Salvar</button><button className="delete" type="button" onClick={() => removeZone(zone)} aria-label="Excluir taxa"><Trash2 size={15} /></button></div>
            </div>
          ))}
        </div>
        <form className="settings-create-form zone-create-form" onSubmit={addZone}>
          <strong>Novo bairro</strong>
          <label>Nome<input required value={zoneForm.neighborhood} onChange={(event) => setZoneForm((current) => ({ ...current, neighborhood: event.target.value }))} placeholder="Ex.: Coroados" /></label>
          <label>Taxa<input required type="number" min="0" step="0.01" value={zoneForm.fee} onChange={(event) => setZoneForm((current) => ({ ...current, fee: event.target.value }))} placeholder="0,00" /></label>
          <label>Pedido mínimo<input type="number" min="0" step="0.01" value={zoneForm.min_order} onChange={(event) => setZoneForm((current) => ({ ...current, min_order: event.target.value }))} /></label>
          <button className="primary-button" type="submit"><Plus size={16} /> Adicionar</button>
        </form>
      </section>

      <section className="settings-card" aria-labelledby="coupon-settings-title">
        <header><div><span className="settings-icon"><Tag size={19} /></span><div><h2 id="coupon-settings-title">Cupons</h2><p>Crie descontos percentuais ou de valor fixo, com limites e validade.</p></div></div><span>{coupons.filter((coupon) => coupon.active).length} ativos</span></header>
        <div className="settings-list coupon-list">
          {coupons.length === 0 ? <p className="settings-empty">Nenhum cupom cadastrado.</p> : coupons.map((coupon) => (
            <div className="coupon-admin-card" key={coupon.id}>
              <div className="coupon-admin-heading"><strong>{coupon.code}</strong><span>{coupon.times_used} utilizações</span></div>
              <div className="coupon-admin-grid">
                <label>Código<input value={coupon.code} onChange={(event) => changeCoupon(coupon.id, "code", event.target.value.toUpperCase())} /></label>
                <label>Tipo<select value={coupon.discount_type} onChange={(event) => changeCoupon(coupon.id, "discount_type", event.target.value)}><option value="percentage">Porcentagem</option><option value="fixed">Valor fixo</option></select></label>
                <label>Desconto<input type="number" min="0.01" step="0.01" value={coupon.discount_value} onChange={(event) => changeCoupon(coupon.id, "discount_value", event.target.value)} /></label>
                <label>Pedido mínimo<input type="number" min="0" step="0.01" value={coupon.min_order} onChange={(event) => changeCoupon(coupon.id, "min_order", event.target.value)} /></label>
                <label>Desconto máximo<input type="number" min="0" step="0.01" value={coupon.max_discount ?? ""} onChange={(event) => changeCoupon(coupon.id, "max_discount", event.target.value)} placeholder="Sem limite" /></label>
                <label>Validade<input type="date" value={coupon.ends_at ?? ""} onChange={(event) => changeCoupon(coupon.id, "ends_at", event.target.value)} /></label>
                <label>Limite de usos<input type="number" min="1" value={coupon.usage_limit ?? ""} onChange={(event) => changeCoupon(coupon.id, "usage_limit", event.target.value)} placeholder="Sem limite" /></label>
                <label className="settings-check"><input type="checkbox" checked={coupon.active} onChange={(event) => changeCoupon(coupon.id, "active", event.target.checked)} />Ativo</label>
              </div>
              <div className="coupon-admin-actions"><button type="button" onClick={() => saveCoupon(coupon)}>Salvar alterações</button><button className="delete" type="button" onClick={() => removeCoupon(coupon)}><Trash2 size={15} /> Excluir</button></div>
            </div>
          ))}
        </div>

        <form className="settings-create-form coupon-create-form" onSubmit={addCoupon}>
          <strong>Novo cupom</strong>
          <label>Código<input required value={couponForm.code} onChange={(event) => setCouponForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="EX.: FLORES10" /></label>
          <label>Tipo<select value={couponForm.discount_type} onChange={(event) => setCouponForm((current) => ({ ...current, discount_type: event.target.value }))}><option value="percentage">Porcentagem</option><option value="fixed">Valor fixo</option></select></label>
          <label>Desconto<input required type="number" min="0.01" step="0.01" value={couponForm.discount_value} onChange={(event) => setCouponForm((current) => ({ ...current, discount_value: event.target.value }))} /></label>
          <label>Pedido mínimo<input type="number" min="0" step="0.01" value={couponForm.min_order} onChange={(event) => setCouponForm((current) => ({ ...current, min_order: event.target.value }))} /></label>
          <label>Validade<input type="date" value={couponForm.ends_at} onChange={(event) => setCouponForm((current) => ({ ...current, ends_at: event.target.value }))} /></label>
          <label>Limite de usos<input type="number" min="1" value={couponForm.usage_limit} onChange={(event) => setCouponForm((current) => ({ ...current, usage_limit: event.target.value }))} placeholder="Sem limite" /></label>
          <button className="primary-button" type="submit"><Plus size={16} /> Criar cupom</button>
        </form>
      </section>
    </div>
  );
}

function ProductEditor({ mode, product, saving, onClose, onSave }) {
  const findSize = (id) => product?.size_options?.find((option) => option.id === id);
  const findAddon = (id) => product?.addons?.find((addon) => addon.id === id);
  const [form, setForm] = useState({
    name: product?.name ?? "",
    category: product?.category ?? "Buquês",
    price: product?.price ?? "",
    stock: product?.stock ?? 0,
    tag: product?.tag ?? "",
    image: product?.image ?? "",
    description: product?.description ?? "",
    care_instructions: product?.care_instructions ?? "",
    medium_delta: findSize("medium")?.price_delta ?? (mode === "create" ? 35 : ""),
    large_delta: findSize("large")?.price_delta ?? (mode === "create" ? 70 : ""),
    card_price: findAddon("card")?.price ?? (mode === "create" ? 9.9 : ""),
    chocolate_price: findAddon("chocolate")?.price ?? (mode === "create" ? 24.9 : ""),
    vase_price: findAddon("vase")?.price ?? (mode === "create" ? 39.9 : ""),
    featured: product?.featured ?? false,
    active: product?.active ?? true,
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  useEffect(() => {
    document.body.classList.add("no-scroll");
    return () => document.body.classList.remove("no-scroll");
  }, []);

  const updateField = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setUploadMessage("Enviando imagem...");
    try {
      const publicUrl = await uploadProductImage(file);
      updateField("image", publicUrl);
      setUploadMessage("Imagem enviada. Salve o produto para concluir.");
    } catch (error) {
      setUploadMessage(error.message || "Não foi possível enviar a imagem.");
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const sizeOptions = [{ id: "standard", label: form.category === "Plantas" ? "Tamanho único" : "Padrão", price_delta: 0 }];
    if (form.medium_delta !== "") sizeOptions.push({ id: "medium", label: "Médio", price_delta: Math.max(0, Number(form.medium_delta)) });
    if (form.large_delta !== "") sizeOptions.push({ id: "large", label: "Grande", price_delta: Math.max(0, Number(form.large_delta)) });
    const addons = [
      ["card", "Cartão especial", form.card_price],
      ["chocolate", "Chocolate", form.chocolate_price],
      ["vase", "Vaso de vidro", form.vase_price],
    ]
      .filter(([, , price]) => price !== "")
      .map(([id, label, price]) => ({ id, label, price: Math.max(0, Number(price)) }));

    onSave({
      name: form.name.trim(),
      category: form.category,
      price: Math.max(0, Number(form.price)),
      stock: Math.max(0, Number(form.stock)),
      tag: form.tag.trim(),
      image: form.image.trim(),
      description: form.description.trim(),
      care_instructions: form.care_instructions.trim(),
      size_options: sizeOptions,
      addons,
      featured: Boolean(form.featured),
      active: Boolean(form.active),
    });
  };

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="product-editor-title">
      <div className="panel-backdrop" aria-hidden="true" />
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
          <div className="product-media-editor">
            <div className="product-image-preview">
              {form.image ? (
                <img src={form.image} alt="Prévia do produto" />
              ) : (
                <div><ImageIcon size={28} /><span>Prévia da imagem</span></div>
              )}
            </div>
            <label className={`image-upload-field ${uploadingImage ? "uploading" : ""}`}>
              <Upload size={17} />
              <span>{uploadingImage ? "Enviando..." : "Enviar imagem do computador"}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploadingImage} onChange={handleImageUpload} />
            </label>
            {uploadMessage && <small className="image-upload-message">{uploadMessage}</small>}
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
            <label className="full">
              Descrição do produto
              <textarea required rows="3" value={form.description} onChange={(event) => updateField("description", event.target.value)} placeholder="Conte o que torna este produto especial." />
            </label>
            <label className="full">
              Instruções de cuidado
              <textarea rows="2" value={form.care_instructions} onChange={(event) => updateField("care_instructions", event.target.value)} placeholder="Ex.: trocar a água diariamente e evitar sol direto." />
            </label>
            <div className="full product-option-editor">
              <div><strong>Tamanhos opcionais</strong><small>Deixe o valor vazio para não oferecer o tamanho.</small></div>
              <label>Médio · acréscimo<input type="number" min="0" step="0.01" value={form.medium_delta} onChange={(event) => updateField("medium_delta", event.target.value)} placeholder="Não oferecer" /></label>
              <label>Grande · acréscimo<input type="number" min="0" step="0.01" value={form.large_delta} onChange={(event) => updateField("large_delta", event.target.value)} placeholder="Não oferecer" /></label>
            </div>
            <div className="full product-option-editor product-addon-editor">
              <div><strong>Complementos</strong><small>Deixe o valor vazio para ocultar o complemento.</small></div>
              <label>Cartão especial<input type="number" min="0" step="0.01" value={form.card_price} onChange={(event) => updateField("card_price", event.target.value)} placeholder="Não oferecer" /></label>
              <label>Chocolate<input type="number" min="0" step="0.01" value={form.chocolate_price} onChange={(event) => updateField("chocolate_price", event.target.value)} placeholder="Não oferecer" /></label>
              <label>Vaso de vidro<input type="number" min="0" step="0.01" value={form.vase_price} onChange={(event) => updateField("vase_price", event.target.value)} placeholder="Não oferecer" /></label>
            </div>
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
          <button className="primary-button" type="submit" disabled={saving || uploadingImage}>
            {saving ? <><RefreshCw className="spin" size={16} /> Salvando...</> : mode === "create" ? "Cadastrar produto" : "Salvar alterações"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default AdminPage;
