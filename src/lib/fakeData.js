import { addDays, subDays, format } from "date-fns";

// IDs baseados na sua configuração SQL
export const serviceTypes = [
    { id: 1, name: 'Licenciamento Anual', emoji: '🗽' },
    { id: 2, name: 'Transferência de Propriedade', emoji: '♻️' },
    { id: 15, name: 'Placa Mercosul', emoji: '🚗' },
    { id: 8, name: 'Renovação de CNH', emoji: '🪪' },
    { id: 3, name: 'Primeiro Emplacamento', emoji: '✨' },
    { id: 5, name: 'Baixa de Gravame', emoji: '🏦' }
];

export const generateFakeData = () => {
  const firstNames = ["Miguel", "Arthur", "Gael", "Théo", "Heitor", "Ravi", "Davi", "Bernardo", "Noah", "Gabriel", "Helena", "Alice", "Laura", "Maria", "Sophia", "Manuela", "Maitê", "Liz", "Cecília", "Isabella"];
  const lastNames = ["Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes", "Costa", "Ribeiro", "Martins"];
  const cars = ["Chevrolet Onix", "Hyundai HB20", "Fiat Argo", "Volkswagen Polo", "Jeep Renegade", "Toyota T-Cross", "Honda Corolla", "Nissan Kicks"];
  
  const generateCPF = () => {
      const n = () => Math.floor(Math.random() * 10);
      return `${n()}${n()}${n()}.${n()}${n()}${n()}.${n()}${n()}${n()}-${n()}${n()}`;
  };

  const generatePlate = () => {
      const l = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
      const n = () => Math.floor(Math.random() * 10);
      return `${l()}${l()}${l()}${n()}${l()}${n()}${n()}`;
  };

  const clients = [];

  // Configuração dos Grupos Solicitados
  const groups = [
      { count: 41, status: 'pendente', min: 1500, max: 3000 },
      { count: 37, status: 'aprovado', min: 1000, max: 5000 },
      { count: 19, status: 'em_andamento', min: 500, max: 4000 },
      { count: 23, status: 'concluido', min: 500, max: 4000 }
  ];

  for (const group of groups) {
      for (let i = 0; i < group.count; i++) {
          const nome = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
          const valorTotal = (Math.random() * (group.max - group.min) + group.min).toFixed(2);
          const valorHonorarios = (valorTotal * 0.3).toFixed(2); // 30% honorários
          const veiculo = cars[Math.floor(Math.random() * cars.length)];
          const tipo = serviceTypes[Math.floor(Math.random() * serviceTypes.length)];
          
          // Datas Dinâmicas
          const today = new Date();
          
          let data_conclusao = null;
          let data_pagamento = null;
          let pagamento_realizado = 0;
          let data_pagamento_previsto = format(subDays(today, Math.floor(Math.random() * 30)), 'yyyy-MM-dd');

          if (group.status === 'concluido') {
              data_conclusao = format(subDays(today, Math.floor(Math.random() * 10)), 'yyyy-MM-dd');
              pagamento_realizado = Math.random() > 0.1 ? 1 : 0; // 90% chance de estar pago se concluído
              if (pagamento_realizado) data_pagamento = data_conclusao;
          } else if (group.status === 'aprovado') {
              // Aprovados têm previsão futura próxima
              data_pagamento_previsto = format(addDays(today, Math.floor(Math.random() * 15)), 'yyyy-MM-dd');
          }

          const lista_debitos = [];
          let debitIdCounter = 0;

          // 1. IPVA (com chance de ter)
          if (Math.random() < 0.5) {
              lista_debitos.push({
                  id: debitIdCounter++,
                  descricao: "IPVA 2024",
                  valor: (Math.random() * (5000 - 1000) + 1000),
                  data_vencimento: format(subDays(today, Math.floor(Math.random() * 365 * 2)), 'yyyy-MM-dd'),
                  pago: Math.random() < 0.1
              });
          }
          if (Math.random() < 0.6) {
              lista_debitos.push({
                  id: debitIdCounter++,
                  descricao: "IPVA 2025",
                  valor: (Math.random() * (5000 - 1000) + 1000),
                  data_vencimento: format(subDays(today, Math.floor(Math.random() * 365)), 'yyyy-MM-dd'),
                  pago: Math.random() < 0.2
              });
          }
          if (Math.random() < 0.8) {
              lista_debitos.push({
                  id: debitIdCounter++,
                  descricao: "IPVA 2026",
                  valor: (Math.random() * (5000 - 1000) + 1000),
                  data_vencimento: format(addDays(today, Math.floor(Math.random() * 180)), 'yyyy-MM-dd'),
                  pago: Math.random() < 0.5
              });
          }

          // 2. Licenciamento
          if (Math.random() < 0.9) lista_debitos.push({ id: debitIdCounter++, descricao: "TX Licenciamento 2026", valor: 176.00, data_vencimento: format(addDays(today, Math.floor(Math.random() * 180)), 'yyyy-MM-dd'), pago: Math.random() < 0.6 });
          if (Math.random() < 0.7) lista_debitos.push({ id: debitIdCounter++, descricao: "TX Licenciamento 2025", valor: 206.00, data_vencimento: format(subDays(today, Math.floor(Math.random() * 365)), 'yyyy-MM-dd'), pago: Math.random() < 0.3 });

          // 3. Taxa de Transferência
          if (tipo.name === 'Transferência de Propriedade') {
              lista_debitos.push({ id: debitIdCounter++, descricao: "Tx trasnferencia", valor: 296.95, data_vencimento: format(addDays(today, Math.floor(Math.random() * 30)), 'yyyy-MM-dd'), pago: Math.random() < 0.8 });
          }

          // 4. Multas (média de 4)
          const numMultas = Math.floor(Math.random() * 9); // 0 a 8 multas
          for (let j = 0; j < numMultas; j++) {
              lista_debitos.push({
                  id: debitIdCounter++,
                  descricao: `Multa`,
                  valor: (Math.random() * (3000 - 80) + 80),
                  data_vencimento: format(subDays(today, Math.floor(Math.random() * 730)), 'yyyy-MM-dd'),
                  pago: Math.random() < 0.4
              });
          }

          clients.push({
              id: clients.length + 1,
              cliente_nome: nome,
              cliente_telefone: '11999999999',
              cliente_email: 'cliente@exemplo.com',
              cliente_cpf_cnpj: generateCPF(),
              placa_veiculo: generatePlate(),
              renavam: '12345678900',
              veiculo: veiculo,
              ano_modelo: '2024',
              chassi: '9BWZZZ...',
              uf_veiculo: 'SP',
              tipo_servico_id: tipo.id,
              tipo_servico_nome: tipo.name,
              status: group.status,
              valor_total: valorTotal,
              valor_honorarios: valorHonorarios,
              valor_divida_ativa: 0,
              honorarios_pagos: pagamento_realizado ? valorHonorarios : 0,
              pagamento_realizado: pagamento_realizado,
              data_pagamento_previsto: data_pagamento_previsto,
              data_pagamento: data_pagamento,
              data_conclusao: data_conclusao,
              observacoes: 'Gerado automaticamente pelo sistema JSON Frontend',
              documentos_necessarios: [],
              inadimplente: false,
              valor_boleto_aberto: 0,
              qtd_boletos_a_vencer: 0,
              valor_entrada: 0,
              identificacao_cliente: [],
              tipos_servicos_ids: [String(tipo.id)],
              lista_boletos: [],
              lista_debitos: lista_debitos
          });
      }
  }
  return clients;
};