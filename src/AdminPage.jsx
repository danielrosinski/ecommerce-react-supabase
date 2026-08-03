import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Database,
  Eye,
  EyeOff,
  LockKeyhole,
  LogOut,
  Minus,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import {
  restoreExampleProducts,
  saveProductChange,
} from "./services/products";

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
        <a className="logo" href="/">NOVA</a>
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
  const [status, setStatus] = useState({ type: "", message: "" });
  const [savingId, setSavingId] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const totalStock = products.reduce((sum, product) => sum + product.stock, 0);
  const lowStock = products.filter((product) => product.stock > 0 && product.stock <= 3).length;
  const outOfStock = products.filter((product) => product.stock === 0).length;

  useEffect(() => {
    if (!status.message) return undefined;
    const timer = window.setTimeout(() => setStatus({ type: "", message: "" }), 2800);
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
      setStatus({ type: "success", message: connected ? "Alteração salva no banco de dados." : "Alteração salva neste navegador." });
    } catch (error) {
      setProducts((current) =>
        current.map((product) => product.id === id ? previous : product),
      );
      setStatus({ type: "error", message: error.message || "Não foi possível salvar a alteração." });
    } finally {
      setSavingId(null);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const restored = await restoreExampleProducts();
      setProducts(restored);
      setStatus({ type: "success", message: "Produtos de exemplo restaurados." });
    } catch (error) {
      setStatus({ type: "error", message: error.message || "Não foi possível restaurar os produtos." });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <a className="logo" href="/">NOVA</a>
        <div>
          <span className={`database-status ${connected ? "connected" : "demo"}`}>
            <Database size={15} /> {connected ? "Banco conectado" : "Modo demonstração"}
          </span>
          {connected && email && <span className="admin-email">{email}</span>}
          {connected && (
            <button className="icon-button" type="button" aria-label="Sair do painel" onClick={() => supabase.auth.signOut()}>
              <LogOut size={19} />
            </button>
          )}
          <a className="outline-button" href="/"><ArrowLeft size={17} /> Voltar à loja</a>
        </div>
      </header>

      <main className="admin-main">
        <div className="admin-title">
          <div><span className="eyebrow">Área administrativa</span><h1>Gestão de estoque</h1><p>Atualize disponibilidade, preços e destaque dos produtos.</p></div>
          <div className="admin-title-actions">
            <button className="text-button" type="button" onClick={reloadProducts}><RefreshCw size={14} /> Atualizar lista</button>
            <button className="text-button" type="button" onClick={handleRestore} disabled={restoring}>{restoring ? "Restaurando..." : "Restaurar dados de exemplo"}</button>
          </div>
        </div>

        {status.message && (
          <div className={`admin-feedback ${status.type}`} role="status">
            {status.type === "success" ? <Check size={17} /> : <AlertCircle size={17} />}
            {status.message}
          </div>
        )}

        <div className="admin-metrics">
          <div><span>Produtos cadastrados</span><strong>{products.length}</strong></div>
          <div><span>Unidades em estoque</span><strong>{totalStock}</strong></div>
          <div><span>Estoque baixo</span><strong>{lowStock}</strong></div>
          <div><span>Sem estoque</span><strong>{outOfStock}</strong></div>
        </div>

        <section className="inventory-table-wrap" aria-labelledby="inventory-title">
          <div className="inventory-heading"><div><h2 id="inventory-title">Produtos</h2><p>As alterações aparecem na loja assim que são salvas.</p></div><span>{products.filter((product) => product.active).length} ativos</span></div>
          <div className="inventory-table">
            <div className="inventory-row inventory-labels"><span>Produto</span><span>Preço</span><span>Estoque</span><span>Destaque</span><span>Status</span></div>
            {products.map((product) => (
              <div className={`inventory-row ${savingId === product.id ? "saving" : ""}`} key={product.id}>
                <div className="inventory-product"><img src={product.image} alt="" /><div><strong>{product.name}</strong><span>{product.category}</span></div></div>
                <label><span className="mobile-label">Preço</span><div className="price-input"><span>R$</span><input key={`${product.id}-price-${product.price}`} type="number" min="0" step="0.01" defaultValue={product.price} onBlur={(event) => updateProduct(product.id, "price", Math.max(0, Number(event.target.value)))} /></div></label>
                <label><span className="mobile-label">Estoque</span><div className="stock-stepper"><button type="button" aria-label="Diminuir estoque" disabled={savingId === product.id} onClick={() => updateProduct(product.id, "stock", Math.max(0, product.stock - 1))}><Minus size={14} /></button><input key={`${product.id}-stock-${product.stock}`} aria-label={`Estoque de ${product.name}`} type="number" min="0" defaultValue={product.stock} onBlur={(event) => updateProduct(product.id, "stock", Math.max(0, Number(event.target.value)))} /><button type="button" aria-label="Aumentar estoque" disabled={savingId === product.id} onClick={() => updateProduct(product.id, "stock", product.stock + 1)}><Plus size={14} /></button></div></label>
                <label className="switch-label"><span className="mobile-label">Destaque</span><input type="checkbox" checked={product.featured} disabled={savingId === product.id} onChange={(event) => updateProduct(product.id, "featured", event.target.checked)} /><span className="switch" /></label>
                <label className="status-toggle"><span className="mobile-label">Status</span><button className={product.active ? "active" : "inactive"} type="button" disabled={savingId === product.id} onClick={() => updateProduct(product.id, "active", !product.active)}>{product.active ? "Ativo" : "Oculto"}</button></label>
              </div>
            ))}
          </div>
        </section>

        <div className="admin-note">
          <ShieldCheck size={20} />
          <p>
            {connected
              ? <><strong>Dados protegidos.</strong> Somente usuários cadastrados como administradores podem alterar os produtos.</>
              : <><strong>Modo demonstração.</strong> Copie o arquivo <code>.env.example</code> para <code>.env.local</code> e siga o README para conectar o banco gratuito.</>}
          </p>
        </div>
      </main>
    </div>
  );
}

export default AdminPage;
