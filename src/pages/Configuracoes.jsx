import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Plus, Edit, Trash2, FileText, DollarSign, Loader2,
  Settings, X, Tag, Database, Lock
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { serviceTypes as fakeServiceTypes } from "@/lib/fakeData";

// [NOVO] Componente de Input Monetário (BRL)
const MoneyInput = ({ value, onValueChange, className, ...props }) => {
  const handleChange = (e) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    if (!rawValue) {
      onValueChange("");
      return;
    }
    const amount = parseFloat(rawValue) / 100;
    onValueChange(amount.toFixed(2));
  };

  const displayValue = useMemo(() => {
    if (value === "" || value === undefined || value === null) return "";
    const num = parseFloat(value);
    if (isNaN(num)) return "";
    return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, [value]);

  return (
    <Input
      {...props}
      className={className}
      value={displayValue}
      onChange={handleChange}
      inputMode="numeric"
    />
  );
};

export default function Configuracoes() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessPassword, setAccessPassword] = useState("");
  const [editingTipo, setEditingTipo] = useState(null);
  const [novoDocumento, setNovoDocumento] = useState("");
  
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    nome: "",
    emoji: "",
    documentos_necessarios: [],
    valor_base: "",
    ativo: true
  });

  const { data: tiposServico = [], isLoading } = useQuery({
  queryKey: ["tipos-servico"],
    queryFn: () => Promise.resolve(fakeServiceTypes), // Usa dados fakes
    staleTime: Infinity, // Mantém os dados em cache
});

  const createMutation = useMutation({
  mutationFn: async (data) => {
    // Mock de criação
    await new Promise(resolve => setTimeout(resolve, 300));
    const newServiceType = { ...data, id: Date.now() };
    queryClient.setQueryData(['tipos-servico'], (oldData) => [...(oldData || []), newServiceType]);
    return newServiceType;
  },
  onSuccess: () => {
    handleCloseForm();
    toast({
      description: "Tipo de serviço criado (simulado).",
      duration: 3000,
    });
  },
  onError: (error) => {
    toast({
      title: "Erro",
      description: "Falha ao criar (simulado): " + error.message,
      variant: "destructive",
      duration: 3000,
    });
  }
});

  const updateMutation = useMutation({
  mutationFn: async ({ id, data }) => {
    // Mock de atualização
    await new Promise(resolve => setTimeout(resolve, 300));
    queryClient.setQueryData(['tipos-servico'], (oldData) => 
      oldData.map(item => item.id === id ? { ...item, ...data } : item)
    );
    return { id, ...data };
  },
  onSuccess: () => {
    handleCloseForm();
    toast({
      description: "Tipo de serviço atualizado (simulado).",
      duration: 3000,
    });
  },
  onError: (error) => {
    console.error("Erro na atualização:", error.message);
    toast({
      title: "Erro",
      description: "Falha ao atualizar (simulado): " + error.message,
      variant: "destructive",
      duration: 3000,
    });
  }
});

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
    // Mock de exclusão
    await new Promise(resolve => setTimeout(resolve, 300));
    queryClient.setQueryData(['tipos-servico'], (oldData) => 
      oldData.filter(item => item.id !== id)
    );
    return { id };
  },
  onSuccess: () => {
    toast({
      description: "Tipo de serviço excluído (simulado).",
      duration: 3000,
    });
  },
  onError: (error) => {
    toast({
      title: "Erro",
      description: "Falha ao excluir: " + error.message,
      variant: "destructive",
      duration: 3000,
    });
  }
});

  const handleOpenForm = (tipo = null) => {
    if (tipo) {
      setEditingTipo(tipo);
      setFormData({
        nome: tipo.nome,
        emoji: tipo.emoji || "",
        documentos_necessarios: tipo.documentos_necessarios || [],
        valor_base: tipo.valor_base?.toString() || "",
        ativo: tipo.ativo !== false
      });
    } else {
      setEditingTipo(null);
      setFormData({
        nome: "",
        emoji: "",
        documentos_necessarios: [],
        valor_base: "",
        ativo: true
      });
    }
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingTipo(null);
    setNovoDocumento("");
    setFormData({
      nome: "",
      emoji: "",
      documentos_necessarios: [],
      valor_base: "",
      ativo: true
    });
  };

  const handleAddDocumento = () => {
    if (novoDocumento.trim() && !formData.documentos_necessarios.includes(novoDocumento.trim())) {
      setFormData({
        ...formData,
        documentos_necessarios: [...formData.documentos_necessarios, novoDocumento.trim()]
      });
      setNovoDocumento("");
    }
  };

  const handleRemoveDocumento = (doc) => {
    setFormData({
      ...formData,
      documentos_necessarios: formData.documentos_necessarios.filter(d => d !== doc)
    });
  };

  const handleSave = async () => {
    if (!formData.nome || formData.nome.trim() === "") {
      toast({
        title: "Campo obrigatório",
        description: "O nome do tipo de serviço não pode estar vazio.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    const data = {
      ...formData,
      valor_base: parseFloat(formData.valor_base) || 0
    };

    if (editingTipo) {
      await updateMutation.mutateAsync({ id: editingTipo.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const handleImportarLegado = async () => {
    // Mock da função de importação
    toast({ 
      description: "Função de importação desativada em modo frontend.",
      duration: 3000 
    });
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleLogin = () => {
    if (accessPassword === "admin") {
      setIsAuthenticated(true);
      toast({ description: "Acesso de administrador liberado.", className: "bg-green-600 text-white" });
    } else {
      toast({ variant: "destructive", title: "Acesso Negado", description: "Senha incorreta." });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto bg-slate-200 p-3 rounded-full w-fit">
              <Lock className="w-8 h-8 text-slate-700" />
            </div>
            <CardTitle className="text-xl">Acesso Restrito</CardTitle>
            <p className="text-sm text-slate-500">
              Digite a senha de administrador para acessar as configurações do sistema.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input 
              type="password" 
              value={accessPassword} 
              onChange={(e) => setAccessPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="Senha de acesso"
              className="text-center"
              autoFocus
            />
            <Button className="w-full bg-slate-800 hover:bg-slate-900" onClick={handleLogin}>
              Entrar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
              <Settings className="w-8 h-8 text-slate-600" />
              Configurações
            </h1>
            <p className="text-slate-500 mt-1">
              Gerencie os tipos de serviço e documentos necessários
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
                variant="outline"
                onClick={handleImportarLegado}
                className="border-slate-300 text-slate-700 hover:bg-slate-100"
            >
                <Database className="w-4 h-4 mr-2" /> Importar Legado
            </Button>
            <Button 
                className="bg-slate-800 hover:bg-slate-900 shadow-lg"
                onClick={() => handleOpenForm()}
            >
                <Plus className="w-4 h-4 mr-2" />
                Novo Tipo de Serviço
            </Button>
          </div>
        </div>

        {/* Tipos de Serviço */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : tiposServico.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700 mb-2">
                  Nenhum tipo de serviço cadastrado
                </h3>
                <p className="text-slate-500 mb-4">
                  Adicione tipos de serviço para começar a usar o sistema
                </p>
                <Button onClick={() => handleOpenForm()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Tipo de Serviço
                </Button>
              </CardContent>
            </Card>
          ) : (
            tiposServico.map((tipo) => (
              <Card key={tipo.id} className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {tipo.emoji && <span className="text-2xl" role="img" aria-label="emoji">{tipo.emoji}</span>}
                        <h3 className="text-lg font-semibold text-slate-800">
                          {tipo.nome}
                        </h3>
                        <Badge variant={tipo.ativo !== false ? "default" : "secondary"}>
                          {tipo.ativo !== false ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      
                      {/* Documentos */}
                      <div className="mb-3">
                        <p className="text-sm text-slate-500 mb-2 flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          Documentos necessários ({tipo.documentos_necessarios?.length || 0})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {tipo.documentos_necessarios?.map((doc) => (
                            <Badge 
                              key={doc} 
                              variant="outline"
                              className="bg-slate-50"
                            >
                              {doc}
                            </Badge>
                          ))}
                          {(!tipo.documentos_necessarios || tipo.documentos_necessarios.length === 0) && (
                            <span className="text-sm text-slate-400">Nenhum documento definido</span>
                          )}
                        </div>
                      </div>

                      {/* Valor Base */}
                      {tipo.valor_base > 0 && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <DollarSign className="w-4 h-4" />
                          Valor sugerido: 
                          <span className="font-semibold">
                            R$ {tipo.valor_base.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleOpenForm(tipo)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Editar
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir tipo de serviço</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir "{tipo.nome}"? 
                              Serviços existentes com este tipo não serão afetados.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => deleteMutation.mutate(tipo.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Form Modal */}
        <Dialog open={formOpen} onOpenChange={handleCloseForm}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingTipo ? "Editar Tipo de Serviço" : "Novo Tipo de Serviço"}
              </DialogTitle>
              <DialogDescription>
                Preencha os dados abaixo para {editingTipo ? "editar" : "criar"} um tipo de serviço.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 py-4">
              {/* Linha 1: Identidade Visual e Nome */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1">
                  <Label htmlFor="emoji" className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Ícone (Emoji)</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none opacity-50">
                       <span className="text-lg">✨</span>
                    </div>
                    <Input
                      id="emoji"
                      value={formData.emoji}
                      onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                      placeholder="🚗"
                      className="pl-10 text-center text-2xl h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                      maxLength={4}
                    />
                  </div>
                </div>
                <div className="md:col-span-3">
                  <Label htmlFor="nome" className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Nome do Serviço *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Licenciamento 2024"
                    className="h-11 text-lg font-medium bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              {/* Linha 2: Valor */}
              <div>
                <Label htmlFor="valor" className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Valor Base (Honorários)</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <span className="text-slate-500 font-semibold">R$</span>
                  </div>
                  <MoneyInput
                    id="valor"
                    value={formData.valor_base}
                    onValueChange={(val) => setFormData({ ...formData, valor_base: val })}
                    placeholder="0,00"
                    className="pl-10 h-11 font-medium bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">Este valor será sugerido automaticamente ao criar um novo serviço deste tipo.</p>
              </div>

              {/* Linha 3: Documentação */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    Documentação Necessária
                  </Label>
                  <Badge variant="outline" className="bg-slate-50 text-slate-500 font-normal">
                    {formData.documentos_necessarios.length} itens selecionados
                  </Badge>
                </div>
                
                {/* Área de Lista de Documentos */}
                <div className="bg-slate-50/50 rounded-xl border border-slate-200 p-4 min-h-[100px] transition-all focus-within:ring-2 focus-within:ring-slate-200 focus-within:bg-white">
                  {formData.documentos_necessarios.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm py-4">
                      <FileText className="w-8 h-8 mb-2 opacity-10" />
                      <p>Nenhum documento solicitado.</p>
                      <p className="text-xs opacity-60">Adicione documentos abaixo ou use as sugestões.</p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {formData.documentos_necessarios.map((doc) => (
                        <Badge 
                          key={doc} 
                          variant="secondary"
                          className="pl-2.5 pr-1 py-1.5 bg-white border border-slate-200 shadow-sm text-slate-700 flex items-center gap-1.5 hover:bg-slate-50 transition-all group"
                        >
                          {doc}
                          <button
                            type="button"
                            onClick={() => handleRemoveDocumento(doc)}
                            className="ml-1 text-slate-400 hover:bg-red-100 hover:text-red-600 rounded-full p-0.5 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Input de Adição */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      value={novoDocumento}
                      onChange={(e) => setNovoDocumento(e.target.value)}
                      placeholder="Digite o nome do documento e pressione Enter..."
                      onKeyPress={(e) => e.key === "Enter" && handleAddDocumento()}
                      className="pr-10"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                          ENTER
                        </kbd>
                    </div>
                  </div>
                  <Button type="button" onClick={handleAddDocumento} className="bg-slate-800 hover:bg-slate-700">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {/* Sugestões Rápidas */}
                <div className="pt-2">
                  <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Sugestões Rápidas
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {["CRLV", "CRV", "CNH", "RG", "CPF", "Comprovante de Residência", "Laudo de Vistoria", "Nota Fiscal", "Boletim de Ocorrência", "Carta de Quitação", "Contrato Financiamento", "Procuração", "Decalque Chassi", "Recibo de Compra e Venda", "Boletos", "Capivara", "TCD-E"].map((doc) => (
                      <button
                        key={doc}
                        type="button"
                        disabled={formData.documentos_necessarios.includes(doc)}
                        onClick={() => {
                          if (!formData.documentos_necessarios.includes(doc)) {
                            setFormData({
                              ...formData,
                              documentos_necessarios: [...formData.documentos_necessarios, doc]
                            });
                          }
                        }}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-all duration-200 ${
                          formData.documentos_necessarios.includes(doc)
                            ? "bg-slate-100 text-slate-300 border-transparent cursor-default opacity-50"
                            : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 hover:shadow-sm"
                        }`}
                      >
                        {doc}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCloseForm}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSave}
                disabled={!formData.nome || isSaving}
                className="bg-slate-800 hover:bg-slate-900"
              >
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingTipo ? "Salvar Alterações" : "Criar Tipo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}