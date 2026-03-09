import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Upload, FileText, Trash2, Plus, X, Eye, CheckCircle, AlertCircle } from "lucide-react";
import { formatDateForInput, isImage, isPdf } from "@/lib/helpers";
import { useToast } from "@/components/ui/use-toast";
import { API_BASE_URL, getAuthHeaders } from "@/config";

export default function ServicoForm({ open, onClose, tiposServico, servicoEdit, onSave }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [previewFile, setPreviewFile] = useState(null);
  const [novoDocumento, setNovoDocumento] = useState("");
  const [pendingUploads, setPendingUploads] = useState([]); // Arquivos aguardando salvamento do serviço
  const [documentToDelete, setDocumentToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const defaultFormData = {
    cliente_nome: "",
    cliente_telefone: "",
    cliente_email: "",
    cliente_cpf_cnpj: "",
    placa_veiculo: "",
    renavam: "",
    veiculo: "",
    chassi: "",
    uf_veiculo: "",
    tipo_servico_id: "",
    tipo_servico_nome: "",
    status: "pendente",
    valor_total: "",
    valor_honorarios: "",
    valor_divida_ativa: "",
    honorarios_pago: false,
    data_pagamento_previsto: "",
    data_pagamento: "",
    observacoes: "",
    restricoes_bloqueios: "",
    motivo_pendencia: "",
    documentos_necessarios: [],
    documentos_entregues: [],
    lista_debitos: [],
    valor_boleto_aberto: "",
    qtd_boletos_a_vencer: "",
    valor_entrada: "",
    descricao_servicos: "",
    entrada_parcelada: false,
    valor_parcela_entrada: "",
    qtd_parcelas_entrada: 1,
    data_vencimento_entrada: "",
    data_vencimento_parcela: ""
  };

  const [formData, setFormData] = useState(defaultFormData);

  useEffect(() => {
    if (open) {
      if (servicoEdit) {
        setFormData({
          ...defaultFormData,
          ...servicoEdit,
          veiculo: servicoEdit.veiculo || "",
          chassi: servicoEdit.chassi || "",
          uf_veiculo: servicoEdit.uf_veiculo || "",
          motivo_pendencia: servicoEdit.motivo_pendencia || "",
          lista_debitos: servicoEdit.lista_debitos || [], // Preserva a lista de débitos
          honorarios_pago: servicoEdit.pagamento_realizado === 1 || servicoEdit.honorarios_pago === true || servicoEdit.honorarios_pago === 1,
          // Garante que sejam arrays
          documentos_necessarios: Array.isArray(servicoEdit.documentos_necessarios) 
            ? servicoEdit.documentos_necessarios 
            : [],
          documentos_entregues: Array.isArray(servicoEdit.documentos_entregues) 
            ? servicoEdit.documentos_entregues.map(d => ({
                ...d,
                url: `${API_BASE_URL}/api/documentos/${d.id}`
              }))
            : [],
          // Formata datas para o input type="date" usando o helper centralizado
          data_pagamento_previsto: formatDateForInput(servicoEdit.data_pagamento_previsto),
          data_pagamento: formatDateForInput(servicoEdit.data_pagamento),
          valor_boleto_aberto: servicoEdit.valor_boleto_aberto || "",
          qtd_boletos_a_vencer: servicoEdit.qtd_boletos_a_vencer || "",
          valor_entrada: servicoEdit.valor_entrada || "",
          descricao_servicos: servicoEdit.descricao_servicos || "",
          entrada_parcelada: Boolean(servicoEdit.entrada_parcelada),
          valor_parcela_entrada: servicoEdit.valor_parcela_entrada || "",
          qtd_parcelas_entrada: servicoEdit.qtd_parcelas_entrada || 1,
          data_vencimento_entrada: formatDateForInput(servicoEdit.data_vencimento_entrada),
          data_vencimento_parcela: formatDateForInput(servicoEdit.data_vencimento_parcela)
        });
      } else {
        setFormData(defaultFormData);
      }
      setPendingUploads([]); // Limpa uploads pendentes ao abrir
    }
  }, [open, servicoEdit]);

  const handleServiceTypeChange = (value) => {
    const tipo = tiposServico.find(t => String(t.id) === String(value));
    if (tipo) {
      setFormData(prev => ({
        ...prev,
        tipo_servico_id: String(tipo.id),
        tipo_servico_nome: tipo.nome,
        valor_honorarios: tipo.valor_base || "",
        // Ao mudar o tipo, carregamos a lista padrão daquele tipo
        documentos_necessarios: Array.isArray(tipo.documentos_necessarios) 
          ? [...tipo.documentos_necessarios] 
          : []
      }));
    }
  };

  const handleFileSelect = (docName, files) => {
    const newPending = [];
    const newDocs = [];

    Array.from(files).forEach(file => {
        const tempUrl = URL.createObjectURL(file);
        // Gera ID temporário para manipulação na interface antes de salvar
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        newPending.push({ docName, file, tempId });
        newDocs.push({
            id: tempId,
            nome: docName,
            url: tempUrl,
            nome_arquivo: file.name,
            data_upload: new Date().toISOString(),
            isPending: true
        });
    });

    setPendingUploads(prev => [...prev, ...newPending]);
    setFormData(prev => ({
      ...prev,
      documentos_entregues: [...prev.documentos_entregues, ...newDocs]
    }));
  };

  // Função para remover um arquivo já enviado (permite reenvio)
  const handleRemoveUploadedDocument = (doc) => {
    if (doc.isPending) {
        // Se for pendente (ainda não salvo no banco), remove apenas do estado local
        setPendingUploads(prev => prev.filter(p => p.tempId !== doc.id));
        setFormData(prev => ({
            ...prev,
            documentos_entregues: prev.documentos_entregues.filter(d => d.id !== doc.id)
        }));
    } else {
        // Se já existe no banco, pede confirmação para deletar
        setDocumentToDelete(doc);
    }
  };

  // [NOVO] Função para carregar o arquivo com autenticação antes de visualizar
  const handlePreview = async (file) => {
    if (file.isPending) {
        setPreviewFile(file);
    } else {
        try {
            const response = await fetch(`${API_BASE_URL}/api/documentos/${file.id}`, {
                headers: getAuthHeaders()
            });
            if (!response.ok) throw new Error("Erro ao carregar arquivo");
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            setPreviewFile({ ...file, url });
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Erro", description: "Erro ao visualizar arquivo.", duration: 3000 });
        }
    }
  };

  const confirmDeleteDocument = async () => {
    if (!documentToDelete) return;
    const doc = documentToDelete;

    setIsDeleting(true);
    try {
        // Se tiver ID, é um arquivo salvo no banco -> Deletar via API
        if (doc.id && !doc.isPending) {
            const response = await fetch(`${API_BASE_URL}/api/documentos/${doc.id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (!response.ok) throw new Error("Falha ao excluir arquivo");
            toast({ description: "Arquivo excluído do banco de dados.", duration: 3000 });
        }

        setFormData(prev => ({
            ...prev,
            documentos_entregues: prev.documentos_entregues.filter(d => d.id !== doc.id)
        }));
        setDocumentToDelete(null);
    } catch (error) {
        console.error(error);
        toast({ variant: "destructive", title: "Erro", description: "Não foi possível excluir o arquivo.", duration: 3000 });
    } finally {
        setIsDeleting(false);
    }
  };

  // Função para adicionar um novo requisito de documento à lista
  const handleAddDocumentRequirement = () => {
    if (novoDocumento.trim()) {
      if (formData.documentos_necessarios.includes(novoDocumento.trim())) {
        toast({
          variant: "warning",
          title: "Atenção",
          description: "Este documento já está na lista.",
          duration: 3000,
        });
        return;
      }
      setFormData(prev => ({
        ...prev,
        documentos_necessarios: [...prev.documentos_necessarios, novoDocumento.trim()]
      }));
      setNovoDocumento("");
    }
  };

  // Função para remover um requisito da lista de documentos necessários
  const handleRemoveDocumentRequirement = (docName) => {
    const hasFile = formData.documentos_entregues.some(d => d.nome === docName);
    if (hasFile) {
        if (!confirm(`Existem arquivos enviados para "${docName}". Ao remover este requisito, os arquivos também serão desvinculados. Continuar?`)) {
            return;
        }
        // Remove tanto da lista de necessários quanto dos entregues
        setFormData(prev => ({
            ...prev,
            documentos_necessarios: prev.documentos_necessarios.filter(d => d !== docName),
            documentos_entregues: prev.documentos_entregues.filter(d => d.nome !== docName)
        }));
        // Remove também dos pendentes
        setPendingUploads(prev => prev.filter(p => p.docName !== docName));
    } else {
        setFormData(prev => ({
            ...prev,
            documentos_necessarios: prev.documentos_necessarios.filter(d => d !== docName)
        }));
    }
  };

  const handleSubmit = async () => {
    if (!formData.cliente_nome || !formData.tipo_servico_id) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Preencha o nome do cliente e o tipo de serviço.",
        duration: 3000,
      });
      return;
    }

    setLoading(true);
    try {
      // Passa os dados do formulário E os arquivos pendentes para o pai salvar
      await onSave(formData, pendingUploads);
      onClose();
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao salvar serviço.",
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{servicoEdit ? "Editar" : "Novo"} Registro de Serviço</DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo para registrar ou atualizar o serviço.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Cliente *</Label>
              <Input 
                value={formData.cliente_nome} 
                onChange={(e) => setFormData({...formData, cliente_nome: e.target.value.toUpperCase()})}
                placeholder="Ex: João Silva"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input 
                value={formData.cliente_telefone} 
                onChange={(e) => setFormData({...formData, cliente_telefone: e.target.value})}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                type="email"
                value={formData.cliente_email} 
                onChange={(e) => setFormData({...formData, cliente_email: e.target.value})}
                placeholder="cliente@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label>CPF / CNPJ</Label>
              <Input 
                value={formData.cliente_cpf_cnpj} 
                onChange={(e) => setFormData({...formData, cliente_cpf_cnpj: e.target.value})}
                placeholder="000.000.000-00"
              />
            </div>

            <div className="space-y-2">
              <Label>Veículo</Label>
              <Input 
                value={formData.veiculo} 
                onChange={(e) => setFormData({...formData, veiculo: e.target.value})}
                placeholder="Modelo/Marca"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-2">
                  <Label>Placa</Label>
                  <Input 
                    value={formData.placa_veiculo} 
                    onChange={(e) => setFormData({...formData, placa_veiculo: e.target.value.toUpperCase()})}
                    placeholder="ABC-1234"
                    maxLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label>UF</Label>
                  <Input 
                    value={formData.uf_veiculo} 
                    onChange={(e) => setFormData({...formData, uf_veiculo: e.target.value.toUpperCase()})}
                    placeholder="UF"
                    maxLength={2}
                  />
                </div>
            </div>

            <div className="space-y-2">
              <Label>Renavam</Label>
              <Input 
                value={formData.renavam} 
                onChange={(e) => setFormData({...formData, renavam: e.target.value})}
                placeholder="00000000000"
              />
            </div>

            <div className="space-y-2">
              <Label>Chassi</Label>
              <Input 
                value={formData.chassi} 
                onChange={(e) => setFormData({...formData, chassi: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')})}
                placeholder="Chassi do veículo"
              />
            </div>

            <div className="space-y-2 col-span-full">
              <Label>Tipo de Serviço *</Label>
              <Select 
                value={formData.tipo_servico_id} 
                onValueChange={handleServiceTypeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o serviço..." />
                </SelectTrigger>
                <SelectContent>
                  {tiposServico.map((tipo) => (
                    <SelectItem key={tipo.id} value={String(tipo.id)}>
                      {tipo.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Custo Total (Empresa)</Label>
              <Input 
                type="number"
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={formData.valor_total} 
                onChange={(e) => setFormData({...formData, valor_total: e.target.value})}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label>Valor Honorários (R$)</Label>
              <Input 
                type="number"
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={formData.valor_honorarios} 
                onChange={(e) => setFormData({...formData, valor_honorarios: e.target.value})}
                placeholder="0.00"
              />
              <div className="flex items-center space-x-2 pt-1">
                <Checkbox 
                  id="honorarios_pago" 
                  checked={formData.honorarios_pago}
                  onCheckedChange={(checked) => setFormData({...formData, honorarios_pago: checked})}
                />
                <Label htmlFor="honorarios_pago" className="text-sm font-normal cursor-pointer">
                  Honorários já pagos
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Valor Dívida Ativa (R$)</Label>
              <Input 
                type="number"
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={formData.valor_divida_ativa} 
                onChange={(e) => setFormData({...formData, valor_divida_ativa: e.target.value})}
                placeholder="0.00"
              />
            </div>

            <div className="col-span-full space-y-2">
              <Label>Descrição dos Serviços</Label>
              <Textarea 
                value={formData.descricao_servicos} 
                onChange={(e) => setFormData({...formData, descricao_servicos: e.target.value})}
                placeholder="Ex: Licenciamento 2024, Transferência, etc."
                className="min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor de Entrada (R$)</Label>
                <Input 
                  type="number"
                  value={formData.valor_entrada} 
                  onChange={(e) => setFormData({...formData, valor_entrada: e.target.value})}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Lucro Estimado</Label>
                <Input 
                  disabled
                  value={((parseFloat(formData.valor_entrada) || 0) + (formData.entrada_parcelada ? ((parseFloat(formData.valor_parcela_entrada) || 0) * (parseInt(formData.qtd_parcelas_entrada) || 1)) : 0) + ((parseFloat(formData.valor_boleto_aberto) || 0) * (parseInt(formData.qtd_boletos_a_vencer) || 0)) - (parseFloat(formData.valor_total) || 0)).toFixed(2)}
                  className={`bg-slate-100 font-bold ${(parseFloat(formData.valor_entrada) || 0) + (formData.entrada_parcelada ? ((parseFloat(formData.valor_parcela_entrada) || 0) * (parseInt(formData.qtd_parcelas_entrada) || 1)) : 0) + ((parseFloat(formData.valor_boleto_aberto) || 0) * (parseInt(formData.qtd_boletos_a_vencer) || 0)) - (parseFloat(formData.valor_total) || 0) >= 0 ? "text-green-600" : "text-red-600"}`}
                />
              </div>
            </div>

            {/* Entrada Parcelada */}
            <div className="col-span-full space-y-2 rounded-md p-3 bg-slate-50 border">
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="entrada_parcelada_form"
                        checked={formData.entrada_parcelada}
                        onCheckedChange={(checked) => setFormData({ ...formData, entrada_parcelada: checked, valor_parcela_entrada: checked ? formData.valor_parcela_entrada : "" })}
                    />
                    <Label htmlFor="entrada_parcelada_form" className="text-sm font-normal cursor-pointer">
                        Entrada será parcelada?
                    </Label>
                </div>

                {formData.entrada_parcelada && (
                    <div className="grid grid-cols-3 gap-4 pt-2">
                        <div>
                            <Label>Qtd. Parcelas</Label>
                            <Input
                                type="number"
                                min="1"
                                value={formData.qtd_parcelas_entrada}
                                onChange={(e) => setFormData({ ...formData, qtd_parcelas_entrada: e.target.value })}
                                placeholder="1"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Valor da Parcela (R$)</Label>
                            <Input
                                type="number"
                                value={formData.valor_parcela_entrada}
                                onChange={(e) => setFormData({ ...formData, valor_parcela_entrada: e.target.value })}
                                placeholder="0.00"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Vencimento 1ª Parc.</Label>
                            <Input
                                type="date"
                                value={formData.data_vencimento_entrada}
                                onChange={(e) => setFormData({ ...formData, data_vencimento_entrada: e.target.value })}
                                className="mt-1"
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="col-span-full grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Valor da Parcela (R$)</Label>
                  <Input 
                    type="number"
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={formData.valor_boleto_aberto} 
                    onChange={(e) => setFormData({...formData, valor_boleto_aberto: e.target.value})}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Qtd. Parcelas</Label>
                  <Input 
                    type="number"
                    value={formData.qtd_boletos_a_vencer} 
                    onChange={(e) => setFormData({...formData, qtd_boletos_a_vencer: e.target.value})}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Vencimento 1ª Parc.</Label>
                  <Input 
                    type="date"
                    value={formData.data_vencimento_parcela} 
                    onChange={(e) => setFormData({...formData, data_vencimento_parcela: e.target.value})}
                  />
                </div>
            </div>

            <div className="space-y-2">
              <Label>Data Pagamento Previsto</Label>
              <Input 
                type="date"
                value={formData.data_pagamento_previsto} 
                onChange={(e) => setFormData({...formData, data_pagamento_previsto: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label>Data Pagamento (Realizado)</Label>
              <Input 
                type="date"
                value={formData.data_pagamento} 
                onChange={(e) => setFormData({...formData, data_pagamento: e.target.value})}
              />
            </div>

            {/* Seção de Documentos */}
            <div className="col-span-full space-y-2 text-left">
              <Label>Documentação Necessária</Label>
              
              {/* Input para adicionar novos documentos */}
              <div className="flex gap-2 mb-2">
                <Input 
                  placeholder="Nome do novo documento (ex: Procuração)..." 
                  value={novoDocumento}
                  onChange={(e) => setNovoDocumento(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddDocumentRequirement())}
                />
                <Button type="button" onClick={handleAddDocumentRequirement} variant="secondary">
                  <Plus className="w-4 h-4 mr-2" /> Adicionar
                </Button>
              </div>

              <div className="space-y-3 mt-2">
                {formData.documentos_necessarios && formData.documentos_necessarios.length > 0 ? (
                  formData.documentos_necessarios.map((docName, index) => {
                    // Filtra todos os arquivos para este requisito
                    const entregues = formData.documentos_entregues?.filter(d => d.nome === docName) || [];
                    const temArquivos = entregues.length > 0;
                    
                    return (
                      <div key={`${docName}-${index}`} className="flex flex-col sm:flex-row sm:items-start justify-between p-3 border rounded-lg bg-white shadow-sm gap-3">
                        <div className="flex items-center gap-2 mt-1">
                          {temArquivos ? (
                            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          )}
                          <span className="text-sm font-medium text-slate-700">{docName}</span>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-slate-400 hover:text-red-500 ml-1"
                            onClick={() => handleRemoveDocumentRequirement(docName)}
                            title="Remover requisito"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                        
                        <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                          {entregues.map((file) => (
                            <div key={file.id} className="flex items-center gap-2 bg-slate-50 p-1.5 rounded border border-slate-100 w-full sm:w-auto justify-between sm:justify-end">
                                <span className="text-xs text-slate-500 truncate max-w-[150px]" title={file.nome_arquivo}>
                                    {file.nome_arquivo || "Arquivo"}
                                </span>
                                <div className="flex items-center">
                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handlePreview(file)} title="Visualizar">
                                        <Eye className="w-3 h-3 text-blue-600" />
                                    </Button>
                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 hover:bg-red-50" onClick={() => handleRemoveUploadedDocument(file)} title="Excluir">
                                        <Trash2 className="w-3 h-3 text-red-500" />
                                    </Button>
                                </div>
                            </div>
                          ))}

                          <div className="relative w-full sm:w-auto">
                            <input
                              type="file"
                              multiple
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              onChange={(e) => e.target.files?.length > 0 && handleFileSelect(docName, e.target.files)}
                            />
                            <Button size="sm" variant={temArquivos ? "secondary" : "outline"} className="h-8 text-xs w-full sm:w-auto">
                               {temArquivos ? <Plus className="w-3 h-3 mr-2" /> : <Upload className="w-3 h-3 mr-2" />}
                               {temArquivos ? "Adicionar outro" : "Anexar arquivos"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <span className="text-xs text-slate-500 italic text-center py-4">
                    Nenhum documento solicitado. Adicione acima ou selecione um tipo de serviço.
                  </span>
                )}
              </div>
            </div>

            {/* Campo Motivo Pendência - Visível apenas se status for pendente (padrão na criação) ou se já houver um motivo */}
            {(formData.status === 'pendente' || formData.motivo_pendencia) && (
              <div className="col-span-full space-y-2">
                <Label className="text-amber-600">Motivo da Pendência (Se houver)</Label>
                <Textarea 
                  value={formData.motivo_pendencia} 
                  onChange={(e) => setFormData({...formData, motivo_pendencia: e.target.value})}
                  placeholder="Ex: Aguardando assinatura do cliente, Falta comprovante..."
                  className="min-h-[60px] border-amber-200 focus:border-amber-400"
                />
              </div>
            )}

            <div className="col-span-full space-y-2">
              <Label>Restrições e Bloqueios</Label>
              <Textarea 
                value={formData.restricoes_bloqueios} 
                onChange={(e) => setFormData({...formData, restricoes_bloqueios: e.target.value})}
                placeholder="Descreva restrições ou bloqueios do veículo..."
                className="min-h-[80px]"
              />
            </div>

            <div className="col-span-full space-y-2">
              <Label>Observações</Label>
              <Textarea 
                value={formData.observacoes} 
                onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                placeholder="Detalhes adicionais sobre o caso..."
                className="min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} type="button">Cancelar</Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {servicoEdit ? "Salvar Alterações" : "Criar Cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-4xl p-0 bg-transparent border-none shadow-none flex justify-center items-center">
          {previewFile && (
            (isPdf(previewFile.url) || previewFile.nome_arquivo?.toLowerCase().endsWith('.pdf') || previewFile.mimetype === 'application/pdf') ? (
              <iframe 
                src={previewFile.url} 
                className="w-[85vw] h-[85vh] rounded-md shadow-2xl bg-white" 
                title="Preview"
              />
            ) : (
              <img 
                src={previewFile.url} 
                alt="Preview" 
                className="max-w-[85vw] max-h-[85vh] rounded-md shadow-2xl object-contain bg-white" 
              />
            )
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!documentToDelete} onOpenChange={(open) => !open && !isDeleting && setDocumentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este documento?
              <br />
              Se ele já estiver salvo no sistema, será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => { e.preventDefault(); confirmDeleteDocument(); }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
