import { useState, useEffect, useMemo } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
  ArrowLeft, FileText, Upload, Trash2, Loader2, Plus, Eye, Wallet, LayoutGrid, Download, Mail, Skull, AlertTriangle, Lock, KeyRound, CheckCircle, AlertCircle, ExternalLink, Edit, Save, X, Search, ScanText, Printer, RefreshCw, Receipt, CalendarClock
} from "lucide-react";
import { format, addMonths, addDays, isWeekend, startOfDay, differenceInCalendarDays } from "date-fns";
import { useNavigate, useSearchParams } from "react-router-dom"; // [FIX] Alterado useParams para useSearchParams
import { useToast } from "@/components/ui/use-toast"; // Importando Toast
import { API_BASE_URL, getAuthHeaders } from "@/config";
import { parseDocs, parseJSON, isPago, formatDateForInput, formatDateDisplay, isPdf, getServiceEmoji, CLIENT_TAGS, extractPdfText } from "@/lib/helpers";
import { generateContractHtml } from "@/lib/contractTemplates";
import { playSound } from "@/lib/audio";
import ServiceBadge from "@/components/servicos/ServiceBadge";
import { generateFakeData, serviceTypes as fakeServiceTypes } from "@/lib/fakeData";

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

// [NOVO] Componente de Input para CPF/CNPJ com formatação automática
const CpfCnpjInput = ({ value, onValueChange, className, ...props }) => {
  const handleChange = (e) => {
    let v = e.target.value.replace(/\D/g, ""); // Remove tudo que não é dígito
    if (v.length > 14) v = v.slice(0, 14); // Limita a 14 dígitos (CNPJ)

    // Aplica a máscara dependendo do tamanho
    if (v.length <= 11) {
      // Máscara CPF: 000.000.000-00
      v = v.replace(/(\d{3})(\d)/, "$1.$2");
      v = v.replace(/(\d{3})(\d)/, "$1.$2");
      v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      // Máscara CNPJ: 00.000.000/0000-00
      v = v.replace(/^(\d{2})(\d)/, "$1.$2");
      v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
      v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
      v = v.replace(/(\d{4})(\d{1,2})$/, "$1-$2");
    }
    
    onValueChange(v);
  };

  return (
    <Input
      {...props}
      className={className}
      value={value}
      onChange={handleChange}
      maxLength={18} // Limite visual com pontuação
      placeholder="000.000.000-00"
    />
  );
};

// [NOVO] Componente de Input para Placa (Mercosul e Antiga)
const PlacaInput = ({ value, onValueChange, className, ...props }) => {
  const handleChange = (e) => {
    let v = e.target.value.toUpperCase();
    onValueChange(v);
  };

  return (
    <Input
      {...props}
      className={className}
      value={value}
      onChange={handleChange}
      maxLength={8}
      placeholder="ABC-1234"
    />
  );
};

