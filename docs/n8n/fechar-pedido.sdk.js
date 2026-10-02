import { workflow, node, trigger, sticky, newCredential, ifElse, expr } from '@n8n/workflow-sdk';

const neonCred = { postgres: newCredential('Neon Nosso Bistrô (atendimento)') };

const entrada = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: {
    name: 'Dados do pedido',
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'telefone', type: 'string' },
          { name: 'nome_cliente', type: 'string' },
          { name: 'endereco', type: 'string' },
          { name: 'bairro', type: 'string' },
          { name: 'complemento', type: 'string' },
          { name: 'observacoes', type: 'string' },
          { name: 'forma_pagamento', type: 'string' }
        ]
      }
    },
    position: [0, 300]
  },
  output: [{ telefone: '5573900000001', nome_cliente: 'Maria', endereco: 'Rua A, 10', bairro: 'Centro', complemento: '', observacoes: '', forma_pagamento: 'pix' }]
});

const itensCarrinho = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Itens do carrinho',
    parameters: {
      operation: 'executeQuery',
      query: 'select atendimento.itens_para_pedido($1) as itens',
      options: { queryReplacement: expr('{{ $json.telefone }}') }
    },
    credentials: neonCred,
    position: [240, 300]
  },
  output: [{ itens: [{ id: 'cappuccino', tamanho_codigo: null, quantidade: 2 }] }]
});

const registrarPedido = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Registrar pedido na API',
    parameters: {
      method: 'POST',
      url: 'https://nossobistro.vercel.app/api/massas/pedidos',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ itens: $json.itens, nome_cliente: $("Dados do pedido").item.json.nome_cliente, telefone_cliente: $("Dados do pedido").item.json.telefone, endereco_cliente: $("Dados do pedido").item.json.endereco, bairro_cliente: $("Dados do pedido").item.json.bairro, complemento_cliente: $("Dados do pedido").item.json.complemento || null, observacoes_cliente: $("Dados do pedido").item.json.observacoes || null, forma_pagamento: $("Dados do pedido").item.json.forma_pagamento, tracking_base_url: "https://nossobistro.vercel.app/pedido" }) }}'),
      options: { response: { response: { neverError: true, responseFormat: 'json' } } }
    },
    position: [480, 300]
  },
  output: [{ success: true, data: { id: 'uuid', status: 'recebido', subtotal: 22, taxa_entrega: 7, valor_total: 29, tracking_url: 'https://nossobistro.vercel.app/pedido/uuid?token=x' } }]
});

const deuCerto = ifElse({
  version: 2.2,
  config: {
    name: 'Pedido registrado?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.success }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    },
    position: [720, 300]
  }
});

const limparCarrinho = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Limpar carrinho',
    parameters: {
      operation: 'executeQuery',
      query: 'select atendimento.limpar_carrinho($1) as ok',
      options: { queryReplacement: expr('{{ $("Dados do pedido").item.json.telefone }}') }
    },
    credentials: neonCred,
    position: [960, 200]
  },
  output: [{ ok: { ok: true } }]
});

const respostaOk = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Resposta: pedido feito',
    parameters: {
      mode: 'raw',
      jsonOutput: expr('{{ JSON.stringify({ ok: true, pedido: $("Registrar pedido na API").item.json.data, aviso: "Pedido registrado. Informe o valor_total e envie o tracking_url ao cliente." }) }}')
    },
    position: [1200, 200]
  },
  output: [{ ok: true }]
});

const respostaErro = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Resposta: erro',
    parameters: {
      mode: 'raw',
      jsonOutput: expr('{{ JSON.stringify({ ok: false, erro: $json.error || "Não consegui registrar o pedido agora. Tente de novo em instantes." }) }}')
    },
    position: [960, 420]
  },
  output: [{ ok: false, erro: 'O pedido está vazio.' }]
});

const nota = sticky('## Ferramenta fechar_pedido\nChamada pelo agente do workflow **Nosso Bistrô / Atendimento WhatsApp**.\nLê o carrinho do cliente no Neon (schema `atendimento`), registra o pedido pela API do site (que recalcula preços e valida o bairro) e limpa o carrinho só se deu certo.\n\nCredencial Postgres: usuário `n8n_atendimento` (dados em `restaurantemodelo/.n8n-neon.local`).', [], { position: [0, 0], width: 520, height: 240 });

export default workflow('nosso-bistro-fechar-pedido', 'Nosso Bistrô / Fechar pedido (tool)')
  .add(nota)
  .add(entrada)
  .to(itensCarrinho)
  .to(registrarPedido)
  .to(deuCerto
    .onTrue(limparCarrinho.to(respostaOk))
    .onFalse(respostaErro));
