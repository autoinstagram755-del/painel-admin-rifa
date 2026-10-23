/**
 * Regras de negócio, cálculos de cotas e validações para a Ação Solidária
 */

export interface ComboItem {
  id: string;
  nome: string;
  subtitulo: string;
  cotas: number;
  valor: number;
  popular?: boolean;
  destaqueBadge?: string;
  economiaTexto?: string;
}

export const COMBOS_DISPONIVEIS: ComboItem[] = [
  {
    id: 'individual',
    nome: '1 Cota',
    subtitulo: 'Semente Individual',
    cotas: 1,
    valor: 20.0,
  },
  {
    id: 'missao',
    nome: 'Combo Missão (3 Cotas)',
    subtitulo: 'Apoio em Grupo',
    cotas: 3,
    valor: 50.0,
    popular: true,
    destaqueBadge: 'Mais Escolhido',
    economiaTexto: 'Economize R$ 10',
  },
  {
    id: 'lideranca',
    nome: 'Cota Liderança (7 Cotas)',
    subtitulo: 'Passo Firme',
    cotas: 7,
    valor: 100.0,
    destaqueBadge: 'Super Desconto',
    economiaTexto: 'Economize R$ 40',
  },
  {
    id: 'patrocinador',
    nome: 'Cota Patrocinador (15 Cotas)',
    subtitulo: 'Semeador Generoso',
    cotas: 15,
    valor: 200.0,
    destaqueBadge: 'Maior Chance',
    economiaTexto: 'Economize R$ 100',
  },
];

export const PRECO_UNITARIO_COTA = 20.0;
export const TOTAL_COTAS = 500;
export const META_VALOR_TOTAL = 8500.0; // Meta estipulada para cobrir despesas de guincho, retífica, hospedagem emergencial e locação

/**
 * Calcula o valor total com base na quantidade de cotas
 * Se corresponder exatamente a um combo, usa o valor com desconto do combo.
 * Caso contrário, aplica a tabela proporcional mais vantajosa.
 */
export function calcularValorTotal(quantidade: number): number {
  if (quantidade <= 0) return 0;

  // Busca se bate exatamente em algum combo
  const comboExato = COMBOS_DISPONIVEIS.find((c) => c.cotas === quantidade);
  if (comboExato) {
    return comboExato.valor;
  }

  // Se for maior ou intermediário, calcula combinando os melhores pacotes
  let rem = quantidade;
  let total = 0;

  const combosOrdenados = [...COMBOS_DISPONIVEIS].sort((a, b) => b.cotas - a.cotas);

  for (const combo of combosOrdenados) {
    if (rem >= combo.cotas) {
      const qtdCombos = Math.floor(rem / combo.cotas);
      total += qtdCombos * combo.valor;
      rem = rem % combo.cotas;
    }
  }

  if (rem > 0) {
    total += rem * PRECO_UNITARIO_COTA;
  }

  return Number(total.toFixed(2));
}

/**
 * Formata um valor numérico para Moeda Real Brasileiro
 */
export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

/**
 * Formata número de cota para 3 dígitos: 7 -> "007", 45 -> "045"
 */
export function formatarNumeroCota(numero: number): string {
  return String(numero).padStart(3, '0');
}

/**
 * Aplica máscara de CPF: 000.000.000-00
 */
