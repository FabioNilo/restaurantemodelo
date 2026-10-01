# Nosso Bistrô Café — Cardápio digital

Cardápio digital + pedido via WhatsApp + painel admin (dados e fotos no Neon, hospedagem na Vercel) do **Nosso Bistrô Café (Ilhéus - BA)**. Montado sobre o esqueleto da demo `restaurantemodelo` (clonada do `massas-italianas-express`), com a identidade visual do logo do cliente: verde-floresta, dourado metálico, "Nosso" em serifa (Cormorant Garamond) e "BISTRÔ · CAFÉ" em caixa-alta espaçada (Montserrat).

## Identidade visual

- **Fonte da verdade da marca**: `src/lib/brand.ts` (nome, cidade, WhatsApp exibido, Instagram, caminhos do logo). Os componentes leem daqui em vez de repetir o nome.
- **Paleta**: tokens em `src/index.css`.
  - `primary`: dourado metálico, para fundos, botões e destaques sobre o verde.
  - `gold-ink`: dourado escuro, para **texto/ícone sobre fundo claro**. O dourado metálico não tem contraste suficiente sobre o creme.
  - `secondary`: verde-floresta do logo.
  - `brand-deep`: verde quase preto do header, hero, "Sobre" e rodapé.
- **Logo**: `docs/nosso-bistro-cafe-logo-hd-v2.png` é um print do avatar do Instagram. O script abaixo recorta só o disco verde (sem o anel colorido nem o fundo preto) e gera logo, favicon, apple-touch-icon e og-image em `public/brand/`:

  ```sh
  node scripts/build-brand-assets.mjs
  ```

  Quando o cliente mandar o arquivo original (PNG transparente ou vetor), basta trocar a origem no script e rodar de novo.
- **Hero**: foto livre do Unsplash (cappuccinos com latte art), baixada e recortada por `node scripts/fetch-hero-photo.mjs`. Troque por uma foto real do café quando houver.

## Cardápio

- Transcrito de `docs/Nosso Bistro Café - Delivery.pdf` para `src/data/cardapio.ts`: 14 categorias, na mesma ordem do PDF.
- Itens com vários sabores ou tamanhos viram **um produto com opções** (campo `tamanhos`): Picolé, Mini sorvete, Polpa de fruta, Licor artesanal, Biscoito caseiro, Água, refrigerantes por marca, Munguzá, Bolo no pote e Morango cravejado.
  - Até 3 opções aparecem como botões no card.
  - Mais que isso vira uma lista suspensa "Escolha o sabor".
- Sem fotos por enquanto: cada card mostra um fallback verde com louros e o ícone da categoria. O dono sobe as fotos pelo admin, e elas vão para o Neon Object Storage.
- O site público tem **busca** (sem acento, procura também nos sabores) e **abas de categoria fixas no topo** ao rolar.
- No admin (`/admin` → Cardápio), o dono cria, edita e exclui produtos e categorias e sobe as fotos.
  - Produtos são simples por padrão. "Adicionar opção" cria sabores ou tamanhos, e o detalhe ("140 ml", "1 kg") é opcional.
  - O preço aceita vírgula ou ponto.
  - Um produto só aparece no site com **estoque > 0** e "Disponível" ligado.

## Arquitetura

```
navegador ──► Vercel CDN ──► site estático (Vite/React, dist/)
                  │
                  └── /api/* ──► 1 Vercel Function (api/index.ts → server/app.ts, Hono)
                                     ├── Neon Postgres  (cardápio, configurações, usuários)
                                     └── Neon Object Storage, bucket "produtos" (fotos)
navegador ──► fotos direto do bucket (leitura pública, sem passar pela Vercel)
```

