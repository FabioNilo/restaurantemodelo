import webpush from 'web-push';
import { z } from 'zod';
import { optionalEnv } from './env.js';
import { query } from './db.js';

// Notificações push do painel (PWA do admin): avisam a equipe de pedido novo
// com o app fechado ou a tela bloqueada. Chaves VAPID nas variáveis
// VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT; sem elas o recurso fica
// desligado e os pedidos continuam funcionando normalmente.

// Teto de espera: na Vercel a função termina com a resposta, então o envio
// precisa acabar antes. Se o serviço de push demorar, o pedido não espera mais que isso.
const LIMITE_ENVIO_MS = 2500;

export const inscricaoSchema = z.object({
  endpoint: z.string().url().max(2000).startsWith('https://'),
  keys: z.object({ p256dh: z.string().min(10).max(300), auth: z.string().min(10).max(100) }),
  user_agent: z.string().max(300).nullish(),
});

export const removerInscricaoSchema = z.object({ endpoint: z.string().url().max(2000) });

export interface AvisoPush {
  titulo: string;
  corpo: string;
  /** Caminho aberto ao tocar na notificação (ex.: /admin/delivery). */
  url: string;
  /** Notificações com a mesma tag se substituem. */
  tag: string;
}

function chaves() {
  const publica = optionalEnv('VAPID_PUBLIC_KEY');
  const privada = optionalEnv('VAPID_PRIVATE_KEY');
  const assunto = optionalEnv('VAPID_SUBJECT') ?? 'https://nossobistro.vercel.app';
  return publica && privada ? { publica, privada, assunto } : null;
}

export function chavePublicaPush() {
  return chaves()?.publica ?? null;
}

export async function salvarInscricao(usuarioId: string, input: z.infer<typeof inscricaoSchema>) {
  // O mesmo aparelho pode trocar de usuário: o endpoint é único e passa a valer para quem ativou por último.
  await query(
    `insert into push_subscriptions (usuario_id, endpoint, p256dh, auth, user_agent)
     values ($1, $2, $3, $4, $5)
     on conflict (endpoint) do update
       set usuario_id = excluded.usuario_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent`,
    [usuarioId, input.endpoint, input.keys.p256dh, input.keys.auth, input.user_agent ?? null]
  );
  return { ativo: true };
}

export async function removerInscricao(usuarioId: string, endpoint: string) {
  await query('delete from push_subscriptions where endpoint = $1 and usuario_id = $2', [endpoint, usuarioId]);
  return { ativo: false };
}

interface InscricaoRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function enviar(inscricoes: InscricaoRow[], aviso: AvisoPush) {
  const k = chaves();

  if (!k || inscricoes.length === 0) {
    return { enviados: 0, removidos: 0 };
  }

  webpush.setVapidDetails(k.assunto, k.publica, k.privada);
  const payload = JSON.stringify({ title: aviso.titulo, body: aviso.corpo, url: aviso.url, tag: aviso.tag });
  const expiradas: string[] = [];
  let enviados = 0;

  await Promise.all(
    inscricoes.map(async (inscricao) => {
      try {
        await webpush.sendNotification(
          { endpoint: inscricao.endpoint, keys: { p256dh: inscricao.p256dh, auth: inscricao.auth } },
          payload,
          { TTL: 3600, urgency: 'high' }
        );
        enviados += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;

        // 404/410: o aparelho cancelou ou a inscrição expirou. Apaga para não tentar de novo.
        if (status === 404 || status === 410) {
          expiradas.push(inscricao.id);
        } else {
          console.warn('Falha ao enviar push:', status ?? (error as Error).message);
        }
      }
    })
  );

  if (expiradas.length > 0) {
    await query('delete from push_subscriptions where id = any($1::uuid[])', [expiradas]).catch(() => undefined);
  }

  return { enviados, removidos: expiradas.length };
}

// Pedido novo: avisa todos os aparelhos inscritos. Nunca lança erro e nunca
// espera mais que LIMITE_ENVIO_MS: o pedido do cliente não pode falhar por causa do push.
export async function avisarPedidoNovo(aviso: AvisoPush) {
  if (!chaves()) {
    return;
  }

  try {
    const envio = query<InscricaoRow>(
      `select s.id, s.endpoint, s.p256dh, s.auth
         from push_subscriptions s
         join usuarios_admin u on u.id = s.usuario_id`
    ).then((inscricoes) => enviar(inscricoes, aviso));

    await Promise.race([envio, new Promise((resolve) => setTimeout(resolve, LIMITE_ENVIO_MS))]);
  } catch (error) {
    console.warn('Falha ao avisar pedido novo por push:', (error as Error).message);
  }
}

// "Enviar teste": só para os aparelhos do próprio usuário.
export async function enviarTeste(usuarioId: string) {
  if (!chaves()) {
    return { enviados: 0, removidos: 0 };
  }

  const inscricoes = await query<InscricaoRow>('select id, endpoint, p256dh, auth from push_subscriptions where usuario_id = $1', [usuarioId]);

  return enviar(inscricoes, {
    titulo: 'Notificações ativadas',
    corpo: 'Você será avisado quando chegar um pedido novo.',
    url: '/admin/mesas',
    tag: 'teste-push',
  });
}
