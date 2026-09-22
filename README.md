# Restaurante Modelo — Demo

Demo genérica de cardápio digital + pedido via WhatsApp + painel admin, para mostrar em reuniões com donos de restaurante (Pacote 1/2 do plano de prospecção). Clonada a partir do `massas-italianas-express` (projeto real da Pasta Brasiliana) e desmarcada: sem fotos, dados ou backend do cliente.

## Como funciona sem backend

Não depende de nenhum n8n/Supabase real. `public/runtime-config.js` está com a base URL do webhook vazia, então tudo roda em modo "demo local":

- o cardápio público vem de `src/lib/demo-backend.ts`, que lê/grava em `localStorage` (semeado a partir de `src/data/cardapio.ts` na primeira visita)
- o botão "Enviar pedido no WhatsApp" monta a mensagem e abre o WhatsApp direto (é a mesma lógica de produção: tenta registrar no backend, falha silenciosamente, e segue pelo WhatsApp mesmo assim)
- por padrão o pedido vai para `5573999099040` (mesmo número do "Desenvolvido por" no rodapé) — mude em `/admin` (Configurações) ou no fallback em `src/lib/site-settings.ts` (`DEFAULT_SITE_SETTINGS.whatsapp_numero`)

## Admin funcional (`/admin`)

Login em `/auth` com **usuário `admin` / senha `demo1234`** (mostrado na própria tela de login quando não há backend configurado). Sem nenhum n8n real, o admin funciona de verdade via `localStorage`:

- **Cardápio**: criar, editar, excluir produtos e categorias — e o cardápio público (`/`) atualiza na hora, porque os dois lêem o mesmo estado local. É o argumento de venda do Pacote 1 ("o dono atualiza preço/cardápio sem depender de você") funcionando ao vivo.
- **Configurações**: trocar o número de WhatsApp e o horário de funcionamento também reflete imediatamente no site público (banner de aberto/fechado e destino do pedido).
- **Pedidos (CRM) e Caixa**: continuam mostrando erro/vazio — não há pedidos reais numa demo que roda só no navegador. Não abrir essas abas ao vivo.
- **Trocar senha e Gestores**: não funcionam nesta demo (sem backend real por trás).

Cada visitante tem seu próprio estado (é local ao navegador dele) — nada é compartilhado entre quem está vendo a demo. Para zerar e voltar ao cardápio original, apague o `localStorage` do site ou rode `localStorage.clear()` no console.

## Fotos do cardápio e do hero

As fotos em `public/menu/` e `public/hero/` são do Unsplash (licença livre, uso comercial permitido), escolhidas por afinidade com a descrição de cada prato — sem marca/logo visível (por isso a lata de refrigerante é lisa, sem rótulo). Foram baixadas com `node scripts/fetch-menu-photos.mjs` e `node scripts/fetch-hero-photo.mjs`. Não são fotos de nenhum cliente — troque pelas fotos reais do restaurante antes de fechar um contrato.

## Rodar localmente

```sh
npm install
npm run dev
```

## O que NÃO está pronto nesta demo

- **Pedidos (CRM) e Caixa** no admin: sem dados reais, mostram erro/vazio.
- **Trocar senha e Gestores** no admin: não funcionam sem backend real.
- **Zonas de entrega** (dentro de Configurações): não funcionam sem backend real — o carrinho já lida bem com isso (cai pro campo de bairro manual).
- **Rastreio de pedido (`/pedido/:id`)**: só funciona com backend real, não é alcançável nesta demo.

## Reaproveitando para um cliente de verdade

Esse é o mesmo esqueleto do `massas-italianas-express`/`marmitas-fit-express`. Pra virar o site de um cliente real:

1. Trocar cardápio em `src/data/cardapio.ts` pelos pratos/preços reais (ou cadastrar direto pelo admin depois de configurar o backend).
2. Trocar nome/textos ("Restaurante Modelo") em `Header.tsx`, `Footer.tsx`, `HeroSection.tsx`, `AboutSection.tsx`, `CartModal.tsx`, `Auth.tsx`, `PedidoTracking.tsx`, `index.html`.
3. Trocar `/placeholder.svg` e as fotos em `public/menu/` e `public/hero/` pela logo/fotos reais do cliente.
4. Ajustar `DEFAULT_SITE_SETTINGS` (WhatsApp, horário de funcionamento) em `src/lib/site-settings.ts`.
5. Se o pacote incluir backend (Pacote 2), apontar `public/runtime-config.js` (ou `.env.local`) pro n8n do cliente e seguir o contrato em `src/features/integrations/n8n-contracts.ts`. Isso desliga o modo demo automaticamente (`hasN8NBaseUrl()` passa a ser `true`) e todo o admin volta a falar com o backend real — inclusive login, então troque a senha demo por credenciais de verdade antes de publicar.
