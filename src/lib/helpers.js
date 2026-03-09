import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * @fileoverview Biblioteca de funções utilitárias compartilhadas.
 * Centraliza lógica de formatação, validação e parsing para garantir consistência no sistema.
 */

/**
 * Analisa o campo de documentos, lidando com strings JSON ou arrays.
 * Garante que o retorno seja sempre um array, evitando erros de renderização.
 * 
 * @param {string|Array} docs - Documentos a serem analisados (string JSON ou Array).
 * @returns {Array} Array de documentos ou array vazio em caso de erro.
 */
export const parseDocs = (docs) => {
  if (Array.isArray(docs)) return docs;
  if (typeof docs === 'string') {
    try { return JSON.parse(docs) || []; } catch { return []; }
  }
  return [];
};

/**
 * Analisa o campo de lista de débitos (JSON).
 */
export const parseJSON = (data) => {
  if (Array.isArray(data)) return data;
  if (typeof data === 'string') {
    try { return JSON.parse(data) || []; } catch { return []; }
  }
  return [];
};

/**
 * Verifica se um valor representa um status de pagamento "pago".
 * Normaliza diferentes tipos de valores (booleano, número, string) que podem vir do banco.
 * 
 * @param {boolean|number|string} val - Valor a ser verificado.
 * @returns {boolean} Verdadeiro se o pagamento foi realizado.
 */
export const isPago = (val) => val === true || val === 1 || val === "1" || val === "true";

/**
 * Formata uma data para o formato padrão de input HTML (YYYY-MM-DD).
 * Sanitiza objetos Date e strings ISO para evitar problemas de timezone ao salvar.
 * 
 * @param {Date|string} val - Data a ser formatada.
 * @returns {string} Data formatada (YYYY-MM-DD) ou string vazia.
 */
export const formatDateForInput = (val) => {
  if (!val) return "";
  if (val instanceof Date) return format(val, 'yyyy-MM-dd');
  if (typeof val === 'string') {
      // Suporta ISO (T) ou SQL (espaço)
      if (val.includes('T')) return val.split('T')[0];
      if (val.includes(' ')) return val.split(' ')[0];
  }
  return val;
};

/**
 * Formata uma data para exibição amigável ao usuário (DD/MM/YYYY).
 * Lida manualmente com strings YYYY-MM-DD para evitar conversões indesejadas de fuso horário do navegador.
 * 
 * @param {string|Date} dateStr - Data a ser formatada.
 * @returns {string} Data formatada (DD/MM/YYYY) ou "—" se inválida.
 */
export const formatDateDisplay = (dateStr) => {
  if (!dateStr) return "—";
  // Se for string YYYY-MM-DD, formata manualmente para evitar timezone UTC->Local
  if (typeof dateStr === 'string') {
      // [FIX] Se vier formato ISO completo (ex: 2024-02-18T00:00:00.000Z), corta a parte da hora
      // Isso previne que o new Date() converta UTC para o dia anterior no fuso Brasil
      if (dateStr.includes('T')) {
          dateStr = dateStr.split('T')[0];
      }

      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
          const [_, y, m, d] = match;
          return `${d}/${m}/${y}`;
      }
  }
  try {
    return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
};

/**
 * Verifica se uma URL ou string Base64 corresponde a um PDF.
 * 
 * @param {string} url - URL ou string Base64.
 * @returns {boolean} Verdadeiro se for PDF.
 */
export const isPdf = (url) => {
  if (!url) return false;
  if (url.startsWith('data:application/pdf')) return true;
  return /\.(pdf)$/i.test(url);
};

/**
 * Configuração centralizada dos tipos de serviço.
 * Permite fácil adição de novos tipos e mantém a consistência visual.
 */
