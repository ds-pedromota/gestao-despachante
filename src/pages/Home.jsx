import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  FileText, 
  Users, 
  CheckCircle, 
  DollarSign, 
  Loader2,
  AlertCircle,
  FileQuestion,
  Calendar as CalendarIcon,
  X,
  TrendingUp,
  CalendarClock,
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  RotateCcw,
  Skull,
  RefreshCw,
  Wallet,
  Search,
  Bell,
  Check,
  Database
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { API_BASE_URL, getAuthHeaders } from "@/config";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { isWithinInterval, startOfDay, endOfDay, isBefore, isAfter, isSameDay, addDays, subDays } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import StatsCard from "@/components/dashboard/StatsCard";
import ServicoCardInternal from "@/components/servicos/ServicoCardInternal";
import ServiceBadge from "@/components/servicos/ServiceBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isPago, parseDocs, formatDateForInput, parseJSON, getServiceEmoji, CLIENT_TAGS } from "@/lib/helpers";
import { playSound } from "@/lib/audio";
import logo from "@/pages/logo.png";
import { generateFakeData } from "@/lib/fakeData";

// --- COMPONENTE AVANÇADO DE PREVISÃO FINANCEIRA ---
function EnhancedUpcomingPayments({ servicos = [] }) {
  const [filter, setFilter] = useState('all'); // 'all', 'overdue', 'today', 'week'
  const [sortOrder, setSortOrder] = useState('asc');
  const [searchTerm, setSearchTerm] = useState("");
  
  // Helper para calcular apenas os débitos pendentes (Gestão de Débitos)
  const getDebitosValue = (s) => {
    const debitos = parseJSON(s.lista_debitos);
    return Array.isArray(debitos) 
      ? debitos.filter(d => !d.pago).reduce((sum, d) => sum + (Number(d.valor) || 0), 0)
      : 0;
  };

  // Helper para data segura (evita problema de timezone com YYYY-MM-DD)
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
       const [y, m, d] = dateStr.split('-').map(Number);
       return new Date(y, m - 1, d);
    }
    return new Date(dateStr);
  };

  const { overdue, dueYesterday, dueToday, dueWeek, allUpcoming } = useMemo(() => {
    const today = startOfDay(new Date());
    const yesterday = subDays(today, 1);
    const nextWeek = addDays(today, 7);
    
    // Filtra apenas serviços não pagos, ativos e com previsão de pagamento
    const unpaid = servicos.filter(s => 
      s.data_pagamento_previsto && 
      !s.data_pagamento && 
      !isPago(s.pagamento_realizado) &&
      s.status?.toLowerCase() === 'aprovado' // [FIX] Garante que apenas "Aprovado" apareça (ignora maiúsculas/minúsculas)
    );

    return {
      // 1. Vencidos: Estritamente ANTES de Ontem
      overdue: unpaid.filter(s => isBefore(startOfDay(parseDate(s.data_pagamento_previsto)), yesterday)),
      // 2. Ontem: Apenas Ontem
      dueYesterday: unpaid.filter(s => isSameDay(parseDate(s.data_pagamento_previsto), yesterday)),
      // 3. Hoje: Apenas Hoje
      dueToday: unpaid.filter(s => isSameDay(parseDate(s.data_pagamento_previsto), today)),
      // 4. 7 Dias: Estritamente DEPOIS de Hoje até semana que vem
      dueWeek: unpaid.filter(s => {
        const d = startOfDay(parseDate(s.data_pagamento_previsto));
        return isAfter(d, today) && isBefore(d, nextWeek);
      }),
      allUpcoming: unpaid
    };
  }, [servicos]);

  const getActiveList = () => {
    let list = [];
    
    // Se houver busca, ignora os filtros de data e busca em tudo
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = allUpcoming.filter(s => 
        (s.cliente_nome?.toLowerCase() || "").includes(term) ||
        (s.numero_contrato?.toLowerCase() || "").includes(term) ||
        (s.placa_veiculo?.toLowerCase() || "").includes(term)
      );
    } else {
      switch(filter) {
        case 'overdue': list = overdue; break;
        case 'yesterday': list = dueYesterday; break;
        case 'today': list = dueToday; break;
        case 'week': list = dueWeek; break;
        default: list = allUpcoming; break;
      }
    }
    return [...list].sort((a, b) => {
      const dateA = parseDate(a.data_pagamento_previsto);
      const dateB = parseDate(b.data_pagamento_previsto);
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
  };

  const activeList = getActiveList();
  const totalValue = activeList.reduce((acc, s) => acc + getDebitosValue(s), 0);

  return (
    <div className="bg-white rounded-xl border shadow-sm h-full flex flex-col">
      <div className="p-5 border-b">
        <div className="flex items-center justify-between mb-4">
           <h3 className="font-semibold text-slate-800 flex items-center gap-2">
             <CalendarClock className="w-5 h-5 text-slate-500" />
             Documentos aprovados para pagamento
           </h3>
           <div className="flex items-center gap-2">
             <Button 
               variant="ghost" 
               size="icon" 
               className="h-6 w-6 text-slate-400 hover:text-slate-700" 
               onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
               title={sortOrder === 'asc' ? "Alternar para decrescente" : "Alternar para crescente"}
             >
               <ArrowUpDown className="w-4 h-4" />
             </Button>
             <Badge variant="outline" className="bg-slate-50">
               {allUpcoming.length} total
             </Badge>
           </div>
        </div>

        {/* Campo de Busca */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Buscar por nome ou placa..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-slate-50 border-slate-200 focus:bg-white"
          />
        </div>

        {/* Mini Dashboard de Métricas Interativas */}
        {!searchTerm.trim() && (
        <div className="grid grid-cols-4 gap-2">
           <button onClick={() => setFilter('overdue')} className={cn("p-2 rounded-lg border text-left transition-all hover:shadow-sm", filter === 'overdue' ? "bg-red-50 border-red-200 ring-1 ring-red-200" : "bg-white border-slate-100 hover:border-red-100")}>
             <p className="text-[10px] uppercase font-bold text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Vencidos</p>
             <p className="text-lg font-bold text-slate-800 mt-1">{overdue.length}</p>
           </button>
           <button onClick={() => setFilter('yesterday')} className={cn("p-2 rounded-lg border text-left transition-all hover:shadow-sm", filter === 'yesterday' ? "bg-purple-50 border-purple-200 ring-1 ring-purple-200" : "bg-white border-slate-100 hover:border-purple-100")}>
             <p className="text-[10px] uppercase font-bold text-purple-600 flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Ontem</p>
             <p className="text-lg font-bold text-slate-800 mt-1">{dueYesterday.length}</p>
           </button>
           <button onClick={() => setFilter('today')} className={cn("p-2 rounded-lg border text-left transition-all hover:shadow-sm", filter === 'today' ? "bg-orange-50 border-orange-200 ring-1 ring-orange-200" : "bg-white border-slate-100 hover:border-orange-100")}>
             <p className="text-[10px] uppercase font-bold text-orange-600 flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> Hoje</p>
             <p className="text-lg font-bold text-slate-800 mt-1">{dueToday.length}</p>
           </button>
           <button onClick={() => setFilter('week')} className={cn("p-2 rounded-lg border text-left transition-all hover:shadow-sm", filter === 'week' ? "bg-blue-50 border-blue-200 ring-1 ring-blue-200" : "bg-white border-slate-100 hover:border-blue-100")}>
             <p className="text-[10px] uppercase font-bold text-blue-600 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> 7 Dias</p>
             <p className="text-lg font-bold text-slate-800 mt-1">{dueWeek.length}</p>
           </button>
        </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-0 max-h-[400px]">
        {activeList.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {activeList.map((s, index) => {
               // Usa o emoji do banco ou o fallback do sistema
               let displayNome = s.tipo_servico_nome;
               let displayEmoji = s.tipo_servico_emoji || getServiceEmoji(s.tipo_servico_nome);

               // Se houver múltiplos serviços, formata a exibição
               if (s.tipos_servicos_detalhes && s.tipos_servicos_detalhes.length > 0) {
                   displayNome = s.tipos_servicos_detalhes.map(t => t.nome).join(" + ");
                   displayEmoji = s.tipos_servicos_detalhes.map(t => t.emoji || getServiceEmoji(t.nome)).join(" ");
               }

               const isInadimplente = !!s.inadimplente;

               return (
               <div key={s.id} className={cn("p-4 transition-colors flex items-center justify-between group border-l-4", 
                   isInadimplente ? "bg-slate-200 border-l-slate-600 hover:bg-slate-300" : cn("border-l-transparent", index % 2 === 0 ? "bg-white" : "bg-slate-50", "hover:bg-blue-50")
               )}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900 truncate flex items-center" title={s.cliente_nome}>
                          {isInadimplente && (
                            <span className="flex items-center mr-2 text-slate-700 font-bold text-[10px]">
                              <Skull className="w-3 h-3 mr-1" /> INADIMPLENTE
                            </span>
                          )}
                          {s.numero_contrato && <span className="font-bold mr-1">#{s.numero_contrato} -</span>}
                          {s.cliente_nome}
                        </p>
                        {Array.isArray(s.identificacao_cliente) && s.identificacao_cliente.map(tag => (
                            CLIENT_TAGS[tag] && (
                                <Badge key={tag} className={cn("text-[10px] px-1.5 py-0 h-5 whitespace-nowrap border-0", CLIENT_TAGS[tag].color)}>
                                    {CLIENT_TAGS[tag].label}
                                </Badge>
                            )
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                       <span className={cn("font-medium", isBefore(startOfDay(parseDate(s.data_pagamento_previsto)), startOfDay(new Date())) ? "text-red-600" : isSameDay(parseDate(s.data_pagamento_previsto), new Date()) ? "text-orange-600" : "text-slate-500")}>
                         {format(parseDate(s.data_pagamento_previsto), "dd 'de' MMM", { locale: ptBR })}
                       </span>
                       <span>•</span>
                       <span className="truncate max-w-[120px] flex items-center gap-1">
                         {displayEmoji && <span className="text-base">{displayEmoji}</span>}
                         {displayNome}
                       </span>
                       {s.placa_veiculo && (
                         <>
                           <span>•</span>
                           <span className="font-mono font-medium text-slate-600">{s.placa_veiculo}</span>
                         </>
                       )}
                       {s.renavam && (
                         <>
                           <span>•</span>
                           <span className="text-slate-500">Renavam: {s.renavam}</span>
                         </>
                       )}
                    </div>
                  </div>
                  <div className="text-right pl-2">
                    <p className="text-sm font-bold text-slate-700">{getDebitosValue(s).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    <Link to={`/ServicoDetalhe?id=${s.id}`} className="text-[10px] text-blue-600 hover:underline opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1">Ver <ArrowRight className="w-3 h-3" /></Link>
                  </div>
               </div>
            )})}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <CheckCircle className="w-10 h-10 mb-2 opacity-20" />
            <p className="text-sm">Nenhum pagamento previsto para este filtro.</p>
            {(filter !== 'all' || searchTerm) && <Button variant="link" size="sm" onClick={() => { setFilter('all'); setSearchTerm(''); }} className="mt-2">Ver todos</Button>}
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-50 border-t rounded-b-xl flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase">Total Previsto</span>
        <span className="text-lg font-bold text-slate-900">{totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
      </div>
    </div>
  );
}

// --- NOVO COMPONENTE: LISTA DE DÉBITOS PARA PAGAMENTO ---
function DebitosList({ servicos }) {
  const debitos = useMemo(() => {
    const list = [];
    servicos.forEach(s => {
      const sDebitos = parseJSON(s.lista_debitos);
      if (Array.isArray(sDebitos)) {
        sDebitos.forEach(d => {
          // Filtra apenas débitos NÃO pagos e que possuem data de vencimento
          if (!d.pago && d.data_vencimento) {
             list.push({
               id: `${s.id}-${d.id}`,
               serviceId: s.id,
               cliente: s.cliente_nome,
               contrato: s.numero_contrato,
               identificacao: Array.isArray(s.identificacao_cliente) ? s.identificacao_cliente : [],
               tipo: s.tipo_servico_nome,
               placa: s.placa_veiculo,
               renavam: s.renavam,
               emoji: (s.tipos_servicos_detalhes && s.tipos_servicos_detalhes.length > 0) 
                      ? s.tipos_servicos_detalhes.map(t => t.emoji || getServiceEmoji(t.nome)).join(" ") 
                      : (s.tipo_servico_emoji || getServiceEmoji(s.tipo_servico_nome)),
               tipoDisplay: (s.tipos_servicos_detalhes && s.tipos_servicos_detalhes.length > 0)
                      ? s.tipos_servicos_detalhes.map(t => t.nome).join(" + ")
                      : s.tipo_servico_nome,
               descricao: d.descricao,
               valor: Number(d.valor) || 0,
               vencimento: d.data_vencimento
             });
          }
        });
      }
    });
    // Ordena por vencimento (mais antigo primeiro)
    return list.sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento));
  }, [servicos]);

  return (
    <div className="bg-white rounded-xl border shadow-sm h-full flex flex-col">
      <div className="p-5 border-b">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
           <Wallet className="w-5 h-5 text-slate-500" />
           Débitos para Pagamento
           <Badge variant="outline" className="ml-auto bg-slate-50 border-slate-200 text-slate-700">
             {debitos.length}
           </Badge>
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-0 max-h-[400px] custom-scrollbar">
         {debitos.length > 0 ? (
            <div className="divide-y divide-slate-50">
               {debitos.map(d => {
                  // Helper para garantir data correta (YYYY-MM-DD -> Local Midnight)
                  const parseDate = (dateStr) => {
                     if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                        const [y, m, day] = dateStr.split('-').map(Number);
                        return new Date(y, m - 1, day);
                     }
                     return new Date(dateStr);
                  };

                  const vencimento = startOfDay(parseDate(d.vencimento));
                  const hoje = startOfDay(new Date());
                  const amanha = addDays(hoje, 1);

                  let containerClass = "bg-white hover:bg-slate-50";
                  let dateClass = "text-slate-500";
                  let icon = null;

                  if (isBefore(vencimento, hoje)) {
                     containerClass = "bg-slate-100 hover:bg-slate-200"; // Vencido (Cinza)
                     dateClass = "text-slate-600 font-bold flex items-center gap-1";
                     icon = <AlertCircle className="w-3 h-3 text-red-600" />;
                  } else if (isSameDay(vencimento, hoje)) {
                     containerClass = "bg-red-50 hover:bg-red-100"; // Hoje (Vermelho)
                     dateClass = "text-red-600 font-bold flex items-center gap-1";
                     icon = <AlertTriangle className="w-3 h-3 animate-pulse" />;
                  } else if (isSameDay(vencimento, amanha)) {
                     containerClass = "bg-amber-50 hover:bg-amber-100"; // Amanhã (Amarelo)
                     dateClass = "text-amber-600 font-bold";
                  }

                  return (
                  <div key={d.id} className={cn("p-3 transition-colors group", containerClass)}>
                     <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-1 max-w-[60%]">
                            <span className="font-medium text-sm text-slate-900 truncate" title={d.cliente}>
                              {d.contrato && <span className="font-bold mr-1">#{d.contrato}</span>}
                              {d.cliente}
                            </span>
                            {d.identificacao.map(tag => (
                                CLIENT_TAGS[tag] && (
                                    <Badge key={tag} className={cn("text-[9px] px-1 py-0 h-4 border-0", CLIENT_TAGS[tag].color)}>
                                        {CLIENT_TAGS[tag].label}
                                    </Badge>
                                )
                            ))}
                        </div>
                        <span className={cn("text-xs font-medium", dateClass)}>
                           {icon}
                           {format(vencimento, "dd/MM/yyyy")}
                        </span>
                     </div>
                     <div className="flex justify-between items-center text-xs text-slate-500">
                        <div className="flex flex-col min-w-0 max-w-[65%]">
                           <span className="truncate flex items-center gap-1">
                              {d.descricao} 
                              <span className="opacity-75">({d.emoji}{d.tipoDisplay})</span>
                           </span>
                           {(d.placa || d.renavam) && (
                               <span className="text-[10px] text-slate-400 truncate mt-0.5">
                                   {d.placa} {d.renavam && `• Renavam: ${d.renavam}`}
                               </span>
                           )}
                        </div>
                        <span className="font-bold text-slate-700 whitespace-nowrap ml-2">
                           {d.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                     </div>
                     <div className="mt-1 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link to={`/ServicoDetalhe?id=${d.serviceId}`} className="text-[10px] text-blue-600 hover:underline flex items-center">
                           Ver Processo <ArrowRight className="w-3 h-3 ml-1" />
                        </Link>
                     </div>
                  </div>
               )})}
            </div>
         ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
               <CheckCircle className="w-10 h-10 mb-2 opacity-20" />
               <p className="text-sm">Nenhum débito pendente com vencimento.</p>
            </div>
         )}
      </div>
    </div>
  );
}

// --- NOVO COMPONENTE: PAINEL DE DESTAQUES OPERACIONAIS ---
// Substitui o gráfico por listas acionáveis de Inadimplentes e Pendências
function OperationalHighlights({ servicos }) {
  const inadimplentes = servicos.filter(s => s.inadimplente);
  const pendentes = servicos.filter(s => s.status === 'pendente');
  // Pega os 5 pendentes mais antigos (menor ID)
  const pendentesList = [...pendentes].sort((a, b) => Number(a.id) - Number(b.id)).slice(0, 5);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
      {/* Card de Inadimplentes (Prioridade Alta) */}
      <div className="bg-white rounded-xl border shadow-sm p-5 flex flex-col h-[400px]">
         <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Atenção: Inadimplentes
            <Badge variant="destructive" className="ml-auto bg-red-100 text-red-700 hover:bg-red-200 border-red-200">{inadimplentes.length}</Badge>
         </h3>
         <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {inadimplentes.length > 0 ? (
                inadimplentes.map(s => (
                    <div key={s.id} className="p-3 bg-red-50 rounded-lg border border-red-100 text-sm hover:bg-red-100 transition-colors group">
                        <div className="font-medium text-red-900 flex justify-between">
                          <div className="flex items-center gap-1 truncate">
                              <span className="truncate">
                                {s.numero_contrato && <span className="font-bold mr-1">#{s.numero_contrato} -</span>}
                                {s.cliente_nome}
                              </span>
                              {Array.isArray(s.identificacao_cliente) && s.identificacao_cliente.map(tag => (
                                CLIENT_TAGS[tag] && (
                                    <Badge key={tag} className={cn("text-[9px] px-1 py-0 h-4 border-0", CLIENT_TAGS[tag].color)}>
                                        {CLIENT_TAGS[tag].label}
                                    </Badge>
                                )
                              ))}
                          </div>
                          <Link to={`/ServicoDetalhe?id=${s.id}`} className="opacity-0 group-hover:opacity-100 text-xs text-red-600 underline flex items-center">Ver <ArrowRight className="w-3 h-3 ml-1"/></Link>
                        </div>
                        <div className="flex justify-between mt-1 text-red-700 text-xs">
                            <div className="flex flex-col min-w-0">
                                <span className="truncate max-w-[150px] flex items-center gap-1">
                                  <span className="text-sm">
                                    {(s.tipos_servicos_detalhes && s.tipos_servicos_detalhes.length > 0) 
                                        ? s.tipos_servicos_detalhes.map(t => t.emoji || getServiceEmoji(t.nome)).join(" ") 
                                        : (s.tipo_servico_emoji || getServiceEmoji(s.tipo_servico_nome))}
                                  </span>
                                  {(s.tipos_servicos_detalhes && s.tipos_servicos_detalhes.length > 0)
                                      ? s.tipos_servicos_detalhes.map(t => t.nome).join(" + ")
                                      : s.tipo_servico_nome}
                                </span>
                                {(s.placa_veiculo || s.renavam) && (
                                    <span className="text-[10px] opacity-80 mt-0.5 truncate">
                                        {s.placa_veiculo} {s.renavam && `• Renavam: ${s.renavam}`}
                                    </span>
                                )}
                            </div>
                            <span className="font-bold whitespace-nowrap ml-2">R$ {Number(s.valor_total).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>
                ))
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm text-center">
                    <CheckCircle className="w-10 h-10 mb-3 opacity-20 text-green-500" />
                    <p>Nenhum cliente inadimplente.</p>
                    <p className="text-xs opacity-70">O fluxo financeiro está saudável.</p>
                </div>
            )}
         </div>
      </div>

      {/* Card de Pendências (Fila de Trabalho) */}
      <div className="bg-white rounded-xl border shadow-sm p-5 flex flex-col h-[400px]">
         <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
            <FileQuestion className="w-5 h-5 text-amber-500" />
            Fila de Pendências
            <Badge variant="outline" className="ml-auto bg-amber-50 text-amber-700 border-amber-200">{pendentes.length}</Badge>
         </h3>
         <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {pendentesList.length > 0 ? (
                pendentesList.map(s => (
                    <div key={s.id} className="p-3 bg-amber-50 rounded-lg border border-amber-100 text-sm hover:bg-amber-100 transition-colors group">
                        <div className="font-medium text-amber-900 flex justify-between">
                          <div className="flex items-center gap-1 truncate">
                              <span className="truncate">
                                {s.numero_contrato && <span className="font-bold mr-1">#{s.numero_contrato} -</span>}
                                {s.cliente_nome}
                              </span>
                              {Array.isArray(s.identificacao_cliente) && s.identificacao_cliente.map(tag => (
                                CLIENT_TAGS[tag] && (
                                    <Badge key={tag} className={cn("text-[9px] px-1 py-0 h-4 border-0", CLIENT_TAGS[tag].color)}>
                                        {CLIENT_TAGS[tag].label}
                                    </Badge>
                                )
                              ))}
                          </div>
                          <Link to={`/ServicoDetalhe?id=${s.id}`} className="opacity-0 group-hover:opacity-100 text-xs text-amber-700 underline flex items-center">Resolver <ArrowRight className="w-3 h-3 ml-1"/></Link>
                        </div>
                        <div className="text-amber-800 text-xs mt-1 line-clamp-2 italic">
                          "{s.motivo_pendencia || "Aguardando documentação ou análise inicial..."}"
                        </div>
                        <div className="mt-2 flex flex-col gap-1">
                           <div className="flex items-center gap-2">
                               <span className="text-lg">
                                    {(s.tipos_servicos_detalhes && s.tipos_servicos_detalhes.length > 0) 
                                        ? s.tipos_servicos_detalhes.map(t => t.emoji || getServiceEmoji(t.nome)).join(" ") 
                                        : (s.tipo_servico_emoji || getServiceEmoji(s.tipo_servico_nome))}
                               </span>
                               <ServiceBadge 
                                    name={(s.tipos_servicos_detalhes && s.tipos_servicos_detalhes.length > 0) ? s.tipos_servicos_detalhes.map(t => t.nome).join(" + ") : s.tipo_servico_nome} 
                                    size="sm" 
                                    className="text-[10px] py-0 h-5 bg-white/50" 
                               />
                           </div>
                           {(s.placa_veiculo || s.renavam) && (
                                <span className="text-[10px] text-amber-800/70 pl-7">
                                    {s.placa_veiculo} {s.renavam && `• Renavam: ${s.renavam}`}
                                </span>
                           )}
                        </div>
                    </div>
                ))
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm text-center">
                    <CheckCircle className="w-10 h-10 mb-3 opacity-20 text-green-500" />
                    <p>Nenhuma pendência ativa.</p>
                    <p className="text-xs opacity-70">Todos os processos estão fluindo.</p>
                </div>
            )}
         </div>
         {pendentes.length > 5 && (
            <div className="mt-3 pt-3 border-t text-center">
               <Link to="/Servicos" className="text-xs text-slate-500 hover:text-slate-800 font-medium">
                 Ver mais {pendentes.length - 5} pendências...
               </Link>
            </div>
         )}
      </div>
    </div>
  );
}

export default function Home() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState(null); // { from: Date, to: Date }
  const [showHonorariosPendentes, setShowHonorariosPendentes] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Efeito para limpar o feedback
  useEffect(() => {
    if (feedback) {
      playSound(feedback.type);
      const timer = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Busca todos os serviços para o cálculo de honorários (já que o dashboard-stats pode não ter essa quebra específica)
  const { data: allServicos = [], isLoading } = useQuery({
    queryKey: ["servicos"],
    queryFn: async () => {
      // [MODIFICADO] Usa dados fakes diretamente (Frontend Only)
      return generateFakeData();
    },
    refetchOnMount: false,
    staleTime: Infinity
  });

  // [NOVO] Busca notificações não lidas (Polling a cada 30s)
  const { data: notificacoes = [] } = useQuery({
    queryKey: ["notificacoes"],
    queryFn: async () => {
      // Mock de notificações vazio para evitar erros de conexão
      return [];
    },
    refetchInterval: false, // Desativa polling
  });

  const markAsRead = useMutation({
    mutationFn: async (id) => {
      // Mock
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notificacoes"] })
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      // Mock
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
      setFeedback({ type: 'success', message: "Todas as notificações marcadas como lidas." });
    }
  });

  // [NOVO] Mutação para gerar dados fakes via Frontend
  const seedDataMutation = useMutation({
    mutationFn: async () => {
      // Simula um tempo de processamento para feedback visual
      await new Promise(resolve => setTimeout(resolve, 500));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servicos"] });
      setFeedback({ type: 'success', message: "120 Clientes Fakes gerados e conectados com sucesso!" });
    },
    onError: (e) => setFeedback({ type: 'error', message: "Erro ao gerar dados: " + e.message })
  });

  // --- LÓGICA DE FILTRAGEM UNIFICADA ---
  const filteredServicos = useMemo(() => {
    if (!dateRange || !dateRange.from) return allServicos;

    const start = startOfDay(dateRange.from);
    const end = endOfDay(dateRange.to || dateRange.from);

    return allServicos.filter(s => {
      if (s.status === 'arquivado') return false; // [NOVO] Exclui arquivados de todas as métricas do dashboard

      // Determina qual data usar baseada no status para ser mais preciso no filtro
      let dateToCheck = null;

      if (s.status === 'concluido' && s.data_conclusao) {
        dateToCheck = s.data_conclusao;
      } else if (isPago(s.pagamento_realizado) && s.data_pagamento) { // Se pago, usa data pagamento
        dateToCheck = s.data_pagamento;
      } else {
        // Para pendentes, aprovados, em andamento, usa previsão ou criação (fallback)
        dateToCheck = s.data_pagamento_previsto || s.created_at || s.data_entrada; 
      }

      if (!dateToCheck) return false; // Se não tem data, não entra no filtro de período

      // Tenta fazer o parse da data
      try {
        let date;
        // [FIX] Se for string YYYY-MM-DD pura (do dateStrings: true), cria data local para evitar UTC->Local shift
        if (typeof dateToCheck === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateToCheck)) {
             const [y, m, d] = dateToCheck.split('-').map(Number);
             date = new Date(y, m - 1, d); // Cria data na meia-noite LOCAL
        } else {
             date = new Date(dateToCheck);
        }
        return isWithinInterval(date, { start, end });
      } catch (e) {
        return false;
      }
    });
  }, [allServicos, dateRange]);

  // --- CÁLCULOS BASEADOS NOS DADOS FILTRADOS ---
  const stats = useMemo(() => {
    const pendentes = filteredServicos.filter(s => s.status === 'pendente');
    const aprovados = filteredServicos.filter(s => s.status === 'aprovado');
    const emAndamento = filteredServicos.filter(s => s.status === 'em_andamento');
    const concluidos = filteredServicos.filter(s => s.status === 'concluido');
    
    // Faturamento: considera serviços onde honorários foram pagos OU valor total pago ao detran (dependendo da regra de negócio)
    // Aqui assumindo Valor Total de serviços concluídos ou pagos
    const pagos = filteredServicos.filter(s => s.status === 'concluido' || isPago(s.pagamento_realizado));

    return {
      pendentes: {
        count: pendentes.length,
        total: pendentes.reduce((acc, s) => acc + (Number(s.valor_total) || 0), 0)
      },
      aprovados: {
        count: aprovados.length,
        total: aprovados.reduce((acc, s) => {
          const debitos = parseJSON(s.lista_debitos);
          const totalDebitos = Array.isArray(debitos) 
            ? debitos.filter(d => !d.pago).reduce((sum, d) => sum + (Number(d.valor) || 0), 0)
            : 0;
          return acc + totalDebitos;
        }, 0)
      },
      emAndamento: {
        count: emAndamento.length,
        total: emAndamento.reduce((acc, s) => acc + (Number(s.valor_total) || 0), 0)
      },
      concluidos: {
        count: concluidos.length
      },
      faturamento: {
        total: pagos.reduce((acc, s) => acc + (Number(s.valor_total) || 0), 0), // Ou valor_honorarios dependendo do que "R$ Pagos" significa
        count: pagos.length
      }
    };
  }, [filteredServicos]);

  // Listas específicas para tabelas/modais
  const honorariosPendentes = filteredServicos.filter(s => s.status === 'concluido' && !isPago(s.pagamento_realizado));
  const honorariosPagos = filteredServicos.filter(s => s.status === 'concluido' && isPago(s.pagamento_realizado));
  const totalHonorariosPendentes = honorariosPendentes.reduce((acc, s) => acc + (Number(s.valor_honorarios) || 0), 0);

  // Recentes (pega os 6 últimos do filtro atual)
  const recentes = [...filteredServicos].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 6);

  const payHonorariosMutation = useMutation({
    mutationFn: async (servico) => { // A lógica de envio permanece a mesma
        // Remove campos de metadados, mas MANTÉM veiculo, chassi, uf, etc.
        const { tipo_servico_nome, created_at, updated_at, honorarios_pago, ...dadosLimpos } = servico;
        const updatedData = { 
            ...dadosLimpos, 
            pagamento_realizado: 1,
            // [FIX] Define o valor pago igual ao valor total dos honorários
            honorarios_pagos: parseFloat(servico.valor_honorarios) || 0,
            data_pagamento: servico.data_pagamento || formatDateForInput(new Date()),
            documentos_necessarios: parseDocs(servico.documentos_necessarios),
            documentos_entregues: parseDocs(servico.documentos_entregues)
        };
        const response = await fetch(`${API_BASE_URL}/api/servicos/${servico.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(updatedData),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error("Falha ao atualizar pagamento: " + errorText);
        }
        return response.json();
    },
    // Implementando a atualização otimista
    onMutate: async (servicoParaAtualizar) => {
      // Cancela requisições em andamento para evitar sobreposição
      await queryClient.cancelQueries({ queryKey: ["servicos"] });

      // Salva o estado anterior do cache
      const estadoAnterior = queryClient.getQueryData(["servicos"]);

      // Atualiza o cache localmente de forma otimista
      queryClient.setQueryData(["servicos"], (oldData) =>
        oldData.map((s) =>
          s.id === servicoParaAtualizar.id ? { ...s, pagamento_realizado: 1 } : s
        )
      );

      // Retorna o estado anterior para possível rollback
      return { estadoAnterior };
    },
    onError: (err, servico, context) => {
      // Em caso de erro, reverte para o estado anterior
      if (context?.estadoAnterior) {
        queryClient.setQueryData(["servicos"], context.estadoAnterior);
      }
      setFeedback({ type: 'error', message: "Falha na Sincronização: A alteração não pôde ser salva." });
    },
    onSettled: () => {
      // Garante que o cache seja revalidado com os dados do servidor
      queryClient.invalidateQueries({ queryKey: ["servicos"] });
    },
    onSuccess: () => {
      setFeedback({ type: 'success', message: "Pagamento registrado com sucesso!" });
    }
  });

  const exportToPDF = (data, filename, title) => {
    if (!data || data.length === 0) {
      setFeedback({ type: 'warning', message: "Nenhum dado para exportar." });
      return;
    }

    const doc = new jsPDF({ orientation: "landscape" });
    
    // Configuração do Logo (Adicione sua string Base64 aqui)
    let startY = 22;

    if (logo) {
      try {
        doc.addImage(logo, "PNG", 14, 10, 30, 15); // Ajuste posição e tamanho (x, y, w, h)
        startY = 35; // Empurra o texto para baixo se houver logo
      } catch (e) {
        console.error("Erro ao adicionar logo:", e);
      }
    }

    // Configuração do Título
    doc.setFontSize(16);
    doc.setTextColor(40);
    doc.text(title, 14, startY);
    
    // Data de geração
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, startY + 6);

    // Cálculo do Total
    const totalValor = data.reduce((acc, curr) => acc + (Number(curr.valor_honorarios) || 0), 0);

    // Configuração da Tabela
    const headers = [["Cliente", "Telefone", "Serviço", "Veículo", "Placa", "UF", "Chassi", "Valor", "Conclusão"]];
    const rows = data.map(servico => [
      servico.cliente_nome || "—",
      servico.cliente_telefone || "—",
      servico.tipo_servico_nome || "—",
      servico.veiculo || "—",
      servico.placa_veiculo || "—",
      servico.uf_veiculo || "—",
      servico.chassi || "—",
      Number(servico.valor_honorarios || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      servico.data_conclusao ? format(new Date(servico.data_conclusao), "dd/MM/yyyy", { locale: ptBR }) : "—"
    ]);

    autoTable(doc, {
      head: headers,
      body: rows,
      foot: [[
        `Total: ${data.length} serviços`, 
        "", 
        "", 
        "", 
        "", 
        "", 
        "", 
        totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 
        ""
      ]],
      startY: startY + 15,
      headStyles: { fillColor: [15, 23, 42] }, // Cor escura (Slate-900)
      footStyles: { fillColor: [15, 23, 42] }, // Mesmo estilo do cabeçalho para o rodapé
      styles: { fontSize: 8 }, // Fonte ligeiramente menor para caber a nova coluna
      alternateRowStyles: { fillColor: [241, 245, 249] } // Cor clara alternada (Slate-100)
    });

    doc.save(`${filename}.pdf`);
    
    setFeedback({ type: 'success', message: "PDF gerado com sucesso." });
  };

  const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) {
      setFeedback({ type: 'warning', message: "Nenhum dado para exportar." });
      return;
    }

    const headers = ["Cliente", "Tipo de Serviço", "Veículo", "Placa", "UF", "Chassi", "Valor Honorários", "Data Conclusão"];
    const rows = data.map(servico => [
      servico.cliente_nome || "",
      servico.tipo_servico_nome || "",
      servico.veiculo || "",
      servico.placa_veiculo || "",
      servico.uf_veiculo || "",
      servico.chassi || "",
      Number(servico.valor_honorarios || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      servico.data_conclusao ? format(new Date(servico.data_conclusao), "dd/MM/yyyy", { locale: ptBR }) : ""
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
                     + headers.join(";") + "\n" 
                     + rows.map(e => e.join(";")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link); // Required for Firefox
    link.click();
    document.body.removeChild(link); // Clean up
    
    setFeedback({ type: 'success', message: "CSV exportado com sucesso." });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="mt-8 mx-4 md:mx-10 pb-24 space-y-10 text-left">
    {/* Título e Subtítulo com margem própria se necessário */}
    <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="md:flex-1">
        <h1 className="text-2xl font-bold text-slate-900">Painel de Gestão despachante</h1>
        <p className="text-slate-500">Métricas de faturamento e processos em tempo real</p>
      </div>

      <div className="flex justify-center items-center gap-3">
        {/* [NOVO] Sino de Notificações */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="relative bg-white border-slate-200 text-slate-600 hover:bg-slate-50">
              <Bell className="w-5 h-5" />
              {notificacoes.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="p-3 border-b flex justify-between items-center bg-slate-50">
              <h4 className="font-semibold text-sm text-slate-700">Notificações</h4>
              {notificacoes.length > 0 && (
                <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600 hover:text-blue-800" onClick={() => markAllAsRead.mutate()}>
                  <Check className="w-3 h-3 mr-1" /> Marcar todas
                </Button>
              )}
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {notificacoes.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">Nenhuma notificação nova.</div>
              ) : (
                notificacoes.map(n => (
                  <div key={n.id} className="p-3 border-b last:border-0 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => markAsRead.mutate(n.id)}>
                    <p className="text-sm font-medium text-slate-800">{n.titulo}</p>
                    <p className="text-xs text-slate-500 mt-1">{n.mensagem}</p>
                    <p className="text-[10px] text-slate-400 mt-2 text-right">{format(new Date(n.created_at), "dd/MM HH:mm", { locale: ptBR })}</p>
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Button 
          variant="outline" 
          onClick={() => window.location.reload()} 
          title="Atualizar Página (F5)"
          className="bg-white border-slate-200 text-slate-600 hover:bg-slate-50 gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar dados
        </Button>
      </div>

      {/* Filtro de Data */}
      <div className="md:flex-1 flex md:justify-end items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-[280px] justify-start text-left font-normal",
                !dateRange && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                    {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                  </>
                ) : (
                  format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                )
              ) : (
                <span>Filtrar por período</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
        {dateRange && (
          <Button variant="ghost" size="icon" onClick={() => setDateRange(null)} title="Limpar filtro">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>

      {/* Grid de Estatísticas Financeiras e de Processo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link to="/Servicos?status=pendente" className="block transition-transform hover:scale-[1.02]">
          <StatsCard
            title="Documentos Pendentes"
            value={stats.pendentes.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            subtitle={`${stats.pendentes.count} serviços pendentes`}
            icon={FileQuestion}
            color="red"
          />
        </Link>
        <Link to="/Servicos?status=aprovado" className="block transition-transform hover:scale-[1.02]">
          <StatsCard
            title="Aprovados"
            value={stats.aprovados.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            subtitle={`${stats.aprovados.count} serviços aprovados`}
            icon={CheckCircle}
            color="green"
          />
        </Link>
        <Link to="/Servicos?status=em_andamento" className="block transition-transform hover:scale-[1.02]">
          <StatsCard
            title="Em andamento"
            value={stats.emAndamento.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            subtitle={`${stats.emAndamento.count} serviços`}
            icon={Users}
            color="tiffany"
          />
        </Link>
        <Link to="/Servicos?status=concluido" className="block transition-transform hover:scale-[1.02]">
          <StatsCard
            title="R$ Pagos ao Detran"
            value={stats.faturamento.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            subtitle={`${stats.faturamento.count} serviços`}
            icon={DollarSign}
            color="blue"
          />
        </Link>
      </div>

      {/* Layout Principal: Documentos Aprovados (Maior) e Débitos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <DebitosList servicos={filteredServicos} />
        </div>
        <div>
          <EnhancedUpcomingPayments servicos={filteredServicos} />
        </div>
      </div>

      {/* Layout Secundário: Inadimplentes e Pendências */}
      <div className="mt-2">
          <OperationalHighlights servicos={filteredServicos} />
      </div>

      {/* Seção de Atalho Rápido */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-800">Processos Recentes</h2>
          <Link to={createPageUrl("Servicos")}>
            <Button variant="outline" size="sm">Gerir todos</Button>
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recentes.map((servico) => {
            const hasStatusExt = (servico.status === 'em_andamento' && servico.motivo_andamento) ||
                                 (servico.status === 'aprovado' && servico.motivo_aprovacao) ||
                                 (servico.status === 'concluido' && servico.motivo_conclusao);

            return (
            <div key={servico.id} className={`flex flex-col ${servico.inadimplente ? "relative" : ""}`}>
               {!!servico.inadimplente && (
                 <div className="absolute -top-2 -right-2 z-50 bg-black text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center shadow-lg"><Skull className="w-3 h-3 mr-1" /> INADIMPLENTE</div>
               )}
               <div className="absolute -top-2 left-2 z-50 flex gap-1">
                   {Array.isArray(servico.identificacao_cliente) && servico.identificacao_cliente.map(tag => (
                       CLIENT_TAGS[tag] && (
                           <div key={tag} className={cn("text-[10px] font-bold px-2 py-1 rounded-full flex items-center shadow-lg border-0", CLIENT_TAGS[tag].color)}>{CLIENT_TAGS[tag].label}</div>
                       )
                   ))}
               </div>
               <div className="relative z-10">
                 <ServicoCardInternal servico={servico} />
               </div>

               {/* Exibição do Motivo de Andamento (Extensão do Card) */}
               {servico.status === 'em_andamento' && servico.motivo_andamento && (
                 <div className="mx-2 -mt-2 pt-4 pb-2 px-3 bg-teal-50/80 border-x border-b border-teal-100 rounded-b-lg text-xs text-teal-800 relative z-0 animate-in slide-in-from-top-2">
                    <p className="line-clamp-2" title={servico.motivo_andamento}>
                       <span className="font-bold uppercase mr-1">Andamento:</span>
                       {servico.motivo_andamento}
                    </p>
                 </div>
               )}

               {/* Exibição do Motivo de Aprovação */}
               {servico.status === 'aprovado' && servico.motivo_aprovacao && (
                 <div className="mx-2 -mt-2 pt-4 pb-2 px-3 bg-green-50/80 border-x border-b border-green-100 rounded-b-lg text-xs text-green-800 relative z-0 animate-in slide-in-from-top-2">
                    <p className="line-clamp-2" title={servico.motivo_aprovacao}>
                       <span className="font-bold uppercase mr-1">Aprovação:</span>
                       {servico.motivo_aprovacao}
                    </p>
                 </div>
               )}

               {/* Exibição do Motivo de Conclusão */}
               {servico.status === 'concluido' && servico.motivo_conclusao && (
                 <div className="mx-2 -mt-2 pt-4 pb-2 px-3 bg-blue-50/80 border-x border-b border-blue-100 rounded-b-lg text-xs text-blue-800 relative z-0 animate-in slide-in-from-top-2">
                    <p className="line-clamp-2" title={servico.motivo_conclusao}>
                       <span className="font-bold uppercase mr-1">Conclusão:</span>
                       {servico.motivo_conclusao}
                    </p>
                 </div>
               )}
            </div>
          )})}
        </div>

        {recentes.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed">
            <p className="text-slate-500">Sem dados financeiros para exibir. Adicione um serviço para começar.</p>
          </div>
        )}
      </div>

      {/* Seção de Controle de Honorários */}
      <div className="mt-8 border-t pt-8">
        <h2 className="text-xl font-semibold text-slate-800 mb-4">Controle de Honorários (Serviços Concluídos)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div 
              onClick={() => setShowHonorariosPendentes(true)} 
              className="cursor-pointer transition-transform hover:scale-[1.01]"
            >
              <StatsCard
                title="Honorários Pendentes"
                value={totalHonorariosPendentes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                subtitle={`${honorariosPendentes.length} serviços concluídos sem pagamento`}
                icon={AlertCircle}
                color="red"
              />
            </div>
            <div> {/* Wrap StatsCard and button in a div */}
              <StatsCard
                title="Honorários Pagos"
                value={honorariosPagos.length}
                subtitle="Serviços concluídos e pagos"
                icon={CheckCircle}
                color="green"
              />
              <div className="flex justify-end mt-2 gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => exportToPDF(honorariosPagos, "honorarios_pagos", "Relatório de Honorários Pagos")}
                >
                  <FileText className="w-4 h-4 mr-1" /> PDF
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => exportToCSV(honorariosPagos, "honorarios_pagos")}
                >
                  <FileText className="w-4 h-4 mr-1" /> CSV
                </Button>
              </div>
            </div>
        </div>
      </div>

      {/* Modal de Detalhes de Honorários Pendentes */}
      <Dialog open={showHonorariosPendentes} onOpenChange={setShowHonorariosPendentes}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Honorários Pendentes</DialogTitle>
            <DialogDescription>
              Lista de serviços concluídos que ainda não tiveram os honorários pagos.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end mb-4 gap-2">
            <Button 
              variant="outline" 
              onClick={() => exportToPDF(honorariosPendentes, "honorarios_pendentes", "Relatório de Honorários Pendentes")}
            >
              <FileText className="w-4 h-4 mr-2" /> Exportar PDF
            </Button>
            <Button 
              variant="outline" 
              onClick={() => exportToCSV(honorariosPendentes, "honorarios_pendentes")}
            >
              <FileText className="w-4 h-4 mr-2" /> Exportar para CSV
            </Button>
          </div>
          <div className="space-y-3 mt-2">
            {honorariosPendentes.length > 0 ? (
              honorariosPendentes.map((servico) => (
                <div key={servico.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
                  <div>
                    <h4 className="font-medium text-slate-900">{servico.cliente_nome}</h4>
                    <div className="flex flex-wrap items-center gap-x-2 text-sm text-slate-500 mt-1">
                      <ServiceBadge name={servico.tipo_servico_nome} size="sm" className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-indigo-200 shadow-none" />
                      {servico.placa_veiculo && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span>{servico.placa_veiculo}</span>
                        </>
                      )}
                      {servico.renavam && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span>Renavam: {servico.renavam}</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Concluído em: {servico.data_conclusao ? format(new Date(servico.data_conclusao), "dd/MM/yyyy", { locale: ptBR }) : "Data não registrada"}
                    </p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <span className="font-bold text-red-600">
                      {Number(servico.valor_honorarios).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-6 text-xs border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
                        onClick={() => payHonorariosMutation.mutate(servico)}
                        disabled={payHonorariosMutation.isPending}
                      >
                        {payHonorariosMutation.isPending && payHonorariosMutation.variables?.id === servico.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Marcar Pago"}
                      </Button>
                      <Link 
                        to={createPageUrl("ServicoDetalhe") + `?id=${servico.id}`}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        Ver detalhes
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500 opacity-50" />
                <p>Todos os honorários de serviços concluídos foram pagos!</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Feedback Visual Personalizado */}
      {feedback && (
        <div className={`fixed bottom-6 right-6 z-[100] px-6 py-3 rounded-lg shadow-2xl text-white font-medium flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 ${feedback.type === 'error' ? 'bg-red-600' : feedback.type === 'warning' ? 'bg-amber-500' : 'bg-emerald-600'}`}>
          {feedback.type === 'error' ? <AlertCircle className="w-5 h-5" /> : feedback.type === 'warning' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          {feedback.message}
        </div>
      )}
    </div>
  );
}