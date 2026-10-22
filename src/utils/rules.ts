export const TOTAL_COTAS = 500;
export const VALOR_UNITARIO_COTA = 20;

// Tempo de expiração de reservas: 3 horas (em milissegundos)
export const TEMPO_EXPIRACAO_RESERVA_MS = 3 * 60 * 60 * 1000;
// Aviso 1: 1 hora decorrida (2 horas restantes)
export const TEMPO_AVISO_1_MS = 1 * 60 * 60 * 1000;
// Aviso 2: Faltando 15 minutos para 3 horas (2h45m decorridas)
export const TEMPO_AVISO_2_MS = (3 * 60 - 15) * 60 * 1000;

export interface ComboItem {
  cotas: number;
  valor: number;
  desconto: string;
  popular?: boolean;
}

export const COMBOS_DISPONIVEIS: ComboItem[] = [
  { cotas: 1, valor: 20, desconto: 'Preço padrão' },
  { cotas: 3, valor: 50, desconto: 'Economize R$ 10', popular: true },
  { cotas: 5, valor: 80, desconto: 'Economize R$ 20' },
  { cotas: 10, valor: 150, desconto: 'Economize R$ 50', popular: true },
  { cotas: 20, valor: 280, desconto: 'Economize R$ 120' },
];

export function calcularValorTotal(quantidade: number): number {
  if (quantidade <= 0) return 0;
  if (quantidade === 1) return 20;
  if (quantidade === 3) return 50;
  if (quantidade === 5) return 80;
  if (quantidade === 10) return 150;
  if (quantidade === 20) return 280;

  // Se múltiplos ou valores avulsos
  if (quantidade % 20 === 0) return (quantidade / 20) * 280;
  if (quantidade % 10 === 0) return (quantidade / 10) * 150;
  if (quantidade % 5 === 0) return (quantidade / 5) * 80;
  if (quantidade % 3 === 0) return (quantidade / 3) * 50;

  return quantidade * VALOR_UNITARIO_COTA;
}

export function formatarNumeroCota(numero: number): string {
  return numero.toString().padStart(3, '0');
}

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function mascararCPF(cpf: string): string {
  if (!cpf) return '---';
  const limpo = cpf.replace(/\D/g, '');
  if (limpo.length !== 11) return cpf;
  return `${limpo.slice(0, 3)}.***.***-${limpo.slice(9)}`;
}

export function mascararWhatsApp(numero: string): string {
  if (!numero) return '---';
  const limpo = numero.replace(/\D/g, '');
  if (limpo.length === 11) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
  }
  return numero;
}

export interface StatusTempoReserva {
  decorridoMs: number;
  restanteMs: number;
  expirado: boolean;
  estagio: 'normal' | 'aviso_1hora' | 'aviso_15min' | 'expirado';
  textoRestante: string;
}

export function calcularTempoRestanteReserva(createdAt: string): StatusTempoReserva {
  const agora = Date.now();
  const criacao = new Date(createdAt).getTime();
  const decorridoMs = Math.max(0, agora - criacao);
  const restanteMs = Math.max(0, TEMPO_EXPIRACAO_RESERVA_MS - decorridoMs);
  const expirado = restanteMs <= 0;

  let estagio: 'normal' | 'aviso_1hora' | 'aviso_15min' | 'expirado' = 'normal';
  if (expirado) {
    estagio = 'expirado';
  } else if (decorridoMs >= TEMPO_AVISO_2_MS) {
    // Faltam menos de 15 minutos
    estagio = 'aviso_15min';
  } else if (decorridoMs >= TEMPO_AVISO_1_MS) {
    // Passou de 1 hora
    estagio = 'aviso_1hora';
  }

  const horas = Math.floor(restanteMs / (1000 * 60 * 60));
  const minutos = Math.floor((restanteMs % (1000 * 60 * 60)) / (1000 * 60));
  const segundos = Math.floor((restanteMs % (1000 * 60)) / 1000);

  let textoRestante = '';
  if (expirado) {
    textoRestante = 'Expirado (+3h)';
  } else if (horas > 0) {
    textoRestante = `${horas}h ${minutos}m ${segundos}s`;
  } else {
    textoRestante = `${minutos}m ${segundos}s`;
  }

  return {
    decorridoMs,
    restanteMs,
    expirado,
    estagio,
    textoRestante,
  };
}

