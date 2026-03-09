import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Loader2, ChevronLeft, ChevronRight, Ban, Skull, Wallet, CheckSquare, Archive, X, Database } from "lucide-react"; // Corrigido para Loader2
import { startOfDay, addMonths, isBefore } from "date-fns";
import { useNavigate, useSearchParams } from "react-router-dom";

import FiltrosServicos from "@/components/servicos/FiltrosServicos";
import ServicoCardInternal from "@/components/servicos/ServicoCardInternal";
import { API_BASE_URL, getAuthHeaders } from "@/config";
import { isPago, parseJSON, CLIENT_TAGS } from "@/lib/helpers";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { generateFakeData, serviceTypes as fakeServiceTypes } from "@/lib/fakeData";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_ORDER = ["pendente", "aprovado", "em_andamento", "congelado", "concluido", "estorno", "cancelado", "arquivado"];

export default function Servicos() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [filtros, setFiltros] = useState({
    busca: "",
    status: searchParams.get("status") || "todos",
    tipoServico: "todos",
    dataPagamento: null,
    inadimplente: false,
    debitosEmAberto: false,
    identificacao: "todos", // [NOVO] Filtro de Identificação
    filtroEntrada: "todos", // [NOVO] Filtro de Valor de Entrada
    apenasImportados: false // [NOVO] Filtro de Importados
  });

  // Estados para Seleção em Massa
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const archiveMutation = useMutation({
    mutationFn: async (ids) => {
      // Mock de arquivamento
      await new Promise(resolve => setTimeout(resolve, 500));
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servicos"] });
      setSelectedIds([]);
      setIsSelectionMode(false);
      toast({ description: "Serviços arquivados com sucesso!", duration: 3000, className: "bg-green-600 text-white" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao arquivar serviços.", duration: 3000 });
    }
  });

  // CORREÇÃO DA BUSCA: Removido o localhost:3000 para usar o Proxy do Vite
  const { data: servicosRaw, isLoading, refetch } = useQuery({
    queryKey: ["servicos"],
    queryFn: async () => {
      // [MODIFICADO] Usa dados fakes diretamente
      return generateFakeData();
    },
    staleTime: Infinity
  });

  // GARANTIA DE ITERAÇÃO: Define servicos como array vazio caso o banco demore a responder
  const servicos = Array.isArray(servicosRaw) ? servicosRaw : [];

  // Garante que tiposServico seja sempre um array, mesmo durante o carregamento
const { data: tiposServicoRaw = [] } = useQuery({
  queryKey: ["tipos-servico"],
  queryFn: async () => {
    // Mock de tipos de serviço
    return fakeServiceTypes;
  },
});

const tiposServico = Array.isArray(tiposServicoRaw) ? tiposServicoRaw : [];

  const servicosFiltrados = useMemo(() => {
    return servicos.filter(s => {
      const term = filtros.busca?.toLowerCase() || "";
      
      const bateBusca = !term || 
                        (s.cliente_nome?.toLowerCase() || "").includes(term) ||
                        (s.numero_contrato?.toLowerCase() || "").includes(term) ||
                        (s.placa_veiculo?.toLowerCase() || "").includes(term) ||
                        (s.cliente_cpf_cnpj?.toLowerCase() || "").includes(term) ||
                        (s.renavam?.toLowerCase() || "").includes(term);

      // Helper para data segura (consistente com ServicoCard)
      const parseDate = (dateStr) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        if (typeof dateStr === 'string' && dateStr.length === 10) {
           return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
        }
        return date;
      };

      let bateStatus = true;
      if (filtros.status === "todos") {
        bateStatus = s.status !== 'arquivado';
      } else if (filtros.status === "cancelados_estornos") {
        bateStatus = (s.status === "cancelado" || s.status === "estorno");
      } else if (filtros.status === "quitado") {
        const vencimentoParcela = parseDate(s.data_vencimento_parcela);
        const qtdParcelas = parseInt(s.qtd_boletos_a_vencer) || 0;
        if (vencimentoParcela && qtdParcelas > 0) {
            const today = startOfDay(new Date());
            const lastParcelaDate = addMonths(vencimentoParcela, qtdParcelas - 1);
            bateStatus = isBefore(startOfDay(lastParcelaDate), today);
        } else {
            bateStatus = false;
        }
      } else {
        bateStatus = s.status === filtros.status;
      }

      // [MODIFICADO] Verifica se o tipo filtrado está na lista de IDs do serviço
      const bateTipo = filtros.tipoServico === "todos" || 
                       String(s.tipo_servico_id) === String(filtros.tipoServico) ||
                       (s.tipos_servicos_ids && Array.isArray(parseJSON(s.tipos_servicos_ids)) && 
                        parseJSON(s.tipos_servicos_ids).map(String).includes(String(filtros.tipoServico)));

      const bateData = !filtros.dataPagamento || (s.data_pagamento && s.data_pagamento.startsWith(filtros.dataPagamento));

      const bateInadimplente = !filtros.inadimplente || s.inadimplente;

      const debitos = parseJSON(s.lista_debitos);
      const bateDebitos = !filtros.debitosEmAberto || (Array.isArray(debitos) && debitos.some(d => !d.pago));

      const bateIdentificacao = filtros.identificacao === "todos" || (Array.isArray(s.identificacao_cliente) && s.identificacao_cliente.includes(filtros.identificacao));

      // [NOVO] Filtro de Entrada
      const isEntradaPaga = (srv) => {
          if (isPago(srv.pagamento_realizado)) return true;
          if (srv.entrada_parcelada) {
              const parcelas = parseJSON(srv.lista_parcelas_entrada);
              return Array.isArray(parcelas) && parcelas.length > 0 && parcelas.every(p => p.pago);
          }
          return false;
      };

      let bateEntrada = true;
      if (filtros.filtroEntrada === "entrada_aberto") {
          // Tem valor de entrada E não está pago
          bateEntrada = (Number(s.valor_entrada) > 0) && !isEntradaPaga(s);
      } else if (filtros.filtroEntrada === "entrada_paga") {
          // Tem valor de entrada E está pago
          bateEntrada = (Number(s.valor_entrada) > 0) && isEntradaPaga(s);
      }

      // [NOVO] Filtro de Importados
      const bateImportado = !filtros.apenasImportados || s.tipo_servico_nome === 'Importado Sistema Antigo';

      return bateBusca && bateStatus && bateTipo && bateData && bateInadimplente && bateDebitos && bateIdentificacao && bateEntrada && bateImportado;
    })
    .sort((a, b) => {
      // [MODIFICADO] Ordenação por Número de Contrato Decrescente
      const contratoA = parseInt(a.numero_contrato) || 0;
      const contratoB = parseInt(b.numero_contrato) || 0;
      
      if (contratoA !== contratoB) {
          return contratoB - contratoA;
      }
      
      // Fallback para ID se não tiver contrato ou for igual
      return b.id - a.id;
    });
  }, [servicos, filtros]);
  
  // Resetar página quando filtrar
  useEffect(() => {
    setCurrentPage(1);
  }, [filtros]);

  // [NOVO] Sincroniza filtros se a URL mudar (ex: navegação via browser)
  useEffect(() => {
    const statusUrl = searchParams.get("status");
    if (statusUrl && statusUrl !== filtros.status) {
      setFiltros(prev => ({ ...prev, status: statusUrl }));
    }
  }, [searchParams]);

  const totalPages = Math.ceil(servicosFiltrados.length / itemsPerPage);
  const paginatedServicos = servicosFiltrados.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // [NOVO] Handler para selecionar todos da página
  const handleSelectAllPage = () => {
    const idsOnPage = paginatedServicos.map(s => s.id);
    const allSelected = idsOnPage.every(id => selectedIds.includes(id));
    
    if (allSelected) {
        setSelectedIds(prev => prev.filter(id => !idsOnPage.includes(id)));
    } else {
        setSelectedIds(prev => [...new Set([...prev, ...idsOnPage])]);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
        <p className="text-slate-500 animate-pulse">Conectando ao banco de dados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 mt-6 mx-4 md:mx-8 pb-12 mb-10 text-left">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 text-left">Gestão de Serviços</h1>
          <p className="text-slate-500">Acompanhe e gerencie todos os processos enviados.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          {isSelectionMode ? (
            <>
              <Button 
                variant="outline"
                onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }}
                className="border-slate-300 text-slate-600"
              >
                <X className="w-4 h-4 mr-2" /> Cancelar
              </Button>
              <Button 
                variant="outline"
                onClick={handleSelectAllPage}
                className="border-slate-300 text-slate-600"
              >
                <CheckSquare className="w-4 h-4 mr-2" /> Todos da Pág.
              </Button>
              <Button 
                variant="destructive"
                onClick={() => archiveMutation.mutate(selectedIds)}
                disabled={selectedIds.length === 0 || archiveMutation.isPending}
                className="bg-gray-600 hover:bg-gray-700"
              >
                {archiveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Archive className="w-4 h-4 mr-2" />}
                Arquivar ({selectedIds.length})
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setIsSelectionMode(true)} className="border-slate-300 text-slate-600">
              <CheckSquare className="w-4 h-4 mr-2" /> Selecionar
            </Button>
          )}
          {!isSelectionMode && (
            <Button 
              className="bg-slate-800 hover:bg-slate-900 w-full md:w-auto"
              onClick={() => navigate("/ServicoDetalhe")}
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Cliente
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <FiltrosServicos 
          filtros={filtros} 
          setFiltros={setFiltros}
          tiposServico={tiposServico}
        />
        
        {/* Filtro de Identificação (SNG, B3, P25) */}
        <div className="flex gap-2 overflow-x-auto pb-2">
            <Button 
                variant={filtros.identificacao === "todos" ? "default" : "outline"} 
                size="sm" 
                onClick={() => setFiltros(prev => ({ ...prev, identificacao: "todos" }))}
            >Todos</Button>
            {Object.entries(CLIENT_TAGS).map(([key, config]) => (
                <Button key={key} variant={filtros.identificacao === key ? "secondary" : "outline"} size="sm" onClick={() => setFiltros(prev => ({ ...prev, identificacao: key }))} className={filtros.identificacao === key ? config.color : ""}>
                    {config.label}
                </Button>
            ))}
        </div>

        {/* Filtro de Valor de Entrada */}
        <div className="flex gap-2 overflow-x-auto pb-2">
            <Button 
                variant={filtros.filtroEntrada === "todos" ? "default" : "outline"} 
                size="sm" 
                onClick={() => setFiltros(prev => ({ ...prev, filtroEntrada: "todos" }))}
            >Todas Entradas</Button>
            <Button 
                variant={filtros.filtroEntrada === "entrada_aberto" ? "secondary" : "outline"} 
                size="sm" 
                onClick={() => setFiltros(prev => ({ ...prev, filtroEntrada: "entrada_aberto" }))}
                className={filtros.filtroEntrada === "entrada_aberto" ? "bg-amber-100 text-amber-800 border-amber-200" : ""}
            >Entrada em Aberto</Button>
            <Button 
                variant={filtros.filtroEntrada === "entrada_paga" ? "secondary" : "outline"} 
                size="sm" 
                onClick={() => setFiltros(prev => ({ ...prev, filtroEntrada: "entrada_paga" }))}
                className={filtros.filtroEntrada === "entrada_paga" ? "bg-green-100 text-green-800 border-green-200" : ""}
            >Entrada Paga</Button>
        </div>

        <div className="flex justify-end gap-2 flex-wrap">
          <Button 
            variant={filtros.apenasImportados ? "secondary" : "outline"}
            size="sm"
            onClick={() => setFiltros(prev => ({ ...prev, apenasImportados: !prev.apenasImportados }))}
            className={filtros.apenasImportados ? "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200" : "border-slate-300 text-slate-600"}
          >
            <Database className="w-4 h-4 mr-2" />
            {filtros.apenasImportados ? "Apenas Importados" : "Filtrar Importados"}
          </Button>
          <Button 
            variant={filtros.debitosEmAberto ? "secondary" : "outline"}
            size="sm"
            onClick={() => setFiltros(prev => ({ ...prev, debitosEmAberto: !prev.debitosEmAberto }))}
            className={filtros.debitosEmAberto ? "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200" : "border-slate-300 text-slate-600"}
          >
            <Wallet className="w-4 h-4 mr-2" />
            {filtros.debitosEmAberto ? "Com Débitos" : "Filtrar Débitos"}
          </Button>
          <Button 
            variant={filtros.inadimplente ? "destructive" : "outline"}
            size="sm"
            onClick={() => setFiltros(prev => ({ ...prev, inadimplente: !prev.inadimplente }))}
            className={filtros.inadimplente ? "bg-black hover:bg-slate-900" : "border-slate-300 text-slate-600"}
          >
            <Skull className="w-4 h-4 mr-2" />
            {filtros.inadimplente ? "Mostrando Inadimplentes" : "Filtrar Inadimplentes"}
          </Button>
          <Button 
            variant={filtros.status === "cancelados_estornos" ? "destructive" : "ghost"}
            size="sm"
            onClick={() => setFiltros(prev => ({ ...prev, status: prev.status === "cancelados_estornos" ? "todos" : "cancelados_estornos" }))}
            className={filtros.status === "cancelados_estornos" ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200" : "text-slate-500 hover:text-slate-900"}
          >
            <Ban className="w-4 h-4 mr-2" />
            {filtros.status === "cancelados_estornos" ? "Limpar filtro de cancelados" : "Ver Cancelados e Estornos"}
          </Button>
        </div>
      </div>

      {servicosFiltrados.length > 0 ? (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedServicos.map((servico) => {
            const hasStatusExt = (servico.status === 'em_andamento' && servico.motivo_andamento) ||
                                 (servico.status === 'aprovado' && servico.motivo_aprovacao) ||
                                 (servico.status === 'concluido' && servico.motivo_conclusao);

            return (
            <div key={servico.id} className={`flex flex-col relative ${servico.inadimplente ? "border-red-500" : ""}`}>
               {!!servico.inadimplente && (
                 <div className="absolute -top-2 -right-2 z-50 bg-black text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center shadow-lg"><Skull className="w-3 h-3 mr-1" /> INADIMPLENTE</div>
               )}
               <div className="absolute -top-2 left-2 z-50 flex gap-1">
                   {Array.isArray(servico.identificacao_cliente) && servico.identificacao_cliente.map(tag => (
                       CLIENT_TAGS[tag] && (
                           <div key={tag} className={`text-[10px] font-bold px-2 py-1 rounded-full flex items-center shadow-lg border-0 ${CLIENT_TAGS[tag].color}`}>{CLIENT_TAGS[tag].label}</div>
                       )
                   ))}
               </div>
               
               {/* Checkbox de Seleção */}
               {isSelectionMode && (
                 <div className="absolute top-2 right-2 z-50" onClick={(e) => e.stopPropagation()}>
                    <Checkbox 
                      checked={selectedIds.includes(servico.id)}
                      onCheckedChange={(checked) => {
                        setSelectedIds(prev => checked ? [...prev, servico.id] : prev.filter(id => id !== servico.id));
                      }}
                      className="h-6 w-6 border-2 border-slate-400 bg-white data-[state=checked]:bg-slate-800 data-[state=checked]:border-slate-800"
                    />
                 </div>
               )}

               <div className="relative z-10">
                 <ServicoCardInternal servico={servico} />
               </div>

               {/* Exibição do Motivo de Andamento (Extensão do Card) */}
               {servico.status === 'em_andamento' && servico.motivo_andamento && (
                 <div className="mx-2 -mt-2 pt-4 pb-2 px-3 bg-teal-50/80 border-x border-b border-teal-100 rounded-b-lg text-xs text-teal-800 relative z-0 animate-in slide-in-from-top-2">
                    <p className="line-clamp-3" title={servico.motivo_andamento}>
                       <span className="font-bold uppercase mr-1">Andamento:</span>
                       {servico.motivo_andamento}
                    </p>
                 </div>
               )}

               {/* Exibição do Motivo de Aprovação */}
               {servico.status === 'aprovado' && servico.motivo_aprovacao && (
                 <div className="mx-2 -mt-2 pt-4 pb-2 px-3 bg-green-50/80 border-x border-b border-green-100 rounded-b-lg text-xs text-green-800 relative z-0 animate-in slide-in-from-top-2">
                    <p className="line-clamp-3" title={servico.motivo_aprovacao}>
                       <span className="font-bold uppercase mr-1">Aprovação:</span>
                       {servico.motivo_aprovacao}
                    </p>
                 </div>
               )}

               {/* Exibição do Motivo de Conclusão */}
               {servico.status === 'concluido' && servico.motivo_conclusao && (
                 <div className="mx-2 -mt-2 pt-4 pb-2 px-3 bg-blue-50/80 border-x border-b border-blue-100 rounded-b-lg text-xs text-blue-800 relative z-0 animate-in slide-in-from-top-2">
                    <p className="line-clamp-3" title={servico.motivo_conclusao}>
                       <span className="font-bold uppercase mr-1">Conclusão:</span>
                       {servico.motivo_conclusao}
                    </p>
                 </div>
               )}
            </div>
          )})}
        </div>
        
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pb-8">
          {/* Controles de Paginação */}
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-2" /> Anterior
            </Button>
            <span className="text-sm text-slate-600">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Próxima <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {/* Seletor de Itens por Página */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Itens por página:</span>
            <Select
              value={String(itemsPerPage)}
              onValueChange={(value) => {
                setItemsPerPage(Number(value));
                setCurrentPage(1); // Volta para a primeira página ao mudar o limite
              }}
            >
              <SelectTrigger className="w-[80px] h-9 bg-white">
                <SelectValue placeholder={itemsPerPage} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="500">500</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        </>
      ) : (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed">
          <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-700 mb-2">
            Nenhum serviço encontrado
          </h3>
          <p className="text-slate-500 mb-4">
            Tente ajustar os filtros ou adicione um novo serviço.
          </p>
        </div>
      )}
    </div>
  );
}