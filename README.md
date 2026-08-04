# Rosinski Floricultura

E-commerce full stack para uma floricultura digital, desenvolvido como projeto de portfólio com catálogo, personalização de produtos, controle de estoque, checkout e gestão de pedidos.

**Aplicação:** [ecommerce-react-supabase.vercel.app](https://ecommerce-react-supabase.vercel.app)

## Sobre o projeto

A Rosinski Floricultura oferece uma experiência de compra voltada a buquês e plantas, com entrega local em Guaratuba/PR ou retirada. A interface utiliza uma identidade visual clean em verde-musgo, palha e off-white, priorizando fotografias e navegação simples.

O projeto conecta a vitrine ao Supabase para que produtos, estoque, pedidos, personalizações e configurações comerciais permaneçam sincronizados entre a loja e o painel administrativo.

## Principais recursos

### Experiência de compra

- Catálogo responsivo com busca, categorias e ordenação
- Favoritos e carrinho persistente no navegador
- Página de detalhes com tamanhos e complementos
- Consulta automática de endereço pelo CEP
- Entrega em Guaratuba ou retirada gratuita
- Taxa de entrega configurável por bairro
- Cupons com regras de validade e valor mínimo
- Mensagem para cartão, ocasião e entrega anônima
- Acompanhamento público por número do pedido e e-mail
- Pagamento por Pix ou cartão no Checkout PagBank
- Retorno ao site e acompanhamento do status do pagamento

### Painel administrativo

- Autenticação de administradores
- Cadastro, edição, visibilidade e exclusão de produtos
- Upload de imagens para o Supabase Storage
- Controle de preço, estoque e produtos em destaque
- Gestão das taxas de entrega
- Gestão de cupons e limites de utilização
- Visualização dos pedidos e atualização de status
- Situação financeira atualizada por notificações do PagBank
- Finalização de pedidos com preservação do histórico
- Restauração automática do estoque em cancelamentos
- Exclusão segura de produtos ligados apenas a pedidos cancelados ou finalizados

### Segurança

- Row Level Security nas tabelas do Supabase
- Operações administrativas limitadas a usuários autorizados
- Preços, descontos, frete e estoque validados no banco
- Registro do pedido e redução de estoque em uma única transação
- Credenciais privadas não são expostas no navegador
- Webhooks validados novamente na API oficial antes de atualizar o pedido

## Tecnologias

- React
- Vite
- JavaScript
- Supabase Database, Authentication e Storage
- PostgreSQL e funções PL/pgSQL
- ViaCEP
- Lucide Icons
- Vercel
- PagBank Checkout e Vercel Functions

## Estrutura

```text
src/
├── lib/
├── services/
├── AdminPage.jsx
├── App.jsx
├── OrderLookupPage.jsx
└── styles.css

supabase/
├── schema.sql
├── v3-orders.sql
├── v5-floricultura.sql
├── v7-catalogo.sql
├── v8-loja.sql
├── v8-1-ajustes.sql
└── v9-pagbank.sql

api/
└── pagbank/
```

## Execução local

```bash
npm install
npm run dev
```

As variáveis públicas e privadas necessárias estão documentadas em `.env.example`. As variáveis privadas devem ser configuradas somente no ambiente da Vercel e nunca podem receber o prefixo `VITE_`.

## Status

O fluxo de compra, o estoque e os pedidos estão funcionais. A V9 integra o Checkout PagBank em Sandbox para validar Pix, cartão, retorno ao site e notificações antes da homologação para produção.

## Autor

Desenvolvido por [Daniel Rosinski](https://github.com/danielrosinski), estudante de Engenharia de Software.
