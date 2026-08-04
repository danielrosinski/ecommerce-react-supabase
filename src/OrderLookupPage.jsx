import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  CreditCard,
  ExternalLink,
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
import { createPagBankCheckout } from "./services/payments";

const statusSteps = [
  { value: "received", label: "Pedido recebido" },
  { value: "confirmed", label: "Confirmado" },
  { value: "preparing", label: "Em preparação" },
  { value: "shipped", label: "Saiu para entrega" },
  { value: "delivered", label: "Entregue" },
  { value: "completed", label: "Finalizado" },
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
  const query = new URLSearchParams(window.location.search);
  const returnedFromPayment = query.get("pagamento") === "retorno";
  const [orderNumber, setOrderNumber] = useState(query.get("pedido") ?? "");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setOrder(null);
    setPaymentError("");

    try {
      const result = await lookupOrder(orderNumber, email);
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

  const continuePayment = async () => {
    if (!order || !email) return;
    setPaymentLoading(true);
    setPaymentError("");
    try {
      if (order.payment_checkout_url) {
        window.location.assign(order.payment_checkout_url);
        return;
      }
      const payment = await createPagBankCheckout(order.order_number, email);
      if (payment.checkoutUrl) window.location.assign(payment.checkoutUrl);
      else if (payment.approved) setOrder((current) => ({ ...current, payment_status: "approved" }));
      else throw new Error("O link de pagamento ainda não está disponível.");
    } catch (paymentStartError) {
      setPaymentError(paymentStartError.message || "Não foi possível abrir o pagamento.");
    } finally {
      setPaymentLoading(false);
    }
  };

  const currentIndex = order
    ? statusSteps.findIndex((step) => step.value === order.status)
    : -1;

  useEffect(() => {
    if (order?.payment_provider !== "pagbank" || order.payment_status !== "pending" || !email) {
      return undefined;
    }

    let active = true;
    const timer = window.setInterval(async () => {
      try {
        const updated = await lookupOrder(order.order_number, email);
        if (active) setOrder(updated);
      } catch {
        // A consulta manual continua disponível se uma atualização falhar.
      }
    }, 10000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [email, order?.order_number, order?.payment_provider, order?.payment_status]);

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

          {returnedFromPayment && (
            <div className="payment-return-note">
              <CreditCard size={18} /> O PagBank processará o pagamento. Consulte abaixo para acompanhar a confirmação.
            </div>
          )}

          <form className="tracking-form" onSubmit={handleSubmit}>
            <label>
              Número do pedido
              <span><PackageCheck size={18} /><input required name="order_number" placeholder="ROSINSKI-20260803-ABC123" value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} /></span>
            </label>
            <label>
              E-mail da compra
              <span><Mail size={18} /><input required name="email" type="email" placeholder="voce@email.com" value={email} onChange={(event) => setEmail(event.target.value)} /></span>
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

            <div className={`tracking-payment payment-${order.payment_status}`}>
              <CreditCard size={20} />
              <div>
                <strong>
                  {order.payment_status === "approved" && "Pagamento aprovado"}
                  {order.payment_status === "pending" && "Pagamento pendente"}
                  {order.payment_status === "refused" && "Pagamento não aprovado"}
                  {order.payment_status === "refunded" && "Pagamento reembolsado"}
                  {order.payment_status === "simulated" && "Pagamento simulado"}
                </strong>
                <span>
                  {order.payment_status === "approved"
                    ? "O PagBank confirmou o recebimento."
                    : order.payment_provider === "pagbank"
                      ? "A confirmação pode levar alguns instantes após o pagamento."
                      : "Este pedido foi registrado antes da integração com o PagBank."}
                </span>
              </div>
              {order.payment_provider === "pagbank" &&
                !["approved", "refunded"].includes(order.payment_status) &&
                !["cancelled", "completed"].includes(order.status) && (
                  <button type="button" onClick={continuePayment} disabled={paymentLoading}>
                    {paymentLoading ? <Loader2 className="spin" size={16} /> : <ExternalLink size={16} />}
                    Continuar pagamento
                  </button>
                )}
            </div>
            {paymentError && <div className="tracking-error" role="alert"><AlertCircle size={18} />{paymentError}</div>}

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
                  <span className="tracking-item-description">
                    {item.quantity}× {item.product_name}
                    {(item.selected_size || item.selected_addons?.length > 0) && (
                      <small>{[item.selected_size, ...(item.selected_addons ?? []).map((addon) => addon.label)].filter(Boolean).join(" · ")}</small>
                    )}
                  </span>
                  <strong>{formatCurrency(Number(item.line_total))}</strong>
                </div>
              ))}
              <footer>
                <span>{order.discount > 0 ? `Cupom ${order.coupon_code}: − ${formatCurrency(order.discount)}` : `Entrega ${order.shipping === 0 ? "grátis" : formatCurrency(order.shipping)}`}</span>
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