const SERVICE_TYPES_CONFIG = [
  { keys: ["2ª via crv/crlv + transferencia", "2ª via crv + transferencia"], emoji: "🥈♻️", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { keys: ["dupla transferencia", "dupla transferência", "dupla"], emoji: "♻️♻️", color: "bg-pink-50 text-pink-700 border-pink-200" },
  { keys: ["acordo"], emoji: "🤝", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { keys: ["liberação", "liberacao", "apreensão", "apreensao"], emoji: "🕊️", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  { keys: ["licenciamento"], emoji: "🗽", color: "bg-blue-50 text-blue-700 border-blue-200"   },
  { keys: ["transferência", "transferencia"], emoji: "♻️", color: "bg-green-50 text-green-700 border-green-200" },
  { keys: ["apreendido"], emoji: "🕊️", color: "bg-slate-100 text-slate-700 border-slate-200" },
  { keys: ["2ª via", "2° via", "crv"], emoji: "🥈", color: "bg-gray-100 text-gray-700 border-gray-200" },
  { keys: ["placa", "emplacamento", "mercosul"], emoji: "🚗", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { keys: ["cnh", "habilitação", "habilitacao", "pid"], emoji: "🪪", color: "bg-orange-50 text-orange-700 border-orange-200" },
  { keys: ["multa", "recurso"], emoji: "📝", color: "bg-red-50 text-red-700 border-red-200" },
  { keys: ["débito", "debito"], emoji: "💸", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { keys: ["antt"], emoji: "🚛", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { keys: ["blindagem"], emoji: "🛡️", color: "bg-zinc-100 text-zinc-700 border-zinc-200" },
  { keys: ["motor", "característica", "caracteristica"], emoji: "⚙️", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  { keys: ["comunicado", "venda"], emoji: "📢", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { keys: ["gravame", "alienação", "alienacao"], emoji: "🏦", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { keys: ["município", "municipio", "estado"], emoji: "🏙️", color: "bg-sky-50 text-sky-700 border-sky-200" },
  { keys: [], emoji: "📄", color: "bg-slate-50 text-slate-700 border-slate-200" } // Fallback
];

/**
 * Retorna o emoji correspondente ao tipo de serviço.
 * @param {string} name - Nome do serviço.
 * @returns {string} Emoji correspondente.
 */
export const getServiceEmoji = (name) => {
  if (!name) return "";
  
  const n = name.toLowerCase();
  
  // Procura o primeiro item cuja chave esteja contida no nome do serviço
  const found = SERVICE_TYPES_CONFIG.find(m => m.keys.some(key => n.includes(key)));
  
  return found ? found.emoji : "📄";
};

/**
 * Retorna a configuração completa (emoji e cor) para o tipo de serviço.
 * @param {string} name - Nome do serviço.
 * @returns {object} Objeto de configuração { emoji, color, keys }.
 */
export const getServiceConfig = (name) => {
  if (!name) return SERVICE_TYPES_CONFIG[SERVICE_TYPES_CONFIG.length - 1];
  const n = String(name).toLowerCase();
  const found = SERVICE_TYPES_CONFIG.find(m => m.keys.some(key => n.includes(key)));
  return found || SERVICE_TYPES_CONFIG[SERVICE_TYPES_CONFIG.length - 1];
};

/**
 * Configuração das Identificações de Cliente (Tags)
 */
export const CLIENT_TAGS = {
  "SNG": { label: "SNG", description: "Pedido de gravame (Falta de Pagamento)", color: "bg-orange-600 text-white border-orange-700 font-bold shadow-md" },
  "B3":  { label: "B3",  description: "Gravame já adicionado", color: "bg-blue-700 text-white border-blue-800 font-bold shadow-md" },
  "P25": { label: "P25", description: "Cliente protestado", color: "bg-red-600 text-white border-red-700 font-bold shadow-md animate-pulse" }
};

/**
 * Extrai texto de um arquivo PDF (Blob/File) usando pdfjs-dist.
 * Carrega a biblioteca dinamicamente para não afetar a performance inicial.
 * 
 * @param {Blob|File} file - O arquivo PDF.
 * @returns {Promise<string>} O texto extraído de todas as páginas.
 */
export const extractPdfText = async (file) => {
  try {
    // [FIX] Importação via CDN para evitar erro de build se o pacote não estiver instalado
    const pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/+esm');
    
    // Configura o worker via CDN para evitar problemas de build no Vite
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  } catch (error) {
    console.error("Erro ao extrair texto do PDF:", error);
    throw new Error("Falha ao processar o arquivo PDF. Verifique se é um PDF válido.");
  }
};