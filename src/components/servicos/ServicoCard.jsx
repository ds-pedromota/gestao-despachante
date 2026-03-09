import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  User, Car, Phone, FileText, Calendar, 
  ChevronRight, AlertCircle, MapPin, Copy, Wallet, CalendarClock, CheckCircle
} from "lucide-react";
import { format, isBefore, startOfDay, isSameDay, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import StatusBadge from "./StatusBadge";
import ServiceBadge from "./ServiceBadge";
import { cn } from "@/lib/utils";
import { parseDocs, parseJSON, isPago } from "@/lib/helpers";
import { playSound } from "@/lib/audio";
import { useToast } from "@/components/ui/use-toast";

const STATUS_BORDER = {
  pendente: "border-l-red-500",
  aprovado: "border-l-green-500",
  em_andamento: "border-l-teal-500",
  concluido: "border-l-blue-600",
  congelado: "border-l-sky-400",
  estorno: "border-l-purple-500",
  cancelado: "border-l-gray-500"
};

export default function ServicoCard({ servico, onEdit }) {
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (feedback) {
      playSound('success'); // Feedback do card é sempre sucesso (cópia)
      const timer = setTimeout(() => setFeedback(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);
  
  const docsEntreguesList = parseDocs(servico.documentos_entregues);
  const docsNecessariosList = parseDocs(servico.documentos_necessarios);
  const listaDebitos = parseJSON(servico.lista_debitos);
  
  const docsEntregues = docsEntreguesList.length;
  const docsNecessarios = docsNecessariosList.length;
  const progressoDocs = docsNecessarios > 0 ? Math.round((docsEntregues / docsNecessarios) * 100) : 0;

  const docsFaltantes = docsNecessariosList.filter(
    doc => !docsEntreguesList.some(d => d.nome === doc)
  ) || [];

  // Verifica se há débitos pendent
  const debitosPendentes = listaDebitos.filter(d => !d.pago);
  const totalDebitosPendentes = debitosPendentes.reduce((acc, d) => acc + (Number(d.valor) || 0), 0);

  // Helper para data segura (evita problema de timezone com YYYY-MM-DD)
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (typeof dateStr === 'string' && dateStr.length === 10) {
       return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    }
    return date;
  };

  let vencimentoParcela = parseDate(servico.data_vencimento_parcela);
  const qtdParcelas = parseInt(servico.qtd_boletos_a_vencer) || 0;
  let todasParcelasVencidas = false;

  // Lógica para mostrar a próxima parcela se a atual estiver vencida
  if (vencimentoParcela && qtdParcelas > 0) {
      const today = startOfDay(new Date());
      const lastParcelaDate = addMonths(vencimentoParcela, qtdParcelas - 1);

      // Se a última parcela já venceu (está no passado), considera quitado
      if (isBefore(startOfDay(lastParcelaDate), today)) {
          todasParcelasVencidas = true;
      } else if (!servico.inadimplente && isBefore(startOfDay(vencimentoParcela), today)) {
          // [MODIFICADO] Se inadimplente, NÃO avança a data (congela na parcela vencida)
          // Se a primeira venceu mas a última não, procura a próxima vigente
          let bestDate = vencimentoParcela;
          for (let i = 1; i < qtdParcelas; i++) {
              const nextDate = addMonths(vencimentoParcela, i);
              bestDate = nextDate;
              if (!isBefore(startOfDay(nextDate), today)) {
                  break;
              }
          }
          vencimentoParcela = bestDate;
      }
  }

  const isVencido = vencimentoParcela && isBefore(startOfDay(vencimentoParcela), startOfDay(new Date()));
  const isHoje = vencimentoParcela && isSameDay(vencimentoParcela, new Date());

  // Cálculo do Lucro
  const lucro = (parseFloat(servico.valor_entrada) || 0) + 
                ((parseFloat(servico.valor_boleto_aberto) || 0) * (parseInt(servico.qtd_boletos_a_vencer) || 0)) - 
                (parseFloat(servico.valor_total) || 0);

  const handleCopyPhone = (e) => {
    e.stopPropagation();
    if (servico.cliente_telefone) {
      navigator.clipboard.writeText(servico.cliente_telefone);
      setFeedback("Telefone copiado!");
    }
  };

  const isInadimplente = !!servico.inadimplente;

  return (
    <Card className={cn(
      "border-l-4 hover:shadow-lg transition-all duration-300 overflow-hidden group",
      STATUS_BORDER[servico.status],
      isInadimplente ? "bg-zinc-950 border-zinc-800" : ""
    )}>
      <CardContent className="p-0">
        <div className="p-5">
          <div className={isInadimplente ? "filter grayscale invert brightness-90" : ""}>
          {/* Header */}
          <div className="flex items-start justify-between mb-4 gap-2">
            <ServiceBadge name={servico.tipo_servico_nome} />
            <div className="flex-shrink-0">
              <StatusBadge status={servico.status} size="sm" />
            </div>
          </div>

          {/* Cliente e Ações */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                 <User className="w-4 h-4 text-slate-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 truncate text-sm leading-tight">{servico.cliente_nome}</h3>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Phone className="w-3 h-3" /> 
                  <span>{servico.cliente_telefone || "Sem telefone"}</span>
                  {servico.cliente_telefone && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-slate-400 hover:text-blue-600"
                      onClick={handleCopyPhone}
                      title="Copiar telefone"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Seção Veículo (Novo Destaque) */}
          <div className="bg-slate-50 rounded-lg p-3 mb-4 border border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <Car className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-slate-700 text-sm">
                {servico.veiculo || "Veículo não informado"}
              </span>
            </div>
            <div className="flex items-center gap-2 pl-6">
              {servico.placa_veiculo ? (
                <Badge variant="outline" className="bg-white border-slate-300 text-slate-700 font-mono text-xs">
                  {servico.placa_veiculo}
                </Badge>
              ) : <span className="text-xs text-slate-400">Sem placa</span>}
              
              {servico.uf_veiculo && (
                <span className="text-xs text-slate-500 flex items-center gap-0.5">
                  <MapPin className="w-3 h-3" /> {servico.uf_veiculo}
                </span>
              )}
            </div>
          </div>

          {/* Progresso de Documentos */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-slate-500 text-xs flex items-center gap-1">
                <FileText className="w-4 h-4" />
                Documentação
              </span>
              <span className="text-xs font-medium text-slate-700">
                {docsEntregues}/{docsNecessarios}
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all",
                  progressoDocs === 100 ? "bg-green-500" : "bg-amber-500"
                )}
                style={{ width: `${progressoDocs}%` }}
              />
            </div>
            {docsFaltantes.length > 0 && servico.status === "pendente" && (
              <div className="mt-2 p-2 bg-red-50 rounded-lg border border-red-100">
                <p className="text-xs font-medium text-red-700 flex items-center gap-1 mb-1">
                  <AlertCircle className="w-3 h-3" />
                  Documentos faltantes:
                </p>
                <p className="text-xs text-red-600">
                  {docsFaltantes.slice(0, 3).join(", ")}
                  {docsFaltantes.length > 3 && ` +${docsFaltantes.length - 3} mais`}
                </p>
              </div>
            )}
          </div>

          {/* Financeiro */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-bold mb-0.5">Honorários</p>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-800">
                  R$ {Number(servico.valor_honorarios || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
                {isPago(servico.pagamento_realizado) ? (
                  <Badge variant="outline" className="h-4 px-1 bg-green-50 text-green-700 border-green-200 text-[9px]">Pago</Badge>
                ) : (
                  <Badge variant="outline" className="h-4 px-1 bg-amber-50 text-amber-700 border-amber-200 text-[9px]">Pendente</Badge>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-slate-400 text-[10px] uppercase font-bold mb-0.5">
                {isPago(servico.pagamento_realizado) ? "Pago em" : "Previsão"}
              </p>
              <p className="font-medium text-slate-700 flex items-center justify-end gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                {servico.data_pagamento || servico.data_pagamento_previsto
                  ? format(new Date(servico.data_pagamento || servico.data_pagamento_previsto), "dd/MM", { locale: ptBR })
                  : "--/--"}
              </p>
            </div>
          </div>
          </div>

          {/* Motivo Pendência */}
          {servico.motivo_pendencia && servico.status === "pendente" && (
            <div className="mt-3 p-2 bg-red-50 rounded-lg border border-red-200">
              <p className="text-xs text-red-700">
                <strong>Pendência:</strong> {servico.motivo_pendencia}
              </p>
            </div>
          )}

          <div className={isInadimplente ? "filter grayscale invert brightness-90" : ""}>
          {/* Motivo Cancelamento/Estorno */}
          {(servico.status === "estorno" || servico.status === "cancelado") && servico.motivo_cancelamento && (
            <div className="mt-3 p-2 bg-slate-100 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-700">
                <strong>Motivo:</strong> {servico.motivo_cancelamento}
              </p>
            </div>
          )}

          {/* Alerta de Vencimento de Parcela */}
          {vencimentoParcela && (
            todasParcelasVencidas ? (
              <div className="mt-3 p-2 rounded-lg border flex items-center justify-between bg-green-50 border-green-200">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-xs font-bold">Quitado</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold block text-green-800">
                    Lucro: R$ {lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ) : (
              <div className={cn(
                "mt-3 p-2 rounded-lg border flex items-center justify-between",
                isVencido ? "bg-red-50 border-red-200" : isHoje ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200"
              )}>
                <div className={cn("flex items-center gap-2", isVencido ? "text-red-700" : isHoje ? "text-amber-700" : "text-blue-700")}>
                  <CalendarClock className="w-4 h-4" />
                  <span className="text-xs font-bold">
                    {isVencido ? "Parcela Vencida:" : isHoje ? "Vence Hoje:" : "Próxima Parcela:"}
                  </span>
                </div>
                <div className="text-right">
                  <span className={cn("text-xs font-bold block", isVencido ? "text-red-800" : isHoje ? "text-amber-800" : "text-blue-800")}>
                    {format(vencimentoParcela, "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                  {Number(servico.valor_boleto_aberto) > 0 && (
                    <span className={cn("text-[10px] font-semibold block", isVencido ? "text-red-600" : isHoje ? "text-amber-600" : "text-blue-600")}>
                      R$ {Number(servico.valor_boleto_aberto).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      {Number(servico.qtd_boletos_a_vencer) > 0 && (
                        <span className="ml-1">({servico.qtd_boletos_a_vencer}x)</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            )
          )}

          {/* Alerta de Débitos em Aberto (Melhoria Solicitada) */}
          {debitosPendentes.length > 0 && (
            <div className="mt-3 p-2 bg-amber-50 rounded-lg border border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-700">
                <Wallet className="w-4 h-4" />
                <span className="text-xs font-bold">Débitos a pagar:</span>
              </div>
              <span className="text-xs font-bold text-amber-800">
                R$ {totalDebitosPendentes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
          </div>
        </div>

        {/* Footer */}
        <div 
          onClick={() => onEdit ? onEdit(servico) : navigate(createPageUrl("ServicoDetalhe") + `?id=${servico.id}`)}
          className={cn("px-5 py-3 bg-slate-50/50 border-t flex items-center justify-between group-hover:bg-blue-50/50 transition-colors cursor-pointer", isInadimplente ? "filter grayscale invert brightness-90" : "")}
        >
          <span className="text-xs font-medium text-slate-600 group-hover:text-blue-700">Ver detalhes do processo</span>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
        </div>
      </CardContent>

      {/* Feedback Local do Card */}
      {feedback && (
        <div className="absolute top-2 right-2 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-md shadow-lg animate-in fade-in zoom-in-95 duration-200 flex items-center gap-2">
          <CheckCircle className="w-3 h-3 text-green-400" />
          {feedback}
        </div>
      )}
    </Card>
  );
}