import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  LayoutDashboard,
  Database,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Banknote,
  PlusCircle,
  Receipt,
  Send,
  AlertCircle,
  CheckCheck,
  MessageSquare,
  Bell,
  Clock3,
  ShieldCheck,
  Lock,
  LogOut,
  Sparkles,
  Info,
  DollarSign,
  HeartHandshake,
} from 'lucide-react';
import {
  Cota,
  Pedido,
  obterCotas,
  obterPedidos,
  atualizarStatusPedido,
  criarPedidoManualAdmin,
  verificarELiberarCotasExpiradas,
  getStoredSupabaseConfig,
  saveStoredSupabaseConfig,
  isSupabaseActive,
} from './lib/supabase.ts';
import { AuditLogsViewer } from './components/AuditLogsViewer.tsx';
import { registrarLogAuditoria } from './lib/auditLogs.ts';
import {
  TOTAL_COTAS,
  VALOR_UNITARIO_COTA,
  formatarMoeda,
  formatarNumeroCota,
  mascararCPF,
  mascararWhatsApp,
  calcularValorTotal,
  COMBOS_DISPONIVEIS,
  calcularTempoRestanteReserva,
  gerarMensagemLembrete1Hora,
  gerarMensagemLembrete15Minutos,
  gerarMensagemRecibo,
} from './utils/rules.ts';

const ADMIN_PIN_DEFAULT = 'missao2026';
const PIN_STORAGE_KEY = 'acao_solidaria_admin_auth_v1';

