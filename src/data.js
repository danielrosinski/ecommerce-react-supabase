export const defaultProducts = [
  {
    id: 1,
    name: "Vaso Cerâmica Areia",
    category: "Casa",
    price: 189.9,
    stock: 12,
    featured: true,
    active: true,
    tag: "Feito à mão",
    image:
      "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 2,
    name: "Bolsa Linho Natural",
    category: "Moda",
    price: 219.9,
    stock: 8,
    featured: true,
    active: true,
    tag: "Nova coleção",
    image:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 3,
    name: "Perfume Âmbar 50 ml",
    category: "Beleza",
    price: 259.9,
    stock: 3,
    featured: true,
    active: true,
    tag: "Mais desejado",
    image:
      "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 4,
    name: "Manta Trama Natural",
    category: "Casa",
    price: 149.9,
    stock: 0,
    featured: false,
    active: true,
    tag: "Conforto",
    image:
      "https://images.unsplash.com/photo-1583845112203-29329902332e?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 5,
    name: "Luminária de Mesa Aura",
    category: "Casa",
    price: 329.9,
    stock: 6,
    featured: false,
    active: true,
    tag: "Design autoral",
    image:
      "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 6,
    name: "Carteira Couro Siena",
    category: "Acessórios",
    price: 179.9,
    stock: 9,
    featured: false,
    active: true,
    tag: "Essencial",
    image:
      "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 7,
    name: "Difusor Cedro & Figo",
    category: "Beleza",
    price: 119.9,
    stock: 15,
    featured: false,
    active: true,
    tag: "Aroma da casa",
    image:
      "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 8,
    name: "Relógio Minimal Couro",
    category: "Acessórios",
    price: 389.9,
    stock: 2,
    featured: false,
    active: true,
    tag: "Últimas unidades",
    image:
      "https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=900&q=85",
  },
];

export const formatCurrency = (value) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
