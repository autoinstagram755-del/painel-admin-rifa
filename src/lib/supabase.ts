import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TOTAL_COTAS, calcularValorTotal, TEMPO_EXPIRACAO_RESERVA_MS } from '../utils/rules.ts';

export interface Cota {
  id: string;
  numero: number;
  status: 'disponivel' | 'reservado' | 'pago';
  pedido_id: string | null;
  updated_at?: string;
}

export interface Pedido {
  id: string;
  nome_comprador: string;
  whatsapp: string;
  cpf: string;
  valor_total: number;
  quantidade_cotas: number;
  status_pagamento: 'pendente' | 'pago' | 'cancelado';
  transaction_id_infinitepay?: string | null;
  pix_copia_cola?: string | null;
  pix_qr_code_url?: string | null;
  created_at: string;
  updated_at?: string;
  cotas_numeros?: number[];
}

const LOCAL_STORAGE_COTAS_KEY = 'acao_solidaria_cotas_v1';
const LOCAL_STORAGE_PEDIDOS_KEY = 'acao_solidaria_pedidos_v1';
const LOCAL_STORAGE_SUPABASE_CONFIG = 'acao_solidaria_admin_supabase_cfg';

const DEFAULT_SUPABASE_URL = 'https://tnnrppcrcakipkmfedmm.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_57UbZEeDu8lqMnhj90eghQ_TL7W0Yoo';

export function getStoredSupabaseConfig(): { url: string; anonKey: string } {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  try {
    const custom = localStorage.getItem(LOCAL_STORAGE_SUPABASE_CONFIG);
    if (custom) {
      const parsed = JSON.parse(custom);
      if (parsed.url && parsed.anonKey) {
        return parsed;
      }
    }
  } catch (e) {}

  return { url: envUrl, anonKey: envKey };
}

export function saveStoredSupabaseConfig(url: string, anonKey: string): void {
  localStorage.setItem(LOCAL_STORAGE_SUPABASE_CONFIG, JSON.stringify({ url, anonKey }));
}

let cachedClient: SupabaseClient | null = null;
let lastUsedConfig = '';

export function getSupabase(): SupabaseClient | null {
  const cfg = getStoredSupabaseConfig();
  if (!cfg.url || !cfg.anonKey || cfg.url.includes('your-project') || cfg.anonKey.includes('your-anon-key')) {
    return null;
  }

  const keyString = `${cfg.url}:${cfg.anonKey}`;
  if (cachedClient && lastUsedConfig === keyString) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(cfg.url, cfg.anonKey);
    lastUsedConfig = keyString;
    return cachedClient;
  } catch (e) {
    console.error('Falha ao instanciar Supabase:', e);
    return null;
  }
}

export function isSupabaseActive(): boolean {
  return getSupabase() !== null;
}

/**
 * Cria cotas iniciais para demonstração
 */
function gerarCotasIniciais(): Cota[] {
  const cotas: Cota[] = [];
  const pagasIniciais = new Set([7, 12, 19, 33, 44, 77, 88, 100, 115, 142, 150, 200, 218, 250, 312, 333, 400, 444]);
  const reservadasIniciais = new Set([15, 52, 99, 175, 280, 410]);

  for (let i = 1; i <= TOTAL_COTAS; i++) {
    let status: 'disponivel' | 'reservado' | 'pago' = 'disponivel';
    let pedido_id: string | null = null;

    if (pagasIniciais.has(i)) {
      status = 'pago';
      pedido_id = 'seed-order-pago';
    } else if (reservadasIniciais.has(i)) {
      status = 'reservado';
      pedido_id = 'seed-order-reservado';
    }

    cotas.push({
      id: `cota-${i}`,
      numero: i,
      status,
      pedido_id,
      updated_at: new Date().toISOString(),
    });
  }
  return cotas;
}

/**
 * Carrega a lista completa de cotas
 */
export async function obterCotas(): Promise<Cota[]> {
  try {
    await verificarELiberarCotasExpiradas();
  } catch (e) {}

  const client = getSupabase();
  if (client) {
    try {
      const { data, error } = await client
        .from('cotas')
        .select('*')
        .order('numero', { ascending: true });

      if (!error && data && data.length > 0) {
        return data as Cota[];
      }
    } catch (err) {
      console.warn('Erro ao consultar Supabase cotas, usando fallback local:', err);
    }
  }

  const local = localStorage.getItem(LOCAL_STORAGE_COTAS_KEY);
  if (local) {
    try {
      return JSON.parse(local);
    } catch (e) {}
  }

  const iniciais = gerarCotasIniciais();
  localStorage.setItem(LOCAL_STORAGE_COTAS_KEY, JSON.stringify(iniciais));
  return iniciais;
}