export default function ServicoDetalhe() {
  const [searchParams] = useSearchParams(); // [FIX] Hook correto para ler ?id=...
  const id = searchParams.get("id"); // [FIX] Obtendo o ID da query string
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editData, setEditData] = useState(null);
  const [newDocName, setNewDocName] = useState("");
  const [previewFile, setPreviewFile] = useState(null);
  const [showGallery, setShowGallery] = useState(false);
  const [showApprovalWarning, setShowApprovalWarning] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailData, setEmailData] = useState({ to: "", message: "" });
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  // Estados para gestão de débitos
  const [novoDebito, setNovoDebito] = useState({ descricao: "", valor: "", data_vencimento: "" });
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'back' | 'cancel'
  const [normalizedOriginal, setNormalizedOriginal] = useState(null);


  
  // Estados para Segurança Gov.br
  const [showGovPasswordDialog, setShowGovPasswordDialog] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [isRevealingPassword, setIsRevealingPassword] = useState(false);

  // Estados para Geração de Contrato
  const [showContractDialog, setShowContractDialog] = useState(false);
  const [showContractPreview, setShowContractPreview] = useState(false);
  const [contractPreviewHtml, setContractPreviewHtml] = useState("");
  const [contractData, setContractData] = useState({
    rg_cli: "",
    nacionalidade_cli: "Brasileiro(a)",
    estado_civil_cli: "Solteiro(a)",
    endereco_cli: "",
    cor_veiculo: "",
    prazo_dias: "12",
    is_owner: true,
    garantidor_nome: "",
    garantidor_cpf: "",
    garantidor_nacionalidade: "Brasileiro(a)",
    garantidor_estado_civil: "Solteiro(a)",
    // Campos para parcelamento da entrada no contrato
    entrada_parcelada: false,
    qtd_parcelas_entrada: 1,
    lista_parcelas_entrada: [],
    lista_boletos: []
  });

  const [feedback, setFeedback] = useState(null); // Novo estado para notificações personalizadas

  const isDirty = useMemo(() => {
    if (!editData || !normalizedOriginal) return false;
    return JSON.stringify(editData) !== JSON.stringify(normalizedOriginal);
  }, [editData, normalizedOriginal]);

  // Estado para o gerador de boletos
  const [configBoletos, setConfigBoletos] = useState({ valorTotal: "", qtd: 1, dataInicio: "" });

  // Efeito para limpar o feedback automaticamente
  useEffect(() => {
    if (feedback) {
      playSound(feedback.type);
      const timer = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // [NOVO] Monitoramento de Conexão (Online/Offline)
  useEffect(() => {
    const handleOffline = () => {
      setFeedback({ type: 'error', message: "⚠️ Conexão perdida! Verifique sua internet." });
    };
    const handleOnline = () => {
      setFeedback({ type: 'success', message: "🌐 Conexão restabelecida." });
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // [NOVO] Bloqueio de fechamento de aba/reload (Nativo do navegador)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty && isEditing) {
        e.preventDefault();
        e.returnValue = ""; // Necessário para Chrome
        return "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, isEditing]);

  const { data: servico, isLoading, isError } = useQuery({
    queryKey: ["servico", id],
    queryFn: async () => {
      if (!id) throw new Error("ID do serviço não fornecido");
      // Mock: Busca nos dados fakes
      const all = generateFakeData();
      const found = all.find(s => String(s.id) === String(id));
      return found || all[0]; // Retorna o encontrado ou o primeiro como fallback
    },
    enabled: !!id, // Só executa se tiver ID
  });

  // Busca os tipos de serviço para o dropdown de edição
  const { data: tiposServico = [] } = useQuery({
    queryKey: ["tipos-servico"],
    queryFn: async () => {
      return fakeServiceTypes;
    },
  });

  useEffect(() => {
    if (servico) {
      const data = {
        ...servico,
        // Garante que campos opcionais sejam strings para evitar problemas de input não controlado e envio
        veiculo: servico.veiculo || "",
        cliente_email: servico.cliente_email || "",
        chassi: servico.chassi || "",
        uf_veiculo: servico.uf_veiculo || "",
        observacoes: servico.observacoes || "",
        restricoes_bloqueios: servico.restricoes_bloqueios || "",
        motivo_pendencia: servico.motivo_pendencia || "",
        motivo_andamento: servico.motivo_andamento || "",
        motivo_aprovacao: servico.motivo_aprovacao || "",
        motivo_conclusao: servico.motivo_conclusao || "",
        motivo_cancelamento: servico.motivo_cancelamento || "",
        lista_debitos: parseJSON(servico.lista_debitos),
        documentos_necessarios: parseDocs(servico.documentos_necessarios),
        documentos_entregues: parseDocs(servico.documentos_entregues),
        inadimplente: Boolean(servico.inadimplente),
        valor_boleto_aberto: servico.valor_boleto_aberto || "",
        qtd_boletos_a_vencer: servico.qtd_boletos_a_vencer || "",
        valor_entrada: servico.valor_entrada || "",
        descricao_servicos: servico.descricao_servicos || "",
        entrada_parcelada: Boolean(servico.entrada_parcelada),
        valor_parcela_entrada: servico.valor_parcela_entrada || "",
        qtd_parcelas_entrada: servico.qtd_parcelas_entrada || 1,
        data_vencimento_entrada: servico.data_vencimento_entrada || "",
        lista_parcelas_entrada: parseJSON(servico.lista_parcelas_entrada) || [],
        lista_boletos: parseJSON(servico.lista_boletos) || [],
        data_vencimento_parcela: servico.data_vencimento_parcela || "",
        gov_login: servico.gov_login || "",
        gov_password: "", // [FIX] Inicializa como string vazia para evitar erro de input não controlado
        has_gov_password: !!servico.has_gov_password, // Flag para saber se existe senha salva
        identificacao_cliente: Array.isArray(servico.identificacao_cliente) ? servico.identificacao_cliente : [],
        data_identificacao: servico.data_identificacao || "",
        numero_contrato: servico.numero_contrato || "",
        tipos_servicos_ids: parseJSON(servico.tipos_servicos_ids) || (servico.tipo_servico_id ? [String(servico.tipo_servico_id)] : []),
        // Dados do Contrato
        rg_cli: servico.rg_cli || "",
        nacionalidade_cli: servico.nacionalidade_cli || "Brasileiro(a)",
        estado_civil_cli: servico.estado_civil_cli || "Solteiro(a)",
        endereco_cli: servico.endereco_cli || "",
        cor_veiculo: servico.cor_veiculo || "",
        prazo_dias: servico.prazo_dias || "12",
        is_owner: servico.is_owner !== undefined ? Boolean(servico.is_owner) : true,
        garantidor_nome: servico.garantidor_nome || "",
        garantidor_cpf: servico.garantidor_cpf || "",
        garantidor_nacionalidade: servico.garantidor_nacionalidade || "Brasileiro(a)",
        garantidor_estado_civil: servico.garantidor_estado_civil || "Solteiro(a)"
      };
      
      // [FIX] Previne perda de dados digitados quando o servidor atualiza (ex: após upload de arquivo)
      if (!isEditing) {
        setEditData(data);
        setNormalizedOriginal(data);
      } else {
        // Se estiver editando, atualiza apenas o original e a lista de documentos (que vem de upload externo)
        // Mantém os campos de texto que o usuário está digitando para não perder trabalho
        setNormalizedOriginal(data);
        setEditData(prev => ({ ...prev, documentos_entregues: data.documentos_entregues }));
      }
    }
    // Inicialização para NOVO SERVIÇO (Sem ID)
    else if (!id) {
      const data = {
        cliente_nome: "",
        cliente_telefone: "",
        cliente_email: "",
        cliente_cpf_cnpj: "",
        placa_veiculo: "",
        renavam: "",
        veiculo: "",
        ano_modelo: "", // [NOVO] Campo temporário para FIPE
        chassi: "",
        uf_veiculo: "",
        tipo_servico_id: "",
        tipo_servico_nome: "",
        status: "pendente",
        valor_total: "",
        valor_honorarios: "",
        valor_divida_ativa: "",
        pagamento_realizado: 0,
        honorarios_pago: 0,
        data_pagamento_previsto: "",
        data_pagamento: "",
        observacoes: "",
        restricoes_bloqueios: "",
        motivo_pendencia: "",
        motivo_andamento: "",
        motivo_aprovacao: "",
        motivo_conclusao: "",
        motivo_cancelamento: "",
        lista_debitos: [],
        documentos_necessarios: [],
        documentos_entregues: [],
        inadimplente: false,
        valor_boleto_aberto: "",
        qtd_boletos_a_vencer: "",
        valor_entrada: "",
        descricao_servicos: "",
        entrada_parcelada: false,
        valor_parcela_entrada: "",
        qtd_parcelas_entrada: 1,
        data_vencimento_entrada: "",
        lista_parcelas_entrada: [],
        lista_boletos: [],
        data_vencimento_parcela: "",
        gov_login: "",
        gov_password: "", // [FIX] Inicializa como string vazia
        has_gov_password: false,
        identificacao_cliente: [],
        data_identificacao: "",
        numero_contrato: "",
        tipos_servicos_ids: [],
        rg_cli: "",
        nacionalidade_cli: "Brasileiro(a)",
        estado_civil_cli: "Solteiro(a)",
        endereco_cli: "",
        cor_veiculo: "",
        prazo_dias: "12",
        is_owner: true,
        garantidor_nome: "",
        garantidor_cpf: "",
        garantidor_nacionalidade: "Brasileiro(a)",
        garantidor_estado_civil: "Solteiro(a)"
      };
      setEditData(data);
      setNormalizedOriginal(data);
      setIsEditing(true); // Já inicia em modo de edição
    }
  }, [servico, id]);

  const updateMutation = useMutation({
    mutationFn: async (updatedData) => {
      // Remove campos de visualização (JOINs) e timestamps antes de enviar
      const { 
        tipo_servico_nome, 
        created_at, 
        updated_at, 
        honorarios_pago, // Removemos aqui para tratar manualmente abaixo
        ...payload 
      } = updatedData;

      payload.data_pagamento = formatDateForInput(payload.data_pagamento);
      payload.data_pagamento_previsto = formatDateForInput(payload.data_pagamento_previsto);
      payload.data_conclusao = formatDateForInput(payload.data_conclusao);
      payload.data_vencimento_entrada = formatDateForInput(payload.data_vencimento_entrada);
      payload.data_vencimento_parcela = formatDateForInput(payload.data_vencimento_parcela);
      payload.data_identificacao = formatDateForInput(payload.data_identificacao);

      // Garantir envio dos campos de veículo
      payload.veiculo = updatedData.veiculo || "";
      payload.chassi = updatedData.chassi || "";
      payload.uf_veiculo = updatedData.uf_veiculo || "";
      payload.motivo_pendencia = updatedData.motivo_pendencia || "";
      payload.motivo_andamento = updatedData.motivo_andamento || "";
      payload.motivo_aprovacao = updatedData.motivo_aprovacao || "";
      payload.motivo_conclusao = updatedData.motivo_conclusao || "";
      payload.motivo_cancelamento = updatedData.motivo_cancelamento || "";
      payload.lista_debitos = updatedData.lista_debitos || [];
      payload.inadimplente = updatedData.inadimplente ? 1 : 0;
      payload.valor_boleto_aberto = updatedData.valor_boleto_aberto || 0;
      payload.qtd_boletos_a_vencer = updatedData.qtd_boletos_a_vencer || 0;
      payload.valor_entrada = updatedData.valor_entrada || 0;
      payload.descricao_servicos = updatedData.descricao_servicos || "";
      payload.entrada_parcelada = updatedData.entrada_parcelada ? 1 : 0;
      payload.valor_parcela_entrada = updatedData.valor_parcela_entrada || 0;
      payload.qtd_parcelas_entrada = updatedData.qtd_parcelas_entrada || 1;
      payload.lista_parcelas_entrada = updatedData.lista_parcelas_entrada || [];
      payload.lista_boletos = updatedData.lista_boletos || [];
      payload.gov_login = updatedData.gov_login || "";
      payload.gov_password = updatedData.gov_password || ""; // Só envia se o usuário digitou algo
      payload.identificacao_cliente = updatedData.identificacao_cliente || [];
      payload.numero_contrato = updatedData.numero_contrato || null;
      payload.tipos_servicos_ids = updatedData.tipos_servicos_ids || [];
      payload.rg_cli = updatedData.rg_cli || "";
      payload.nacionalidade_cli = updatedData.nacionalidade_cli || "";
      payload.estado_civil_cli = updatedData.estado_civil_cli || "";
      payload.endereco_cli = updatedData.endereco_cli || "";
      payload.cor_veiculo = updatedData.cor_veiculo || "";
      payload.prazo_dias = updatedData.prazo_dias || 12;
      payload.is_owner = updatedData.is_owner;
      payload.garantidor_nome = updatedData.garantidor_nome || "";
      payload.garantidor_cpf = updatedData.garantidor_cpf || "";
      payload.garantidor_nacionalidade = updatedData.garantidor_nacionalidade || "";
      payload.garantidor_estado_civil = updatedData.garantidor_estado_civil || "";

      // ESTRATÉGIA DE SINCRONIZAÇÃO: Garante que ambos os campos tenham o mesmo valor
      // Prioriza pagamento_realizado se existir, senão usa honorarios_pago
      if (updatedData.pagamento_realizado !== undefined || updatedData.honorarios_pago !== undefined) {
        const statusPagamento = (updatedData.pagamento_realizado || updatedData.honorarios_pago) ? 1 : 0;
        payload.pagamento_realizado = statusPagamento;
        // [FIX] Atualiza o valor monetário pago para bater com o valor dos honorários se estiver pago
        // Isso garante que o dashboard some corretamente os valores recebidos
        payload.honorarios_pagos = statusPagamento ? (parseFloat(payload.valor_honorarios) || 0) : 0;
      }

      // Mock Update
      await new Promise(resolve => setTimeout(resolve, 800));
      return { ...payload, id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servico", id] });
      queryClient.invalidateQueries({ queryKey: ["servicos"] });
      setIsEditing(false);
      setFeedback({ type: 'success', message: "Alterações salvas com sucesso!" });
    },
    onError: (error) => {
      console.error("Erro ao salvar:", error);
      setFeedback({ type: 'error', message: "Falha ao salvar: " + error.message });
    },
  });

  // Mutation para CRIAR novo serviço (POST)
  const createMutation = useMutation({
    mutationFn: async (newData) => {
      const payload = { ...newData };
      
      // Formatações necessárias para o backend
      payload.data_pagamento = formatDateForInput(payload.data_pagamento);
      payload.data_pagamento_previsto = formatDateForInput(payload.data_pagamento_previsto);
      payload.data_conclusao = formatDateForInput(payload.data_conclusao);
      payload.data_vencimento_entrada = formatDateForInput(payload.data_vencimento_entrada);
      payload.data_vencimento_parcela = formatDateForInput(payload.data_vencimento_parcela);
      payload.data_identificacao = formatDateForInput(payload.data_identificacao);
      
      // Sincronização de pagamento
      if (newData.pagamento_realizado !== undefined || newData.honorarios_pago !== undefined) {
        const statusPagamento = (newData.pagamento_realizado || newData.honorarios_pago) ? 1 : 0;
        payload.pagamento_realizado = statusPagamento;
        payload.honorarios_pagos = statusPagamento ? (parseFloat(payload.valor_honorarios) || 0) : 0;
      }

      // Mock Create
      await new Promise(resolve => setTimeout(resolve, 800));
      return { ...payload, id: Date.now() };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["servicos"] });
      setFeedback({ type: 'success', message: "Serviço criado com sucesso!" });
      // Redireciona para a URL com o ID do novo serviço para habilitar uploads, etc.
      navigate(`/ServicoDetalhe?id=${data.id}`, { replace: true });
      setIsEditing(false);
    },
    onError: (error) => {
      setFeedback({ type: 'error', message: "Falha ao criar: " + error.message });
    }
  });

  // [NOVO] Gera relatório detalhado para e-mail (Arquivo do Processo)
  const generateServiceReport = () => {
    const lucro = ((parseFloat(editData.valor_entrada) || 0) + (editData.entrada_parcelada ? ((parseFloat(editData.valor_parcela_entrada) || 0) * (parseInt(editData.qtd_parcelas_entrada) || 1)) : 0) + ((parseFloat(editData.valor_boleto_aberto) || 0) * (parseInt(editData.qtd_boletos_a_vencer) || 0)) - (parseFloat(editData.valor_total) || 0));

    // [NOVO] Lista de Débitos Pagos
    const debitosPagos = (editData.lista_debitos || []).filter(d => d.pago);
    const totalDebitos = debitosPagos.reduce((acc, d) => acc + (Number(d.valor) || 0), 0);
    
    let debitosSection = "Nenhum débito pago registrado.";
    if (debitosPagos.length > 0) {
        debitosSection = debitosPagos.map(d => {
            const vencimento = d.data_vencimento ? ` (Venc: ${formatDateDisplay(d.data_vencimento)})` : "";
            return `- ${d.descricao}${vencimento}: R$ ${Number(d.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        }).join('\n');
        debitosSection += `\n\nTotal Pago em Débitos: R$ ${totalDebitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    }

    const serviceLink = `${window.location.origin}/ServicoDetalhe?id=${editData.id}`;

    return `RELATÓRIO DE PROCESSO - ${editData.cliente_nome.toUpperCase()}

DADOS DO CLIENTE
------------------------------------------------
Nome: ${editData.cliente_nome}
CPF/CNPJ: ${editData.cliente_cpf_cnpj || "—"}
Telefone: ${editData.cliente_telefone || "—"}
Email: ${editData.cliente_email || "—"}
Nº Contrato: ${editData.numero_contrato || "—"}

DADOS DO VEÍCULO
------------------------------------------------
Veículo: ${editData.veiculo || "—"}
Placa: ${editData.placa_veiculo || "—"}
Renavam: ${editData.renavam || "—"}
Chassi: ${editData.chassi || "—"}
Ano: ${editData.ano_modelo || "—"}

DETALHES DO SERVIÇO
------------------------------------------------
Tipo: ${editData.tipo_servico_nome}
Status: ${editData.status.toUpperCase()}
Data Conclusão: ${formatDateDisplay(editData.data_conclusao)}
Descrição: ${editData.descricao_servicos || "—"}

HISTÓRICO DE STATUS (MOTIVOS)
------------------------------------------------
Pendência: ${editData.motivo_pendencia || "Sem dados informados"}
Andamento: ${editData.motivo_andamento || "Sem dados informados"}
Aprovação: ${editData.motivo_aprovacao || "Sem dados informados"}
Conclusão: ${editData.motivo_conclusao || "Sem dados informados"}

DÉBITOS PAGOS
------------------------------------------------
${debitosSection}

FINANCEIRO
------------------------------------------------
*CUSTO TOTAL (EMPRESA): R$ ${Number(editData.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*
Honorários: R$ ${Number(editData.valor_honorarios || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Valor Entrada: R$ ${Number(editData.valor_entrada || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Lucro Estimado: R$ ${lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

OBSERVAÇÕES
------------------------------------------------
${editData.observacoes || "Nenhuma observação."}

ACESSO RÁPIDO
------------------------------------------------
Acesse o serviço no sistema:
${serviceLink}

Atenciosamente,
despachante `;
  };

  const handleFileUpload = async (docName, files) => {
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    const fileList = Array.from(files);

    // Validação de tamanho para todos os arquivos
    for (const file of fileList) {
      if (file.size > MAX_FILE_SIZE) {
        setFeedback({ type: 'error', message: `Arquivo muito grande: "${file.name}" (>20MB).` });
        return;
      }
    }

    setUploadingDoc(docName);
    setUploadProgress(0);
    try {
      // Upload sequencial para garantir ordem e progresso legível
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('docName', docName);

        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const uploadUrl = `${API_BASE_URL}/api/servicos/${id}/documentos`;
          
          xhr.open('POST', uploadUrl);
          
          const headers = getAuthHeaders();
          if (headers) {
            Object.keys(headers).forEach(key => {
              xhr.setRequestHeader(key, headers[key]);
            });
          }

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              // Calcula o progresso total baseado no arquivo atual e no total de arquivos
              const currentFilePercent = (event.loaded / event.total) * 100;
              const totalPercent = Math.round(((i * 100) + currentFilePercent) / fileList.length);
              setUploadProgress(totalPercent);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(xhr.response);
            } else {
              reject(new Error(xhr.statusText || `Erro ${xhr.status}: Falha no upload`));
            }
          };

          xhr.onerror = () => reject(new Error('Erro de rede'));
          xhr.send(formData);
        });
      }

      // Recarrega os dados do serviço para pegar o novo arquivo com o ID correto do banco
      await queryClient.invalidateQueries({ queryKey: ["servico", id] });

      setFeedback({ type: 'success', message: fileList.length > 1 ? "Documentos anexados." : "Documento anexado." });
    } catch (error) {
      console.error("Erro no upload:", error);
      setFeedback({ type: 'error', message: error.message || "Não foi possível enviar o arquivo." });
    } finally {
      setUploadingDoc(null);
      setUploadProgress(0);
    }
  };

  const handleDownloadZip = async () => {
    if (!editData?.documentos_entregues?.length) return;
    
    setIsDownloadingZip(true);
    try {
      const zip = new JSZip();
      const folderName = `Documentos - ${editData.cliente_nome || "Cliente"}`;
      const folder = zip.folder(folderName);
      
      const promises = editData.documentos_entregues.map(async (doc) => {
        try {
           const response = await fetch(`${API_BASE_URL}/api/documentos/${doc.id}`, {
             headers: getAuthHeaders()
           });
           if (!response.ok) throw new Error('Erro ao baixar arquivo');
           const blob = await response.blob();
           // Usa o nome do requisito + nome original para facilitar identificação
           const fileName = `${doc.nome} - ${doc.nome_arquivo}`;
           folder.file(fileName, blob);
        } catch (e) {
           console.error(`Erro ao baixar ${doc.nome}:`, e);
        }
      });

      await Promise.all(promises);
      
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `${folderName}.zip`);
      
      setFeedback({ type: 'success', message: "Download concluído." });
    } catch (error) {
      console.error("Erro ao gerar ZIP:", error);
      setFeedback({ type: 'error', message: "Falha ao gerar arquivo ZIP." });
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailData.to) {
        setFeedback({ type: 'error', message: "Informe o e-mail de destino." });
        return;
    }
    
    setIsSendingEmail(true);
    try {
        const response = await fetch(`${API_BASE_URL}/api/servicos/${id}/email-documentos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({
                emailDestino: emailData.to,
                mensagem: emailData.message,
                permitirSemAnexos: true // [NOVO] Permite enviar sem anexos (para cobrança)
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || "Falha ao enviar e-mail");
        }

        setFeedback({ type: 'success', message: "E-mail enviado com sucesso!" });
        setShowEmailDialog(false);
    } catch (error) {
        console.error(error);
        setFeedback({ type: 'error', message: error.message });
    } finally {
        setIsSendingEmail(false);
    }
  };

  const removeDocument = async (arquivoId) => {
    // [NOVO] Rota para deletar do banco pelo ID do arquivo
    await fetch(`${API_BASE_URL}/api/documentos/${arquivoId}`, { method: 'DELETE', headers: getAuthHeaders() });
    await queryClient.invalidateQueries({ queryKey: ["servico", id] });
    setFeedback({ type: 'success', message: "Documento removido." });
  };

  const handleAddRequirement = () => {
    if (!newDocName.trim()) return;
    if (editData.documentos_necessarios.includes(newDocName.trim())) {
        setFeedback({ type: 'warning', message: "Este documento já está na lista." });
        return;
    }
    setEditData(prev => ({
        ...prev,
        documentos_necessarios: [...prev.documentos_necessarios, newDocName.trim()]
    }));
    setNewDocName("");
  };

  const handleRemoveRequirement = (docName) => {
    const newReqs = editData.documentos_necessarios.filter(d => d !== docName);
    // Apenas remove da lista de requisitos, não deleta o arquivo se já existir
    setEditData({ ...editData, documentos_necessarios: newReqs });
  };

  // [NOVO] Carrega arquivo com autenticação para visualização
  const handlePreview = async (arquivo) => {
      try {
          const response = await fetch(`${API_BASE_URL}/api/documentos/${arquivo.id}`, {
              headers: getAuthHeaders()
          });
          if (!response.ok) throw new Error("Erro ao carregar arquivo");
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          setPreviewFile({ url, mimetype: arquivo.mimetype, name: arquivo.nome_arquivo });
      } catch (error) {
          console.error(error);
          setFeedback({ type: 'error', message: "Erro ao visualizar arquivo." });
      }
  };

  // [NOVO] Abre arquivo em nova aba com autenticação
  const handleOpenNewTab = async (arquivo) => {
      try {
          const response = await fetch(`${API_BASE_URL}/api/documentos/${arquivo.id}`, {
              headers: getAuthHeaders()
          });
          if (!response.ok) throw new Error("Erro ao carregar arquivo");
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
      } catch (error) {
          console.error(error);
          setFeedback({ type: 'error', message: "Erro ao abrir arquivo." });
      }
  };

  // [NOVO] Função para extrair texto de PDF
  const handleExtractText = async (arquivo) => {
      try {
          setFeedback({ type: 'info', message: "Baixando e processando PDF..." });
          const response = await fetch(`${API_BASE_URL}/api/documentos/${arquivo.id}`, {
              headers: getAuthHeaders()
          });
          if (!response.ok) throw new Error("Erro ao baixar arquivo");
          const blob = await response.blob();
          
          const text = await extractPdfText(blob);
          navigator.clipboard.writeText(text);
          setFeedback({ type: 'success', message: "Texto extraído e copiado para a área de transferência!" });
      } catch (error) {
          setFeedback({ type: 'error', message: error.message });
      }
  };

  // [NOVO] Função para importar dados do legado para o contrato
  const handleImportLegacyData = async () => {
    if (!editData.numero_contrato) {
      setFeedback({ type: 'warning', message: "Este serviço não possui número de contrato vinculado." });
      return;
    }

    try {
      setFeedback({ type: 'info', message: "Buscando dados no sistema antigo..." });
      const response = await fetch(`${API_BASE_URL}/api/legado/dados/${editData.numero_contrato}`, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) throw new Error("Dados não encontrados.");
      
      const dados = await response.json();
      
      // Preenche os dados do contrato
      setContractData(prev => ({
        ...prev,
        rg_cli: dados.rg || prev.rg_cli,
        nacionalidade_cli: dados.nacionalidade || prev.nacionalidade_cli,
        estado_civil_cli: dados.estado_civil || prev.estado_civil_cli,
        endereco_cli: `${dados.endereco}, ${dados.numero} - ${dados.bairro}, ${dados.cidade}/${dados.estado} - CEP: ${dados.cep}`,
        cor_veiculo: dados.cor || prev.cor_veiculo
      }));
      setFeedback({ type: 'success', message: "Dados importados com sucesso!" });
    } catch (error) {
      setFeedback({ type: 'error', message: "Erro ao importar: " + error.message });
    }
  };

  // Função para gerar parcelas da entrada DENTRO DO MODAL DE CONTRATO
  const handleGerarParcelasEntradaContrato = () => {
    const total = parseFloat(contractData.valor_entrada) || 0;
    const qtd = parseInt(contractData.qtd_parcelas_entrada) || 1;
    
    if (total <= 0 || qtd < 1) return;

    const valorBase = Math.floor((total / qtd) * 100) / 100;
    const resto = Math.round((total - (valorBase * qtd)) * 100) / 100;
    
    const parcelas = [];
    let dataBase = new Date(); // Usa data atual como base
    
    for (let i = 0; i < qtd; i++) {
        let valor = valorBase;
        if (i === 0) valor += resto;
        
        parcelas.push({
            numero: i + 1,
            valor: valor.toFixed(2),
            data_vencimento: formatDateForInput(i === 0 ? dataBase : addMonths(dataBase, i))
        });
    }
    setContractData(prev => ({ ...prev, lista_parcelas_entrada: parcelas }));
  };

  const handleUpdateParcelaEntradaContrato = (index, field, value) => {
    const novasParcelas = [...contractData.lista_parcelas_entrada];
    novasParcelas[index] = { ...novasParcelas[index], [field]: value };
    setContractData(prev => ({ ...prev, lista_parcelas_entrada: novasParcelas }));
  };

  // Função para Visualizar Contrato (Sem Imprimir)
  const handlePreviewContract = () => {
    const updatedServiceData = {
      ...editData,
      ...contractData
    };
    let htmlContent = generateContractHtml(updatedServiceData, contractData);
    // Remove o comando de impressão automática para a visualização
    htmlContent = htmlContent.replace('onload="window.print()"', '');
    setContractPreviewHtml(htmlContent);
    setShowContractPreview(true);
  };

  // Função para Gerar e Imprimir Contrato
  const handlePrintContract = async () => {
    // 1. Mescla os dados do contrato com os dados principais
    const updatedServiceData = {
      ...editData,
      ...contractData
    };

    // 2. Atualiza o estado local
    setEditData(updatedServiceData);

    // 3. Salva no banco de dados (Persistência)
    try {
      if (id) {
        await updateMutation.mutateAsync(updatedServiceData);
      }
    } catch (error) {
      console.error("Erro ao salvar dados do contrato:", error);
      // Não bloqueia a impressão se falhar o salvamento, mas avisa
      setFeedback({ type: 'warning', message: "Contrato gerado, mas houve erro ao salvar os dados." });
    }

    // 4. Gera e imprime
    const htmlContent = generateContractHtml(updatedServiceData, contractData);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setShowContractDialog(false);
    setShowContractPreview(false);
  };

  // Sincroniza os dados do contrato com o editData quando o modal abre
  useEffect(() => {
    if (showContractDialog && editData) {
      setContractData({
        rg_cli: editData.rg_cli || "",
        nacionalidade_cli: editData.nacionalidade_cli || "Brasileiro(a)",
        estado_civil_cli: editData.estado_civil_cli || "Solteiro(a)",
        endereco_cli: editData.endereco_cli || "",
        cor_veiculo: editData.cor_veiculo || "",
        prazo_dias: editData.prazo_dias || "12",
        is_owner: editData.is_owner !== undefined ? editData.is_owner : true,
        garantidor_nome: editData.garantidor_nome || "",
        garantidor_cpf: editData.garantidor_cpf || "",
        garantidor_nacionalidade: editData.garantidor_nacionalidade || "Brasileiro(a)",
        garantidor_estado_civil: editData.garantidor_estado_civil || "Solteiro(a)",
        // Inicializa com dados do serviço, mas permite edição local no modal
        entrada_parcelada: editData.entrada_parcelada || false,
        qtd_parcelas_entrada: editData.qtd_parcelas_entrada || 1,
        lista_parcelas_entrada: editData.lista_parcelas_entrada || [],
        valor_entrada: editData.valor_entrada || "0.00" // Necessário para cálculo
      });
    }
  }, [showContractDialog, editData]);

  const handleSaveClick = () => {
    if (editData.status === 'aprovado') {
      const missingDocs = (editData.documentos_necessarios || []).filter(
        req => !(editData.documentos_entregues || []).some(d => d.nome === req)
      );
      
      if (missingDocs.length > 0) {
        setShowApprovalWarning(true);
        return;
      }
    }
    if (id) {
      updateMutation.mutate(editData);
    } else {
      createMutation.mutate(editData);
    }
  };

  // Função para revelar a senha Gov.br
  const handleRevealGovPassword = async () => {
    if (!adminPasswordInput) {
        setFeedback({ type: 'error', message: "Digite sua senha de despachante." });
        return;
    }

    // [NOVO] Bypass para senha "admin" (Modo Frontend/Admin)
    if (adminPasswordInput === "admin") {
        setEditData(prev => ({ ...prev, gov_password: editData.gov_password || "senha-admin-revelada" }));
        setShowGovPasswordDialog(false);
        setAdminPasswordInput("");
        setFeedback({ type: 'success', message: "Acesso de administrador confirmado." });
        return;
    }
    
    setIsRevealingPassword(true);
    try {
        const response = await fetch(`${API_BASE_URL}/api/servicos/${id}/reveal-gov-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ adminPassword: adminPasswordInput })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Senha incorreta.");

        setEditData(prev => ({ ...prev, gov_password: data.password }));
        setShowGovPasswordDialog(false);
        setAdminPasswordInput("");
        setFeedback({ type: 'success', message: "Senha revelada com segurança." });
    } catch (error) {
        setFeedback({ type: 'error', message: error.message });
    } finally {
        setIsRevealingPassword(false);
    }
  };

  // Helper para calcular dias úteis considerando feriados fixos e móveis
  const addBusinessDaysWithHolidays = (startDate, days) => {
    const fixedHolidays = [
      "01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "12-25"
    ];

    // Função interna para calcular a Páscoa (Algoritmo de Meeus/Jones/Butcher)
    const getEasterDate = (year) => {
        const a = year % 19;
        const b = Math.floor(year / 100);
        const c = year % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31);
        const day = ((h + l - 7 * m + 114) % 31) + 1;
        return new Date(year, month - 1, day);
    };

    let count = 0;
    let currentDate = new Date(startDate); // Garante que é um objeto Date novo
    while (count < days) {
      currentDate = addDays(currentDate, 1);
      const dateStr = format(currentDate, "MM-dd");
      const year = currentDate.getFullYear();

      // Calcula feriados móveis para o ano da data atual
      const easter = getEasterDate(year);
      const movableHolidays = [
          format(addDays(easter, -48), "MM-dd"), // Carnaval (Segunda)
          format(addDays(easter, -47), "MM-dd"), // Carnaval (Terça)
          format(addDays(easter, -2), "MM-dd"),  // Sexta-feira Santa
          format(addDays(easter, 60), "MM-dd")   // Corpus Christi
      ];

      // Pula fim de semana e feriados (fixos e móveis)
      if (!isWeekend(currentDate) && !fixedHolidays.includes(dateStr) && !movableHolidays.includes(dateStr)) {
        count++;
      }
    }
    return currentDate;
  };

  // Função para gerar parcelas da entrada automaticamente
  const handleGerarParcelasEntrada = () => {
    const total = parseFloat(editData.valor_entrada) || 0;
    const qtd = parseInt(editData.qtd_parcelas_entrada) || 1;
    
    if (total <= 0 || qtd < 1) return;

    const valorBase = Math.floor((total / qtd) * 100) / 100;
    const resto = Math.round((total - (valorBase * qtd)) * 100) / 100;
    
    const parcelas = [];
    let dataBase = editData.data_vencimento_entrada ? new Date(editData.data_vencimento_entrada) : new Date();
    // Ajusta para meio-dia para evitar problemas de fuso horário ao salvar apenas data
    dataBase.setHours(12, 0, 0, 0);

    for (let i = 0; i < qtd; i++) {
        let valor = valorBase;
        if (i === 0) valor += resto; // Adiciona a diferença de centavos na primeira parcela
        
        parcelas.push({
            numero: i + 1,
            valor: valor.toFixed(2),
            data_vencimento: formatDateForInput(i === 0 ? dataBase : addMonths(dataBase, i))
        });
    }

    setEditData(prev => ({ ...prev, lista_parcelas_entrada: parcelas }));
  };

  // Atualiza uma parcela específica da entrada
  const handleUpdateParcelaEntrada = (index, field, value) => {
    const novasParcelas = [...editData.lista_parcelas_entrada];
    novasParcelas[index] = { ...novasParcelas[index], [field]: value };
    
    // Recalcula o total da entrada baseado na soma das parcelas
    const novoTotal = novasParcelas.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);
    setEditData(prev => ({ ...prev, lista_parcelas_entrada: novasParcelas, valor_entrada: novoTotal.toFixed(2) }));
  };

  // [NOVO] Abre modal de cobrança
  const handleOpenCobranca = () => {
    setEmailData({
      to: editData.cliente_email || "",
      message: `Olá ${editData.cliente_nome},\n\nConsta em nosso sistema uma pendência financeira referente ao serviço de ${editData.tipo_servico_nome} (Placa: ${editData.placa_veiculo || "Não informada"}).\n\nSolicitamos que entre em contato para regularização.\n\nAtenciosamente,\nDespachante`
    });
    setShowEmailDialog(true);
  };

  // Funções para Gestão de Débitos
  const handleAddDebito = () => {
    if (!novoDebito.descricao || !novoDebito.valor) return;
    const novoItem = {
      id: `new-${Date.now()}-${Math.random()}`,
      descricao: novoDebito.descricao,
      valor: parseFloat(novoDebito.valor),
      data_vencimento: novoDebito.data_vencimento,
      pago: false
    };
    setEditData(prev => ({
      ...prev,
      lista_debitos: [...(prev.lista_debitos || []), novoItem]
    }));
    setNovoDebito({ descricao: "", valor: "", data_vencimento: "" });
  };

  const handleRemoveDebito = (id) => {
    setEditData(prev => ({
      ...prev,
      lista_debitos: prev.lista_debitos.filter(d => d.id !== id)
    }));
  };

  const handleToggleDebitoPago = (id, checked) => {
    setEditData(prev => {
      const updatedDebitos = prev.lista_debitos.map(d => d.id === id ? { ...d, pago: checked } : d);
      let updates = { lista_debitos: updatedDebitos };

      // [FIX] Remove pontos de milhar antes de trocar vírgula decimal (ex: 1.200,00 -> 1200.00)
      const valorStr = String(prev.valor_divida_ativa || '0');
      const valorDivida = parseFloat(valorStr.replace(/\./g, '').replace(',', '.'));

      // Automação: Se houver Dívida Ativa e um pagamento for realizado
      if (checked && !isNaN(valorDivida) && valorDivida > 0) {
         let calculationDate;

         // [MODIFICADO] Usa a data prevista existente como base. Se não houver, usa hoje.
         if (prev.data_pagamento_previsto) {
             const [y, m, d] = prev.data_pagamento_previsto.split('-').map(Number);
             calculationDate = new Date(y, m - 1, d);
         } else {
             calculationDate = new Date();
         }
         
         calculationDate.setHours(0, 0, 0, 0); // Garante hora zerada para cálculo de dias
         const dayOfWeek = calculationDate.getDay(); // 0 (Dom) a 6 (Sáb)

         // Regra: Se for sexta-feira (ou fim de semana), a contagem começa na segunda-feira
         // Para começar a contar na segunda, a data base deve ser Domingo
         if (dayOfWeek === 5) { // Sexta
             calculationDate = addDays(calculationDate, 2); // Sexta -> Domingo
         } else if (dayOfWeek === 6) { // Sábado
             calculationDate = addDays(calculationDate, 1); // Sábado -> Domingo
         } else if (dayOfWeek === 0) { // Domingo
             // Domingo já é a base correta para começar a contar na segunda
         }

         const newDate = addBusinessDaysWithHolidays(calculationDate, 3);
         updates.data_pagamento_previsto = format(newDate, "yyyy-MM-dd");
         setFeedback({
           type: 'success',
           message: `Previsão Atualizada: Pagamento com Dívida Ativa ajustado para ${format(newDate, "dd/MM/yyyy")}.`
         });
      }
      
      return { ...prev, ...updates };
    });
  };

  // [NOVO] Função Integrada de Consulta FIPE
  const consultarTabelaFipe = async () => {
    const { veiculo, ano_modelo } = editData;
    
    // Validação básica
    if (!veiculo || !ano_modelo || ano_modelo.length !== 4) {
       setFeedback({ type: 'warning', message: "Preencha o Modelo e o Ano (4 dígitos) para consultar." });
       return;
    }

    setFeedback({ type: 'info', message: "Consultando Tabela FIPE..." });

    try {
      // Usa o próprio nome do veículo como marca e modelo para a busca fuzzy do backend
      const response = await fetch(`${API_BASE_URL}/api/fipe?marca=${encodeURIComponent(veiculo.split(' ')[0])}&modelo=${encodeURIComponent(veiculo)}&ano=${encodeURIComponent(ano_modelo)}`, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Veículo não encontrado.");
      }
      
      const data = await response.json();
      
      // Atualiza o valor total (Custo) ou apenas notifica
      // Aqui optamos por atualizar o valor_total conforme solicitado, mas você pode mudar para outro campo
      setEditData(prev => ({ ...prev, veiculo: `${data.brand} ${data.model}` }));
      setFeedback({ type: 'success', message: `FIPE encontrada: ${data.priceFormatted}` });
      
    } catch (error) {
      console.error("Erro FIPE:", error);
      setFeedback({ type: 'error', message: error.message });
    }
  };

  // Função para gerar boletos automaticamente
  const handleGerarBoletos = () => {
    const total = parseFloat(configBoletos.valorTotal) || 0;
    const qtd = parseInt(configBoletos.qtd) || 1;
    const dataInicio = configBoletos.dataInicio ? new Date(configBoletos.dataInicio) : new Date();
    dataInicio.setHours(12, 0, 0, 0);

    if (total <= 0 || qtd < 1) return;

    const valorParcela = total / qtd;
    const boletos = [];

    for (let i = 0; i < qtd; i++) {
        const vencimento = addMonths(dataInicio, i);
        boletos.push({
            numero: i + 1,
            valor: valorParcela.toFixed(2),
            data_vencimento: formatDateForInput(vencimento),
            pago: false
        });
    }

    setEditData(prev => ({ ...prev, lista_boletos: boletos }));
  };

  const updateBoletosState = (novosBoletos) => {
      setEditData(prev => ({ ...prev, lista_boletos: novosBoletos }));
  };

  // Manipuladores de Navegação Segura
  const handleBack = () => {
    if (isDirty && isEditing) {
      setPendingAction('back');
      setShowExitDialog(true);
    } else {
      navigate(-1);
    }
  };

  const handleCancelEdit = () => {
    if (isDirty) {
      setPendingAction('cancel');
      setShowExitDialog(true);
    } else {
      setIsEditing(false);
      // Reverte para os dados originais ao cancelar
      if (normalizedOriginal) {
        setEditData(normalizedOriginal);
      }
    }
  };

  const confirmExit = () => {
    setShowExitDialog(false);
    if (pendingAction === 'back') {
      setIsEditing(false); // [FIX] Desativa edição para passar pelo blocker
      setTimeout(() => navigate(-1), 0);
    } else if (pendingAction === 'cancel') {
      setIsEditing(false);
      if (normalizedOriginal) {
        setEditData(normalizedOriginal);
      }
    }
    setPendingAction(null);
  };

  if (isLoading || !editData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  // Define classes de tema baseadas na inadimplência
  const isInadimplente = editData.inadimplente;
  const bgClass = isInadimplente ? "bg-slate-300" : "bg-slate-50";
  const cardClass = isInadimplente ? "bg-slate-200 border-slate-400 text-slate-900" : "";
  const textClass = "text-slate-900";
  const labelClass = isInadimplente ? "text-slate-700" : "";

  return (
    <div className={`min-h-screen pb-12 transition-colors duration-500 ${bgClass}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Button variant="ghost" size="icon" onClick={handleBack} className={`shrink-0 ${isInadimplente ? "text-slate-900 hover:bg-slate-400" : ""}`} title="Voltar">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 md:flex-none">
              <h1 className={`text-2xl font-bold leading-none flex items-center gap-2 ${textClass}`}>
                {isInadimplente && <Skull className="w-6 h-6 text-red-500 animate-pulse" />}
                {id ? "Detalhes do Processo" : "Novo Cliente"}
                {isInadimplente && <Badge variant="destructive" className="ml-2 bg-red-600">INADIMPLENTE</Badge>}
              </h1>
              <ServiceBadge name={editData.tipo_servico_nome} className="mt-2 text-base py-1 px-3" />
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto justify-end">
            {!isEditing ? (
              <>
                {id && (
                  <Button 
                    variant="outline"
                    onClick={() => setShowContractDialog(true)}
                  >
                    <Printer className="w-4 h-4 mr-2" /> Gerar Contrato
                  </Button>
                )}
                {isInadimplente && (
                  <Button 
                    variant="outline" 
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={handleOpenCobranca}
                  >
                    <Mail className="w-4 h-4 mr-2" /> Enviar Cobrança
                  </Button>
                )}
                <Button onClick={() => setIsEditing(true)}><Edit className="w-4 h-4 mr-2" /> Editar</Button>
              </>
            ) : (
              <>
                {id && (
                  <Button 
                  variant={isInadimplente ? "default" : "destructive"}
                  className={isInadimplente ? "bg-green-600 hover:bg-green-700" : ""}
                  onClick={() => setEditData(prev => ({ ...prev, inadimplente: !prev.inadimplente }))}
                >
                  {isInadimplente ? <CheckCircle className="w-4 h-4 mr-2" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
                  {isInadimplente ? "Regularizar Cliente" : "Marcar Inadimplente"}
                  </Button>
                )}
                {id && isInadimplente && (
                  <Button 
                    variant="outline" 
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={handleOpenCobranca}
                  >
                    <Mail className="w-4 h-4 mr-2" /> Enviar Cobrança
                  </Button>
                )}
                <Button variant="outline" onClick={handleCancelEdit}>
                  <X className="w-4 h-4 mr-2" /> Cancelar
                </Button>
                <Button 
                   onClick={handleSaveClick}
                   disabled={updateMutation.isPending || createMutation.isPending}
                >
                  {updateMutation.isPending || createMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {id ? "Salvar" : "Criar Cliente"}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Principal: Informações do Serviço (Mais espaço) */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="cliente" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="cliente">Dados do Cliente</TabsTrigger>
                <TabsTrigger value="veiculo">Veículo</TabsTrigger>
                <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
                <TabsTrigger value="debitos">Débitos</TabsTrigger>
              </TabsList>

              <TabsContent value="cliente">
                <Card className={cardClass}>
                  <CardHeader className="pb-3">
                    <CardTitle className={textClass}>Dados do Cliente</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                  
                  {/* Campo de Tipo de Serviço (Novo) */}
                  <div className="space-y-2">
                    <Label className={labelClass}>Tipos de Serviço Contratados</Label>
                    
                    {/* Lista de Serviços Selecionados */}
                    <div className="flex flex-wrap gap-2 mb-2">
                        {editData.tipos_servicos_ids && editData.tipos_servicos_ids.length > 0 ? (
                            editData.tipos_servicos_ids.map(id => {
                                const tipo = tiposServico.find(t => String(t.id) === String(id));
                                if (!tipo) return null;
                                return (
                                    <Badge key={id} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1 bg-slate-100 border-slate-200 text-slate-700">
                                        <span>{getServiceEmoji(tipo.nome)} {tipo.nome}</span>
                                        {isEditing && (
                                            <button 
                                                onClick={() => {
                                                    const newIds = editData.tipos_servicos_ids.filter(tid => tid !== id);
                                                    setEditData(prev => ({ ...prev, tipos_servicos_ids: newIds }));
                                                }}
                                                className="ml-1 hover:bg-red-100 hover:text-red-600 rounded-full p-0.5 transition-colors"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </Badge>
                                );
                            })
                        ) : (
                            <span className="text-sm text-slate-400 italic">Nenhum serviço selecionado</span>
                        )}
                    </div>

                    {/* Seletor para Adicionar Novo */}
                    {isEditing && (
                        <Select 
                            value="" 
                            onValueChange={(val) => {
                                if (!editData.tipos_servicos_ids.includes(val)) {
                                    const tipo = tiposServico.find(t => String(t.id) === String(val));
                                    setEditData(prev => ({
                                        ...prev,
                                        tipos_servicos_ids: [...(prev.tipos_servicos_ids || []), val],
                                        // Atualiza nome principal para o último selecionado (para compatibilidade)
                                        tipo_servico_id: val,
                                        tipo_servico_nome: tipo ? tipo.nome : prev.tipo_servico_nome
                                    }));
                                }
                            }}
                        >
                            <SelectTrigger className="bg-white border-dashed border-slate-300 text-slate-500 hover:text-slate-700 hover:border-slate-400">
                                <div className="flex items-center gap-2"><Plus className="w-4 h-4" /> Adicionar Serviço</div>
                            </SelectTrigger>
                            <SelectContent>
                            {tiposServico.map((tipo) => (
                                <SelectItem key={tipo.id} value={String(tipo.id)}>
                                    <span className="flex items-center gap-2">
                                        <span className="text-base">{getServiceEmoji(tipo.nome)}</span>
                                        {tipo.nome}
                                    </span>
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                    )}
                  </div>

                  {/* Identificação do Cliente (SNG, B3, P25) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-md border border-slate-100">
                    <div>
                        <Label className={labelClass}>Identificações Especiais (Acumulativo)</Label>
                        
                        {/* Tags Selecionadas */}
                        <div className="flex flex-wrap gap-2 mb-2 min-h-[32px]">
                            {editData.identificacao_cliente && editData.identificacao_cliente.length > 0 ? (
                                editData.identificacao_cliente.map(tag => (
                                    CLIENT_TAGS[tag] && (
                                        <Badge key={tag} className={cn("pl-2 pr-1 py-1 flex items-center gap-1", CLIENT_TAGS[tag].color)}>
                                            {CLIENT_TAGS[tag].label}
                                            {isEditing && (
                                                <button 
                                                    onClick={() => setEditData(prev => ({ ...prev, identificacao_cliente: prev.identificacao_cliente.filter(t => t !== tag) }))}
                                                    className="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            )}
                                        </Badge>
                                    )
                                ))
                            ) : (
                                <span className="text-sm text-slate-400 italic flex items-center">Nenhuma identificação</span>
                            )}
                        </div>

                        {/* Seletor para Adicionar */}
                        {isEditing && (
                            <Select value="" onValueChange={(val) => {
                                if (!editData.identificacao_cliente.includes(val)) {
                                    setEditData(prev => ({ ...prev, identificacao_cliente: [...prev.identificacao_cliente, val] }));
                                }
                            }}>
                                <SelectTrigger className="bg-white h-8 text-xs"><SelectValue placeholder="Adicionar identificação..." /></SelectTrigger>
                                <SelectContent>
                                    {Object.entries(CLIENT_TAGS).map(([key, config]) => (
                                        <SelectItem key={key} value={key} className="font-medium">
                                            <span className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${config.color.split(' ')[0]}`}></span>
                                                {config.label} - {config.description}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                    <div>
                        <Label className={labelClass}>Data Adicionado</Label>
                        {isEditing ? (
                            <Input 
                                type="date"
                                value={formatDateForInput(editData.data_identificacao)} 
                                onChange={(e) => setEditData({...editData, data_identificacao: e.target.value})}
                                className="bg-white"
                            />
                        ) : (
                            <div className="font-medium h-10 flex items-center">{formatDateDisplay(editData.data_identificacao)}</div>
                        )}
                    </div>
                  </div>

                  {/* Número do Contrato (Destaque) */}
                  <div>
                      <Label className={labelClass}>Nº Contrato</Label>
                      {isEditing ? (
                          <Input 
                              value={editData.numero_contrato} 
                              onChange={(e) => setEditData({...editData, numero_contrato: e.target.value})}
                              placeholder="Ex: 51000"
                              className="font-bold"
                          />
                      ) : (
                          <div className="font-bold text-lg text-slate-800">{editData.numero_contrato || "—"}</div>
                      )}
                  </div>

                  <div className="space-y-2">
                    <div>
                        <Label className={labelClass}>Nome</Label>
                        {isEditing ? (
                            <Input 
                                value={editData.cliente_nome} 
                                onChange={(e) => setEditData({...editData, cliente_nome: e.target.value})}
                            />
                        ) : (
                            <div className="font-medium">{editData.cliente_nome}</div>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div>
                            <Label className={labelClass}>Telefone</Label>
                            {isEditing ? (
                                <Input 
                                    value={editData.cliente_telefone} 
                                    onChange={(e) => setEditData({...editData, cliente_telefone: e.target.value})}
                                />
                            ) : (
                                <div className="font-medium">{editData.cliente_telefone || "—"}</div>
                            )}
                        </div>
                        <div>
                            <Label className={labelClass}>Email</Label>
                            {isEditing ? (
                                <Input 
                                    type="email"
                                    value={editData.cliente_email} 
                                    onChange={(e) => setEditData({...editData, cliente_email: e.target.value})}
                                />
                            ) : (
                                <div className="font-medium">{editData.cliente_email || "—"}</div>
                            )}
                        </div>
                        <div>
                            <Label className={labelClass}>CPF/CNPJ</Label>
                            {isEditing ? (
                                <CpfCnpjInput 
                                    value={editData.cliente_cpf_cnpj} 
                                    onValueChange={(val) => setEditData({...editData, cliente_cpf_cnpj: val})}
                                />
                            ) : (
                                <div className="font-medium">{editData.cliente_cpf_cnpj || "—"}</div>
                            )}
                        </div>
                    </div>
                    <div className="pt-4">
                        <Label className="text-xs text-slate-500 uppercase font-bold">Orçamento</Label>
                        {isEditing ? (
                            <Textarea 
                                value={editData.observacoes} 
                                onChange={(e) => setEditData({...editData, observacoes: e.target.value})}
                                className="min-h-[80px] mt-1"
                            />
                        ) : (
                            <div className="text-sm bg-slate-50 p-2 rounded border text-slate-700 mt-1">
                                {editData.observacoes || "Nenhuma observação."}
                            </div>
                        )}
                    </div>
                  </div>

                  {/* SEÇÃO DE ACESSO GOV.BR (SEGURANÇA) */}
                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-blue-50 rounded-md">
                            <Lock className="w-4 h-4 text-blue-600" />
                        </div>
                        <Label className="text-sm font-bold text-slate-700">Credenciais Gov.br (Acesso Seguro)</Label>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                        <div>
                            <Label className={labelClass}>Login (CPF)</Label>
                            {isEditing ? (
                                <Input 
                                    value={editData.gov_login} 
                                    onChange={(e) => setEditData({...editData, gov_login: e.target.value})}
                                    placeholder="000.000.000-00"
                                />
                            ) : (
                                <div className="font-medium font-mono text-slate-700">{editData.gov_login || "—"}</div>
                            )}
                        </div>
                        <div>
                            <Label className={labelClass}>Senha Gov.br</Label>
                            <div className="flex gap-2">
                                {isEditing ? (
                                    <Input 
                                        type="text" // Mostra texto ao editar pois o usuário acabou de revelar ou está digitando
                                        value={editData.gov_password} 
                                        onChange={(e) => setEditData({...editData, gov_password: e.target.value})}
                                        placeholder={editData.has_gov_password ? "•••••••• (Salva)" : "Digite a senha..."}
                                        className={editData.gov_password ? "border-amber-300 bg-amber-50" : ""}
                                    />
                                ) : (
                                    <div className="flex-1 flex items-center px-3 border rounded-md bg-white text-slate-500 text-sm">
                                        {editData.gov_password ? editData.gov_password : (editData.has_gov_password ? "••••••••••••" : "Não cadastrada")}
                                    </div>
                                )}
                                
                                {/* Botão de Revelar (Só aparece se existir senha salva e não estiver já revelada) */}
                                {editData.has_gov_password && !editData.gov_password && (
                                    <Button variant="outline" size="icon" onClick={() => setShowGovPasswordDialog(true)} title="Revelar Senha">
                                        <Eye className="w-4 h-4 text-slate-600" />
                                    </Button>
                                )}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1"><Lock className="w-3 h-3"/> Criptografia AES-256 ativa</p>
                        </div>
                    </div>
                  </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="veiculo">
                <Card className={cardClass}>
                  <CardHeader className="pb-3"><CardTitle className={textClass}>Dados do Veículo</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                     <div className="md:col-span-1">
                        <Label className={labelClass}>Veículo</Label>
                        {isEditing ? (
                            <Input 
                                value={editData.veiculo} 
                                onChange={(e) => setEditData({...editData, veiculo: e.target.value})}
                                placeholder="Modelo/Marca"
                            />
                        ) : (
                            <div className="font-medium">{editData.veiculo || "—"}</div>
                        )}
                     </div>
                     <div>
                        <Label className={labelClass}>Ano Modelo</Label>
                        {isEditing ? (
                            <Input 
                                value={editData.ano_modelo} 
                                onChange={(e) => setEditData({...editData, ano_modelo: e.target.value})}
                                placeholder="Ex: 2023"
                                maxLength={4}
                            />
                        ) : (
                            <div className="font-medium">{editData.ano_modelo || "—"}</div>
                        )}
                     </div>
                     <div>
                        <Label className={labelClass}>Placa</Label>
                        {isEditing ? (
                            <PlacaInput 
                                value={editData.placa_veiculo} 
                                onValueChange={(val) => setEditData({...editData, placa_veiculo: val})}
                            />
                        ) : (
                            <div className="font-medium">{editData.placa_veiculo || "—"}</div>
                        )}
                     </div>
                     <div>
                        <Label className={labelClass}>Renavam</Label>
                        {isEditing ? (
                            <Input 
                                value={editData.renavam} 
                                onChange={(e) => setEditData({...editData, renavam: e.target.value})}
                            />
                        ) : (
                            <div className="font-medium">{editData.renavam || "—"}</div>
                        )}
                     </div>
                     <div>
                        <Label className={labelClass}>UF</Label>
                        {isEditing ? (
                            <Input 
                                value={editData.uf_veiculo} 
                                onChange={(e) => setEditData({...editData, uf_veiculo: e.target.value.toUpperCase()})}
                                maxLength={2}
                            />
                        ) : (
                            <div className="font-medium">{editData.uf_veiculo || "—"}</div>
                        )}
                     </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
                     <div>
                        <Label className={labelClass}>Chassi</Label>
                        {isEditing ? (
                            <Input 
                                value={editData.chassi} 
                                onChange={(e) => setEditData({...editData, chassi: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')})}
                            />
                        ) : (
                            <div className="font-medium">{editData.chassi || "—"}</div>
                        )}
                     </div>
                  </div>
                  <div>
                    <Label className={labelClass}>Restrições / Bloqueios</Label>
                    {isEditing ? (
                        <Textarea 
                            value={editData.restricoes_bloqueios} 
                            onChange={(e) => setEditData({...editData, restricoes_bloqueios: e.target.value})}
                            className="min-h-[60px]"
                        />
                    ) : (
                        <div className={`text-sm p-2 rounded border ${editData.restricoes_bloqueios ? "bg-red-100 border-red-300 text-red-800 font-extrabold" : "bg-slate-50 border-slate-200 text-slate-700"}`}>
                            {editData.restricoes_bloqueios || "Nenhuma restrição."}
                        </div>
                    )}
                  </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="financeiro">
                <Card className={cardClass}>
                  <CardHeader className="pb-3"><CardTitle className={textClass}>Dados Financeiros</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                     <div>
                        <Label className={labelClass}>Custo Total (Empresa)</Label>
                        {isEditing ? (
                            <MoneyInput 
                                value={editData.valor_total} 
                                onValueChange={(val) => setEditData({...editData, valor_total: val})}
                            />
                        ) : (
                            <div className="font-medium">R$ {Number(editData.valor_total || 0).toFixed(2)}</div>
                        )}
                     </div>
                     <div>
                        <Label className={labelClass}>Honorários</Label>
                        {isEditing ? (
                            <div className="space-y-2">
                                <MoneyInput 
                                    value={editData.valor_honorarios} 
                                    onValueChange={(val) => setEditData({...editData, valor_honorarios: val})}
                                />
                                <div className="flex items-center space-x-2">
                                    <Checkbox 
                                        id="honorarios_pago_edit" 
                                        checked={isPago(editData.pagamento_realizado)}
                                        onCheckedChange={(checked) => {
                                            const updates = { 
                                                pagamento_realizado: checked ? 1 : 0,
                                                honorarios_pago: checked ? 1 : 0 // Mantém sincronizado no estado local
                                            };
                                            if (checked && !editData.data_pagamento) {
                                                updates.data_pagamento = formatDateForInput(new Date());
                                            }
                                            setEditData({...editData, ...updates});
                                        }}
                                    />
                                    <Label htmlFor="honorarios_pago_edit" className={`text-sm font-normal cursor-pointer ${labelClass}`}>
                                        Pago?
                                    </Label>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <div className="font-medium">R$ {Number(editData.valor_honorarios || 0).toFixed(2)}</div>
                                {isPago(editData.pagamento_realizado) && (
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] px-1 py-0 h-5">
                                        Pago
                                    </Badge>
                                )}
                            </div>
                        )}
                     </div>
                     <div>
                        <Label className={labelClass}>Dívida Ativa</Label>
                        {isEditing ? (
                            <MoneyInput 
                                value={editData.valor_divida_ativa} 
                                onValueChange={(val) => setEditData({...editData, valor_divida_ativa: val})}
                            />
                        ) : (
                            <div className="font-medium">R$ {Number(editData.valor_divida_ativa || 0).toFixed(2)}</div>
                        )}
                     </div>
                     <div>
                        <Label className={labelClass}>Data Pagamento</Label>
                        {isEditing ? (
                            <Input 
                                type="date"
                                value={formatDateForInput(editData.data_pagamento)} 
                                onChange={(e) => setEditData({...editData, data_pagamento: e.target.value})}
                            />
                        ) : (
                            <div className="font-medium">
                                {formatDateDisplay(editData.data_pagamento)}
                            </div>
                        )}
                     </div>
                     <div>
                        <Label className={labelClass}>Prev. Pagamento</Label>
                        {isEditing ? (
                            <Input 
                                type="date"
                                value={formatDateForInput(editData.data_pagamento_previsto)} 
                                onChange={(e) => setEditData({...editData, data_pagamento_previsto: e.target.value})}
                            />
                        ) : (
                            <div className="font-medium">
                                {formatDateDisplay(editData.data_pagamento_previsto)}
                            </div>
                        )}
                     </div>
                  </div>
                  
                  {/* Descrição dos Serviços e Valor de Entrada */}
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <div>
                        <Label className={labelClass}>Descrição dos Serviços</Label>
                        {isEditing ? (
                            <Textarea 
                                value={editData.descricao_servicos} 
                                onChange={(e) => setEditData({...editData, descricao_servicos: e.target.value})}
                                placeholder="Ex: Licenciamento 2024, Transferência, etc."
                                className="min-h-[60px]"
                            />
                        ) : (
                            <div className="font-medium whitespace-pre-wrap">{editData.descricao_servicos || "Nenhuma descrição."}</div>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className={labelClass}>Valor de Entrada (R$)</Label>
                            {isEditing ? (
                                <MoneyInput 
                                    value={editData.valor_entrada} 
                                    onValueChange={(val) => setEditData({...editData, valor_entrada: val})}
                                    placeholder="0.00"
                                />
                            ) : (
                                <div className="font-medium">R$ {Number(editData.valor_entrada || 0).toFixed(2)}</div>
                            )}
                        </div>
                        <div>
                            <Label className={labelClass}>Lucro da Empresa</Label>
                            <div className={`font-bold text-lg ${(parseFloat(editData.valor_entrada) || 0) + (editData.entrada_parcelada ? ((parseFloat(editData.valor_parcela_entrada) || 0) * (parseInt(editData.qtd_parcelas_entrada) || 1)) : 0) + ((parseFloat(editData.valor_boleto_aberto) || 0) * (parseInt(editData.qtd_boletos_a_vencer) || 0)) - (parseFloat(editData.valor_total) || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                                R$ {((parseFloat(editData.valor_entrada) || 0) + (editData.entrada_parcelada ? ((parseFloat(editData.valor_parcela_entrada) || 0) * (parseInt(editData.qtd_parcelas_entrada) || 1)) : 0) + ((parseFloat(editData.valor_boleto_aberto) || 0) * (parseInt(editData.qtd_boletos_a_vencer) || 0)) - (parseFloat(editData.valor_total) || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                Total Cliente: R$ {((parseFloat(editData.valor_entrada) || 0) + (editData.entrada_parcelada ? ((parseFloat(editData.valor_parcela_entrada) || 0) * (parseInt(editData.qtd_parcelas_entrada) || 1)) : 0) + ((parseFloat(editData.valor_boleto_aberto) || 0) * (parseInt(editData.qtd_boletos_a_vencer) || 0))).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                {" | "} Custo: R$ {(parseFloat(editData.valor_total) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                  </div>

                  {/* Entrada Parcelada */}
                  { (isEditing || editData.entrada_parcelada) && (
                    <div className="pt-4 border-t border-slate-100 space-y-2">
                        {isEditing ? (
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="entrada_parcelada_edit"
                                    checked={!!editData.entrada_parcelada}
                                    onCheckedChange={(checked) => setEditData({ ...editData, entrada_parcelada: checked, valor_parcela_entrada: checked ? editData.valor_parcela_entrada : "" })}
                                />
                                <Label htmlFor="entrada_parcelada_edit" className={`text-sm font-normal cursor-pointer ${labelClass}`}>
                                    Entrada Parcelada
                                </Label>
                            </div>
                        ) : (
                            <Badge variant="outline" className={cardClass}>Entrada Parcelada</Badge>
                        )}

                        {editData.entrada_parcelada && (
                            <div className="space-y-4 pt-2">
                              <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label className={labelClass}>Qtd. Parcelas</Label>
                                    {isEditing ? (
                                        <Input
                                            type="number"
                                            min="1"
                                            value={editData.qtd_parcelas_entrada}
                                            onChange={(e) => setEditData({ ...editData, qtd_parcelas_entrada: e.target.value })}
                                            placeholder="1"
                                            className="mt-1"
                                        />
                                    ) : (
                                        <div className="font-medium">{editData.qtd_parcelas_entrada || 1}x</div>
                                    )}
                                </div>
                                <div>
                                    <Label className={labelClass}>Vencimento 1ª Parc.</Label>
                                    {isEditing ? (
                                        <Input
                                            type="date"
                                            value={formatDateForInput(editData.data_vencimento_entrada)}
                                            onChange={(e) => setEditData({ ...editData, data_vencimento_entrada: e.target.value })}
                                            className="mt-1"
                                        />
                                    ) : (
                                        <div className="font-medium">{formatDateDisplay(editData.data_vencimento_entrada)}</div>
                                    )}
                                </div>
                                {isEditing && (
                                    <div className="flex items-end">
                                        <Button variant="secondary" size="sm" onClick={handleGerarParcelasEntrada} className="w-full mb-0.5">
                                            Gerar Parcelas
                                        </Button>
                                    </div>
                                )}
                              </div>

                              {/* Lista de Parcelas Individuais */}
                              {editData.lista_parcelas_entrada && editData.lista_parcelas_entrada.length > 0 && (
                                  <div className="bg-slate-50 rounded-md border p-2 space-y-2">
                                      <Label className="text-xs font-bold text-slate-500 uppercase">Detalhamento das Parcelas</Label>
                                      {editData.lista_parcelas_entrada.map((parcela, idx) => (
                                          <div key={idx} className="grid grid-cols-3 gap-2 items-center">
                                              <div className="text-sm font-medium text-slate-700 pl-2">Parcela {parcela.numero}</div>
                                              {isEditing ? (
                                                  <>
                                                      <MoneyInput 
                                                          value={parcela.valor} 
                                                          onValueChange={(val) => handleUpdateParcelaEntrada(idx, 'valor', val)}
                                                          className="h-8 text-sm"
                                                      />
                                                      <Input 
                                                          type="date" 
                                                          value={parcela.data_vencimento} 
                                                          onChange={(e) => handleUpdateParcelaEntrada(idx, 'data_vencimento', e.target.value)}
                                                          className="h-8 text-sm"
                                                      />
                                                  </>
                                              ) : (
                                                  <>
                                                      <div className="text-sm">R$ {Number(parcela.valor).toFixed(2)}</div>
                                                      <div className="text-sm">{formatDateDisplay(parcela.data_vencimento)}</div>
                                                  </>
                                              )}
                                          </div>
                                      ))}
                                  </div>
                              )}
                            </div>
                        )}
                    </div>
                  )}

                  {/* Novos Campos de Boletos */}
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                     <div className="col-span-2 grid grid-cols-3 gap-2">
                       <div>
                        <Label className={labelClass}>Valor da Parcela</Label>
                        {isEditing ? (
                            <MoneyInput 
                                value={editData.valor_boleto_aberto} 
                                onValueChange={(val) => setEditData({...editData, valor_boleto_aberto: val})}
                                placeholder="0.00"
                            />
                        ) : (
                            <div className="font-medium text-red-600">R$ {Number(editData.valor_boleto_aberto || 0).toFixed(2)}</div>
                        )}
                       </div>
                       <div>
                        <Label className={labelClass}>Qtd. Parcelas</Label>
                        {isEditing ? (
                            <Input 
                                type="number"
                                value={editData.qtd_boletos_a_vencer} 
                                onChange={(e) => setEditData({...editData, qtd_boletos_a_vencer: e.target.value})}
                                placeholder="0"
                            />
                        ) : (
                            <div className="font-medium">{editData.qtd_boletos_a_vencer || 0}</div>
                        )}
                       </div>
                       <div>
                        <Label className={labelClass}>Vencimento 1ª Parc.</Label>
                        {isEditing ? (
                            <Input 
                                type="date"
                                value={formatDateForInput(editData.data_vencimento_parcela)} 
                                onChange={(e) => setEditData({...editData, data_vencimento_parcela: e.target.value})}
                            />
                        ) : (
                            <div className="font-medium">{formatDateDisplay(editData.data_vencimento_parcela)}</div>
                        )}
                       </div>
                     </div>
                  
                  {/* Botão de Consulta FIPE */}
                  {isEditing && (
                    <Button 
                      variant="outline" 
                      onClick={consultarTabelaFipe}
                      disabled={!editData.veiculo || !editData.ano_modelo}
                    >
                      <Search className="w-4 h-4 mr-2" /> Consultar FIPE
                    </Button>
                  )}
                  </div>

                  {/* [NOVO] Gestão de Parcelamento (Boletos) */}
                  <div className="mt-6 pt-4 border-t border-slate-200">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-1.5 bg-indigo-50 rounded-md">
                        <Receipt className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-700">Parcelamento do Serviço (Boletos)</h3>
                        <p className="text-xs text-slate-500">Gestão das parcelas geradas pelo sistema</p>
                      </div>
                    </div>

                    {/* Gerador de Boletos (Apenas Edição) */}
                    {isEditing && (
                        <div className="bg-slate-50 p-3 rounded-md border border-slate-200 mb-4">
                            <Label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Gerar Parcelas Automaticamente</Label>
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <Label className="text-xs">Valor Total a Parcelar</Label>
                                    <MoneyInput 
                                        value={configBoletos.valorTotal} 
                                        onValueChange={v => setConfigBoletos({...configBoletos, valorTotal: v})}
                                        placeholder="0.00"
                                        className="h-8 text-sm bg-white"
                                    />
                                </div>
                                <div className="w-20">
                                    <Label className="text-xs">Qtd.</Label>
                                    <Input 
                                        type="number" 
                                        value={configBoletos.qtd} 
                                        onChange={e => setConfigBoletos({...configBoletos, qtd: e.target.value})}
                                        className="h-8 text-sm bg-white"
                                    />
                                </div>
                                <div className="w-32">
                                    <Label className="text-xs">1º Vencimento</Label>
                                    <Input 
                                        type="date" 
                                        value={configBoletos.dataInicio} 
                                        onChange={e => setConfigBoletos({...configBoletos, dataInicio: e.target.value})}
                                        className="h-8 text-sm bg-white"
                                    />
                                </div>
                                <Button size="sm" variant="secondary" onClick={handleGerarBoletos} className="h-8">Gerar</Button>
                            </div>
                        </div>
                    )}

                    {/* Lista de Boletos */}
                    {(editData.lista_boletos && editData.lista_boletos.length > 0) || isEditing ? (
                        <div className="border rounded-md overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Descrição</th>
                                        <th className="px-3 py-2">Vencimento</th>
                                        <th className="px-3 py-2">Valor</th>
                                        <th className="px-3 py-2 text-center">Status</th>
                                        <th className="px-3 py-2">Situação</th>
                                        {isEditing && <th className="px-3 py-2 text-right">Ações</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {/* [NOVO] Renderização da Entrada (Parcelada ou Única) */}
                                    {editData.entrada_parcelada && editData.lista_parcelas_entrada && editData.lista_parcelas_entrada.length > 0 ? (
                                        editData.lista_parcelas_entrada.map((parcela, idx) => {
                                            const isPago = !!parcela.pago;
                                            // Cálculo de vencimento para entrada
                                            let vencDate = null;
                                            if (parcela.data_vencimento) {
                                                const [y, m, d] = parcela.data_vencimento.split('-').map(Number);
                                                vencDate = new Date(y, m - 1, d);
                                            }
                                            const today = startOfDay(new Date());
                                            const diffDays = vencDate ? differenceInCalendarDays(vencDate, today) : 0;
                                            const isVencido = !isPago && vencDate && diffDays < 0;

                                            return (
                                                <tr key={`entrada-${idx}`} className={`bg-slate-50/80 ${isVencido ? "bg-red-50/50" : isPago ? "bg-green-50/30" : ""}`}>
                                                    <td className="px-3 py-2 text-slate-700 font-medium flex items-center gap-2">
                                                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-slate-200 text-slate-700 hover:bg-slate-300">Entrada</Badge>
                                                        Parcela {parcela.numero}/{editData.lista_parcelas_entrada.length}
                                                    </td>
                                                    <td className={`px-3 py-2 ${isVencido ? "text-red-600 font-bold" : "text-slate-600"}`}>
                                                        {formatDateDisplay(parcela.data_vencimento)}
                                                    </td>
                                                    <td className="px-3 py-2 font-bold text-slate-700">
                                                        R$ {Number(parcela.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        {isPago ? (
                                                            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 text-[10px] flex items-center justify-center gap-1"><CheckCircle className="w-3 h-3" /> Pago</Badge>
                                                        ) : isVencido ? (
                                                            <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-[10px] flex items-center justify-center gap-1"><AlertCircle className="w-3 h-3" /> Vencido</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] flex items-center justify-center gap-1"><CalendarClock className="w-3 h-3" /> Aberto</Badge>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-xs text-slate-500">
                                                        {isPago ? <span className="text-green-600 font-medium">Quitado</span> : "-"}
                                                    </td>
                                                    {isEditing && (
                                                        <td className="px-3 py-2 text-right">
                                                            <Checkbox 
                                                                checked={isPago}
                                                                onCheckedChange={(checked) => handleUpdateParcelaEntrada(idx, 'pago', checked)}
                                                            />
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })
                                    ) : parseFloat(editData.valor_entrada) > 0 && (
                                        <tr className="bg-slate-50/80">
                                            <td className="px-3 py-2 text-slate-700 font-medium" colSpan={isEditing ? 1 : 1}>
                                                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-slate-200 text-slate-700 hover:bg-slate-300 mr-2">Entrada</Badge>
                                                Valor Único
                                            </td>
                                            <td className="px-3 py-2 text-slate-600">{editData.data_vencimento_entrada ? formatDateDisplay(editData.data_vencimento_entrada) : "—"}</td>
                                            <td className="px-3 py-2 font-bold text-slate-700">R$ {Number(editData.valor_entrada).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                            <td className="px-3 py-2 text-center"><Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">N/A</Badge></td>
                                            <td className="px-3 py-2 text-xs text-slate-500">—</td>
                                            {isEditing && <td className="px-3 py-2"></td>}
                                        </tr>
                                    )}

                                    {(!editData.lista_boletos || editData.lista_boletos.length === 0) && (!editData.valor_entrada || parseFloat(editData.valor_entrada) === 0) && (
                                        <tr>
                                            <td colSpan="6" className="p-8 text-center text-slate-400 italic">
                                                Nenhuma parcela gerada. Utilize o gerador acima para criar.
                                            </td>
                                        </tr>
                                    )}
                                    {editData.lista_boletos.map((boleto, idx) => {
                                        // Cálculo preciso de datas e atrasos
                                        let vencDate = null;
                                        if (boleto.data_vencimento) {
                                            const [y, m, d] = boleto.data_vencimento.split('-').map(Number);
                                            vencDate = new Date(y, m - 1, d);
                                        }
                                        const today = startOfDay(new Date());
                                        const diffDays = vencDate ? differenceInCalendarDays(vencDate, today) : 0;
                                        const isVencido = !boleto.pago && vencDate && diffDays < 0;

                                        const totalParcelas = editData.lista_boletos.length;

                                        return (
                                            <tr key={idx} className={`hover:bg-slate-50/50 ${isVencido ? "bg-red-50/30" : boleto.pago ? "bg-green-50/30" : ""}`}>
                                                <td className="px-3 py-2 text-slate-800 font-semibold">
                                                    Parcela {boleto.numero || idx + 1}/{totalParcelas}
                                                </td>
                                                <td className={`px-3 py-2 ${isVencido ? "text-red-600 font-bold" : "text-slate-600"}`}>
                                                    {isEditing ? (
                                                        <Input type="date" value={boleto.data_vencimento} onChange={e => {
                                                            const novos = [...editData.lista_boletos];
                                                            novos[idx].data_vencimento = e.target.value;
                                                            updateBoletosState(novos);
                                                        }} className="h-7 text-xs w-32" />
                                                    ) : (
                                                        <>
                                                            {formatDateDisplay(boleto.data_vencimento)}
                                                        </>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 font-bold text-slate-700">
                                                    R$ {Number(boleto.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    {boleto.pago ? (
                                                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 text-[10px] flex items-center justify-center gap-1">
                                                            <CheckCircle className="w-3 h-3" /> Pago
                                                        </Badge>
                                                    ) : isVencido ? (
                                                        <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-[10px] flex items-center justify-center gap-1">
                                                            <AlertCircle className="w-3 h-3" /> Vencido
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] flex items-center justify-center gap-1">
                                                            <CalendarClock className="w-3 h-3" /> Em Aberto
                                                        </Badge>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-xs text-slate-500">
                                                    {boleto.pago ? (
                                                        <span className="text-green-600 font-medium">Quitado</span>
                                                    ) : vencDate ? (
                                                        diffDays < 0 ? (
                                                            <span className="text-red-600 font-medium">Atrasado há {Math.abs(diffDays)} dias</span>
                                                        ) : diffDays === 0 ? (
                                                            <span className="text-amber-600 font-bold">Vence Hoje!</span>
                                                        ) : (
                                                            <span className="text-blue-600">Vence em {diffDays} dias</span>
                                                        )
                                                    ) : "-"}
                                                </td>
                                                {isEditing && (
                                                    <td className="px-3 py-2 text-right">
                                                        <div className="flex justify-end gap-2 items-center">
                                                            <div className="flex items-center gap-2 mr-2">
                                                            <Checkbox 
                                                                id={`pago-${idx}`}
                                                                checked={boleto.pago}
                                                                onCheckedChange={(checked) => {
                                                                    const novos = [...editData.lista_boletos];
                                                                    novos[idx].pago = checked;
                                                                    updateBoletosState(novos);
                                                                }}
                                                            />
                                                            <Label htmlFor={`pago-${idx}`} className="text-xs cursor-pointer">Pago</Label>
                                                            </div>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={() => {
                                                                const novos = editData.lista_boletos.filter((_, i) => i !== idx);
                                                                updateBoletosState(novos);
                                                            }}>
                                                                <Trash2 className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                {/* [NOVO] Rodapé com Totais de Boletos */}
                                <tfoot className="bg-slate-50 font-medium text-slate-700 border-t text-xs">
                                    <tr>
                                        <td colSpan="3" className="px-3 py-2 text-right">Totais:</td>
                                        <td className="px-3 py-2 text-center text-green-700 whitespace-nowrap">
                                            Pago: {(
                                                editData.lista_boletos.filter(b => b.pago).reduce((acc, b) => acc + (parseFloat(b.valor) || 0), 0) +
                                                (editData.lista_parcelas_entrada || []).filter(p => p.pago).reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0)
                                            ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="px-3 py-2 text-center text-blue-700 whitespace-nowrap">
                                            Aberto: {(
                                                editData.lista_boletos.filter(b => !b.pago).reduce((acc, b) => acc + (parseFloat(b.valor) || 0), 0) +
                                                (editData.lista_parcelas_entrada || []).filter(p => !p.pago).reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0)
                                            ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        {isEditing && <td></td>}
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    ) : null}

                  </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="debitos">
                <Card className={cardClass}>
                  <CardHeader className="pb-3">
                    <CardTitle className={`flex items-center gap-2 ${textClass}`}>
                      <Wallet className="w-5 h-5 text-slate-600" />
                      Gestão de Débitos do Veículo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Lista de Débitos */}
                    <div className="space-y-2">
                      {(editData.lista_debitos || []).length === 0 ? (
                        <p className="text-sm text-slate-500 italic py-4 text-center border border-dashed rounded-md">
                          Nenhum débito registrado para este veículo.
                        </p>
                      ) : (
                        (editData.lista_debitos || []).map((debito) => (
                          <div key={debito.id} className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm">
                            <div className="flex items-center gap-3">
                              <Checkbox 
                                checked={debito.pago} 
                                onCheckedChange={(checked) => isEditing && handleToggleDebitoPago(debito.id, checked)}
                                disabled={!isEditing}
                              />
                              <div>
                                <p className={`font-medium ${debito.pago ? "text-slate-500 line-through" : "text-slate-800"}`}>
                                  {debito.descricao}
                                </p>
                                <div className="flex gap-2 text-xs text-slate-500">
                                  <span>{debito.pago ? "Pago pela Despachante" : "Pendente de Pagamento"}</span>
                                  {debito.data_vencimento && (
                                    <span>• Vence em: {formatDateDisplay(debito.data_vencimento)}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-slate-700">
                                R$ {debito.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                              {isEditing && (
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveDebito(debito.id)} className="text-red-500 hover:bg-red-50">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Adicionar Novo Débito */}
                    {isEditing && (
                      <div className="flex gap-2 items-end pt-4 border-t">
                        <div className="flex-1 space-y-1">
                          <Label>Descrição do Débito</Label>
                          <Input 
                            placeholder="Ex: IPVA 2024, Multa..." 
                            value={novoDebito.descricao}
                            onChange={(e) => setNovoDebito({...novoDebito, descricao: e.target.value})}
                          />
                        </div>
                        <div className="w-32 space-y-1">
                          <Label>Valor (R$)</Label>
                          <MoneyInput 
                            placeholder="0.00" 
                            value={novoDebito.valor}
                            onValueChange={(val) => setNovoDebito({...novoDebito, valor: val})}
                          />
                        </div>
                        <div className="w-36 space-y-1">
                          <Label>Vencimento</Label>
                          <Input 
                            type="date" 
                            value={novoDebito.data_vencimento}
                            onChange={(e) => setNovoDebito({...novoDebito, data_vencimento: e.target.value})}
                          />
                        </div>
                        <Button onClick={handleAddDebito} type="button">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Coluna Lateral: Status e Documentos (Menos espaço) */}
          <div className="space-y-6">
            <Card className={cardClass}>
              <CardHeader className="pb-3">
                <CardTitle className={textClass}>Status do Serviço</CardTitle>
              </CardHeader>
              <CardContent>
                <Select 
                  disabled={!isEditing} 
                  value={editData.status}
                  onValueChange={(val) => {
                    const updates = { status: val };
                    // Lógica automática: Se mudar para "em_andamento", define data de pagamento para hoje
                    if (val === "em_andamento" && !editData.data_pagamento) {
                      updates.data_pagamento = formatDateForInput(new Date());
                    }
                    // Lógica automática: Se mudar para "concluido", define data de conclusão para hoje
                    if (val === "concluido") {
                        updates.data_conclusao = formatDateForInput(new Date());
                    }
                    setEditData({...editData, ...updates});
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem> {/* [FIX] Valores em minúsculo conforme Servicos.jsx */}
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                    <SelectItem value="estorno">Estorno</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                    <SelectItem value="congelado">Congelado 🐧</SelectItem>
                    <SelectItem value="arquivado">Arquivado 🗄️</SelectItem>
                  </SelectContent>
                </Select>

                {/* Campo condicional para Motivo da Pendência */}
                {editData.status === 'pendente' && (
                  <div className="mt-4 space-y-2 animate-accordion-down">
                    <Label className="text-xs font-bold text-amber-600 uppercase">Motivo da Pendência</Label>
                    <Textarea 
                      disabled={!isEditing}
                      value={editData.motivo_pendencia} 
                      onChange={(e) => setEditData({...editData, motivo_pendencia: e.target.value})}
                      placeholder="Descreva o que falta para prosseguir..."
                      className="min-h-[80px] border-amber-200 bg-amber-50/30 focus:border-amber-400"
                    />
                  </div>
                )}

                {/* Campo condicional para Motivo de Andamento (Parado/Detalhes) */}
                {editData.status === 'em_andamento' && (
                  <div className="mt-4 space-y-2 animate-accordion-down">
                    <Label className="text-xs font-bold text-teal-600 uppercase">Detalhes do Andamento</Label>
                    <Textarea 
                      disabled={!isEditing}
                      value={editData.motivo_andamento} 
                      onChange={(e) => setEditData({...editData, motivo_andamento: e.target.value})}
                      placeholder="Descreva o status atual ou motivo de estar parado..."
                      className="min-h-[80px] border-teal-200 bg-teal-50/30 focus:border-teal-400"
                    />
                  </div>
                )}

                {/* Campo condicional para Motivo de Aprovação */}
                {editData.status === 'aprovado' && (
                  <div className="mt-4 space-y-2 animate-accordion-down">
                    <Label className="text-xs font-bold text-green-600 uppercase">Detalhes da Aprovação</Label>
                    <Textarea 
                      disabled={!isEditing}
                      value={editData.motivo_aprovacao} 
                      onChange={(e) => setEditData({...editData, motivo_aprovacao: e.target.value})}
                      placeholder="Observações sobre a aprovação..."
                      className="min-h-[80px] border-green-200 bg-green-50/30 focus:border-green-400"
                    />
                  </div>
                )}

                {/* Campo condicional para Motivo de Conclusão */}
                {editData.status === 'concluido' && (
                  <div className="mt-4 space-y-2 animate-accordion-down">
                    <Label className="text-xs font-bold text-blue-600 uppercase">Detalhes da Conclusão</Label>
                    <Textarea 
                      disabled={!isEditing}
                      value={editData.motivo_conclusao} 
                      onChange={(e) => setEditData({...editData, motivo_conclusao: e.target.value})}
                      placeholder="Observações finais sobre a conclusão..."
                      className="min-h-[80px] border-blue-200 bg-blue-50/30 focus:border-blue-400"
                    />
                  </div>
                )}

                {/* Campo condicional para Motivo de Cancelamento/Estorno */}
                {(editData.status === 'estorno' || editData.status === 'cancelado') && (
                  <div className="mt-4 space-y-2 animate-accordion-down">
                    <Label className="text-xs font-bold text-slate-600 uppercase">Motivo do {editData.status === 'estorno' ? 'Estorno' : 'Cancelamento'}</Label>
                    <Textarea 
                      disabled={!isEditing}
                      value={editData.motivo_cancelamento} 
                      onChange={(e) => setEditData({...editData, motivo_cancelamento: e.target.value})}
                      placeholder="Descreva o motivo..."
                      className="min-h-[80px] border-slate-200 bg-slate-50/30 focus:border-slate-400"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className={cardClass}>
            <CardHeader className="pb-3">
              <CardTitle className={`flex items-center gap-2 ${textClass}`}>
                <FileText className="w-5 h-5 text-blue-600" />
                Documentação do Processo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {id && (
                  <div className="flex flex-col gap-2 mb-6 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <Button variant="outline" className="w-full justify-start bg-white hover:bg-slate-50" onClick={() => {
                        setEmailData({ 
                            to: "cliente@exemplo.com.br", 
                            message: generateServiceReport()
                        });
                        setShowEmailDialog(true);
                    }}>
                      <Mail className="w-4 h-4 mr-2 text-slate-500" />
                      Enviar Documentos por E-mail
                    </Button>
                    {editData.documentos_entregues?.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" className="w-full justify-start bg-white hover:bg-slate-50" onClick={handleDownloadZip} disabled={isDownloadingZip}>
                          {isDownloadingZip ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2 text-slate-500" />}
                          Baixar ZIP
                        </Button>
                        <Button variant="outline" className="w-full justify-start bg-white hover:bg-slate-50" onClick={() => setShowGallery(true)}>
                          <LayoutGrid className="w-4 h-4 mr-2 text-slate-500" />
                          Galeria
                        </Button>
                    </div>
                    )}
                  </div>
                )}
              {!id && (
                <div className="mb-4 p-3 bg-blue-50 text-blue-700 text-sm rounded-md border border-blue-200">
                  Salve o serviço primeiro para habilitar o upload de documentos.
                </div>
              )}
              <div className="space-y-4">
                {Array.from(new Set([
                  ...(editData.documentos_necessarios || []),
                  ...(editData.documentos_entregues || []).map(d => d.nome).filter(Boolean)
                ])).map((doc) => {
                  // [FIX] Filtra TODOS os arquivos entregues para este requisito, não apenas o primeiro
                  const entregues = editData.documentos_entregues?.filter(d => d.nome === doc) || [];
                  const temArquivos = entregues.length > 0;

                  return (
                    <div key={doc} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg gap-3 ${isInadimplente ? "border-slate-400 bg-slate-300" : ""}`}>
                      <div className="flex items-center gap-3">
                        {temArquivos ? (
                          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                        )}
                        <span className={`font-medium ${isInadimplente ? "text-slate-900" : "text-slate-700"}`}>{doc}</span>
                        {isEditing && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-slate-400 hover:text-red-500 -ml-2"
                            onClick={() => handleRemoveRequirement(doc)}
                            title="Remover solicitação deste documento"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                        {/* Lista de arquivos já enviados */}
                        {entregues.map((arquivo) => {
                            const isPdfFile = arquivo.mimetype?.includes('pdf') || arquivo.nome_arquivo?.toLowerCase().endsWith('.pdf');
                            return (
                            <div key={arquivo.id} className="flex items-center gap-2 bg-slate-50 p-1 rounded border border-slate-100">
                                <span className="text-xs text-slate-500 max-w-[150px] truncate px-2" title={arquivo.nome_arquivo}>
                                    {arquivo.nome_arquivo || "Arquivo"}
                                </span>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handlePreview(arquivo)} title="Visualizar">
                                    <Eye className="w-3 h-3 text-blue-600" />
                                </Button>
                                {isPdfFile && (
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleExtractText(arquivo)} title="Extrair Texto (Copiar)">
                                        <ScanText className="w-3 h-3 text-slate-600" />
                                    </Button>
                                )}
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleOpenNewTab(arquivo)} title="Abrir em nova aba">
                                    <ExternalLink className="w-3 h-3" />
                                </Button>
                                {isEditing && (
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeDocument(arquivo.id)}>
                                        <Trash2 className="w-3 h-3 text-red-500" />
                                    </Button>
                                )}
                            </div>
                        )})}

                        {/* Botão de Upload (Sempre visível para permitir múltiplos) */}
                        <div className="relative">
                          <input
                            type="file"
                            multiple // [FIX] Permite múltiplos arquivos
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={(e) => e.target.files?.length > 0 && handleFileUpload(doc, e.target.files)}
                            disabled={uploadingDoc === doc || !id}
                          />
                          <Button variant={temArquivos ? "secondary" : "outline"} size="sm" disabled={uploadingDoc === doc || !id} className="w-full sm:w-auto">
                            {uploadingDoc === doc ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                {uploadProgress}%
                              </>
                            ) : (
                              <>
                                {temArquivos ? <Plus className="w-4 h-4 mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                                {temArquivos ? "Adicionar outro" : "Anexar arquivos"}
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {isEditing && (
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                      <Input 
                          placeholder="Nome do novo documento (ex: Comprovante de Pagamento)" 
                          value={newDocName}
                          onChange={(e) => setNewDocName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddRequirement()}
                      />
                      <Button onClick={handleAddRequirement} type="button" variant="secondary">
                          <Plus className="w-4 h-4 mr-2" /> Adicionar
                      </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          </div>
        </div>

        {isEditing && (
          <div className="flex justify-end gap-2 mt-8">
            <Button variant="outline" onClick={handleCancelEdit}>
              <X className="w-4 h-4 mr-2" /> Cancelar
            </Button>
            <Button 
               onClick={handleSaveClick}
               disabled={updateMutation.isPending || createMutation.isPending}
            >
              {updateMutation.isPending || createMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {id ? "Salvar" : "Criar Cliente"}
            </Button>
          </div>
        )}
      </div>

      {/* Modal de Visualização de Imagem/PDF */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-transparent border-none shadow-none flex justify-center items-center">
           {previewFile && (
             (isPdf(previewFile.url) || previewFile.mimetype?.includes('pdf') || previewFile.name?.toLowerCase().endsWith('.pdf')) ? (
               <iframe 
                 src={previewFile.url} 
                 className="w-[90vw] h-[90vh] rounded-md shadow-2xl bg-white"
                 title="Visualização do documento"
               />
             ) : (
               <img 
                 src={previewFile.url} 
                 alt="Visualização do documento" 
                 className="max-w-[90vw] max-h-[90vh] rounded-md shadow-2xl object-contain bg-white"
               />
             )
           )}
        </DialogContent>
      </Dialog>

      {/* Modal de Galeria de Documentos */}
      <Dialog open={showGallery} onOpenChange={setShowGallery}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between mr-8">
              <DialogTitle>Galeria de Documentos</DialogTitle>
              <Button variant="outline" size="sm" onClick={handleDownloadZip} disabled={isDownloadingZip}>
                {isDownloadingZip ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                Baixar ZIP
              </Button>
            </div>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
            {editData?.documentos_entregues?.map((doc) => {
              const url = `${API_BASE_URL}/api/documentos/${doc.id}`;
              // Verifica se é imagem pelo mimetype ou extensão
              const isImg = doc.mimetype?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.nome_arquivo || "");
              
              return (
                <div key={doc.id} className="border rounded-lg p-3 flex flex-col gap-2 bg-slate-50 hover:shadow-md transition-shadow group">
                   <div className="aspect-square bg-white rounded border flex items-center justify-center overflow-hidden relative">
                      {isImg ? (
                          <img src={url} alt={doc.nome_arquivo} className="w-full h-full object-cover" />
                      ) : (
                          <div className="flex flex-col items-center text-slate-400 p-4 text-center">
                              <FileText className="w-12 h-12 mb-2 text-slate-300" />
                              <span className="text-[10px] uppercase font-bold">{doc.nome_arquivo?.split('.').pop() || 'DOC'}</span>
                          </div>
                      )}
                      
                      {/* Overlay com ações */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[1px]">
                          <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full" onClick={() => handlePreview(doc)} title="Visualizar">
                              <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full" onClick={() => handleOpenNewTab(doc)} title="Abrir em nova aba">
                              <ExternalLink className="w-4 h-4" />
                          </Button>
                      </div>
                   </div>
                   <div className="space-y-0.5">
                     <div className="text-xs font-semibold text-slate-700 truncate" title={doc.nome}>
                        {doc.nome}
                     </div>
                     <div className="text-[10px] text-slate-500 truncate" title={doc.nome_arquivo}>
                        {doc.nome_arquivo}
                     </div>
                   </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Envio de E-mail */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Enviar Documentos por E-mail</DialogTitle>
                <DialogDescription>
                    Os documentos anexados serão enviados para o e-mail abaixo.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
                <div className="space-y-2">
                    <Label>Para</Label>
                    <Input 
                        value={emailData.to} 
                        onChange={(e) => setEmailData({...emailData, to: e.target.value})} 
                        placeholder="exemplo@email.com"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Mensagem</Label>
                    <Textarea 
                        value={emailData.message} 
                        onChange={(e) => setEmailData({...emailData, message: e.target.value})} 
                        rows={5}
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setShowEmailDialog(false)}>Cancelar</Button>
                <Button onClick={handleSendEmail} disabled={isSendingEmail}>
                    {isSendingEmail && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Enviar
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Segurança para Revelar Senha */}
      <Dialog open={showGovPasswordDialog} onOpenChange={setShowGovPasswordDialog}>
        <DialogContent className="max-w-sm">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5 text-amber-500"/> Acesso Restrito</DialogTitle>
                <DialogDescription>
                    Para visualizar a senha do cliente, confirme sua identidade de despachante.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Label>Sua Senha de Acesso</Label>
                <Input type="password" value={adminPasswordInput} onChange={(e) => setAdminPasswordInput(e.target.value)} placeholder="Senha do sistema..." />
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setShowGovPasswordDialog(false)}>Cancelar</Button>
                <Button onClick={handleRevealGovPassword} disabled={isRevealingPassword}>
                    {isRevealingPassword && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Confirmar
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Geração de Contrato */}
      <Dialog open={showContractDialog} onOpenChange={setShowContractDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Printer className="w-5 h-5 text-slate-600"/> Gerar Contrato</DialogTitle>
            <DialogDescription>
              Preencha os dados complementares para gerar o contrato jurídico (TCD-e ou TCDG-e).
            </DialogDescription>
            {/* Botão de Importação Automática */}
            {editData?.numero_contrato && (
              <Button variant="outline" size="sm" onClick={handleImportLegacyData} className="mt-2 w-full border-dashed border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-blue-600">
                <RefreshCw className="w-3 h-3 mr-2" />
                Preencher automaticamente com dados do sistema antigo
              </Button>
            )}
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-slate-900 border-b pb-1">Dados Complementares do Cliente</h4>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>RG</Label><Input value={contractData.rg_cli} onChange={e => setContractData({...contractData, rg_cli: e.target.value})} placeholder="00.000.000-0" /></div>
                <div><Label>Nacionalidade</Label><Input value={contractData.nacionalidade_cli} onChange={e => setContractData({...contractData, nacionalidade_cli: e.target.value})} /></div>
                <div><Label>Estado Civil</Label><Input value={contractData.estado_civil_cli} onChange={e => setContractData({...contractData, estado_civil_cli: e.target.value})} /></div>
                <div><Label>Prazo (Dias Úteis)</Label><Input type="number" value={contractData.prazo_dias} onChange={e => setContractData({...contractData, prazo_dias: e.target.value})} /></div>
                <div className="col-span-2"><Label>Endereço Completo</Label><Input value={contractData.endereco_cli} onChange={e => setContractData({...contractData, endereco_cli: e.target.value})} placeholder="Rua, Número, Bairro, Cidade - UF" /></div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-sm text-slate-900 border-b pb-1">Dados do Veículo</h4>
              <div><Label>Cor do Veículo</Label><Input value={contractData.cor_veiculo} onChange={e => setContractData({...contractData, cor_veiculo: e.target.value})} placeholder="Ex: Prata" /></div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-sm text-slate-900 border-b pb-1">Propriedade do Veículo</h4>
              <div className="flex items-center space-x-2 py-2">
                <Checkbox 
                  id="is_owner" 
                  checked={contractData.is_owner} 
                  onCheckedChange={(checked) => setContractData({...contractData, is_owner: checked})}
                />
                <Label htmlFor="is_owner" className="cursor-pointer">O Cliente é o proprietário do veículo?</Label>
              </div>

              {!contractData.is_owner && (
                <div className="bg-slate-50 p-3 rounded-md border border-slate-200 space-y-3 animate-in slide-in-from-top-2">
                  <p className="text-xs text-slate-500 font-medium uppercase">Dados do Proprietário (Garantidor Solidário)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2"><Label>Nome Completo</Label><Input value={contractData.garantidor_nome} onChange={e => setContractData({...contractData, garantidor_nome: e.target.value})} /></div>
                    <div><Label>CPF</Label><CpfCnpjInput value={contractData.garantidor_cpf} onValueChange={val => setContractData({...contractData, garantidor_cpf: val})} /></div>
                    <div><Label>Nacionalidade</Label><Input value={contractData.garantidor_nacionalidade} onChange={e => setContractData({...contractData, garantidor_nacionalidade: e.target.value})} /></div>
                    <div className="col-span-2"><Label>Estado Civil</Label><Input value={contractData.garantidor_estado_civil} onChange={e => setContractData({...contractData, garantidor_estado_civil: e.target.value})} /></div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-sm text-slate-900 border-b pb-1">Condições de Entrada</h4>
              <div className="flex items-center space-x-2 py-2">
                <Checkbox 
                  id="entrada_parcelada_contract" 
                  checked={contractData.entrada_parcelada} 
                  onCheckedChange={(checked) => setContractData({...contractData, entrada_parcelada: checked})}
                />
                <Label htmlFor="entrada_parcelada_contract" className="cursor-pointer">Entrada Parcelada?</Label>
              </div>

              {contractData.entrada_parcelada && (
                <div className="bg-slate-50 p-3 rounded-md border border-slate-200 space-y-3 animate-in slide-in-from-top-2">
                   <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Qtd. Parcelas</Label>
                        <Input 
                          type="number" 
                          value={contractData.qtd_parcelas_entrada} 
                          onChange={(e) => setContractData({...contractData, qtd_parcelas_entrada: e.target.value})} 
                        />
                      </div>
                      <div className="flex items-end">
                        <Button type="button" variant="secondary" size="sm" onClick={handleGerarParcelasEntradaContrato} className="w-full">
                            Gerar Parcelas
                        </Button>
                      </div>
                   </div>
                   
                   {contractData.lista_parcelas_entrada && contractData.lista_parcelas_entrada.map((p, i) => (
                      <div key={i} className="grid grid-cols-2 gap-2 items-center">
                          <MoneyInput 
                              value={p.valor} 
                              onValueChange={(val) => handleUpdateParcelaEntradaContrato(i, 'valor', val)}
                              className="h-8 text-sm"
                              placeholder="Valor"
                          />
                          <Input 
                              type="date" 
                              value={p.data_vencimento} 
                              onChange={(e) => handleUpdateParcelaEntradaContrato(i, 'data_vencimento', e.target.value)}
                              className="h-8 text-sm"
                          />
                      </div>
                   ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContractDialog(false)}>Cancelar</Button>
            <Button variant="secondary" onClick={handlePreviewContract} className="mr-2">
                <Eye className="w-4 h-4 mr-2" /> Visualizar
            </Button>
            <Button onClick={handlePrintContract} className="bg-slate-800 hover:bg-slate-900">
              <Printer className="w-4 h-4 mr-2" /> Imprimir Contrato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Visualização do Contrato */}
      <Dialog open={showContractPreview} onOpenChange={setShowContractPreview}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Visualização do Contrato</DialogTitle>
          </DialogHeader>
          <div className="flex-1 border rounded-md overflow-hidden bg-white">
            <iframe 
              srcDoc={contractPreviewHtml} 
              className="w-full h-full" 
              title="Pré-visualização do Contrato"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContractPreview(false)}>Fechar</Button>
            <Button onClick={handlePrintContract} className="bg-slate-800 hover:bg-slate-900">
              <Printer className="w-4 h-4 mr-2" /> Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showApprovalWarning} onOpenChange={setShowApprovalWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Documentação Incompleta</AlertDialogTitle>
            <AlertDialogDescription>
              Existem documentos necessários que ainda não foram enviados. 
              Deseja aprovar o serviço mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowApprovalWarning(false); updateMutation.mutate(editData); }}>
              Aprovar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alerta de Saída sem Salvar */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterações não salvas</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem alterações pendentes. Se sair agora, elas serão perdidas. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setPendingAction(null);
            }}>Continuar Editando</AlertDialogCancel>
            <AlertDialogAction onClick={confirmExit} className="bg-red-600 hover:bg-red-700">
              Sair sem Salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Componente de Feedback Visual Personalizado (Substituto do Toast) */}
      {feedback && (
        <div className={`fixed bottom-6 right-6 z-[100] px-6 py-3 rounded-lg shadow-2xl text-white font-medium flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 ${feedback.type === 'error' ? 'bg-red-600' : feedback.type === 'warning' ? 'bg-amber-500' : 'bg-emerald-600'}`}>
          {feedback.type === 'error' ? <AlertCircle className="w-5 h-5" /> : feedback.type === 'warning' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          {feedback.message}
        </div>
      )}
    </div>
  );
}