/**
 * Mensagem amigável enviada após 1 hora da reserva
 */
export function gerarMensagemLembrete1Hora(params: {
  nome: string;
  cotas: number[];
  valor: number;
  pedidoId: string;
}): string {
  const cotasStr = params.cotas.map((n) => formatarNumeroCota(n)).join(', ');
  const primeiroNome = params.nome.trim().split(' ')[0] || 'Irmão(ã)';

  return `Olá, ${primeiroNome}! A paz do Senhor! 🙏✨

Passando para lembrar com muito carinho que suas cotas (*${cotasStr}*) da nossa *Ação Solidária Missionária* (Águas Lindas de Goiás ➔ Bertioga/SP) continuam reservadas para você no valor de *${formatarMoeda(params.valor)}*.

Essa ação tem como único objetivo o conserto do carro que transportará nossos missionários para o evento de fé Vision Day. Cada cota representa um ato concreto de cooperação com a obra! 🚗⛪

📌 *Chave Pix Oficial da Ação:*
*61991736136* (Telefone - Jocimar Silva)

Sua reserva fica garantida por mais *2 horas*. Caso já tenha efetuado o pagamento, basta me enviar o comprovante por aqui para darmos baixa no sistema!

Que Deus continue abençoando ricamente você e toda sua família! 🙌`;
}

/**
 * Mensagem enviada quando faltam 15 minutos para completar 3 horas
 */
export function gerarMensagemLembrete15Minutos(params: {
  nome: string;
  cotas: number[];
  valor: number;
}): string {
  const cotasStr = params.cotas.map((n) => formatarNumeroCota(n)).join(', ');
  const primeiroNome = params.nome.trim().split(' ')[0] || 'Irmão(ã)';

  return `⚠️ *Aviso Importante: Reserva de Cotas da Ação Missionária*

Olá, ${primeiroNome}! Esperamos que esteja bem!

Passando para avisar que faltam apenas *15 MINUTOS* para o encerramento do prazo limite de 3 horas da sua reserva das cotas (*${cotasStr}*).

Conforme as regras do sistema, após 3 horas os números não confirmados são automaticamente liberados na grade pública para que outros irmãos possam contribuir com o conserto do carro da nossa missão.

Se você deseja garantir suas cotas e apoiar nossa viagem missionária, por favor envie o comprovante Pix agora mesmo:

📌 *Chave Pix:* *61991736136* (Jocimar Silva)
Valor: *${formatarMoeda(params.valor)}*

Muito obrigado pelo carinho e apoio! Deus te abençoe! 🙏`;
}

/**
 * Mensagem de recibo e confirmação de pagamento para WhatsApp
 */
export function gerarMensagemRecibo(params: {
  nome: string;
  cotas: number[];
  valor: number;
  formaPagamento: string;
  pedidoId: string;
}): string {
  const cotasStr = params.cotas.map((n) => formatarNumeroCota(n)).join(', ');
  const primeiroNome = params.nome.trim().split(' ')[0] || 'Irmão(ã)';

  return `✅ *COMPROVANTE OFICIAL DE COTAS - AÇÃO SOLIDÁRIA MISSIONÁRIA*

Olá, ${primeiroNome}! É com imensa alegria e gratidão que confirmamos sua participação!

📋 *Dados da Sua Contribuição:*
• Comprador: *${params.nome}*
• Números da Cota: *${cotasStr}* (${params.cotas.length} cota${params.cotas.length > 1 ? 's' : ''})
• Valor Total: *${formatarMoeda(params.valor)}*
• Forma: *${params.formaPagamento}*
• Código de Registro: \`${params.pedidoId}\`

Seu apoio direto está permitindo o reparo mecânico do veículo para a missão ministerial de Águas Lindas/GO a Bertioga/SP (Vision Day).

_"Cada um contribua segundo propôs no seu coração... porque Deus ama ao que dá com alegria."_ (2 Co 9:7)

Que o Senhor multiplique bênçãos sem medida sobre sua vida! Guarde esta mensagem como seu comprovante oficial. 🙏✨`;
}
