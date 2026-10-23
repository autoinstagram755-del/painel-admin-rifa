import React, { useState, useMemo } from 'react';
import {
  AuditLogEntry,
  TipoLogAuditoria,
  obterLogsAuditoria,
  limparLogsAuditoria,
  exportarLogsCSV,
  exportarLogsJSON,
  registrarLogAuditoria,
} from '../lib/auditLogs.ts';
import { formatarMoeda, formatarNumeroCota } from '../utils/rules.ts';
import {
  ShieldCheck,
  Search,
  Filter,
  Download,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  Banknote,
  AlertTriangle,
  Copy,
  Check,
  ArrowUpDown,
  Tag,
  User,
  Hash,
} from 'lucide-react';

interface AuditLogsViewerProps {
  onRefreshData?: () => void;
}

export const AuditLogsViewer: React.FC<AuditLogsViewerProps> = ({ onRefreshData }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>(() => obterLogsAuditoria());
  const [filtroTipo, setFiltroTipo] = useState<'todos' | TipoLogAuditoria>('todos');
  const [busca, setBusca] = useState('');
  const [copiouId, setCopiouId] = useState<string | null>(null);

  const recarregar = () => {
    setLogs(obterLogsAuditoria());
    if (onRefreshData) onRefreshData();
  };

  const handleLimpar = () => {
    if (confirm('Tem certeza de que deseja limpar o histórico de logs de auditoria?')) {
      limparLogsAuditoria();
      setLogs([]);
      registrarLogAuditoria({
        tipo: 'sincronizacao',
        titulo: 'Histórico de Logs Reinicializado',
        detalhes: 'O administrador reiniciou os registros de auditoria do sistema.',
        origem: 'admin_painel',
        status: 'aviso',
      });
      setLogs(obterLogsAuditoria());
    }
  };

  const copiarTexto = async (texto: string, id: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiouId(id);
      setTimeout(() => setCopiouId(null), 2500);
    } catch (e) {
      console.error('Falha ao copiar:', e);
    }
  };

  const logsFiltrados = useMemo(() => {
    return logs.filter((log) => {
      // Filtro de tipo
      if (filtroTipo !== 'todos' && log.tipo !== filtroTipo) {
        return false;
      }

      // Filtro de busca textual
      if (!busca.trim()) return true;
      const termo = busca.toLowerCase().trim();
      const numBusca = parseInt(termo.replace(/\D/g, ''), 10);
      const temCota = !isNaN(numBusca) && log.cotas?.includes(numBusca);

      return (
        log.titulo.toLowerCase().includes(termo) ||
        log.detalhes.toLowerCase().includes(termo) ||
        (log.comprador && log.comprador.toLowerCase().includes(termo)) ||
        (log.pedidoId && log.pedidoId.toLowerCase().includes(termo)) ||
        temCota
      );
    });
  }, [logs, filtroTipo, busca]);

  // Métricas
  const totalLogs = logs.length;
  const pagamentos = logs.filter((l) => l.tipo === 'pagamento').length;
  const cancelamentos = logs.filter((l) => l.tipo === 'cancelamento').length;
  const errosEAvisos = logs.filter((l) => l.status === 'aviso' || l.status === 'erro').length;

  const formatarData = (iso: string) => {
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(d);
    } catch {
      return iso;
    }
  };

  const getTipoBadge = (tipo: TipoLogAuditoria) => {
    switch (tipo) {
      case 'pagamento':
        return {
          label: 'Pagamento Confirmado',
          cor: 'bg-emerald-950 text-emerald-300 border-emerald-600/50',
          icone: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
        };
      case 'reserva':
        return {
          label: 'Cota Reservada',
          cor: 'bg-amber-950 text-amber-300 border-amber-600/50',
          icone: <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
        };
      case 'cancelamento':
        return {
          label: 'Reserva Expirada / Cancelada',
          cor: 'bg-rose-950 text-rose-300 border-rose-600/50',
          icone: <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />,
        };
      case 'venda_manual':
        return {
          label: 'Venda Manual Balcão',
          cor: 'bg-purple-950 text-purple-300 border-purple-600/50',
          icone: <Banknote className="w-3.5 h-3.5 text-purple-400 shrink-0" />,
        };
      case 'sincronizacao':
        return {
          label: 'Sincronização de Dados',
          cor: 'bg-blue-950 text-blue-300 border-blue-600/50',
          icone: <RefreshCw className="w-3.5 h-3.5 text-blue-400 shrink-0" />,
        };
      case 'erro':
        return {
          label: 'Falha / Alerta',
          cor: 'bg-rose-950 text-rose-300 border-rose-600/50',
          icone: <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />,
        };
    }
  };

  const getOrigemLabel = (origem: string) => {
    switch (origem) {
      case 'webhook_infinitepay':
        return 'InfinitePay Webhook';
      case 'admin_painel':
        return 'Painel Administrativo';
      case 'sistema_auto':
        return 'Sistema Automático (3h)';
      default:
        return 'Site / Checkout';
    }
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho informativo */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/60 via-slate-900 to-slate-900 border border-blue-600/40 text-xs space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <h4 className="font-bold text-sm text-white">
                Logs de Auditoria &amp; Rastreamento de Sincronização
              </h4>
              <p className="text-slate-300 text-xs">
                Registro cronológico imutável de todas as alterações críticas de status nas cotas, reservas e pagamentos.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={exportarLogsCSV}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
              title="Exportar logs para planilha Excel / CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>CSV</span>
            </button>
            <button
              onClick={exportarLogsJSON}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
              title="Exportar relatório completo em JSON"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>JSON</span>
            </button>
            <button
              onClick={recarregar}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-sm"
              title="Atualizar lista de logs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Atualizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mini-Cards de Estatísticas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
          <span className="text-[11px] text-slate-400 block">Total de Eventos</span>
          <span className="text-lg font-bold text-white font-mono">{totalLogs}</span>
        </div>
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
          <span className="text-[11px] text-emerald-400 block font-semibold">Pagamentos Auditados</span>
          <span className="text-lg font-bold text-emerald-300 font-mono">{pagamentos}</span>
        </div>
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
          <span className="text-[11px] text-rose-400 block font-semibold">Liberações / Expirações</span>
          <span className="text-lg font-bold text-rose-300 font-mono">{cancelamentos}</span>
        </div>
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
          <span className="text-[11px] text-amber-400 block font-semibold">Alertas &amp; Avisos</span>
          <span className="text-lg font-bold text-amber-300 font-mono">{errosEAvisos}</span>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cota (ex: 206), nome do comprador, pedido..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-400"
          />
        </div>

        {/* Filtros por Categoria */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'pagamento', label: 'Pagamentos' },
            { id: 'reserva', label: 'Reservas' },
            { id: 'cancelamento', label: 'Cancelados' },
            { id: 'venda_manual', label: 'Venda Balcão' },
            { id: 'sincronizacao', label: 'Sincronização' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltroTipo(f.id as any)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
                filtroTipo === f.id
                  ? 'bg-blue-600 text-white shadow-sm font-bold'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Registros Cronológicos */}
      {logsFiltrados.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400 space-y-2">
          <Filter className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="font-semibold text-slate-300">Nenhum evento corresponde ao filtro atual.</p>
          <p className="text-[11px] text-slate-500">Tente buscar por outro termo ou selecione a categoria "Todos".</p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
          {logsFiltrados.map((log) => {
            const badge = getTipoBadge(log.tipo);
            const dataHora = formatarData(log.timestamp);
            const resumoCopiar = `[${dataHora}] ${log.titulo}\n${log.detalhes}${log.cotas ? `\nCotas: ${log.cotas.join(', ')}` : ''}`;

            return (
              <div
                key={log.id}
                className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800/90 hover:border-slate-700 transition space-y-2.5 shadow-sm"
              >
                {/* Linha superior: Tipo, Origem e Data */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badge.cor}`}
                    >
                      {badge.icone}
                      <span>{badge.label}</span>
                    </span>

                    <span className="text-[10px] uppercase font-semibold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
                      {getOrigemLabel(log.origem)}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-mono">
                    <span>{dataHora}</span>
                    <button
                      onClick={() => copiarTexto(resumoCopiar, log.id)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                      title="Copiar dados deste log"
                    >
                      {copiouId === log.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Título & Detalhes */}
                <div>
                  <h5 className="text-sm font-bold text-white">{log.titulo}</h5>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{log.detalhes}</p>
                </div>

                {/* Cotas e Comprador Vinculados */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400 pt-1 border-t border-slate-900">
                  {log.cotas && log.cotas.length > 0 && (
                    <div className="flex items-center space-x-1.5">
                      <Tag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-[11px]">Cotas:</span>
                      <div className="flex flex-wrap gap-1">
                        {log.cotas.map((n) => (
                          <span
                            key={n}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border ${
                              log.tipo === 'pagamento'
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/40'
                                : 'bg-amber-950/80 text-amber-300 border-amber-600/40'
                            }`}
                          >
                            #{formatarNumeroCota(n)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {log.comprador && (
                    <div className="flex items-center space-x-1">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-white font-medium">{log.comprador}</span>
                    </div>
                  )}

                  {log.valor && log.valor > 0 && (
                    <div className="font-bold text-emerald-400 font-mono">
                      {formatarMoeda(log.valor)}
                    </div>
                  )}

                  {log.pedidoId && (
                    <div className="text-[10px] font-mono text-slate-500">
                      ID: #{log.pedidoId.slice(0, 8)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rodapé com botão de limpeza */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400">
        <span>Mostrando {logsFiltrados.length} de {logs.length} eventos registrados</span>
        <button
          onClick={handleLimpar}
          className="text-xs text-rose-400 hover:text-rose-300 flex items-center space-x-1 transition cursor-pointer hover:underline"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Limpar Histórico de Auditoria</span>
        </button>
      </div>
    </div>
  );
};
