import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { 
  Search, X, Calendar as CalendarIcon, RotateCcw 
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function FiltrosServicos({ 
  filtros, 
  setFiltros, 
  tiposServico,
  onLimpar 
}) {
  const [dateRange, setDateRange] = useState({ from: null, to: null });

  const activeFiltersCount = Object.values(filtros).filter(v => v && v !== "todos").length;

  return (
    <div className="bg-white rounded-xl border shadow-sm p-4 mb-6">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Busca */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar por cliente, placa ou CPF/CNPJ..."
              value={filtros.busca || ""}
              onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
              className="pl-10 bg-slate-50 border-slate-200 focus:bg-white"
            />
          </div>
        </div>

        {/* Status */}
        <div className="w-full lg:w-48">
          <Select
            value={filtros.status || "todos"}
            onValueChange={(value) => setFiltros({ ...filtros, status: value })}
          >
            <SelectTrigger className="bg-slate-50 border-slate-200">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Status</SelectItem>
              <SelectItem value="pendente">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Pendente
                </span>
              </SelectItem>
              <SelectItem value="aprovado">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Aprovado
                </span>
              </SelectItem>
              <SelectItem value="em_andamento">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-500" />
                  Em Andamento
                </span>
              </SelectItem>
              <SelectItem value="concluido">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  Concluído
                </span>
              </SelectItem>
              <SelectItem value="congelado">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  Congelado
                </span>
              </SelectItem>
              <SelectItem value="quitado">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  Quitado (Financeiro)
                </span>
              </SelectItem>
              <SelectItem value="arquivado">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-gray-500" />
                  Arquivado
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tipo de Serviço */}
        <div className="w-full lg:w-48">
          <Select
            value={filtros.tipoServico || "todos"}
            onValueChange={(value) => setFiltros({ ...filtros, tipoServico: value })}
          >
            <SelectTrigger className="bg-slate-50 border-slate-200">
              <SelectValue placeholder="Tipo de Serviço" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Tipos</SelectItem>
              {tiposServico.filter(t => t.ativo !== false).map((tipo) => (
                <SelectItem key={tipo.id} value={String(tipo.id)}>
                  {tipo.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Data de Pagamento */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              className={cn(
                "w-full lg:w-auto justify-start text-left font-normal bg-slate-50 border-slate-200",
                !filtros.dataPagamento && "text-slate-500"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filtros.dataPagamento 
                ? format(new Date(filtros.dataPagamento), "dd/MM/yyyy", { locale: ptBR })
                : "Data Pagamento"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filtros.dataPagamento ? new Date(filtros.dataPagamento) : undefined}
              onSelect={(date) => setFiltros({ 
                ...filtros, 
                dataPagamento: date ? format(date, "yyyy-MM-dd") : null 
              })}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>

        {/* Limpar Filtros */}
        {activeFiltersCount > 0 && (
          <Button 
            variant="ghost" 
            onClick={onLimpar}
            className="text-slate-500 hover:text-slate-700"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Limpar ({activeFiltersCount})
          </Button>
        )}
      </div>

      {/* Tags de Filtros Ativos */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
          {filtros.busca && (
            <Badge variant="secondary" className="gap-1">
              Busca: {filtros.busca}
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => setFiltros({ ...filtros, busca: "" })}
              />
            </Badge>
          )}
          {filtros.status && filtros.status !== "todos" && (
            <Badge variant="secondary" className="gap-1">
              Status: {filtros.status.replace("_", " ")}
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => setFiltros({ ...filtros, status: "todos" })}
              />
            </Badge>
          )}
          {filtros.tipoServico && filtros.tipoServico !== "todos" && (
            <Badge variant="secondary" className="gap-1">
              Tipo: {tiposServico.find(t => String(t.id) === String(filtros.tipoServico))?.nome || "Desconhecido"}
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => setFiltros({ ...filtros, tipoServico: "todos" })}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}