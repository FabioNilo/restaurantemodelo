import { workflow, node, trigger, sticky, newCredential, ifElse, languageModel, memory, tool, expr } from '@n8n/workflow-sdk';

const neonCred = { postgres: newCredential('Neon Nosso Bistrô (atendimento)') };

const webhookEvolution = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook Evolution',
    parameters: { httpMethod: 'POST', path: 'nossobistro-whatsapp', responseMode: 'onReceived', options: {} },
    position: [0, 300]
  },
  output: [{ body: { event: 'messages.upsert', instance: 'nossobistro', data: { key: { remoteJid: '5573999990000@s.whatsapp.net', fromMe: false }, pushName: 'Maria', message: { conversation: 'Oi, quero ver o cardápio' } } } }]
});

const chatTeste = trigger({
  type: '@n8n/n8n-nodes-langchain.chatTrigger',
  version: 1.1,
  config: {
    name: 'Chat de teste',
    parameters: { public: false, options: { responseMode: 'lastNode' } },
    position: [0, 520]
  },
  output: [{ sessionId: 'teste', action: 'sendMessage', chatInput: 'Oi, quero ver o cardápio' }]
});

const normalizar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Normalizar Mensagem',
    parameters: {
      mode: 'runOnceForEachItem',
      jsCode: "if ($json.chatInput !== undefined) {\n  return { json: { origem: 'chat', telefone_whatsapp: '5573000000000', nome_cliente: 'Teste', mensagem: String($json.chatInput).trim(), remote_jid: '', instance_name: '', is_from_me: false, is_grupo: false } };\n}\nconst body = $json.body ?? $json;\nconst data = body.data ?? body;\nconst key = data.key ?? body.key ?? {};\nconst message = data.message ?? body.message ?? {};\nconst text = message.conversation ?? message.extendedTextMessage?.text ?? message.imageMessage?.caption ?? message.videoMessage?.caption ?? body.text ?? data.text ?? '';\nconst remoteJid = String(key.remoteJid ?? data.remoteJid ?? body.remoteJid ?? body.from ?? '');\nconst telefone = remoteJid.split('@')[0].replace(/\\D/g, '');\nreturn { json: { origem: 'whatsapp', telefone_whatsapp: telefone, nome_cliente: data.pushName ?? body.pushName ?? '', mensagem: String(text).trim(), remote_jid: remoteJid, instance_name: body.instance ?? data.instance ?? '', is_from_me: Boolean(key.fromMe), is_grupo: remoteJid.endsWith('@g.us') } };"
    },
    position: [240, 400]
  },
  output: [{ origem: 'whatsapp', telefone_whatsapp: '5573999990000', nome_cliente: 'Maria', mensagem: 'Oi, quero ver o cardápio', remote_jid: '5573999990000@s.whatsapp.net', instance_name: 'nossobistro', is_from_me: false, is_grupo: false }]
});

const ehCliente = ifElse({
  version: 2.2,
  config: {
    name: 'Mensagem de cliente?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [
          { leftValue: expr('{{ $json.telefone_whatsapp }}'), operator: { type: 'string', operation: 'notEmpty', singleValue: true } },
          { leftValue: expr('{{ $json.mensagem }}'), operator: { type: 'string', operation: 'notEmpty', singleValue: true } },
          { leftValue: expr('{{ $json.is_from_me }}'), operator: { type: 'boolean', operation: 'false', singleValue: true } },
          { leftValue: expr('{{ $json.is_grupo }}'), operator: { type: 'boolean', operation: 'false', singleValue: true } }
        ],
        combinator: 'and'
      }
    },
    position: [480, 400]
  }
});

const contexto = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Contexto do cliente (Neon)',
    parameters: {
      operation: 'executeQuery',
      query: 'select atendimento.contexto($1) as contexto',
      options: { queryReplacement: expr('{{ $json.telefone_whatsapp }}') }
    },
    credentials: neonCred,
    position: [720, 380]
  },
  output: [{ contexto: { loja: { aberta_agora: true, horario: '07:00 às 19:00', mensagem_fechado: 'Estamos fechados.' }, bairros: [{ bairro: 'Centro', taxa: 7 }], carrinho: { itens: [], subtotal: 0, quantidade_itens: 0 } } }]
});

