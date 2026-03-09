import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ProximosPagamentos({ servicos = [] }) {
  // Filtra serviços que possuem data prevista e ordena pela data (do mais próximo para o mais distante)
  const pagamentos = servicos
    .filter((s) => s.data_pagamento_previsto && !s.data_pagamento)
    .sort((a, b) => new Date(a.data_pagamento_previsto) - new Date(b.data_pagamento_previsto))
    .slice(0, 5); // Exibe apenas os 5 primeiros

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-800">
          Próximos Pagamentos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {pagamentos.length > 0 ? (
            pagamentos.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center justify-between border-b border-slate-100 last:border-0 pb-3 last:pb-0"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-700 truncate max-w-[140px]" title={item.cliente_nome}>
                    {item.cliente_nome}
                  </p>
                  <div className="flex items-center text-xs text-slate-500">
                    <Calendar className="w-3 h-3 mr-1" />
                    {/* Formata a data para dia e mês (ex: 15 de Outubro) */}
                    {format(new Date(item.data_pagamento_previsto), "dd 'de' MMMM", { locale: ptBR })}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">
                    R$ {Number(item.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-slate-500 truncate max-w-[100px]" title={item.tipo_servico_nome}>
                    {item.tipo_servico_nome}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm">
              Nenhum pagamento previsto.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}