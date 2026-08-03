export function formatPostalCode(value) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 8);
  return digits.length > 5
    ? `${digits.slice(0, 5)}-${digits.slice(5)}`
    : digits;
}

export async function lookupPostalCode(value, signal) {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (digits.length !== 8) {
    throw new Error("Digite um CEP com 8 números.");
  }

  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
    signal,
  });

  if (!response.ok) {
    throw new Error("Não foi possível consultar o CEP agora.");
  }

  const data = await response.json();

  if (data.erro) {
    throw new Error("CEP não encontrado. Confira os números digitados.");
  }

  return {
    postal_code: formatPostalCode(data.cep),
    address_line: data.logradouro ?? "",
    neighborhood: data.bairro ?? "",
    city: data.localidade ?? "",
    state: data.uf ?? "",
    suggested_complement: data.complemento ?? "",
  };
}