const modelo = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'OpenAI',
    parameters: {
      model: { __rl: true, mode: 'list', value: 'gpt-5-mini', cachedResultName: 'gpt-5-mini' },
      responsesApiEnabled: true,
      options: { reasoningEffort: 'low', timeout: 60000, maxRetries: 2 }
    },
    credentials: { openAiApi: newCredential('OpenAI') },
    position: [760, 700]
  }
});

const memoria = memory({
  type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
  version: 1.4,
  config: {
    name: 'Memória WhatsApp',
    parameters: { sessionIdType: 'customKey', sessionKey: expr("{{ $(\"Normalizar Mensagem\").item.json.telefone_whatsapp }}"), contextWindowLength: 12 },
    position: [900, 700]
  }
});


const listarCategorias = tool({
  type: 'n8n-nodes-base.postgresTool',
  version: 2.6,
  config: {
    name: "listar_categorias",
    parameters: {
      descriptionType: 'manual',
      toolDescription: "Lista as categorias do cardápio que têm produtos à venda agora, com a quantidade de produtos de cada uma. Use quando o cliente pedir o cardápio de forma geral.",
      operation: 'executeQuery',
      query: "select atendimento.categorias() as resultado",
      options: {}
    },
    credentials: neonCred,
    position: [1040,700]
  }
});

const buscarCardapio = tool({
  type: 'n8n-nodes-base.postgresTool',
  version: 2.6,
  config: {
    name: "buscar_cardapio",
    parameters: {
      descriptionType: 'manual',
      toolDescription: "Busca produtos à venda (disponíveis e com estoque) por termo e/ou categoria, sem diferenciar acentos. Retorna total_encontrado e produtos com produto_id, nome, descricao, categoria, preco e opcoes (tamanho_codigo, nome, preco). Para listar uma categoria inteira, envie termo vazio e a categoria.",
      operation: 'executeQuery',
      query: "select atendimento.buscar_cardapio(coalesce($1::jsonb->>'termo', ''), coalesce($1::jsonb->>'categoria', ''), 15) as resultado",
      options: { queryReplacement: expr("{{ JSON.stringify({ termo: $fromAI('termo', 'Palavra do produto que o cliente quer, ex.: cappuccino, torta, coxinha, picolé. Vazio para listar uma categoria inteira.', 'string', ''), categoria: $fromAI('categoria', 'Nome (ou parte) da categoria, ex.: Cafés, Tortas, Salgados. Vazio para buscar em todas.', 'string', '') }) }}") }
    },
    credentials: neonCred,
    position: [1180,700]
  }
});

const verCarrinho = tool({
  type: 'n8n-nodes-base.postgresTool',
  version: 2.6,
  config: {
    name: "ver_carrinho",
    parameters: {
      descriptionType: 'manual',
      toolDescription: "Mostra o carrinho atual do cliente com preços atualizados do cardápio: itens (nome, quantidade, preco_unitario, total_item, disponivel), quantidade_itens e subtotal (sem a taxa de entrega).",
      operation: 'executeQuery',
      query: "select atendimento.ver_carrinho($1) as resultado",
      options: { queryReplacement: expr("{{ $(\"Normalizar Mensagem\").item.json.telefone_whatsapp }}") }
    },
    credentials: neonCred,
    position: [1320,700]
  }
});