/**
 * Carrega pedidos
 */
export async function obterPedidos(): Promise<Pedido[]> {
  try {
    await verificarELiberarCotasExpiradas();
  } catch (e) {}

  const client = getSupabase();
  if (client) {
    try {
      const { data, error } = await client
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data as Pedido[];
      }
    } catch (err) {
      console.warn('Erro ao consultar Supabase pedidos:', err);
    }
  }

  const local = localStorage.getItem(LOCAL_STORAGE_PEDIDOS_KEY);
  if (local) {
    try {
      return JSON.parse(local);
    } catch (e) {}
  }

  return [];
}

/**
 * Atualiza status de um pedido e suas cotas associadas
 */
export async function atualizarStatusPedido(
  pedidoId: string,
  novoStatus: 'pago' | 'cancelado' | 'pendente'
): Promise<boolean> {
  const client = getSupabase();
  if (client) {
    try {
      await client
        .from('pedidos')
        .update({ status_pagamento: novoStatus })
        .eq('id', pedidoId);

      if (novoStatus === 'pago') {
        await client
          .from('cotas')
          .update({ status: 'pago' })
          .eq('pedido_id', pedidoId);
      } else if (novoStatus === 'cancelado') {
        await client
          .from('cotas')
          .update({ status: 'disponivel', pedido_id: null })
          .eq('pedido_id', pedidoId);
      }
    } catch (e) {
      console.error('Erro ao atualizar status no Supabase:', e);
    }
  }

  // Sincroniza localmente
  const localPedidos = localStorage.getItem(LOCAL_STORAGE_PEDIDOS_KEY);
  if (localPedidos) {
    try {
      const lista: Pedido[] = JSON.parse(localPedidos);
      const target = lista.find((p) => p.id === pedidoId);
      if (target) {
        target.status_pagamento = novoStatus;
        localStorage.setItem(LOCAL_STORAGE_PEDIDOS_KEY, JSON.stringify(lista));
      }
    } catch (e) {}
  }

  const localCotas = localStorage.getItem(LOCAL_STORAGE_COTAS_KEY);
  if (localCotas) {
    try {
      const cotas: Cota[] = JSON.parse(localCotas);
      let alterou = false;
      for (const c of cotas) {
        if (c.pedido_id === pedidoId) {
          alterou = true;
          if (novoStatus === 'pago') {
            c.status = 'pago';
          } else if (novoStatus === 'cancelado') {
            c.status = 'disponivel';
            c.pedido_id = null;
          }
        }
      }
      if (alterou) {
        localStorage.setItem(LOCAL_STORAGE_COTAS_KEY, JSON.stringify(cotas));
      }
    } catch (e) {}
  }

  return true;
}

/**
 * Cria venda manual para pagamentos em dinheiro, maquininha ou Pix avulso
 */
export async function criarPedidoManualAdmin(params: {
  nome: string;
  whatsapp: string;
  cpf?: string;
  cotasNumeros: number[];
  formaPagamento: 'dinheiro' | 'pix_direto' | 'maquininha';
}): Promise<{ success: boolean; pedidoId: string; error?: string }> {
  const pedidoId = crypto.randomUUID();
  const qtd = params.cotasNumeros.length;
  const valorTotal = calcularValorTotal(qtd);
  const now = new Date().toISOString();

  const novoPedido: Pedido = {
    id: pedidoId,
    nome_comprador: params.nome.trim(),
    whatsapp: params.whatsapp.trim(),
    cpf: params.cpf ? params.cpf.replace(/\D/g, '') : 'MANUAL_SEM_CPF',
    valor_total: valorTotal,
    quantidade_cotas: qtd,
    status_pagamento: 'pago',
    transaction_id_infinitepay: `MANUAL_${params.formaPagamento.toUpperCase()}`,
    cotas_numeros: params.cotasNumeros,
    created_at: now,
    
  };

  const client = getSupabase();
  if (client) {
    try {
      const { error: errPed } = await client.from('pedidos').insert({
        id: pedidoId,
        nome_comprador: novoPedido.nome_comprador,
        whatsapp: novoPedido.whatsapp,
        cpf: novoPedido.cpf,
        valor_total: valorTotal,
        quantidade_cotas: qtd,
        status_pagamento: 'pago',
        transaction_id_infinitepay: novoPedido.transaction_id_infinitepay,
        created_at: now,
        
      });

      if (!errPed) {
        await client
          .from('cotas')
          .update({
            status: 'pago',
            pedido_id: pedidoId,
            
          })
          .in('numero', params.cotasNumeros);
      }
    } catch (e) {
      console.warn('Erro ao persistir pedido manual no Supabase:', e);
    }
  }

  // Local fallback
  const localPedidos = localStorage.getItem(LOCAL_STORAGE_PEDIDOS_KEY);
  let listaPedidos: Pedido[] = localPedidos ? JSON.parse(localPedidos) : [];
  listaPedidos.unshift(novoPedido);
  localStorage.setItem(LOCAL_STORAGE_PEDIDOS_KEY, JSON.stringify(listaPedidos));

  const localCotas = localStorage.getItem(LOCAL_STORAGE_COTAS_KEY);
  if (localCotas) {
    const cotas: Cota[] = JSON.parse(localCotas);
    const setNumeros = new Set(params.cotasNumeros);
    for (const c of cotas) {
      if (setNumeros.has(c.numero)) {
        c.status = 'pago';
        c.pedido_id = pedidoId;
        c.updated_at = now;
      }
    }
    localStorage.setItem(LOCAL_STORAGE_COTAS_KEY, JSON.stringify(cotas));
  }

  return { success: true, pedidoId };
}

