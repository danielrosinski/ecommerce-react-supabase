import { useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  Gift,
  Loader2,
  Mail,
  MapPin,
  PackageCheck,
  Search,
  Truck,
} from "lucide-react";
import { formatCurrency } from "./data";
import { lookupOrder } from "./services/orders";

const statusSteps = [
  { value: "received", label: "Pedido recebido" },
  { value: "confirmed", label: "Confirmado" },
  { value: "preparing", label: "Em preparação" },
  { value: "shipped", label: "Saiu para entrega" },
  { value: "delivered", label: "Entregue" },
];

const periodLabels = {
  morning: "Manhã · 8h às 12h",
  afternoon: "Tarde · 12h às 18h",
  evening: "Noite · 18h às 21h",
  flexible: "Horário flexível",
};

function formatDate(value) {
  if (!value) return "A combinar";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(
    new Date(`${value}T12:00:00`),
  );
}

export default function OrderLookupPage() {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setLoading(true);
    setError("");
    setOrder(null);

    try {
      const result = await lookupOrder(
        formData.get("order_number")?.toString() ?? "",
        formData.get("email")?.toString() ?? "",
      );
      setOrder(result);
    } catch (lookupError) {
      const missingFunction =
        lookupError?.code === "PGRST202" ||
        lookupError?.message?.includes("lookup_order");
      setError(
        missingFunction
          ? "A atualização V5 ainda não foi executada no Supabase."
          : lookupError?.message || "Não foi possível consultar o pedido.",
      );
    } finally {
      setLoading(false);
    }
  };

  const currentIndex = order
    ? statusSteps.findIndex((step) => step.value === order.status)
    : -1;

  return (
    <div className="tracking-page">
      <header className="tracking-header shell">
        <a className="logo floral-logo" href="/" aria-label="Rosinski Floricultura - início">
          ROSINSKI <small>Floricultura</small>
        </a>
        <a className="tracking-back" href="/">
          <ArrowLeft size={17} /> Voltar à loja
        </a>
      </header>

      <main className="tracking-main shell">
        <section className="tracking-intro">
          <span className="eyebrow">Acompanhe sua entrega</span>
          <h1>Onde estão suas flores?</h1>
          <p>
            Digite o número do pedido e o mesmo e-mail utilizado na compra.
            Seus dados permanecem protegidos.
          </p>

          <form className="tracking-form" onSubmit={handleSubmit}>
            <label>
              Número do pedido
              <span><PackageCheck size={18} /><input required name="order_number" placeholder="ROSINSKI-20260803-ABC123" /></span>
            </label>
            <label>
              E-mail da compra
              <span><Mail size={18} /><input required name="email" type="email" placeholder="voce@email.com" /></span>
            </label>
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? <><Loader2 className="spin" size={18} /> Consultando...</> : <><Search size={18} /> Consultar pedido</>}
            </button>
          </form>

          {error && <div className="tracking-error" role="alert"><AlertCircle size={18} />{error}</div>}
        </section>

        {order ? (
          <section className="tracking-result" aria-live="polite">
            <header>
              <div><span>Pedido</span><strong>{order.order_number}</strong></div>
              <span className={`tracking-status status-${order.status}`}>
                {order.status === "cancelled"
                  ? "Cancelado"
                  : statusSteps.find((step) => step.value === order.status)?.label}
              </span>
            </header>

            {order.status === "cancelled" ? (
              <div className="cancelled-note"><AlertCircle size={20} />Este pedido foi cancelado. Em caso de dúvida, fale conosco.</div>
            ) : (
              <ol className="order-timeline">
                {statusSteps.map((step, index) => (
                  <li className={index <= currentIndex ? "done" : ""} key={step.value}>
                    <span>{index <= currentIndex ? <Check size={14} /> : index + 1}</span>
                    <strong>{step.label}</strong>
                  </li>
                ))}
              </ol>
            )}

            <div className="tracking-details">
              <div><CalendarDays size={19} /><span>Data prevista<strong>{formatDate(order.delivery_date)}</strong></span></div>
              <div><Clock3 size={19} /><span>Período<strong>{periodLabels[order.delivery_period] ?? "A combinar"}</strong></span></div>
              <div><MapPin size={19} /><span>Recebimento<strong>{order.delivery_method === "pickup" ? "Retirada em Guaratuba" : `Entrega em ${order.city}`}</strong></span></div>
              <div><Gift size={19} /><span>Destinatário<strong>{order.recipient_name || order.customer_name}</strong></span></div>
            </div>

            <div className="tracking-items">
              <h2>Itens do pedido</h2>
              {order.items.map((item, index) => (
                <div key={`${item.product_name}-${index}`}>
                  <span>{item.quantity}× {item.product_name}</span>
                  <strong>{formatCurrency(Number(item.line_total))}</strong>
                </div>
              ))}
              <footer>
                <span>Entrega {order.shipping === 0 ? "grátis" : formatCurrency(order.shipping)}</span>
                <strong>Total {formatCurrency(order.total)}</strong>
              </footer>
            </div>

            <p className="tracking-help"><Truck size={17} /> Precisa de ajuda? WhatsApp (42) 00000-0000.</p>
          </section>
        ) : (
          <aside className="tracking-art" aria-hidden="true">
            <span>Flores escolhidas com cuidado, preparadas com afeto e entregues em Guaratuba.</span>
          </aside>
        )}
      </main>
    </div>
  );
}
