async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Não foi possível concluir a operação de pagamento.");
  }
  return data;
}

export async function createPagBankCheckout(orderNumber, email) {
  const response = await fetch("/api/pagbank/create-checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orderNumber, email }),
  });
  return parseResponse(response);
}

export async function cancelPagBankCheckout(orderNumber, accessToken) {
  const response = await fetch("/api/pagbank/cancel-checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ orderNumber }),
  });
  return parseResponse(response);
}

export async function refundPagBankPayment(orderNumber, accessToken) {
  const response = await fetch("/api/pagbank/refund-payment", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ orderNumber }),
  });
  return parseResponse(response);
}