const adicionarItem = tool({
  type: 'n8n-nodes-base.postgresTool',
  version: 2.6,
  config: {
    name: "adicionar_item",
    parameters: {
      descriptionType: 'manual',
      toolDescription: "Adiciona um produto ao carrinho do cliente (se já estiver lá, soma a quantidade). Produtos com opcoes exigem tamanho_codigo. Retorna ok e o carrinho atualizado, ou ok=false com o erro (e as opções válidas, quando faltar a opção).",
      operation: 'executeQuery',
      query: "select atendimento.adicionar_item($1::jsonb->>'telefone', $1::jsonb->>'produto_id', nullif($1::jsonb->>'tamanho_codigo', ''), coalesce(nullif($1::jsonb->>'quantidade', '')::int, 1)) as resultado",
      options: { queryReplacement: expr("{{ JSON.stringify({ telefone: $(\"Normalizar Mensagem\").item.json.telefone_whatsapp, produto_id: $fromAI('produto_id', 'produto_id exato retornado por buscar_cardapio', 'string'), tamanho_codigo: $fromAI('tamanho_codigo', 'tamanho_codigo da opção escolhida (de opcoes em buscar_cardapio); vazio se o produto não tem opções', 'string', ''), quantidade: $fromAI('quantidade', 'Quantidade a adicionar (1 a 50)', 'number', 1) }) }}") }
    },
    credentials: neonCred,
    position: [1460,700]
  }
});

const removerItem = tool({
  type: 'n8n-nodes-base.postgresTool',
  version: 2.6,
  config: {
    name: "remover_item",
    parameters: {
      descriptionType: 'manual',
      toolDescription: "Tira um produto do carrinho. Com quantidade 0, tira o item inteiro; com quantidade N, diminui N unidades. Retorna o carrinho atualizado.",
      operation: 'executeQuery',
      query: "select atendimento.remover_item($1::jsonb->>'telefone', $1::jsonb->>'produto_id', nullif($1::jsonb->>'tamanho_codigo', ''), coalesce(nullif($1::jsonb->>'quantidade', '')::int, 0)) as resultado",
      options: { queryReplacement: expr("{{ JSON.stringify({ telefone: $(\"Normalizar Mensagem\").item.json.telefone_whatsapp, produto_id: $fromAI('produto_id', 'produto_id do item no carrinho (veja ver_carrinho)', 'string'), tamanho_codigo: $fromAI('tamanho_codigo', 'tamanho_codigo do item no carrinho; vazio se não houver', 'string', ''), quantidade: $fromAI('quantidade', 'Quantas unidades tirar; 0 para tirar o item inteiro', 'number', 0) }) }}") }
    },
    credentials: neonCred,
    position: [1600,700]
  }
});

const limparCarrinho = tool({
  type: 'n8n-nodes-base.postgresTool',
  version: 2.6,
  config: {
    name: "limpar_carrinho",
    parameters: {
      descriptionType: 'manual',
      toolDescription: "Esvazia o carrinho do cliente. Use só quando o cliente pedir para recomeçar ou desistir do pedido.",
      operation: 'executeQuery',
      query: "select atendimento.limpar_carrinho($1) as resultado",
      options: { queryReplacement: expr("{{ $(\"Normalizar Mensagem\").item.json.telefone_whatsapp }}") }
    },
    credentials: neonCred,
    position: [1740,700]
  }
});

const fecharPedido = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'fechar_pedido',
    parameters: {
      description: 'Registra o pedido de delivery com os itens do carrinho no sistema do restaurante (aparece no painel da equipe) e esvazia o carrinho. Use SOMENTE depois que o cliente confirmou o resumo com um SIM. Os preços são recalculados pelo sistema. Retorna ok=true com pedido.valor_total e pedido.tracking_url, ou ok=false com erro.',
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'enxN9gBa9tyRuZG9', cachedResultName: 'Nosso Bistrô / Fechar pedido (tool)' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          telefone: expr("{{ $(\"Normalizar Mensagem\").item.json.telefone_whatsapp }}"),
          nome_cliente: expr("{{ $fromAI('nome_cliente', 'Nome do cliente', 'string') }}"),
          endereco: expr("{{ $fromAI('endereco', 'Rua e número', 'string') }}"),
          bairro: expr("{{ $fromAI('bairro', 'Bairro exatamente como na lista de bairros atendidos', 'string') }}"),
          complemento: expr("{{ $fromAI('complemento', 'Complemento ou ponto de referência; vazio se não houver', 'string', '') }}"),
          observacoes: expr("{{ $fromAI('observacoes', 'Observações do pedido; vazio se não houver', 'string', '') }}"),
          forma_pagamento: expr("{{ $fromAI('forma_pagamento', 'Uma de: pix, cartao_debito, cartao_credito', 'string') }}")
        },
        matchingColumns: [],
        schema: [
          { id: 'telefone', displayName: 'telefone', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'nome_cliente', displayName: 'nome_cliente', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'endereco', displayName: 'endereco', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'bairro', displayName: 'bairro', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'complemento', displayName: 'complemento', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'observacoes', displayName: 'observacoes', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'forma_pagamento', displayName: 'forma_pagamento', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }
        ],
        attemptToConvertTypes: false,
        convertFieldsToString: false
      }
    },
    position: [1880, 700]
  }
});

