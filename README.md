# NOVA — e-commerce editorial V3

E-commerce responsivo desenvolvido com React, Vite e Supabase, preparado para publicação gratuita na Vercel.

## O que funciona nesta versão

### Loja

- Catálogo com busca, categorias, ordenação e favoritos
- Carrinho com quantidades, validação de estoque e frete progressivo
- Checkout com dados do cliente e endereço de entrega
- Registro permanente dos pedidos no Supabase
- Número exclusivo para cada pedido
- Frete grátis acima de R$ 299 e frete demonstrativo de R$ 24,90 abaixo desse valor
- Baixa automática e segura do estoque
- Pagamento simulado, sem cobrança real

### Painel administrativo

- Login protegido com e-mail e senha em `/admin`
- Controle de preços, estoque, destaque e visibilidade dos produtos
- Lista de pedidos com cliente, endereço, itens e valores
- Atualização de status: confirmado, em separação, enviado, entregue ou cancelado
- Restauração automática do estoque quando um pedido é cancelado
- Políticas de segurança no banco de dados

## Atualizar da V2 para a V3

Se a V2 já está conectada ao Supabase:

1. No Supabase, abra **SQL Editor**.
2. Abra o arquivo `supabase/v3-orders.sql` deste projeto.
3. Copie todo o conteúdo, cole no SQL Editor e execute uma única vez.
4. Copie o seu arquivo `.env.local` da pasta V2 para esta pasta V3.
5. Execute:

```bash
npm install
npm run dev
```

6. Faça um pedido de teste na loja.
7. Acesse `http://localhost:5173/admin` e abra a aba **Pedidos**.

> Para atualizar um projeto existente, execute apenas `v3-orders.sql`. O arquivo `schema.sql` completo é destinado principalmente a instalações novas.

## Instalação nova

1. Crie um projeto gratuito em `https://supabase.com`.
2. No **SQL Editor**, execute todo o arquivo `supabase/schema.sql`.
3. Em **Authentication > Users**, crie o usuário administrador.
4. Copie o UUID do usuário.
5. No SQL Editor, execute:

```sql
insert into public.admin_users (user_id)
values ('COLE-AQUI-O-UUID-DO-USUARIO');
```

6. Duplique `.env.example`, renomeie para `.env.local` e preencha:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUA_CHAVE_PUBLICA
```

7. Instale e inicie:

```bash
npm install
npm run dev
```

> Use somente a chave pública. Nunca coloque uma chave `service_role` ou `sb_secret_` no código, GitHub ou Vercel.

## Como os pedidos são protegidos

O navegador envia somente os identificadores e quantidades dos produtos. Uma função no banco:

1. Confere se os produtos estão ativos.
2. Bloqueia temporariamente as linhas para evitar vendas acima do estoque.
3. Usa os preços salvos no banco, não os valores enviados pelo navegador.
4. Registra o pedido e seus itens.
5. Reduz o estoque na mesma operação.

Se alguma verificação falhar, nenhuma alteração é gravada.

## Publicar a atualização na Vercel

Depois dos testes locais, envie as alterações para a branch `main` do mesmo repositório. A Vercel fará uma nova publicação automaticamente.

As variáveis continuam as mesmas:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Estrutura principal

```text
nova-ecommerce/
├── src/
│   ├── lib/supabase.js
│   ├── services/
│   │   ├── orders.js
│   │   └── products.js
│   ├── AdminPage.jsx
│   ├── App.jsx
│   ├── data.js
│   └── styles.css
├── supabase/
│   ├── schema.sql
│   └── v3-orders.sql
├── .env.example
├── package.json
└── vercel.json
```

## Próxima evolução

O pagamento ainda é simulado. A próxima etapa poderá integrar Mercado Pago ou Stripe por uma função segura no servidor, sem expor chaves privadas no navegador.