- **API em `server/`**: app [Hono](https://hono.dev) sem dependência da Vercel.
  - As rotas seguem o contrato que o front já usava com o n8n (`src/features/integrations/n8n-contracts.ts`), com o envelope `{ success, data }`.
  - `api/index.ts` adapta o app para Vercel Functions. O `vercel.json` reescreve `/api/*` para essa **única função** (o Hobby permite 12).
  - `server/node.ts` roda o mesmo app num Node comum: desenvolvimento local e, no futuro, a VPS.
- **Banco**: projeto Neon `nosso-bistro-cafe` (`soft-cake-33779792`), região `aws-us-east-1`, a mesma das funções da Vercel (`iad1`).
  - Branch `production`: usada pelo site no ar.
  - Branch `dev`: usada no desenvolvimento local e nos previews.
  - Schema em `db/migrations/`.
- **Fotos**: o admin comprime a imagem no navegador (até 500 KB). A API envia para o bucket `produtos` (leitura pública) e grava a URL no produto.
  - Trocar a foto ou excluir o produto apaga o arquivo antigo.
  - O Object Storage do Neon não existe em São Paulo, por isso o projeto fica em us-east-1.
- **Login**: senha com bcrypt na tabela `usuarios_admin` e token JWT (12 h) assinado com `SESSION_SECRET`. Trocar a senha encerra as sessões abertas em outros aparelhos.
- **Cache**: o catálogo e o status do site ficam 30 s no cache da CDN da Vercel. Uma edição no admin leva **até ~1 min** para aparecer para todos os visitantes.
- **Formas de pagamento em todo o site**: só **Pix, Débito e Crédito**, sem dinheiro e sem troco (`server/pagamentos.ts` e `src/lib/pagamentos.ts`).
- **Ainda não existe**: cadastro de gestores pela tela (use `npm run admin:password`).
- **Acesso ao painel**: não há mais botão "Admin" no site. O painel fica em `/auth` (salve nos favoritos), e o `robots.txt` pede aos buscadores para não indexar `/auth`, `/admin` e `/api/`.

## Painel administrativo (`/admin`)

Mesma estrutura do painel do `plataforma-restaurantes`: **menu lateral** (no celular, uma barra rolável no topo) e uma página por seção, nas cores da marca. O código fica em `src/pages/admin/`, com o layout em `AdminLayout.tsx`.

| Seção | O que faz | Admin | Gestor (caixa) |
|---|---|---|---|
| **Mesas** | mapa das mesas (livre ou ocupada, há quanto tempo, total e pedidos novos), QR e cadastro | ✔ | ✔ (sem cadastro e sem QR) |
| **Mesas → comanda** | pedidos da mesa, Preparar → Entregue, Imprimir, Cancelar, **Lançar pedido** e **Fechar conta** | ✔ | ✔ |
| **Delivery** | pedidos do site em andamento, avanço de status e **Marcar entregue** (forma de pagamento e taxa) | ✔ | ✔ |
| **Caixa** | recebimentos por período, por forma e por canal, e **Exportar Excel** | ✔ | ✔ |
| **Cardápio** | produtos, fotos, opções e categorias (o gestor só ajusta o estoque) | ✔ | estoque |
| **Métricas** | vendas, pedidos, ticket médio, por canal, vendas por dia e mais vendidos (hoje, 7 ou 30 dias) | ✔ | — |
| **Desempenho** | ranking por produto, em alta e em queda, e produtos parados (7, 30 ou 90 dias) | ✔ | — |
| **Configurações** | WhatsApp, horário, **bairros e taxas de entrega** e credenciais | ✔ | — |

Mesas e Delivery se atualizam sozinhos, a cada 10 e 15 segundos, só com a aba visível. Clique em **"Ativar som"** ao abrir: o navegador só toca o bipe de pedido novo depois de um clique. O título da aba também mostra "(2) Novos pedidos".

Usuário do caixa (gestor):

```sh
ENV_FILE=.env.vercel-production.local npm run admin:password -- caixa <senha> gestor
```

### Pedidos pela mesa (QR code)

O cliente escaneia o QR da mesa, vê o cardápio no celular e envia o pedido **direto para o caixa**, sem WhatsApp. Os pedidos se acumulam numa **conta aberta** da mesa.

```
QR da mesa ──► /mesa/<código> ──► POST /api/mesas/<código>/pedidos ──► Neon (pedidos_mesa)
                                                                          ▲
painel (/admin/mesas e /admin/mesas/:id) ── consulta a cada 10 s ─────────┘
```

- **Segurança**:
  - Cada mesa tem um código aleatório no QR, e não um número.
  - **O preço de cada item é recalculado no servidor** a partir do cardápio.
  - Há limite de 6 pedidos por minuto por mesa.
  - A mesa ignora o horário do delivery e só aceita pedido se estiver **ativa**.
- **Lançar pedido**: na comanda, abre o cardápio da mesa numa aba nova, para o garçom pedir por um cliente sem celular.
- **Fechar conta**:
  - escolhe Pix, Débito ou Crédito, e o valor já vem preenchido com o total;
  - **"Dividir pagamento"** reparte o total em até 3 formas, e "Completar R$ X" preenche o que falta;
  - a soma tem de bater exatamente com o total, porque não há troco;
  - não fecha com pedido em andamento;
  - se entrar um pedido durante o fechamento, a API recusa e pede para conferir de novo.
- **QR**: "Imprimir QR" gera uma folha A4 com 6 cartões; o botão QR do cartão imprime o de uma mesa só (`/admin/mesas/qr?id=`). "Gerar novo QR" invalida o cartão impresso.
- O cliente acompanha os pedidos e o total parcial em "Minha conta". O pedido da mesa **não** baixa estoque.

### Delivery registrado

O pedido feito pelo site é **gravado no banco** (`pedidos_delivery`, com o preço recalculado no servidor) e o WhatsApp continua abrindo com a mensagem e o **link de acompanhamento** (`/pedido/:id?token=`).
- No painel (**Delivery**), a equipe leva o pedido por Recebido → Em preparo → Saiu para entrega e clica em **Marcar entregue**.
- Ao marcar como entregue, confirma a forma de pagamento (pré-marcada com a escolha do cliente) e a taxa de entrega (pré-preenchida com a do bairro, pode ajustar). Nesse momento o valor **entra no caixa**.

### Bairros e taxas de entrega

- Cadastro em **Configurações → Bairros e taxas de entrega** (tabela `bairros`, migração `004`): nome e **taxa única** por bairro.
- No carrinho, o **bairro é obrigatório e escolhido numa lista** (só os ativos, com a taxa ao lado). A taxa é somada ao total na hora e vai na mensagem do WhatsApp.
- **Bairro fora da lista não pode pedir.** A API confere de novo: recusa bairro não cadastrado ou pausado e usa a taxa do cadastro, nunca a do navegador.
- **Pausar** (interruptor Ativo/Pausado) tira o bairro do carrinho sem apagar o cadastro. Sem nenhum bairro ativo, o site não aceita delivery.
- O pedido guarda nome e taxa do bairro: mudar a taxa ou excluir o bairro depois não altera pedidos antigos.
- A taxa aparece no cartão do pedido em **Delivery**, no cupom impresso (`ENTREGA:`), na página de acompanhamento e, **separada dos itens**, no **Caixa** e no Excel (Resumo: "Vendas (itens)" e "Taxas de entrega"; Movimentações: colunas Itens / Taxa de entrega / Valor; Por dia: "Taxas de entrega (incluídas)").
- O site aceita no máximo 5 pedidos por telefone a cada 10 minutos.

### Caixa e Excel

- O caixa sai da tabela `pagamentos`: **só entradas**, com cada pagamento de conta fechada e cada delivery entregue.
- Período: **Hoje, Ontem, 7 dias, Este mês, Mês passado** ou datas **De/Até**, com no máximo 1 ano.
- **Exportar Excel** baixa `fluxo-de-caixa_AAAA-MM-DD_a_AAAA-MM-DD.xlsx` com três abas:
  - **Resumo**: total, por forma de pagamento e por canal;
  - **Movimentações**: data, hora, canal, referência, cliente, forma e valor, com linha de total e filtro;
  - **Por dia**: Pix, Débito, Crédito e total.
- O `exceljs` só é baixado no clique, num arquivo separado, para não pesar o site.

## Variáveis de ambiente

Modelo em `.env.example`. Os valores reais (gerados na criação do projeto Neon) estão em arquivos **locais, fora do git**:

| Arquivo | Para quê |
|---|---|
| `.env.local` | desenvolvimento local, aponta para a branch `dev` |
| `.env.vercel-production.local` | valores para colar na Vercel (Production) |
| `.admin-production.local` | login inicial do painel em produção. **Não vai para a Vercel.** |

| Variável | Onde | Observação |
|---|---|---|
| `VITE_API_BASE_URL` | Vercel (Production e Preview) | `/api`. Vazio = modo demo |
| `DATABASE_URL` | Vercel | string *pooled*. Production usa a branch `production`; Preview pode usar a `dev` |
| `SESSION_SECRET` | Vercel | 32+ caracteres aleatórios (`openssl rand -base64 48`). Trocar derruba todas as sessões |
| `NEON_STORAGE_ENDPOINT` | Vercel | endpoint S3 da branch (Console Neon → Connect → Storage) |
| `NEON_STORAGE_REGION` | Vercel | `us-east-1` |
| `NEON_STORAGE_BUCKET` | Vercel | `produtos` |
| `NEON_STORAGE_ACCESS_KEY_ID` / `NEON_STORAGE_SECRET_ACCESS_KEY` | Vercel | credencial `storage:write` (vale para a `production` e a `dev`) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | só local | usados pelos scripts `db:seed` e `admin:password` |

O prefixo é `NEON_STORAGE_*`, e não `AWS_*`, porque a Vercel reserva os nomes `AWS_*`.

## Deploy na Vercel (plano Hobby)

1. Importe o repositório na Vercel. O preset **Vite** é detectado sozinho: build `npm run build`, saída `dist`.
2. Em *Settings → Environment Variables*, cadastre as variáveis de `.env.vercel-production.local` para **Production**. Para **Preview**, use as mesmas, trocando `DATABASE_URL` e `NEON_STORAGE_ENDPOINT` pelos da branch `dev` (estão em `.env.local`).
3. Faça o deploy e confira:
   - `https://<projeto>.vercel.app/api/health` deve responder `{"ok":true}`;
   - o cardápio carrega do banco;
   - o login funciona com o usuário de `.admin-production.local`.
4. **Troque a senha do admin no primeiro acesso**, em Admin → Configurações → Credenciais.

O banco de produção já está migrado e populado. Para rodar de novo, por exemplo depois de uma migração nova:

```sh
ENV_FILE=.env.vercel-production.local npm run db:migrate
```

**Limites do Hobby, conferidos na documentação da Vercel em set/2026:**
- 1 milhão de invocações por mês e 4 h de CPU ativa;
- 100 GB de tráfego;
- até 12 funções por deploy (este projeto usa 1);
- corpo de requisição de até 4,5 MB (as fotos chegam com no máximo 500 KB).

Pelos termos, o Hobby é para **uso não comercial**. Se o site crescer ou for formalizado, mude a conta para Pro, sem nenhuma mudança de código, ou leve a API para a VPS (seção abaixo).

## Rodar localmente

```sh
npm install
npm run dev:api   # API em http://localhost:8787 (usa .env.local → branch "dev" do Neon)
npm run dev       # site em http://localhost:8080, com proxy de /api para a API local
npm test
```

Sem `VITE_API_BASE_URL` (por exemplo, sem `.env.local`), o site roda no **modo demo**:
- o cardápio fica no `localStorage`, semeado a partir de `src/data/cardapio.ts`;
- o login é `admin` / `demo1234`.

### Scripts de banco

| Comando | O que faz |
|---|---|
| `npm run db:migrate` | aplica o que falta de `db/migrations/*.sql` (controle em `schema_migrations`) |
| `npm run db:seed` | cadastra o cardápio de `src/data/cardapio.ts`, as configurações e o admin. Não sobrescreve o que já existe |
| `npm run admin:password -- <usuario> <senha> [admin\|gestor]` | cria o usuário ou redefine a senha dele (e encerra as sessões abertas) |

Todos usam o `.env.local` por padrão. Para a produção, prefixe com `ENV_FILE=.env.vercel-production.local`.

## Levando a API para a VPS (quando quiser)

O front não muda. Na VPS:
1. Rode `npm ci && npm run start:api`, com pm2 ou systemd, usando as mesmas variáveis de ambiente (`PORT`, padrão 8787).
2. Exponha pelo Nginx em `https://api.seudominio/api`.
3. No build do site, use `VITE_API_BASE_URL=https://api.seudominio/api`.

O site estático pode continuar na Vercel ou ir para a VPS. Se o site e a API ficarem em domínios diferentes, habilite CORS em `server/app.ts` (`hono/cors`).

## Pendências com o cliente

Confirmar antes de publicar. Os itens estão marcados com **"(a confirmar)"** no próprio cardápio, visíveis no site e no admin.

1. **Nomes cortados no PDF**:
   - Promoção do dia: "2 Fatias torta pro...", "Promoção 2 fatias ...", "Salgado promoção...".
   - Salgados: "Misto quente com ...".
   - Cafés: "CAPPUCCINO ALP..." (Alpino?), "KITKAT", "MOK. DOIS FRADES", "DOIS FRADES".
   - Refrigerantes: os dois tamanhos de Coca-Cola Original (R$ 10 e R$ 12) e a 2ª opção de Guaraná Antarctica.
   - Bolos caseiros: "Bolo caseiro com ...".
   - Biscoitos: "LECINHO DE GOI...", "ROSQUINHA DE C...".
   - Picolés: os 15 sabores, dos quais só se lê a inicial.
   - Mini sorvete: os 5 sabores.
   - Doces: "Copo pequeno mo...", "Morango cravejad..." (R$ 25).
   - Sobremesas: as duas opções de "Bolo no pote Tam...".
   - Licores: "Licor artesanal ma...", "me...", "ta...".
   - Bomboniere: "Salgadinhos s...".
2. **Sem preço no PDF**:
   - "Cenoura" (bolos caseiros) está cadastrado como indisponível.
   - "POLPA FRUTAS 1KG" aparece no PDF sem preço, acima de "POLPA DE MANGA 1KG" (R$ 15). O site tem só "Polpa de fruta 1 kg" com a opção Manga.
3. **Horário de funcionamento**: o padrão é 07h–19h (placeholder, editável no admin).
4. **Endereço**: o rodapé mostra "Endereço a confirmar" (`BRAND.address` em `src/lib/brand.ts`).
5. **Logo original** em alta resolução ou vetor, sem o anel do Instagram.
6. **Fotos reais** dos produtos e do ambiente, para substituir o fallback e a foto do hero.
7. **Promoção do dia** no hero: o texto "2 fatias de torta por R$ 30" está fixo em `HeroSection.tsx`.
