import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * TEMPLATE A: TCD-e (Cliente = Proprietário)
 */
const TEMPLATE_A = `
  <div class="header-logo"><img src="/logo.png" alt="Logo" /></div>
  <h1>TERMO DE CONFISSÃO DE DÍVIDA COM GARANTIA - TCD-e</h1>
  <h3>CONTRATO nº {{NUMERO_CONTRATO}}</h3>
  
  <p><strong>CLÁUSULA PRIMEIRA:</strong> O DEVEDOR reconhece e confessa débito para com a CREDORA da importância líquida, certa e exigível de R$ {{VALOR_TOTAL}}.</p>
  
  <p><strong>Parágrafo Primeiro:</strong> As partes neste ato esclarecem que a origem da dívida (sem prejuízo aos acréscimos pertinentes e para que se necessário surta efeitos como verdade incontestável) se deu pela prestação de serviços pela CREDORA ao DEVEDOR para: {{DESCRICAO_SERVICOS}}. Atos esses devidamente comprovados através de notas e recibos, quais foram apresentados ao DEVEDOR, ficando assim o DEVEDOR com a dívida perante a CREDORA no valor na cláusula primeira, cujo é tido como valor devido e confessado pelo DEVEDOR.</p>

  <p><strong>Parágrafo Segundo:</strong> Somente os órgãos emissores de autuações, tais como: PREFEITURAS, DER, PRF, DNIT, que poderão efetuar as devidas baixas, assim como a conclusão de processos, atualização e emissão de CRLVe (Certificado de Registro de Licenciamento Digital) e ATPVe (Autorização para Transferência de Veículo Digital) é de total competência do DETRAN, não tendo quaisquer responsabilidades por parte da CREDORA, ficando restrita sua atuação, em efetuar o pagamento de todos os débitos acima citados, dentro do prazo de <strong>{{PRAZO_DIAS}} DIAS ÚTEIS</strong>, a partir do pagamento integral da entrada, assinatura do termo e envio de toda a documentação necessária para envio do processo, como também, pelo acompanhamento das baixas dos débitos, principalmente quanto às multas de trânsito.</p>
  
  <p><strong>CLÁUSULA SEGUNDA:</strong> O DEVEDOR promete e se obriga a quitar o débito em {{DETALHES_ENTRADA}} e {{TEXTO_PAGAMENTO}}, sendo que o comprovante do pagamento servirá de RECIBO DE QUITAÇÃO, desde que, a transação seja efetuada corretamente.</p>

  <p>{{DATA_ATUAL_EXTENSO}}.</p>
  <br><br>
  <br> DESPACAHNTE(Credora)<br><br>
  <br>{{NOME_CLI}} (Devedor)<br><br>
`;

/**
 * TEMPLATE B: TCDG-e (Com Garantidor Solidário)
 */
const TEMPLATE_B = `
  <div class="header-logo"><img src="/logo.png" alt="Logo" /></div>
  <h1>TERMO DE CONFISSÃO DE DÍVIDA COM GARANTIA PIGNORATÍCIA - TCDGe</h1>
  <h3>CONTRATO nº {{NUMERO_CONTRATO}}</h3>
  <p><strong>CLÁUSULA PRIMEIRA:</strong> O DEVEDOR reconhece e confessa débito para com a CREDORA da importância líquida, certa e exigível de R$ {{VALOR_TOTAL}}.</p>
  <p><strong>Parágrafo Primeiro:</strong> As partes neste ato esclarecem que a origem da dívida (sem prejuízo aos acréscimos pertinentes e para que se necessário surta efeitos como verdade incontestável) se deu pela prestação de serviços pela CREDORA ao DEVEDOR para: {{DESCRICAO_SERVICOS}}. Atos esses devidamente comprovados através de notas e recibos, quais foram apresentados ao DEVEDOR, ficando assim o DEVEDOR com a dívida perante a CREDORA no valor na cláusula primeira, cujo é tido como valor devido e confessado pelo DEVEDOR.</p>
  <p><strong>Parágrafo Segundo:</strong> Somente os órgãos emissores de autuações, tais como: PREFEITURAS, DER, PRF, DNIT, que poderão efetuar as devidas baixas, assim como a conclusão de processos, atualização e emissão de CRLVe (Certificado de Registro de Licenciamento Digital) e ATPVe (Autorização para Transferência de Veículo Digital) é de total competência do DETRAN, não tendo quaisquer responsabilidades por parte da CREDORA, ficando restrita sua atuação, em efetuar o pagamento de todos os débitos acima citados, dentro do prazo de <strong>{{PRAZO_DIAS}} DIAS ÚTEIS</strong>, a partir do pagamento integral da entrada, assinatura do termo e envio de toda a documentação necessária para envio do processo, como também, pelo acompanhamento das baixas dos débitos, principalmente quanto às multas de trânsito.</p>
  
  <p><strong>CLÁUSULA SEGUNDA:</strong> O DEVEDOR promete e se obriga a quitar o débito em {{DETALHES_ENTRADA}} e {{TEXTO_PAGAMENTO}}, sendo que o comprovante do pagamento servirá de RECIBO DE QUITAÇÃO, desde que, a transação seja efetuada corretamente.</p>
 
  <p>{{DATA_ATUAL_EXTENSO}}.</p>
  <br><br>
  <br>DESPACHANTE (Credora)<br><br>
  <br>{{NOME_CLI}} (Devedor)<br><br>
  <br>{{NOME_GAR}} (Garantidor-Solidário)<br><br>

`;



