import { User, Phone, Car, MapPin, FileText, Calendar, CalendarClock, Wallet, Skull, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getServiceEmoji, parseDocs, parseJSON, isPago } from "@/lib/helpers";

export default function ServicoCardInternal({ servico }) {
  const docsEntregues = parseDocs(servico.documentos_entregues);
  const docsNecessarios = parseDocs(servico.documentos_necessarios);
  const progress = docsNecessarios.length > 0 
    ? Math.round((docsEntregues.length / docsNecessarios.length) * 100) 
    : (docsEntregues.length > 0 ? 100 : 0);

  // Configuração de Status
  const getStatusConfig = (status) => {
      switch(String(status).toLowerCase()) {
          case 'aprovado': return { color: 'bg-green-500 text-white border-green-600', icon: '✅', label: 'Aprovado' };
          case 'concluido': return { color: 'bg-blue-500 text-white border-blue-600', icon: '🏁', label: 'Concluído' };
          case 'em_andamento': return { color: 'bg-teal-500 text-white border-teal-600', icon: '⚙️', label: 'Em Andamento' };
          case 'cancelado': return { color: 'bg-slate-500 text-white border-slate-600', icon: '🚫', label: 'Cancelado' };
          case 'pendente': return { color: 'bg-red-500 text-white border-red-600', icon: '⏳', label: 'Pendente' };
          case 'congelado': return { color: 'bg-cyan-500 text-white border-cyan-600', icon: '❄️', label: 'Congelado' };
          case 'estorno': return { color: 'bg-purple-500 text-white border-purple-600', icon: '↩️', label: 'Estorno' };
          default: return { color: 'bg-slate-500 text-white border-slate-600', icon: '❓', label: status };
      }
  };
  const statusConfig = getStatusConfig(servico.status);

  // Lógica para próxima parcela
  const getProximaParcela = () => {
      const parcelasEntrada = parseJSON(servico.lista_parcelas_entrada);
      const proximaEntrada = Array.isArray(parcelasEntrada) ? parcelasEntrada.find(p => {
          const d = new Date(p.data_vencimento);
          return d >= new Date().setHours(0,0,0,0);
      }) : null;

      if (proximaEntrada) return { date: proximaEntrada.data_vencimento, value: proximaEntrada.valor, obs: `(${proximaEntrada.numero}x)` };
      if (servico.qtd_boletos_a_vencer > 0 && servico.data_vencimento_parcela) {
          return { date: servico.data_vencimento_parcela, value: servico.valor_boleto_aberto, obs: `(${servico.qtd_boletos_a_vencer}x)` };
      }
      return null;
  };
  const proximaParcela = getProximaParcela();

  // Lógica para débitos
  const debitos = parseJSON(servico.lista_debitos);
  const totalDebitos = Array.isArray(debitos) ? debitos.filter(d => !d.pago).reduce((acc, d) => acc + (Number(d.valor) || 0), 0) : 0;

  const isInadimplente = !!servico.inadimplente;
  const temEntrada = Number(servico.valor_entrada) > 0;
  
  // [CORREÇÃO] Verifica se a entrada está paga (Global ou Parcelada)
  let entradaPaga = isPago(servico.pagamento_realizado);
  if (!entradaPaga && servico.entrada_parcelada) {
      const parcelasEntrada = parseJSON(servico.lista_parcelas_entrada);
      if (Array.isArray(parcelasEntrada) && parcelasEntrada.length > 0) {
          entradaPaga = parcelasEntrada.every(p => p.pago);
      }
  }

  return (
    <div className={cn(
      "rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 p-5 h-full flex flex-col relative group",
      isInadimplente ? "bg-slate-200 border-slate-400" : "bg-white"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-2">
        <div className="inline-flex items-center text-xs font-normal shadow-sm border rounded-md bg-slate-50 text-slate-700 border-slate-200 p-1.5" title={servico.tipo_servico_nome}>
           <span className="text-lg mr-1.5">{servico.tipo_servico_emoji || getServiceEmoji(servico.tipo_servico_nome)}</span>
           <span className="font-medium max-w-[120px] truncate">{servico.tipo_servico_nome}</span>
        </div>
        <div className="flex-shrink-0">
           <div className={cn("inline-flex items-center rounded-md shadow font-medium border text-xs px-2 py-0.5", statusConfig.color)}>
              <span className="mr-1.5 text-xs">{statusConfig.icon}</span>{statusConfig.label}
           </div>
        </div>
      </div>

      {/* Client Info */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 overflow-hidden">
           <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200">
             <User className="w-5 h-5 text-slate-500" />
           </div>
           <div className="min-w-0">
             <h3 className="font-bold text-slate-800 truncate text-sm leading-tight" title={servico.cliente_nome}>
               {servico.numero_contrato && <span className="text-slate-500 mr-1">#{servico.numero_contrato} -</span>}
               {servico.cliente_nome}
             </h3>
             <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
               <Phone className="w-3 h-3" />
               <span>{servico.cliente_telefone || "Sem telefone"}</span>
             </div>
           </div>
        </div>
      </div>

      {/* Vehicle Info */}
      <div className="bg-slate-50 rounded-lg p-3 mb-4 border border-slate-100">
         <div className="flex items-center gap-2 mb-1.5">
            <Car className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="font-semibold text-slate-700 text-xs truncate" title={servico.veiculo}>
              {servico.veiculo || "Veículo não informado"}
            </span>
         </div>
         <div className="flex items-center gap-2 pl-6 flex-wrap">
            <div className="inline-flex items-center rounded-md border px-2 py-0.5 font-semibold bg-white border-slate-300 text-slate-700 font-mono text-xs">
              {servico.placa_veiculo || "---"}
            </div>
            {servico.renavam && (
                <span className="text-[10px] text-slate-500 font-mono border border-slate-200 bg-white px-1.5 py-0.5 rounded flex items-center">
                    Renavam: {servico.renavam}
                </span>
            )}
            {servico.uf_veiculo && <span className="text-xs text-slate-500 flex items-center gap-0.5 ml-auto"><MapPin className="w-3 h-3" /> {servico.uf_veiculo}</span>}
         </div>
      </div>

      {/* Documentation Progress */}
      <div className="mb-4">
         <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-slate-500 text-xs flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Documentação</span>
            <span className="text-xs font-medium text-slate-700">{docsEntregues.length}/{docsNecessarios.length}</span>
         </div>
         <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all duration-500", progress === 100 ? "bg-green-500" : "bg-blue-500")} style={{ width: `${progress}%` }} />
         </div>
      </div>

      {/* Informações Financeiras Detalhadas (Próxima Parcela e Débitos) */}
      <div className="space-y-2 mb-4">
          {proximaParcela && (
            <div className="p-2 rounded-lg border flex items-center justify-between bg-blue-50 border-blue-200">
                <div className="flex items-center gap-2 text-blue-700">
                    <CalendarClock className="w-4 h-4" />
                    <span className="text-xs font-bold">Próxima Parcela:</span>
                </div>
                <div className="text-right">
                    <span className="text-xs font-bold block text-blue-800">
                        {format(new Date(proximaParcela.date + 'T12:00:00'), "dd/MM/yyyy")}
                    </span>
                    <span className="text-[10px] font-semibold block text-blue-600">
                        {Number(proximaParcela.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        <span className="ml-1">{proximaParcela.obs}</span>
                    </span>
                </div>
            </div>
          )}

          {totalDebitos > 0 && (
            <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-700">
                    <Wallet className="w-4 h-4" />
                    <span className="text-xs font-bold">Débitos a pagar:</span>
                </div>
                <span className="text-xs font-bold text-amber-800">
                    {totalDebitos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
            </div>
          )}
      </div>

      {/* Financial Info */}
      <div className="grid grid-cols-2 gap-3 text-sm mt-auto pt-3 border-t border-slate-100">
         <div>
            <p className="text-slate-400 text-[10px] uppercase font-bold mb-0.5">Honorários</p>
            <div className="flex items-center gap-1.5">
               <span className="font-semibold text-slate-800">{Number(servico.valor_honorarios || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
               <div className={cn("inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold", isPago(servico.pagamento_realizado) ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200")}>
                  {isPago(servico.pagamento_realizado) ? "Pago" : "Pendente"}
               </div>
            </div>
            {temEntrada && (
               <div className={cn("mt-1.5 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold", 
                  entradaPaga ? "bg-green-100 text-green-800 border-green-200" : "bg-purple-300 text-black border-purple-400")}>
                  {entradaPaga ? "Entrada Paga" : "Entrada em Aberto"}
               </div>
            )}
         </div>
         <div className="text-right">
            <p className="text-slate-400 text-[10px] uppercase font-bold mb-0.5">Previsão</p>
            <p className="font-medium text-slate-700 flex items-center justify-end gap-1">
               <Calendar className="w-3 h-3 text-slate-400" />
               {servico.data_pagamento_previsto ? format(new Date(servico.data_pagamento_previsto), "dd/MM", { locale: ptBR }) : "--/--"}
            </p>
         </div>
      </div>

      {/* Botão Ver Detalhes */}
      <div className="mt-3 flex justify-end">
        <Link to={`/ServicoDetalhe?id=${servico.id}`} className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline z-10">
            Ver detalhes <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}