const SYSTEM = "Você é o atendente virtual do *Nosso Bistrô Café* (Ilhéus - BA) no WhatsApp: tortas, salgados, cafés, bolos caseiros, doces, sorvetes e bebidas.\nFale em português do Brasil como um atendente simpático e prático. Mensagens curtas, no estilo WhatsApp: *negrito* com um asterisco, listas com \"1.\", \"2.\", sem títulos com # e sem tabelas. No máximo 1 ou 2 emojis por mensagem.\n\n## Verdade dos dados\n- Produtos, preços, opções, carrinho e taxas vêm SÓ das ferramentas e do contexto enviado em cada mensagem. Nunca invente produto, sabor, preço, prazo ou taxa.\n- Itens com \"(a confirmar)\" no nome existem, mas avise com naturalidade que o nome/sabor exato será confirmado pela equipe.\n- Nunca mostre produto_id, tamanho_codigo nem JSON ao cliente. Use esses códigos só nas ferramentas.\n\n## Cardápio\n- Pedido de cardápio geral: use listar_categorias e pergunte qual categoria o cliente quer ver. Não despeje o cardápio inteiro.\n- Produto específico: use buscar_cardapio com o termo. Se vier vazio, tente um termo mais simples (ex.: \"cappuccino alpino\" -> \"cappuccino\") antes de dizer que não tem.\n- Categoria: buscar_cardapio com termo vazio e a categoria.\n- Se total_encontrado for maior que os produtos mostrados, diga que há mais opções e peça um filtro.\n- Ao listar, numere e mostre nome e preço (R$ 0,00). Produto com opcoes: mostre as opções com preço e pergunte qual o cliente quer.\n\n## Carrinho\n- Quando o cliente escolher algo, use adicionar_item (com tamanho_codigo se o produto tiver opções). Se a quantidade não foi dita, pergunte quantas unidades antes de adicionar.\n- Depois de adicionar, confirme em uma linha o que entrou e o subtotal, e pergunte se deseja mais alguma coisa.\n- Para trocar ou tirar itens use remover_item; para ver o pedido use ver_carrinho. Só use limpar_carrinho se o cliente pedir para recomeçar.\n\n## Fechando o pedido (delivery)\n1. Confira no contexto se a loja está aberta (loja.aberta_agora). Se estiver fechada, diga loja.mensagem_fechado; o cliente pode montar o carrinho, mas não registre o pedido.\n2. Colete: nome, endereço (rua e número), bairro, complemento (opcional), forma de pagamento e observações (opcional). Não peça telefone: já temos o do WhatsApp.\n3. Só entregamos nos bairros da lista \"bairros\" do contexto, com a taxa de cada um. Fora da lista: diga que ainda não entregamos lá. Se a lista estiver vazia, diga que o delivery está indisponível no momento.\n4. Pagamento: só Pix, cartão de débito ou cartão de crédito, pagos na entrega. Não aceitamos dinheiro e não há troco. Na ferramenta use pix, cartao_debito ou cartao_credito.\n5. Mostre o RESUMO: itens com quantidade e valor, subtotal, taxa de entrega do bairro, total, endereço e forma de pagamento. Pergunte: \"Posso confirmar o pedido?\"\n6. Só chame fechar_pedido depois de um SIM claro ao resumo. Nunca chame duas vezes para o mesmo pedido.\n7. Com ok=true: agradeça, informe o *total* de pedido.valor_total (é o oficial) e envie o link pedido.tracking_url para acompanhar. Com ok=false: explique o erro com suas palavras e ajude a corrigir.\n\n## Limites\n- Este canal é só para delivery. Para comer no local, o cliente faz o pedido pelo QR code da mesa.\n- Cancelar ou alterar pedido já registrado, reclamações ou qualquer assunto que você não resolva: peça para falar com a equipe no WhatsApp (73) 99804-0470.\n- Não fale de assuntos fora do restaurante.";