/**
 * Libera reservas pendentes que ultrapassaram o prazo de 3 horas
 */
export async function verificarELiberarCotasExpiradas(): Promise<{ pedidosCancelados: number; cotasLiberadas: number }> {
  const agora = Date.now();
  let pedidosCancelados = 0;
  let cotasLiberadas = 0;

  const client = getSupabase();
  if (client) {
    try {
      const limiteExpiracaoIso = new Date(agora - TEMPO_EXPIRACAO_RESERVA_MS).toISOString();
      const { data: expirados, error } = await client
        .from('pedidos')
        .select('id')
        .eq('status_pagamento', 'pendente')
        .lt('created_at', limiteExpiracaoIso);

      if (!error && expirados && expirados.length > 0) {
        const ids = expirados.map((p) => p.id);
        pedidosCancelados += ids.length;

        await client
          .from('pedidos')
          .update({ status_pagamento: 'cancelado' })
          .in('id', ids);

        const { data: cotasLiberadasDb } = await client
          .from('cotas')
          .update({ status: 'disponivel', pedido_id: null })
          .in('pedido_id', ids)
          .select('numero');

        if (cotasLiberadasDb) {
          cotasLiberadas += cotasLiberadasDb.length;
        }

        // Limpeza de cotas com status 'reservado' que ficaram orfãs
        await client
          .from('cotas')
          .update({ status: 'disponivel', pedido_id: null })
          .eq('status', 'reservado')
          .is('pedido_id', null);
      }
    } catch (e) {
      console.warn('Erro ao expirar reservas no Supabase:', e);
    }
  }

  // Fallback local
  const localPedidos = localStorage.getItem(LOCAL_STORAGE_PEDIDOS_KEY);
  const localCotas = localStorage.getItem(LOCAL_STORAGE_COTAS_KEY);

  if (localPedidos && localCotas) {
    try {
      const listaPedidos: Pedido[] = JSON.parse(localPedidos);
      const listaCotas: Cota[] = JSON.parse(localCotas);
      const idsCancelados = new Set<string>();

      for (const ped of listaPedidos) {
        if (ped.status_pagamento === 'pendente') {
          const tempoCriacao = new Date(ped.created_at).getTime();
          if (agora - tempoCriacao >= TEMPO_EXPIRACAO_RESERVA_MS) {
            ped.status_pagamento = 'cancelado';
            idsCancelados.add(ped.id);
            pedidosCancelados++;
          }
        }
      }

      if (idsCancelados.size > 0) {
        for (const c of listaCotas) {
          if (c.pedido_id && idsCancelados.has(c.pedido_id) && c.status === 'reservado') {
            c.status = 'disponivel';
            c.pedido_id = null;
            c.updated_at = new Date().toISOString();
            cotasLiberadas++;
          }
        }
        localStorage.setItem(LOCAL_STORAGE_PEDIDOS_KEY, JSON.stringify(listaPedidos));
        localStorage.setItem(LOCAL_STORAGE_COTAS_KEY, JSON.stringify(listaCotas));
      }
    } catch (e) {}
  }

  return { pedidosCancelados, cotasLiberadas };
}
