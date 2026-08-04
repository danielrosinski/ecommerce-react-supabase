# ROSINSKI — floricultura digital V7

E-commerce responsivo de floricultura desenvolvido com React, Vite e Supabase, preparado para publicação gratuita na Vercel.

## O que funciona nesta versão

### Identidade e catálogo da V7

- Cabeçalho verde-musgo com busca, navegação e ações reorganizadas
- Fundo palha e cartões claros, mantendo o terracota como cor de apoio
- Grade de produtos inspirada em vitrines de floriculturas
- Botões “Comprar agora” em verde-musgo
- Página de detalhes em modal com descrição e cuidados
- Escolha de tamanhos e complementos antes de adicionar ao carrinho
- Botão flutuante de WhatsApp com número demonstrativo

### Loja

- Catálogo com busca, categorias, ordenação e favoritos
- Carrinho com quantidades e validação de estoque
- Carrinho registra tamanho e complementos escolhidos
- Checkout adaptado para floricultura: destinatário, telefone, data e período
- Escolha entre entrega local em Guaratuba ou retirada
- Ocasião, mensagem para o cartão, entrega anônima e instruções
- Preenchimento automático de rua, bairro, cidade e estado pelo CEP
- Registro permanente dos pedidos no Supabase
- Número exclusivo para cada pedido
- Taxa demonstrativa de entrega de R$ 14,90 e retirada gratuita
- Baixa automática e segura do estoque
- Pagamento simulado, sem cobrança real

### Painel administrativo

- Login protegido com e-mail e senha em `/admin`
- Controle de preços, estoque, destaque e visibilidade dos produtos
- Cadastro e edição completa de produtos com prévia da imagem
- Cadastro de descrição, cuidados, tamanhos e complementos
- Exclusão protegida de produtos que não possuem histórico de pedidos
- Lista de pedidos com cliente, endereço, itens e valores
- Atualização de status: recebido, confirmado, em preparação, saiu para entrega, entregue ou cancelado
- Restauração automática do estoque quando um pedido é cancelado
- Políticas de segurança no banco de dados

### Consulta do cliente

- Página pública em `/pedido`
- Consulta protegida pelo número do pedido e e-mail da compra
- Linha do tempo do andamento, data, período, destinatário, itens e total
- O endereço completo e os dados administrativos não são expostos

## Atualizar da V6 para a V7

A V7 adiciona novos campos aos produtos e aos itens dos pedidos.

1. No Supabase, abra **SQL Editor**.
2. Abra `supabase/v7-catalogo.sql`, copie todo o conteúdo e execute uma única vez.
3. Copie o `.env.local` da V6 para a pasta V7.
4. Execute `npm install` e `npm run dev`.
5. Abra um produto, escolha tamanho e complementos e faça um pedido de teste.
6. Confira a personalização em `/admin` e em `/pedido`.

O arquivo SQL mantém os pedidos e produtos existentes. Ele apenas acrescenta os novos campos e valores iniciais.

## Atualizar da V4 para a V5

Esta versão exige uma atualização SQL para os campos florais e a consulta segura.

1. No Supabase, abra **SQL Editor**.
2. Abra `supabase/v5-floricultura.sql`, copie todo o conteúdo e execute uma única vez.
3. Copie o arquivo `.env.local` da V4 para a pasta V5.
4. Execute:

```bash
npm install
npm run dev
```

5. Faça um pedido de teste com data e destinatário.
6. Consulte o pedido em `http://localhost:5173/pedido`.

O SQL converte somente os produtos demonstrativos originais da NOVA. Produtos cadastrados pelo administrador não são modificados.

## Atualizar uma V2 para pedidos

Se a V2 já está conectada ao Supabase:

1. No Supabase, abra **SQL Editor**.
2. Abra o arquivo `supabase/v3-orders.sql` deste projeto.
3. Copie todo o conteúdo, cole no SQL Editor e execute uma única vez.
4. Copie o seu arquivo `.env.local` da pasta V2 para esta pasta.
5. Execute:

```bash
npm install
npm run dev
```

6. Faça um pedido de teste na loja.
7. Acesse `http://localhost:5173/admin` e abra a aba **Pedidos**.

> Para atualizar um projeto existente, execute apenas `v3-orders.sql`. O arquivo `schema.sql` completo é destinado principalmente a instalações novas.

## Consulta automática de CEP

O checkout consulta o serviço gratuito ViaCEP depois que os oito números do CEP são digitados. Rua, bairro, cidade e UF são preenchidos automaticamente, mas continuam editáveis para o cliente confirmar ou corrigir.

Não é necessário cadastrar chave de API nem adicionar uma variável na Vercel.

## Instalação nova

1. Crie um projeto gratuito em `https://supabase.com`.
2. No **SQL Editor**, execute `supabase/schema.sql`, `supabase/v5-floricultura.sql` e `supabase/v7-catalogo.sql`, nesta ordem.
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
│   │   ├── postalCode.js
│   │   └── products.js
│   ├── AdminPage.jsx
│   ├── App.jsx
│   ├── OrderLookupPage.jsx
│   ├── data.js
│   └── styles.css
├── supabase/
│   ├── schema.sql
│   ├── v3-orders.sql
│   ├── v5-floricultura.sql
│   └── v7-catalogo.sql
├── .env.example
├── package.json
└── vercel.json
```

## Próxima evolução

O pagamento ainda é simulado. A próxima etapa poderá incluir taxa por bairro, cupons e integração de pagamento por uma função segura no servidor, sem expor chaves privadas no navegador.