const atendente = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Atendente Nosso Bistrô',
    parameters: {
      promptType: 'define',
      text: expr(
        "Agora: {{ $now.setZone(\"America/Bahia\").toFormat(\"cccc, dd/MM/yyyy HH:mm\", { locale: \"pt-BR\" }) }} (horário da Bahia)\nCliente: {{ $(\"Normalizar Mensagem\").item.json.nome_cliente || \"não informado\" }}\nLoja: {{ JSON.stringify($json.contexto.loja) }}\nBairros atendidos (bairro e taxa): {{ JSON.stringify($json.contexto.bairros) }}\nCarrinho atual: {{ JSON.stringify($json.contexto.carrinho) }}\n\nMensagem do cliente: {{ $(\"Normalizar Mensagem\").item.json.mensagem }}"
      ),
      options: { systemMessage: SYSTEM, maxIterations: 12 }
    },
    subnodes: {
      model: modelo,
      memory: memoria,
      tools: [listarCategorias, buscarCardapio, verCarrinho, adicionarItem, removerItem, limparCarrinho, fecharPedido]
    },
    position: [960, 380]
  },
  output: [{ output: 'Oi, Maria! Temos tortas, salgados, cafés... Qual categoria você quer ver?' }]
});

const veioDoWhatsapp = ifElse({
  version: 2.2,
  config: {
    name: 'Veio do WhatsApp?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr('{{ $("Normalizar Mensagem").item.json.origem }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'whatsapp' }],
        combinator: 'and'
      }
    },
    position: [1320, 380]
  }
});

const enviarTexto = node({
  type: 'n8n-nodes-evolution-api.evolutionApi',
  version: 1,
  config: {
    name: 'Enviar resposta (Evolution)',
    parameters: {
      resource: 'messages-api',
      operation: 'send-text',
      instanceName: expr('{{ $("Normalizar Mensagem").item.json.instance_name }}'),
      remoteJid: expr('{{ $("Normalizar Mensagem").item.json.telefone_whatsapp }}'),
      messageText: expr('{{ $("Atendente Nosso Bistrô").item.json.output }}'),
      options_message: {}
    },
    credentials: { evolutionApi: newCredential('Evolution Nosso Bistrô') },
    position: [1560, 300]
  },
  output: [{ key: { id: 'abc' } }]
});

const notaGeral = sticky(
  "## Nosso Bistrô / Atendimento WhatsApp\nMesma estrutura do *Doces Sonhos / WhatsApp ChatGPT*: Evolution → normalizar → filtro → contexto → agente → resposta.\n\n**Dados**: Neon `nosso-bistro-cafe`, branch *production*, schema `atendimento` (migration `005_atendimento_whatsapp.sql`). O usuário `n8n_atendimento` só executa essas funções.\n**Pedido**: a ferramenta `fechar_pedido` chama o workflow *Nosso Bistrô / Fechar pedido (tool)*, que registra pela API do site.\n\n**Antes de publicar**: credencial Postgres *Neon Nosso Bistrô (atendimento)* em todos os nodes Postgres, credencial OpenAI e credencial/instância Evolution do número do bistrô. Aponte o webhook da instância para `/webhook/nossobistro-whatsapp` (evento MESSAGES_UPSERT).\n\n**Chat de teste**: usa o telefone fictício 5573000000000. Um pedido confirmado no teste entra de verdade no painel.",
  [],
  { position: [0, -40], width: 700, height: 320 }
);

export default workflow('nosso-bistro-atendimento', 'Nosso Bistrô / Atendimento WhatsApp')
  .add(notaGeral)
  .add(webhookEvolution)
  .to(normalizar)
  .add(chatTeste)
  .to(normalizar)
  .add(normalizar)
  .to(ehCliente.onTrue(contexto.to(atendente.to(veioDoWhatsapp.onTrue(enviarTexto)))));