/**
 * Gera o HTML do contrato preenchido.
 * @param {Object} servico - Dados do serviço (DB).
 * @param {Object} extraData - Dados complementares do formulário (RG, Endereço, Garantidor, etc).
 * @returns {string} HTML completo para impressão.
 */
export const generateContractHtml = (servico, extraData) => {
  const isOwner = extraData.is_owner || (extraData.garantidor_cpf && servico.cliente_cpf_cnpj === extraData.garantidor_cpf);
  let template = isOwner ? TEMPLATE_A : TEMPLATE_B;
  const valorTotal = Number(servico.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const valorEntrada = Number(servico.valor_entrada || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  
  let detalhesEntrada = `R$ ${valorEntrada} de ENTRADA para esta data`;
  if (servico.entrada_parcelada && Array.isArray(servico.lista_parcelas_entrada) && servico.lista_parcelas_entrada.length > 0) {
      const parcelasTexto = servico.lista_parcelas_entrada.map((p, i) => {
          const v = Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
          const d = p.data_vencimento ? format(new Date(p.data_vencimento), "dd/MM/yyyy") : "__/__/____";
          return `${i + 1}ª R$ ${v} (${d})`;
      }).join(", ");
      detalhesEntrada = `R$ ${valorEntrada} de ENTRADA, sendo: ${parcelasTexto}`;
  }

  let textoPagamento = "à vista";
  const qtdParcelas = parseInt(servico.qtd_boletos_a_vencer) || 0;
  if (qtdParcelas > 0) {
    const valorParcela = Number(servico.valor_boleto_aberto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const dataVenc = servico.data_vencimento_parcela ? format(new Date(servico.data_vencimento_parcela), "dd/MM/yyyy") : "__/__/____";
    textoPagamento = `mais ${qtdParcelas} parcelas de R$ ${valorParcela} mensais e consecutivas, com a primeira vencendo em ${dataVenc}`;
  }
  let descricaoServicos = servico.descricao_servicos;
  if (!descricaoServicos && servico.lista_debitos && servico.lista_debitos.length > 0) {
    descricaoServicos = servico.lista_debitos.map(d => d.descricao).join(", ");
  }
  if (!descricaoServicos) descricaoServicos = servico.tipo_servico_nome;
  const dataExtenso = `São José dos Campos, ${format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
  const replacements = { "{{NUMERO_CONTRATO}}": servico.numero_contrato || servico.id, "{{DATA_ATUAL_EXTENSO}}": dataExtenso, "{{PRAZO_DIAS}}": extraData.prazo_dias || "12", "{{VALOR_TOTAL}}": valorTotal, "{{DETALHES_ENTRADA}}": detalhesEntrada, "{{TEXTO_PAGAMENTO}}": textoPagamento, "{{DESCRICAO_SERVICOS}}": descricaoServicos, "{{NOME_CLI}}": servico.cliente_nome?.toUpperCase(), "{{NACIONALIDADE_CLI}}": extraData.nacionalidade_cli, "{{ESTADO_CIVIL_CLI}}": extraData.estado_civil_cli, "{{CPF_CLI}}": servico.cliente_cpf_cnpj, "{{RG_CLI}}": extraData.rg_cli, "{{ENDERECO_CLI}}": extraData.endereco_cli, "{{VEICULO_DESC}}": servico.veiculo?.toUpperCase(), "{{PLACA}}": servico.placa_veiculo?.toUpperCase(), "{{RENAVAM}}": servico.renavam, "{{ANO}}": servico.ano_modelo, "{{NOME_GAR}}": extraData.garantidor_nome?.toUpperCase() || "_______________________", "{{NACIONALIDADE_GAR}}": extraData.garantidor_nacionalidade, "{{CPF_GAR}}": extraData.garantidor_cpf, "{{ESTADO_CIVIL_GAR}}": extraData.garantidor_estado_civil };
  let finalHtml = template;
  Object.keys(replacements).forEach(key => { finalHtml = finalHtml.replace(new RegExp(key, 'g'), replacements[key] || "________________"); });
  
  const styles = `
    body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.5; color: #000; margin: 0; padding: 20px; position: relative; }
    .contrato { max-width: 800px; margin: 0 auto; text-align: justify; position: relative; z-index: 1; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.1; z-index: 0; width: 60%; pointer-events: none; }
    .header-logo { text-align: center; margin-bottom: 20px; }
    .header-logo img { max-height: 80px; }
    h1 { font-size: 14pt; text-align: center; font-weight: bold; margin-bottom: 5px; }
    h3 { font-size: 12pt; text-align: center; font-weight: bold; margin-top: 0; margin-bottom: 20px; }
    p { margin-bottom: 10px; text-indent: 30px; }
    strong { font-weight: bold; }
    @media print { 
      body { padding: 0; } 
      .contrato { width: 100%; max-width: none; } 
      @page { margin: 2cm; } 
    }
  `;

  return `<html><head><title>Contrato - ${servico.cliente_nome}</title><style>${styles}</style></head><body onload="window.print()"><img src="/logo.png" class="watermark" /><div class="contrato">${finalHtml}</div></body></html>`;
};