export default function App() {
  // Autenticação
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem(PIN_STORAGE_KEY) === 'true';
  });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [lembrarAcesso, setLembrarAcesso] = useState(true);

  // Estados principais
  const [abaAtiva, setAbaAtiva] = useState<'pedidos' | 'venda_manual' | 'whatsapp' | 'logs_auditoria' | 'configuracoes'>('venda_manual');
  const [cotas, setCotas] = useState<Cota[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pago' | 'pendente' | 'cancelado'>('todos');

  // Estados da Venda Manual
  const [manualNome, setManualNome] = useState('');
  const [manualWhatsapp, setManualWhatsapp] = useState('');
  const [manualCpf, setManualCpf] = useState('');
  const [manualFormaPagamento, setManualFormaPagamento] = useState<'dinheiro' | 'pix_direto' | 'maquininha'>('dinheiro');
  const [manualCotasSelecionadas, setManualCotasSelecionadas] = useState<number[]>([]);
  const [manualBuscaCota, setManualBuscaCota] = useState('');
  const [manualFaixaAtiva, setManualFaixaAtiva] = useState<'1-100' | '101-200' | '201-300' | '301-400' | '401-500' | 'todas'>('1-100');
  const [manualSalvando, setManualSalvando] = useState(false);
  const [manualErro, setManualErro] = useState<string | null>(null);
  const [manualSucesso, setManualSucesso] = useState<{
    pedidoId: string;
    nome: string;
    whatsapp: string;
    valor: number;
    cotas: number[];
  } | null>(null);

  // Estados de WhatsApp e Utilitários
  const [copiouMsgId, setCopiouMsgId] = useState<string | null>(null);
  const [copiouRecibo, setCopiouRecibo] = useState(false);
  const [executandoLimpeza, setExecutandoLimpeza] = useState(false);
  const [feedbackLimpeza, setFeedbackLimpeza] = useState<string | null>(null);

  // Configurações Supabase
  const [supabaseUrlInput, setSupabaseUrlInput] = useState('');
  const [supabaseKeyInput, setSupabaseKeyInput] = useState('');
  const [supabaseSalvoFeedback, setSupabaseSalvoFeedback] = useState(false);

  // Relógio interno para atualizar contadores a cada segundo
  const [, setTick] = useState(0);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    try {
      const [listaCotas, listaPedidos] = await Promise.all([
        obterCotas(),
        obterPedidos(),
      ]);
      setCotas(listaCotas);
      setPedidos(listaPedidos);
    } catch (e) {
      console.error('Erro ao carregar dados:', e);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      carregarDados();
      const cfg = getStoredSupabaseConfig();
      setSupabaseUrlInput(cfg.url);
      setSupabaseKeyInput(cfg.anonKey);
    }
  }, [isAuthenticated, carregarDados]);

  // Atualizador do cronômetro a cada 10 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Login handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const envPin = import.meta.env.VITE_ADMIN_PIN || ADMIN_PIN_DEFAULT;
    if (pinInput.trim() === envPin || pinInput.trim() === ADMIN_PIN_DEFAULT) {
      setIsAuthenticated(true);
      setPinError(false);
      if (lembrarAcesso) {
        localStorage.setItem(PIN_STORAGE_KEY, 'true');
      }
    } else {
      setPinError(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(PIN_STORAGE_KEY);
    setIsAuthenticated(false);
    setPinInput('');
  };

  // Métricas
  const cotasPagas = cotas.filter((c) => c.status === 'pago');
  const cotasReservadas = cotas.filter((c) => c.status === 'reservado');
  const cotasDisponiveis = cotas.filter((c) => c.status === 'disponivel');
  const pedidosPendentes = pedidos.filter((p) => p.status_pagamento === 'pendente');
  const totalArrecadado = pedidos
    .filter((p) => p.status_pagamento === 'pago')
    .reduce((acc, p) => acc + Number(p.valor_total || 0), 0);

  // Filtro de pedidos
  const pedidosFiltrados = pedidos.filter((p) => {
    if (filtroStatus !== 'todos' && p.status_pagamento !== filtroStatus) {
      return false;
    }
    if (!busca.trim()) return true;
    const termo = busca.toLowerCase();
    return (
      p.nome_comprador.toLowerCase().includes(termo) ||
      p.cpf.includes(termo) ||
      p.whatsapp.includes(termo) ||
      p.id.toLowerCase().includes(termo)
    );
  });

  const handleMarcarComoPago = async (pedidoId: string) => {
    await atualizarStatusPedido(pedidoId, 'pago');
    carregarDados();
  };

  const handleCancelarPedido = async (pedidoId: string) => {
    if (confirm('Deseja realmente cancelar este pedido e liberar as cotas reservadas imediatamente?')) {
      await atualizarStatusPedido(pedidoId, 'cancelado');
      carregarDados();
    }
  };

  const handleExecutarLimpezaManual = async () => {
    setExecutandoLimpeza(true);
    setFeedbackLimpeza(null);
    try {
      const res = await verificarELiberarCotasExpiradas();
      if (res.pedidosCancelados > 0 || res.cotasLiberadas > 0) {
        setFeedbackLimpeza(`Sucesso! ${res.pedidosCancelados} pedido(s) cancelado(s) e ${res.cotasLiberadas} cota(s) liberadas de volta para a grade pública.`);
      } else {
        setFeedbackLimpeza('Nenhuma reserva ultrapassou o limite de 3 horas neste momento.');
      }
      await carregarDados();
    } catch (e) {
      setFeedbackLimpeza('Erro ao executar verificação de expiração.');
    } finally {
      setExecutandoLimpeza(false);
      setTimeout(() => setFeedbackLimpeza(null), 7000);
    }
  };

  const handleToggleManualCota = (numero: number) => {
    const cota = cotas.find((c) => c.numero === numero);
    if (!cota || cota.status !== 'disponivel') return;

    setManualCotasSelecionadas((prev) =>
      prev.includes(numero) ? prev.filter((n) => n !== numero) : [...prev, numero].sort((a, b) => a - b)
    );
    setManualErro(null);
  };

  const handleSelectComboManual = (quantidade: number) => {
    const disponiveis = cotas.filter((c) => c.status === 'disponivel').map((c) => c.numero);
    if (disponiveis.length < quantidade) {
      setManualErro(`Apenas ${disponiveis.length} cotas disponíveis no momento.`);
      return;
    }
    const embaralhadas = [...disponiveis].sort(() => 0.5 - Math.random());
    const selecionadas = embaralhadas.slice(0, quantidade).sort((a, b) => a - b);
    setManualCotasSelecionadas(selecionadas);
    setManualErro(null);
  };

  const handleLimparManualCotas = () => {
    setManualCotasSelecionadas([]);
    setManualErro(null);
  };

  const handleLancarVendaManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualErro(null);

    if (!manualNome.trim() || manualNome.trim().length < 3) {
      setManualErro('Informe o nome completo do comprador.');
      return;
    }

    const whatsLimpo = manualWhatsapp.replace(/\D/g, '');
    if (!manualWhatsapp.trim() || whatsLimpo.length < 10) {
      setManualErro('Informe um número de WhatsApp/telefone válido com DDD.');
      return;
    }

    if (manualCotasSelecionadas.length === 0) {
      setManualErro('Selecione pelo menos uma cota na tabela abaixo ou use os botões de Combo Promocional.');
      return;
    }

    // Verificar se alguma cota selecionada já foi ocupada
    const ocupadas = cotas.filter((c) => manualCotasSelecionadas.includes(c.numero) && c.status !== 'disponivel');
    if (ocupadas.length > 0) {
      const strOcupadas = ocupadas.map((c) => '#' + formatarNumeroCota(c.numero)).join(', ');
      setManualErro(`As seguintes cotas não estão disponíveis: ${strOcupadas}. Por favor desmarque-as.`);
      return;
    }

    const selecionadas = [...manualCotasSelecionadas].sort((a, b) => a - b);
    setManualSalvando(true);

    try {
      const valorTotal = calcularValorTotal(selecionadas.length);
      const res = await criarPedidoManualAdmin({
        nome: manualNome.trim(),
        whatsapp: manualWhatsapp.trim(),
        cpf: manualCpf.trim() ? manualCpf.replace(/\D/g, '') : undefined,
        cotasNumeros: selecionadas,
        formaPagamento: manualFormaPagamento,
      });

      if (res.success) {
        setManualSucesso({
          pedidoId: res.pedidoId,
          nome: manualNome.trim(),
          whatsapp: manualWhatsapp.trim(),
          valor: valorTotal,
          cotas: selecionadas,
        });
        setManualNome('');
        setManualWhatsapp('');
        setManualCpf('');
        setManualCotasSelecionadas([]);
        setManualBuscaCota('');
        carregarDados();
      } else {
        setManualErro(res.error || 'Erro ao lançar pedido manual.');
      }
    } catch (err: any) {
      setManualErro(err.message || 'Erro inesperado.');
    } finally {
      setManualSalvando(false);
    }
  };

  const handleSalvarSupabaseConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoredSupabaseConfig(supabaseUrlInput.trim(), supabaseKeyInput.trim());
    setSupabaseSalvoFeedback(true);
    carregarDados();
    setTimeout(() => setSupabaseSalvoFeedback(false), 4000);
  };

  // Se não autenticado, tela de bloqueio
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-400/20">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black text-white">Painel do Administrador</h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Acesso exclusivo à gestão da Ação Solidária Missionária
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Senha / PIN de Acesso
              </label>
              <input
                type="password"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError(false);
                }}
                placeholder="Digite a senha (padrão: missao2026)"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none text-white text-sm"
                autoFocus
              />
              {pinError && (
                <p className="mt-2 text-xs text-rose-400 flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Senha incorreta. Tente novamente ou use <strong>missao2026</strong>.</span>
                </p>
              )}
            </div>

            <label className="flex items-center space-x-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={lembrarAcesso}
                onChange={(e) => setLembrarAcesso(e.target.checked)}
                className="rounded border-slate-700 text-amber-500 focus:ring-amber-400 bg-slate-950"
              />
              <span>Manter conectado neste navegador</span>
            </label>

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition shadow-lg shadow-amber-400/20 cursor-pointer text-sm"
            >
              Entrar no Painel Seguro
            </button>
          </form>

          <div className="pt-4 border-t border-slate-800 text-center text-xs text-slate-500">
            Ambiente Seguro • Ação Solidária Águas Lindas ➔ Bertioga/SP
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Topo / Header do Painel */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 flex items-center justify-center font-black shadow-md">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base sm:text-lg text-white">
                  Painel de Gestão da Rifa
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  ADM EXCLUSIVO
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Controle de Cotas, Vendas Balcão &amp; Disparos WhatsApp
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
              <span className={`w-2 h-2 rounded-full ${isSupabaseActive() ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-slate-300">
                {isSupabaseActive() ? 'Supabase Conectado' : 'Modo Local / Demonstrativo'}
              </span>
            </div>

            <button
              onClick={carregarDados}
              disabled={carregando}
              className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition cursor-pointer"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin text-amber-400' : ''}`} />
            </button>

            <button
              onClick={handleLogout}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 rounded-lg border border-rose-800/50 transition cursor-pointer"
              title="Sair do painel"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {/* Barra de Métricas em Destaque */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <span className="text-xs font-medium text-slate-400 block mb-1">Total Arrecadado</span>
            <div className="text-xl sm:text-2xl font-black text-emerald-400">
              {formatarMoeda(totalArrecadado)}
            </div>
            <span className="text-[11px] text-slate-500">Meta: R$ 8.500,00</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <span className="text-xs font-medium text-slate-400 block mb-1">Cotas Pagas</span>
            <div className="text-xl sm:text-2xl font-black text-amber-400">
              {cotasPagas.length} <span className="text-xs font-normal text-slate-400">/ {TOTAL_COTAS}</span>
            </div>
            <span className="text-[11px] text-slate-500">
              {((cotasPagas.length / TOTAL_COTAS) * 100).toFixed(1)}% do total
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <span className="text-xs font-medium text-slate-400 block mb-1">Cotas Reservadas</span>
            <div className="text-xl sm:text-2xl font-black text-blue-400">
              {cotasReservadas.length}
            </div>
            <span className="text-[11px] text-slate-500">
              {pedidosPendentes.length} pedido(s) pendente(s)
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <span className="text-xs font-medium text-slate-400 block mb-1">Cotas Livres</span>
            <div className="text-xl sm:text-2xl font-black text-slate-200">
              {cotasDisponiveis.length}
            </div>
            <span className="text-[11px] text-slate-500">Disponíveis na grade</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm col-span-2 lg:col-span-1">
            <span className="text-xs font-medium text-slate-400 block mb-1">Total de Pedidos</span>
            <div className="text-xl sm:text-2xl font-black text-purple-400">
              {pedidos.length}
            </div>
            <span className="text-[11px] text-slate-500">
              {pedidos.filter((p) => p.status_pagamento === 'pago').length} concluídos
            </span>
          </div>
        </div>

        {/* Navegação por Abas */}
        <div className="flex border-b border-slate-800 space-x-1 sm:space-x-3 overflow-x-auto pb-1">

          <button
            onClick={() => setAbaAtiva('venda_manual')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition cursor-pointer whitespace-nowrap ${
              abaAtiva === 'venda_manual'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Banknote className="w-4 h-4" />
            <span>Venda Balcão (500 Cotas & Combos)</span>
          </button>
          <button
            onClick={() => setAbaAtiva('pedidos')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition cursor-pointer whitespace-nowrap ${
              abaAtiva === 'pedidos'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Gestão de Pedidos ({pedidos.length})</span>
          </button>

          <button
            onClick={() => setAbaAtiva('whatsapp')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition cursor-pointer whitespace-nowrap ${
              abaAtiva === 'whatsapp'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Central WhatsApp &amp; 3 Horas ({pedidosPendentes.length})</span>
          </button>

          <button
            onClick={() => setAbaAtiva('logs_auditoria')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition cursor-pointer whitespace-nowrap ${
              abaAtiva === 'logs_auditoria'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Logs de Auditoria</span>
          </button>

          <button
            onClick={() => setAbaAtiva('configuracoes')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition cursor-pointer whitespace-nowrap ${
              abaAtiva === 'configuracoes'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Banco de Dados &amp; SQL</span>
          </button>
        </div>

        {/* ABA 1: PEDIDOS */}
        {abaAtiva === 'pedidos' && (
          <div className="space-y-4">
            {/* Filtros e Barra de Pesquisa */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-96">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por nome, WhatsApp, CPF ou ID..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs sm:text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto">
                <button
                  onClick={() => setFiltroStatus('todos')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                    filtroStatus === 'todos' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  Todos ({pedidos.length})
                </button>
                <button
                  onClick={() => setFiltroStatus('pago')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                    filtroStatus === 'pago' ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50' : 'text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  Pagos ({pedidos.filter((p) => p.status_pagamento === 'pago').length})
                </button>
                <button
                  onClick={() => setFiltroStatus('pendente')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                    filtroStatus === 'pendente' ? 'bg-amber-900/60 text-amber-300 border border-amber-700/50' : 'text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  Pendentes ({pedidos.filter((p) => p.status_pagamento === 'pendente').length})
                </button>
                <button
                  onClick={() => setFiltroStatus('cancelado')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                    filtroStatus === 'cancelado' ? 'bg-rose-900/60 text-rose-300 border border-rose-700/50' : 'text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  Cancelados ({pedidos.filter((p) => p.status_pagamento === 'cancelado').length})
                </button>
              </div>
            </div>

            {/* Tabela de Pedidos */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Comprador</th>
                      <th className="py-3 px-4">WhatsApp / Tel</th>
                      <th className="py-3 px-4">Cotas</th>
                      <th className="py-3 px-4">Valor</th>
                      <th className="py-3 px-4">Status / Tempo</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {pedidosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          Nenhum pedido encontrado para os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      pedidosFiltrados.map((pedido) => {
                        const cotasDoPedido = cotas
                          .filter((c) => c.pedido_id === pedido.id)
                          .map((c) => c.numero);
                        const cotasExibicao = (pedido.cotas_numeros && pedido.cotas_numeros.length > 0)
                          ? pedido.cotas_numeros
                          : cotasDoPedido;

                        const infoTempo = pedido.status_pagamento === 'pendente'
                          ? calcularTempoRestanteReserva(pedido.created_at)
                          : null;

                        const whatsLimpo = pedido.whatsapp.replace(/\D/g, '');
                        const whatsLinkRecibo = whatsLimpo
                          ? `https://api.whatsapp.com/send?phone=55${whatsLimpo}&text=${encodeURIComponent(
                              gerarMensagemRecibo({
                                nome: pedido.nome_comprador,
                                cotas: cotasExibicao,
                                valor: pedido.valor_total,
                                formaPagamento: pedido.transaction_id_infinitepay?.includes('MANUAL') ? 'Presencial/Manual' : 'Pix InfinitePay',
                                pedidoId: pedido.id,
                              })
                            )}`
                          : null;

                        return (
                          <tr key={pedido.id} className="hover:bg-slate-800/40 transition">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-white">{pedido.nome_comprador}</div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                CPF: {mascararCPF(pedido.cpf)} • ID: {pedido.id.slice(0, 10)}...
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <span className="font-mono text-slate-300">
                                {mascararWhatsApp(pedido.whatsapp)}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {cotasExibicao.slice(0, 6).map((n) => (
                                  <span
                                    key={n}
                                    className="px-1.5 py-0.5 rounded bg-slate-800 text-[11px] font-mono text-amber-300 border border-slate-700"
                                  >
                                    {formatarNumeroCota(n)}
                                  </span>
                                ))}
                                {cotasExibicao.length > 6 && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[11px] text-slate-400">
                                    +{cotasExibicao.length - 6}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-4 font-bold text-slate-200">
                              {formatarMoeda(pedido.valor_total)}
                            </td>

                            <td className="py-3 px-4">
                              {pedido.status_pagamento === 'pago' ? (
                                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  <span>Pago</span>
                                </span>
                              ) : pedido.status_pagamento === 'pendente' ? (
                                <div className="space-y-1">
                                  <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                    infoTempo?.estagio === 'aviso_15min'
                                      ? 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse'
                                      : infoTempo?.estagio === 'aviso_1hora'
                                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                      : 'bg-blue-950 text-blue-300 border border-blue-800'
                                  }`}>
                                    <Clock className="w-3 h-3" />
                                    <span>Pendente</span>
                                  </span>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    Expira em: <span className="text-amber-400">{infoTempo?.textoRestante}</span>
                                  </div>
                                </div>
                              ) : (
                                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Cancelado</span>
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end space-x-2">
                                {pedido.status_pagamento === 'pendente' && (
                                  <>
                                    <button
                                      onClick={() => handleMarcarComoPago(pedido.id)}
                                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer shadow-sm"
                                      title="Confirmar recebimento do pagamento"
                                    >
                                      Dar Baixa
                                    </button>
                                    <button
                                      onClick={() => handleCancelarPedido(pedido.id)}
                                      className="px-2 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-300 rounded-lg text-xs transition cursor-pointer border border-rose-800/60"
                                      title="Cancelar reserva e liberar cotas"
                                    >
                                      Liberar
                                    </button>
                                  </>
                                )}

                                {whatsLinkRecibo && (
                                  <a
                                    href={whatsLinkRecibo}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-400 rounded-lg border border-emerald-800/50 transition"
                                    title="Enviar comprovante oficial no WhatsApp do comprador"
                                  >
                                    <Send className="w-4 h-4" />
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: VENDA MANUAL / BALCÃO */}
        {abaAtiva === 'venda_manual' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Banknote className="w-5 h-5 text-amber-400" />
                  <span>Lançamento de Venda Balcão / Manual</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Ideal para irmãos que pagaram em dinheiro em mãos, maquininha de cartão ou Pix direto na conta bancária.
                </p>
              </div>

              {manualErro && (
                <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{manualErro}</span>
                </div>
              )}

              <form onSubmit={handleLancarVendaManual} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Nome Completo do Apoiador *
                    </label>
                    <input
                      type="text"
                      value={manualNome}
                      onChange={(e) => setManualNome(e.target.value)}
                      placeholder="Ex: João Ferreira da Silva"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-amber-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      WhatsApp com DDD (para envio do recibo) *
                    </label>
                    <input
                      type="tel"
                      value={manualWhatsapp}
                      onChange={(e) => setManualWhatsapp(e.target.value)}
                      placeholder="Ex: (61) 99123-4567"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-amber-400"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      CPF (Opcional - para consulta no site)
                    </label>
                    <input
                      type="text"
                      value={manualCpf}
                      onChange={(e) => setManualCpf(e.target.value)}
                      placeholder="Ex: 000.000.000-00"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Forma de Recebimento *
                    </label>
                    <select
                      value={manualFormaPagamento}
                      onChange={(e) => setManualFormaPagamento(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-amber-400"
                    >
                      <option value="dinheiro">Dinheiro Vivo em Espécie</option>
                      <option value="pix_direto">Pix Direto na Conta (Chave 61991736136)</option>
                      <option value="maquininha">Maquininha de Cartão Física</option>
                    </select>
                  </div>
                </div>

                {/* 1. SELEÇÃO DE COMBOS PROMOCIONAIS */}
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-bold text-white uppercase tracking-wider">
                        1. Combos Promocionais (Seleção Rápida)
                      </label>
                      <p className="text-[11px] text-slate-400">
                        Clique em um combo para selecionar cotas livres automaticamente, ou monte sua própria escolha na tabela abaixo.
                      </p>
                    </div>
                    {manualCotasSelecionadas.length > 0 && (
                      <button
                        type="button"
                        onClick={handleLimparManualCotas}
                        className="text-xs text-rose-400 hover:text-rose-300 font-bold px-2.5 py-1 rounded-lg bg-rose-950/40 border border-rose-900/60 transition cursor-pointer"
                      >
                        Limpar Seleção
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {[
                      { qtd: 1, label: '1 Cota', sub: 'Individual', val: 20 },
                      { qtd: 3, label: '3 Cotas', sub: 'Combo Missão (Economize R$ 10)', val: 50 },
                      { qtd: 7, label: '7 Cotas', sub: 'Liderança (Economize R$ 40)', val: 100 },
                      { qtd: 15, label: '15 Cotas', sub: 'Patrocinador (Economize R$ 100)', val: 200 },
                    ].map((combo) => {
                      const isMatch = manualCotasSelecionadas.length === combo.qtd;
                      return (
                        <button
                          key={combo.qtd}
                          type="button"
                          onClick={() => handleSelectComboManual(combo.qtd)}
                          className={`p-3 rounded-xl border text-left transition cursor-pointer active:scale-95 flex flex-col justify-between ${
                            isMatch
                              ? 'bg-amber-400/15 border-amber-400 text-amber-300 ring-2 ring-amber-400/50 shadow-md'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <span className="block text-xs font-extrabold text-white">{combo.label}</span>
                            <span className="block text-[10px] text-slate-400 leading-tight mt-0.5">{combo.sub}</span>
                          </div>
                          <span className="block text-sm font-black text-amber-400 mt-2 font-mono">
                            {formatarMoeda(combo.val)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. TABELA INTERATIVA COM AS 500 COTAS */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-white uppercase tracking-wider block">
                        2. Tabela Geral das 500 Cotas (Clique para Escolher)
                      </span>
                      <p className="text-[11px] text-slate-400">
                        Cotas pagas e reservadas estão bloqueadas para evitar duplicidade de números.
                      </p>
                    </div>

                    {/* Busca Rápida de Cota */}
                    <div className="relative min-w-[200px]">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={manualBuscaCota}
                        onChange={(e) => setManualBuscaCota(e.target.value)}
                        placeholder="Buscar cota (ex: 206)..."
                        className="w-full pl-8 pr-7 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      />
                      {manualBuscaCota && (
                        <button
                          type="button"
                          onClick={() => setManualBuscaCota('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Centenas */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/80">
                    <span className="text-[11px] text-slate-400 mr-1 font-medium">Centenas:</span>
                    {[
                      { id: '1-100', label: '001 a 100' },
                      { id: '101-200', label: '101 a 200' },
                      { id: '201-300', label: '201 a 300' },
                      { id: '301-400', label: '301 a 400' },
                      { id: '401-500', label: '401 a 500' },
                      { id: 'todas', label: 'Todas as 500' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setManualFaixaAtiva(f.id as any)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          manualFaixaAtiva === f.id
                            ? 'bg-amber-400 text-slate-950 shadow-sm'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Legenda de Status */}
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400">
                    <span className="flex items-center space-x-1">
                      <span className="w-3 h-3 rounded bg-slate-900 border border-slate-700 inline-block" />
                      <span>Livre</span>
                    </span>
                    <span className="flex items-center space-x-1 text-amber-300 font-bold">
                      <span className="w-3 h-3 rounded bg-amber-400 inline-block" />
                      <span>Selecionada ({manualCotasSelecionadas.length})</span>
                    </span>
                    <span className="flex items-center space-x-1 text-amber-500">
                      <span className="w-3 h-3 rounded bg-amber-950 border border-amber-800 inline-block" />
                      <span>Reservada (Bloqueada)</span>
                    </span>
                    <span className="flex items-center space-x-1 text-slate-500">
                      <span className="w-3 h-3 rounded bg-slate-950 border border-slate-900 inline-block" />
                      <span>Já Paga (Bloqueada)</span>
                    </span>
                  </div>

                  {/* Grade das Cotas */}
                  <div className="pt-2 max-h-60 overflow-y-auto p-2 bg-slate-900/60 rounded-xl border border-slate-800/80">
                    {(() => {
                      const cotasFiltradas = cotas.filter((c) => {
                        if (manualFaixaAtiva === '1-100' && (c.numero < 1 || c.numero > 100)) return false;
                        if (manualFaixaAtiva === '101-200' && (c.numero < 101 || c.numero > 200)) return false;
                        if (manualFaixaAtiva === '201-300' && (c.numero < 201 || c.numero > 300)) return false;
                        if (manualFaixaAtiva === '301-400' && (c.numero < 301 || c.numero > 400)) return false;
                        if (manualFaixaAtiva === '401-500' && (c.numero < 401 || c.numero > 500)) return false;
                        if (manualBuscaCota.trim()) {
                          const termo = manualBuscaCota.trim();
                          const numFmt = formatarNumeroCota(c.numero);
                          return numFmt.includes(termo) || String(c.numero).includes(termo);
                        }
                        return true;
                      });

                      if (cotasFiltradas.length === 0) {
                        return (
                          <div className="py-8 text-center text-xs text-slate-400">
                            Nenhuma cota encontrada para este filtro.
                          </div>
                        );
                      }

                      return (
                        <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-20 gap-1.5">
                          {cotasFiltradas.map((c) => {
                            const isSelected = manualCotasSelecionadas.includes(c.numero);
                            const isPago = c.status === 'pago';
                            const isReservado = c.status === 'reservado';
                            const isDisponivel = c.status === 'disponivel';

                            let classe = 'bg-slate-900 text-slate-200 border-slate-800 hover:border-emerald-400 hover:text-white';
                            if (isSelected) {
                              classe = 'bg-amber-400 text-slate-950 font-black border-amber-300 ring-2 ring-amber-400 scale-105 shadow-md';
                            } else if (isPago) {
                              classe = 'bg-slate-950 text-slate-600 border-slate-900 cursor-not-allowed opacity-40 line-through';
                            } else if (isReservado) {
                              classe = 'bg-amber-950/40 text-amber-600 border-amber-900/50 cursor-not-allowed opacity-60';
                            }

                            return (
                              <button
                                key={c.numero}
                                type="button"
                                disabled={!isDisponivel}
                                onClick={() => isDisponivel && handleToggleManualCota(c.numero)}
                                title={
                                  isSelected
                                    ? `Cota #${formatarNumeroCota(c.numero)}: Selecionada para esta venda`
                                    : isPago
                                    ? `Cota #${formatarNumeroCota(c.numero)}: Já PAGA (Bloqueada)`
                                    : isReservado
                                    ? `Cota #${formatarNumeroCota(c.numero)}: Reservada (Bloqueada)`
                                    : `Cota #${formatarNumeroCota(c.numero)}: Livre (Clique para selecionar)`
                                }
                                className={`h-9 rounded-lg text-xs font-mono font-bold flex items-center justify-center border transition-all cursor-pointer ${classe}`}
                              >
                                {formatarNumeroCota(c.numero)}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Resumo Dinâmico das Cotas Selecionadas e Valor */}
                  <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white">
                          Cotas Selecionadas ({manualCotasSelecionadas.length}):
                        </span>
                        {manualCotasSelecionadas.length === 0 && (
                          <span className="text-xs text-amber-400/90 italic">
                            Nenhuma cota selecionada ainda.
                          </span>
                        )}
                      </div>
                      {manualCotasSelecionadas.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5 max-h-20 overflow-y-auto">
                          {manualCotasSelecionadas.map((num) => (
                            <span
                              key={num}
                              className="px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-mono font-bold flex items-center space-x-1"
                            >
                              <span>#{formatarNumeroCota(num)}</span>
                              <button
                                type="button"
                                onClick={() => handleToggleManualCota(num)}
                                className="text-amber-400 hover:text-white ml-0.5 p-0.5"
                                title="Remover cota"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 block font-medium">Valor Total a Cobrar:</span>
                      <span className="text-xl font-black text-emerald-400 font-mono">
                        {formatarMoeda(calcularValorTotal(manualCotasSelecionadas.length))}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between border-t border-slate-800">
                  <div className="text-xs text-slate-400">
                    Cotas a registrar:{' '}
                    <span className="text-sm font-bold text-amber-300">
                      {manualCotasSelecionadas.length} cota(s)
                    </span>
                  </div>
                  <button
                    type="submit"
                    disabled={manualSalvando || manualCotasSelecionadas.length === 0}
                    className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 rounded-xl font-bold text-xs sm:text-sm transition shadow-md shadow-amber-400/20 cursor-pointer flex items-center space-x-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{manualSalvando ? 'Gravando...' : 'Confirmar Venda Balcão'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Coluna Direita: Recibo Gerado e Instruções */}
            <div className="space-y-4">
              {manualSucesso ? (
                <div className="bg-emerald-950/40 border border-emerald-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                    <CheckCircle className="w-5 h-5" />
                    <span>Cotas Gravadas com Sucesso!</span>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono space-y-2 text-slate-300">
                    <div>Comprador: <strong className="text-white">{manualSucesso.nome}</strong></div>
                    <div>Valor: <strong className="text-emerald-400">{formatarMoeda(manualSucesso.valor)}</strong></div>
                    <div>
                      Cotas: <span className="text-amber-300">{manualSucesso.cotas.map((n) => formatarNumeroCota(n)).join(', ')}</span>
                    </div>
                    <div>ID: <span className="text-slate-500">{manualSucesso.pedidoId}</span></div>
                  </div>

                  <div className="space-y-2">
                    <a
                      href={`https://api.whatsapp.com/send?phone=55${manualSucesso.whatsapp.replace(/\D/g, '')}&text=${encodeURIComponent(
                        gerarMensagemRecibo({
                          nome: manualSucesso.nome,
                          cotas: manualSucesso.cotas,
                          valor: manualSucesso.valor,
                          formaPagamento: 'Dinheiro / Balcão Presencial',
                          pedidoId: manualSucesso.pedidoId,
                        })
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer shadow-md"
                    >
                      <Send className="w-4 h-4" />
                      <span>Enviar Comprovante via WhatsApp</span>
                    </a>

                    <button
                      onClick={() => {
                        const txt = gerarMensagemRecibo({
                          nome: manualSucesso.nome,
                          cotas: manualSucesso.cotas,
                          valor: manualSucesso.valor,
                          formaPagamento: 'Dinheiro / Balcão Presencial',
                          pedidoId: manualSucesso.pedidoId,
                        });
                        navigator.clipboard.writeText(txt);
                        setCopiouRecibo(true);
                        setTimeout(() => setCopiouRecibo(false), 3000);
                      }}
                      className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer"
                    >
                      {copiouRecibo ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span>{copiouRecibo ? 'Recibo Copiado!' : 'Copiar Texto do Recibo'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs text-slate-400">
                  <h3 className="font-bold text-white text-sm flex items-center space-x-2">
                    <Info className="w-4 h-4 text-amber-400" />
                    <span>Como Funciona a Venda Balcão</span>
                  </h3>
                  <p>
                    Quando alguém da igreja ou conhecido pagar a você em dinheiro vivo ou Pix avulso, registre aqui.
                  </p>
                  <p>
                    As cotas são marcadas como <strong>PAGAS</strong> no mesmo instante no banco de dados, sumindo da lista de disponíveis do site público dos compradores.
                  </p>
                  <p>
                    O sistema gera um comprovante oficial para você enviar no WhatsApp da pessoa com 1 clique!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABA 3: CENTRAL WHATSAPP & 3 HORAS */}
        {abaAtiva === 'whatsapp' && (
          <div className="space-y-6">
            {/* Bloco Explicativo Anti-Banimento */}
            <div className="bg-gradient-to-r from-blue-950/60 to-slate-900 border border-blue-800/50 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-start justify-between flex-col sm:flex-row gap-3">
                <div className="flex items-start space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-white text-sm">
                      Estratégia Segura Anti-Banimento no WhatsApp
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                      <strong>Por que este método é 100% seguro?</strong> O WhatsApp/Meta bane números quando robôs automatizados não-oficiais disparam milhares de mensagens frias em massa. Aqui, usamos <strong>links oficiais legítimos (wa.me)</strong> que abrem a sua conversa individual com o apoiador com a mensagem personalizada pronta (citando o nome, os números escolhidos e a causa missionária). Isso garante <strong>taxa zero de denúncia e zero risco de bloqueio</strong>.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleExecutarLimpezaManual}
                  disabled={executandoLimpeza}
                  className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-bold transition shadow-md cursor-pointer shrink-0 flex items-center space-x-2"
                >
                  <Clock3 className="w-4 h-4" />
                  <span>{executandoLimpeza ? 'Verificando...' : 'Liberar Cotas Expiradas (+3h)'}</span>
                </button>
              </div>

              {feedbackLimpeza && (
                <div className="p-3 bg-amber-950/60 border border-amber-800 text-amber-300 rounded-xl text-xs flex items-center space-x-2">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>{feedbackLimpeza}</span>
                </div>
              )}
            </div>

            {/* Lista de Reservas Pendentes e Estágios */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Bell className="w-4 h-4 text-amber-400" />
                  <span>Cotas Reservadas Aguardando Pagamento ({pedidosPendentes.length})</span>
                </h3>
                <span className="text-xs text-slate-400">Regra: 3 horas limite para pagamento Pix</span>
              </div>

              {pedidosPendentes.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
                  <CheckCheck className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-sm font-medium text-white">Nenhuma reserva pendente no momento!</p>
                  <p className="text-xs text-slate-500">Todas as cotas estão pagas ou disponíveis para compra.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pedidosPendentes.map((pedido) => {
                    const cotasDoPedido = cotas
                      .filter((c) => c.pedido_id === pedido.id)
                      .map((c) => c.numero);
                    const cotasExibicao = (pedido.cotas_numeros && pedido.cotas_numeros.length > 0)
                      ? pedido.cotas_numeros
                      : cotasDoPedido;

                    const infoTempo = calcularTempoRestanteReserva(pedido.created_at);
                    const whatsLimpo = pedido.whatsapp.replace(/\D/g, '');

                    // Links WhatsApp
                    const msg1Hora = gerarMensagemLembrete1Hora({
                      nome: pedido.nome_comprador,
                      cotas: cotasExibicao,
                      valor: pedido.valor_total,
                      pedidoId: pedido.id,
                    });
                    const linkMsg1Hora = `https://api.whatsapp.com/send?phone=55${whatsLimpo}&text=${encodeURIComponent(msg1Hora)}`;

                    const msg15Min = gerarMensagemLembrete15Minutos({
                      nome: pedido.nome_comprador,
                      cotas: cotasExibicao,
                      valor: pedido.valor_total,
                    });
                    const linkMsg15Min = `https://api.whatsapp.com/send?phone=55${whatsLimpo}&text=${encodeURIComponent(msg15Min)}`;

                    return (
                      <div
                        key={pedido.id}
                        className={`bg-slate-900 border rounded-2xl p-5 space-y-4 shadow-sm transition ${
                          infoTempo.estagio === 'expirado'
                            ? 'border-rose-800/80 bg-rose-950/20'
                            : infoTempo.estagio === 'aviso_15min'
                            ? 'border-amber-700/80 bg-amber-950/20'
                            : 'border-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-bold text-white text-sm block">
                              {pedido.nome_comprador}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                              WhatsApp: {mascararWhatsApp(pedido.whatsapp)}
                            </span>
                          </div>

                          <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                            infoTempo.estagio === 'expirado'
                              ? 'bg-rose-900 text-rose-200'
                              : infoTempo.estagio === 'aviso_15min'
                              ? 'bg-amber-900 text-amber-200 animate-pulse'
                              : 'bg-slate-800 text-slate-300'
                          }`}>
                            {infoTempo.textoRestante}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs py-2 border-y border-slate-800/60 font-mono">
                          <div>
                            <span className="text-slate-400">Cotas: </span>
                            <span className="text-amber-400 font-bold">
                              {cotasExibicao.map((n) => formatarNumeroCota(n)).join(', ')}
                            </span>
                          </div>
                          <div className="font-bold text-emerald-400">
                            {formatarMoeda(pedido.valor_total)}
                          </div>
                        </div>

                        {/* Botões de Ação de Disparo WhatsApp */}
                        <div className="space-y-2">
                          <div className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1">
                            <Send className="w-3.5 h-3.5" />
                            <span>Enviar Notificação com 1 Clique:</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <a
                              href={linkMsg1Hora}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[11px] font-medium text-center transition flex items-center justify-center space-x-1"
                              title="Aviso amigável de 1 hora decorrida"
                            >
                              <span>Lembrete 1h</span>
                            </a>

                            <a
                              href={linkMsg15Min}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="py-2 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-[11px] font-medium text-center transition flex items-center justify-center space-x-1"
                              title="Último aviso quando faltam 15 minutos para expirar"
                            >
                              <span>Aviso Final 15m</span>
                            </a>
                          </div>

                          <div className="flex items-center space-x-2 pt-1">
                            <button
                              onClick={() => handleMarcarComoPago(pedido.id)}
                              className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                            >
                              Confirmar Pagamento
                            </button>

                            <button
                              onClick={() => handleCancelarPedido(pedido.id)}
                              className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-300 rounded-lg text-xs transition cursor-pointer border border-rose-800/60"
                            >
                              Liberar Cotas
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABA 4: CONFIGURAÇÕES & SUPABASE */}
        {abaAtiva === 'logs_auditoria' && (
          <div className="space-y-4">
            <AuditLogsViewer onRefreshData={carregarDados} />
          </div>
        )}

        {abaAtiva === 'configuracoes' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conexão com Supabase */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
              <div>
                <h2 className="text-base font-bold text-white flex items-center space-x-2">
                  <Database className="w-5 h-5 text-amber-400" />
                  <span>Sincronização com o Banco de Dados</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Conecte o Painel Gestor ao mesmo projeto Supabase da página da rifa para que todas as ações reflitam em tempo real.
                </p>
              </div>

              {supabaseSalvoFeedback && (
                <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-xl text-xs flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>Configurações salvas e dados recarregados com sucesso!</span>
                </div>
              )}

              <form onSubmit={handleSalvarSupabaseConfig} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    VITE_SUPABASE_URL
                  </label>
                  <input
                    type="text"
                    value={supabaseUrlInput}
                    onChange={(e) => setSupabaseUrlInput(e.target.value)}
                    placeholder="https://seu-projeto.supabase.co"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    VITE_SUPABASE_ANON_KEY
                  </label>
                  <input
                    type="password"
                    value={supabaseKeyInput}
                    onChange={(e) => setSupabaseKeyInput(e.target.value)}
                    placeholder="eyJhbGciOi..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl text-xs sm:text-sm transition cursor-pointer"
                >
                  Salvar e Conectar
                </button>
              </form>
            </div>

            {/* Script SQL do Banco */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm">Script SQL do Supabase</h3>
                  <p className="text-xs text-slate-400">Copie e execute no SQL Editor do Supabase se ainda não rodou:</p>
                </div>
                <button
                  onClick={() => {
                    const sql = `-- Criação da tabela de pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id TEXT PRIMARY KEY,
  nome_comprador TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  cpf TEXT NOT NULL,
  valor_total NUMERIC NOT NULL,
  quantidade_cotas INTEGER NOT NULL,
  status_pagamento TEXT NOT NULL DEFAULT 'pendente',
  transaction_id_infinitepay TEXT,
  pix_copia_cola TEXT,
  pix_qr_code_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Criação da tabela de 500 cotas
CREATE TABLE IF NOT EXISTS cotas (
  id TEXT PRIMARY KEY,
  numero INTEGER UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'disponivel',
  pedido_id TEXT REFERENCES pedidos(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS público para consulta
ALTER TABLE cotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cotas_leitura_publica" ON cotas FOR SELECT USING (true);
CREATE POLICY "cotas_atualizacao" ON cotas FOR ALL USING (true);
CREATE POLICY "pedidos_leitura_publica" ON pedidos FOR SELECT USING (true);
CREATE POLICY "pedidos_insercao" ON pedidos FOR INSERT WITH CHECK (true);
CREATE POLICY "pedidos_atualizacao" ON pedidos FOR UPDATE USING (true);`;
                    navigator.clipboard.writeText(sql);
                    setCopiouRecibo(true);
                    setTimeout(() => setCopiouRecibo(false), 3000);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition flex items-center space-x-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar SQL</span>
                </button>
              </div>

              <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 overflow-x-auto max-h-60">
{`CREATE TABLE IF NOT EXISTS pedidos (
  id TEXT PRIMARY KEY,
  nome_comprador TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  cpf TEXT NOT NULL,
  valor_total NUMERIC NOT NULL,
  quantidade_cotas INTEGER NOT NULL,
  status_pagamento TEXT NOT NULL DEFAULT 'pendente',
  transaction_id_infinitepay TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cotas (
  id TEXT PRIMARY KEY,
  numero INTEGER UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'disponivel',
  pedido_id TEXT REFERENCES pedidos(id)
);`}
              </pre>
            </div>
          </div>
        )}
      </main>

      {/* Rodapé do Painel */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        Painel Administrativo da Ação Solidária • Exclusivo para Gestores da Campanha Missionária
      </footer>
    </div>
  );
}