export function mascararCPF(valor: string): string {
  const digits = valor.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

/**
 * Aplica máscara de WhatsApp: (00) 00000-0000 ou (00) 0000-0000
 */
export function mascararWhatsApp(valor: string): string {
  const digits = valor.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

/**
 * Validação dos dígitos verificadores do CPF
 */
export function validarCPF(cpf: string): boolean {
  const limpo = cpf.replace(/\D/g, '');
  if (limpo.length !== 11) return false;
  // Rejeita sequências repetidas como 11111111111
  if (/^(\d)\1{10}$/.test(limpo)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(limpo.charAt(i), 10) * (10 - i);
  }
  let resto = 11 - (soma % 11);
  const digito1 = resto >= 10 ? 0 : resto;
  if (digito1 !== parseInt(limpo.charAt(9), 10)) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(limpo.charAt(i), 10) * (11 - i);
  }
  resto = 11 - (soma % 11);
  const digito2 = resto >= 10 ? 0 : resto;
  return digito2 === parseInt(limpo.charAt(10), 10);
}

/**
 * Validação básica de telefone/WhatsApp brasileiro (10 ou 11 dígitos)
 */
export function validarWhatsApp(telefone: string): boolean {
  const limpo = telefone.replace(/\D/g, '');
  return limpo.length === 10 || limpo.length === 11;
}

export interface EstatisticasCotas {
  total: number;
  pagas: number;
  reservadas: number;
  disponiveis: number;
  percentualPago: number;
  valorArrecadado: number;
  percentualMeta: number;
}

export function calcularEstatisticas(
  cotas: Array<{ status: 'disponivel' | 'reservado' | 'pago' }>
): EstatisticasCotas {
  const total = cotas.length || TOTAL_COTAS;
  let pagas = 0;
  let reservadas = 0;
  let disponiveis = 0;

  for (const c of cotas) {
    if (c.status === 'pago') pagas++;
    else if (c.status === 'reservado') reservadas++;
    else disponiveis++;
  }

  // Estimativa de valor arrecadado (média aproximada ou valor unitário)
  const valorArrecadado = pagas * (META_VALOR_TOTAL / TOTAL_COTAS);
  const percentualPago = total > 0 ? Math.round((pagas / total) * 100) : 0;
  const percentualMeta = Math.min(100, Math.round((valorArrecadado / META_VALOR_TOTAL) * 100));

  return {
    total,
    pagas,
    reservadas,
    disponiveis,
    percentualPago,
    valorArrecadado,
    percentualMeta,
  };
}

// Configurações Oficiais do Recebedor Pix
export const CHAVE_PIX_OFICIAL = '61992274858';
export const CHAVE_PIX_FORMATADA = '(61) 99227-4858';
export const NOME_TITULAR_PIX = 'Jocimar da Silva Araujo';
export const CIDADE_PIX = 'Aguas Lindas';

/**
 * Calcula o checksum CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF)
 * exigido pelo padrão BR Code do Banco Central do Brasil para o Pix
 */
export function calcularCRC16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Formata um campo no padrão EMV (Tag + Tamanho de 2 dígitos + Valor)
 */
function emvField(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  return id + len + value;
}

/**
 * Gera o payload oficial do Pix Copia e Cola (BR Code)
 * Válido em qualquer banco brasileiro
 */
export function gerarPixBacen(
  chave: string = CHAVE_PIX_OFICIAL,
  nome: string = NOME_TITULAR_PIX,
  cidade: string = CIDADE_PIX,
  valor?: number,
  txid: string = '***'
): string {
  const nomeLimpo = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .slice(0, 25);
  const cidadeLimpa = cidade
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .slice(0, 15);

  let chaveFormatada = chave.trim();
  // Se for telefone celular brasileiro (10 ou 11 dígitos), formata para o padrão internacional +55...
  if (/^\d{10,11}$/.test(chaveFormatada)) {
    chaveFormatada = '+55' + chaveFormatada;
  }

  const gui = emvField('00', 'br.gov.bcb.pix');
  const key = emvField('01', chaveFormatada);
  const merchantAccount = emvField('26', gui + key);

  let payload =
    emvField('00', '01') +
    merchantAccount +
    emvField('52', '0000') +
    emvField('53', '986');

  if (valor && valor > 0) {
    payload += emvField('54', Number(valor).toFixed(2));
  }

  payload +=
    emvField('58', 'BR') +
    emvField('59', nomeLimpo) +
    emvField('60', cidadeLimpa);

  const additionalData = emvField('05', txid || '***');
  payload += emvField('62', additionalData);
  payload += '6304';

  const crc = calcularCRC16(payload);
  return payload + crc;
}

// WhatsApp oficial para suporte e dúvidas
export const WHATSAPP_DUVIDAS = '5561991736136';
export const WHATSAPP_DUVIDAS_FORMATADO = '(61) 99173-6136';
export const WHATSAPP_SUPORTE_NUMERO = WHATSAPP_DUVIDAS;

// Tempo máximo de reserva antes da liberação automática: 3 horas
export const TEMPO_EXPIRACAO_RESERVA_HORAS = 3;
export const TEMPO_EXPIRACAO_RESERVA_MS = 3 * 60 * 60 * 1000; // 10.800.000 ms

export interface DadosLembreteWhatsapp {
  nome: string;
  cotas: number[];
  valor: number;
  tipo: '1_hora' | '15_minutos' | 'expirado';
  pixCopiaECola?: string;
}

/**
 * Gera mensagem fraterna para WhatsApp reforçando a ação solidária missionária
 * Usada nos lembretes de 1 hora e de 15 minutos restantes
 */
export function gerarMensagemLembreteWhatsapp(dados: DadosLembreteWhatsapp): string {
  const primeiroNome = dados.nome.trim().split(' ')[0] || dados.nome.trim();
  const cotasTexto = dados.cotas.map((n) => formatarNumeroCota(n)).join(', ');
  const valorTexto = formatarMoeda(dados.valor);

  if (dados.tipo === '1_hora') {
    return (
      `Olá, ${primeiroNome}! A paz do Senhor! 🙏✨\n\n` +
      `Passando com muito carinho para agradecer pelo seu apoio à *Ação Solidária: Missão & Cooperação* em prol do Pr. Jocimar Araújo e Pra. Ana Cristina.\n\n` +
      `📌 *Seus Números Reservados:* ${cotasTexto}\n` +
      `💰 *Valor Total:* ${valorTexto}\n\n` +
      `Esta ação é fundamental para quitarmos as despesas urgentes de transporte missionário e mantermos a obra avançando.\n\n` +
      `Notamos que o pagamento Pix ainda está pendente. Lembrando que o sistema mantém as cotas reservadas por *3 horas*. Você ainda tem tempo para garantir sua participação!\n\n` +
      (dados.pixCopiaECola ? `🔑 *Pix Copia e Cola:*\n\`${dados.pixCopiaECola}\`\n\n` : '') +
      `Qualquer dúvida, estamos à inteira disposição no WhatsApp (61) 99173-6136. Deus abençoe abundantemente!`
    );
  }

  if (dados.tipo === '15_minutos') {
    return (
      `Olá, ${primeiroNome}! A paz do Senhor! ⏳⚠️\n\n` +
      `Passando para avisar que faltam apenas *15 minutos* para completar o prazo de 3 horas da sua reserva na *Ação Solidária: Missão & Cooperação*.\n\n` +
      `📌 *Cotas Reservadas:* ${cotasTexto} (${valorTexto})\n\n` +
      `Como o sistema é automático, se o Pix não for concluído nesses próximos 15 minutos, esses números voltarão a ficar disponíveis na grade para outros irmãos cooperadores.\n\n` +
      `Seu apoio é uma grande bênção para a quitação do veículo missionário do Pr. Jocimar!\n\n` +
      (dados.pixCopiaECola ? `🔑 *Pix Copia e Cola para pagamento rápido:*\n\`${dados.pixCopiaECola}\`\n\n` : '') +
      `Caso já tenha feito, por favor desconsidere este aviso. Um abraço fraterno!`
    );
  }

  return (
    `Olá, ${primeiroNome}! A paz do Senhor!\n\n` +
    `Informamos que o prazo de 3 horas para as cotas (${cotasTexto}) da Ação Solidária expirou e os números foram liberados no sistema. Caso ainda queira participar, você pode acessar novamente e escolher novas cotas!\n\n` +
    `Deus te abençoe!`
  );
}


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

Se você ainda tem intenção de confirmar sua participação através do valor de *${formatarMoeda(params.valor)}*, pedimos gentilmente que envie o comprovante Pix agora mesmo.

📌 *Chave Pix:* *61991736136* (Jocimar Silva)

Caso já tenha pago ou não queira mais as cotas, desconsidere esta mensagem. Deus abençoe!`;
}

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

export const TEMPO_AVISO_1_MS = 1 * 60 * 60 * 1000;
export const TEMPO_AVISO_2_MS = (3 * 60 - 15) * 60 * 1000;

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
    estagio = 'aviso_15min';
  } else if (decorridoMs >= TEMPO_AVISO_1_MS) {
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
