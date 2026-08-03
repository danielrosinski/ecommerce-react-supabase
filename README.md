# NOVA — e-commerce editorial

Projeto criado com React + Vite, preparado para publicação na Vercel e para usar Supabase no plano gratuito.

## O que já funciona

- Catálogo responsivo com busca, categorias e ordenação
- Produtos com preço, status de estoque e favoritos
- Carrinho lateral com controle de quantidade e frete progressivo
- Checkout demonstrativo sem cobrança real
- Painel de estoque em `/admin`
- Login administrativo com e-mail e senha
- Banco de dados protegido por políticas de acesso
- Modo demonstração quando o banco ainda não está configurado

## 1. Rodar no VS Code

Abra a pasta `nova-ecommerce` no VS Code e execute:

```bash
npm install
npm run dev
```

Abra o endereço informado pelo terminal, normalmente `http://localhost:5173`.

## 2. Criar o banco gratuito

1. Crie uma conta em `https://supabase.com`.
2. Crie um projeto no plano gratuito.
3. No painel do projeto, abra **SQL Editor**.
4. Abra o arquivo `supabase/schema.sql` deste projeto.
5. Copie todo o conteúdo, cole no SQL Editor e execute.

O script cria:

- Tabela de produtos
- Tabela de administradores
- Produtos demonstrativos
- Regras para permitir leitura pública apenas de produtos ativos
- Regras para permitir alterações somente aos administradores

## 3. Criar o usuário administrador

1. No Supabase, acesse **Authentication > Users**.
2. Adicione um usuário com seu e-mail e uma senha segura.
3. Copie o UUID desse usuário.
4. Volte ao **SQL Editor** e execute, substituindo o valor:

```sql
insert into public.admin_users (user_id)
values ('COLE-AQUI-O-UUID-DO-USUARIO');
```

O site não possui cadastro público de administradores. Isso evita que qualquer pessoa crie uma conta com acesso ao estoque.

## 4. Conectar o site ao Supabase

1. Duplique o arquivo `.env.example`.
2. Renomeie a cópia para `.env.local`.
3. No Supabase, abra o painel **Connect** do projeto.
4. Copie a URL do projeto e a chave pública.
5. Preencha:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUA_CHAVE_PUBLICA
```

Depois, reinicie o site:

```bash
npm run dev
```

A loja passa a buscar os produtos reais e `/admin` passa a exigir login.

> Use somente a chave pública no site. Nunca coloque uma chave `service_role` no código, GitHub ou Vercel.

## 5. Publicar com Git e Vercel

1. Envie a pasta `nova-ecommerce` para um repositório no GitHub.
2. Na Vercel, clique em **Add New > Project**.
3. Importe o repositório.
4. Em **Environment Variables**, adicione:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
5. Clique em **Deploy**.

O arquivo `vercel.json` mantém as rotas `/` e `/admin` funcionando ao atualizar a página.

## Estrutura principal

```text
nova-ecommerce/
├── src/
│   ├── lib/supabase.js
│   ├── services/products.js
│   ├── AdminPage.jsx
│   ├── App.jsx
│   ├── data.js
│   └── styles.css
├── supabase/schema.sql
├── .env.example
├── package.json
└── vercel.json
```

## Próxima etapa

O pagamento ainda é simulado. A próxima evolução recomendada é criar pedidos no banco e integrar uma plataforma de pagamentos por uma função segura no servidor.
