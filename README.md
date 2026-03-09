# 🚗 Sistema de Gestão para Despachante (Senaf)

Bem-vindo ao **Sistema de Gestão Senaf**, uma solução completa e robusta desenvolvida para modernizar e automatizar as operações de escritórios de despachante. Este sistema integra gestão de clientes, controle financeiro, acompanhamento de processos veiculares e geração automática de documentos.

![Status do Projeto](https://img.shields.io/badge/Status-Em_Desenvolvimento-green)
![Tech Stack](https://img.shields.io/badge/Stack-React_Node_MySQL-blue)

---

## 📋 Funcionalidades Principais

### 🚀 Gestão Operacional
*   **Controle de Processos:** Acompanhamento detalhado de status (Pendente, Em Andamento, Aprovado, Concluído, etc.).
*   **Gestão de Documentos:** Upload, visualização e organização de documentos digitalizados (CNH, CRV, Laudos).
*   **Galeria de Arquivos:** Visualização rápida de imagens e PDFs com opção de download em ZIP.
*   **Histórico de Motivos:** Registro de pendências, aprovações e cancelamentos.

### 💰 Controle Financeiro
*   **Dashboard Financeiro:** Visão geral de faturamento, honorários pendentes e recebidos.
*   **Gestão de Débitos:** Cadastro de IPVA, Multas e Taxas com cálculo automático de totais.
*   **Parcelamento:** Geração e controle de parcelas (Entrada + Boletos).
*   **Alertas de Vencimento:** Notificação visual de parcelas vencidas ou a vencer.

### 📄 Automação e Ferramentas
*   **Gerador de Contratos:** Criação automática de contratos (TCD-e) preenchidos com dados do cliente e veículo.
*   **Consulta FIPE:** Integração para consulta de valor de mercado de veículos.
*   **Segurança Gov.br:** Armazenamento criptografado de credenciais de acesso governamental.
*   **Modo Demonstração:** Gerador de dados "fakes" para testes e treinamento de equipe.

---

## 🛠️ Tecnologias Utilizadas

*   **Frontend:** React.js (Vite), Tailwind CSS, Lucide Icons, Radix UI (Shadcn).
*   **Backend:** Node.js, Express.
*   **Banco de Dados:** MySQL.
*   **Outros:** PDF Generation (jsPDF), Criptografia (Crypto), Upload de Arquivos (Multer).

---

## ⚙️ Instalação e Configuração

### Pré-requisitos
*   Node.js (v18 ou superior)
*   MySQL (Servidor de Banco de Dados)

### 1. Configuração do Banco de Dados
Crie um banco de dados MySQL e execute o script de criação das tabelas (schema).
*As tabelas principais são: `servicos`, `tipos_servicos`, `arquivos_servico`, `notificacoes`.*

### 2. Configuração do Backend (API)
1.  Navegue até a pasta raiz do projeto.
2.  Instale as dependências:
    ```bash
    npm install
    ```
3.  Crie um arquivo `.env` na raiz com as seguintes variáveis:
    ```env
    PORT=3000
    DB_HOST=localhost
    DB_USER=seu_usuario
    DB_PASSWORD=sua_senha
    DB_NAME=nome_do_banco
    API_TOKEN=seu_token_secreto
    ADMIN_PASSWORD=senha_admin
    ENCRYPTION_SECRET=chave_secreta_criptografia
    ```
4.  Inicie o servidor:
    ```bash
    node server.js
    ```

### 3. Configuração do Frontend
1.  Verifique o arquivo `src/config.js` e aponte para o seu backend:
    ```javascript
    export const API_BASE_URL = "http://localhost:3000";
    ```
2.  Instale as dependências do frontend (se estiverem separadas ou na mesma raiz):
    ```bash
    npm install
    ```
3.  Inicie a aplicação:
    ```bash
    npm run dev
    ```

---

## 📖 Guia de Uso Passo a Passo

### 1. Painel Inicial (Dashboard)
Ao entrar no sistema, você verá o **Dashboard**.
*   **Métricas:** Cards no topo mostram o volume de processos pendentes, aprovados e o faturamento.
*   **Previsão de Pagamentos:** Uma lista interativa mostra quais clientes têm pagamentos previstos para hoje, ontem ou atrasados.
*   **Débitos em Aberto:** Lista rápida de débitos (IPVA, Multas) que precisam ser pagos pelo escritório.
*   **Botão "Gerar Dados Fakes":** Use este botão (ícone de banco de dados no topo) para popular o sistema com dados de teste se estiver em ambiente de desenvolvimento.

### 2. Cadastrando um Novo Serviço
1.  Clique no botão **"Novo Cliente"** na Home ou na aba Serviços.
2.  Preencha os **Dados do Cliente** (Nome, CPF, Telefone).
3.  Na aba **Veículo**, insira Placa, Renavam e Modelo.
    *   *Dica:* Use o botão "Consultar FIPE" para buscar o valor do veículo automaticamente.
4.  Na aba **Financeiro**, defina o valor total, honorários e forma de pagamento.
5.  Clique em **"Criar Cliente"**.

### 3. Gerenciando um Processo (Detalhes)
Dentro da ficha do cliente (`ServicoDetalhe`), você tem controle total:
*   **Status:** Mude o status (ex: de "Pendente" para "Em Andamento"). O sistema pedirá um motivo/observação.
*   **Documentos:**
    *   Veja a lista de documentos necessários (configurada previamente).
    *   Clique em "Anexar arquivos" para subir fotos ou PDFs.
    *   Use a "Galeria" para visualizar tudo de uma vez.
*   **Débitos:** Adicione multas ou taxas que surgirem. Marque como "Pago" quando o escritório quitar a dívida.
*   **Contrato:** Clique em "Gerar Contrato" para criar um PDF pronto para impressão com os dados preenchidos.

### 4. Configurações do Sistema
Acesse a página de **Configurações** (ícone de engrenagem) para:
*   Criar novos **Tipos de Serviço** (ex: "Licenciamento 2025", "Transferência").
*   Definir o **Valor Base** de honorários para cada serviço.
*   Configurar a **Lista de Documentos** padrão exigida para cada tipo de serviço.

### 5. Segurança e Senhas
*   O campo de **Senha Gov.br** é criptografado no banco de dados.
*   Para visualizar a senha, o usuário precisa clicar no ícone de "olho" e inserir a senha de administrador do sistema. Isso garante auditoria e segurança.

---

## 📄 Licença

Este projeto é proprietário e desenvolvido para uso exclusivo da Senaf Despachante.
