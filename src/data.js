export const defaultProducts = [
  {
    id: 1,
    name: "Buquê Aurora",
    category: "Buquês",
    price: 149.9,
    stock: 12,
    featured: true,
    active: true,
    tag: "Mais pedido",
    image:
      "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 2,
    name: "Buquê Jardim Rosé",
    category: "Buquês",
    price: 189.9,
    stock: 8,
    featured: true,
    active: true,
    tag: "Delicado",
    image:
      "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 3,
    name: "Buquê Campo Natural",
    category: "Buquês",
    price: 129.9,
    stock: 6,
    featured: true,
    active: true,
    tag: "Flores da estação",
    image:
      "https://images.unsplash.com/photo-1487412912498-0447578fcca8?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 4,
    name: "Orquídea Branca",
    category: "Plantas",
    price: 119.9,
    stock: 5,
    featured: false,
    active: true,
    tag: "Elegância natural",
    image:
      "https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 5,
    name: "Jiboia em Vaso Palha",
    category: "Plantas",
    price: 89.9,
    stock: 9,
    featured: false,
    active: true,
    tag: "Fácil de cuidar",
    image:
      "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 6,
    name: "Suculenta Afeto",
    category: "Plantas",
    price: 49.9,
    stock: 14,
    featured: false,
    active: true,
    tag: "Pequeno presente",
    image:
      "https://images.unsplash.com/photo-1459156212016-c812468e2115?auto=format&fit=crop&w=900&q=85",
  },
];

export const formatCurrency = (value) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
