# Estratégia de Desenvolvimento e Arquitetura: Planejador de Atividades Ramo Lobinho

Este documento serve como um **blueprint (modelo estratégico de desenvolvimento)** completo do Planejador de Atividades. Ele detalha a arquitetura técnica, as integrações de APIs, a engenharia de prompts e as estratégias de persistência de dados. Utilize este guia para replicar essa mesma infraestrutura de alta performance e experiência de usuário polida em qualquer outro aplicativo de planejamento (ex: planejador de aulas, organizador de eventos, rotinas corporativas, etc.).

---

## 🧭 1. Resumo do Conceito e Fluxograma Funcional

O aplicativo é um planejador inteligente full-stack que gera cronogramas minuciosos de **150 minutos (2h30)** para reuniões escoteiras baseadas no Ramo Lobinho e no universo literário da Jângal (Ruyard Kipling). O sistema permite personalizar disponíveis, incluir atividades especiais obrigatórias e sincronizar dados com WordPress e Firebase.

### Fluxo de Dados de Ponta a Ponta:
```
[Interface React (Frontend)]
    │
    ├───► [Firebase Auth & Firestore] ──► Sincronização automática e persistência das configurações de usuário.
    │
    ├───► [Backend Express (API Proxy)]
    │         ├───► API do Gemini (AI) ────► Retorna objeto estruturado (JSON rígido).
    │         └───► API do WordPress ──────► Realiza upload autenticado de mídias/PDFs.
    │
    └───► [Geração offline de Arquivos]
              ├───► PDF (html2pdf.js) ────► Renderiza o DOM diretamente como PDF estilizado.
              └───► DOCX (docx library) ───► Constrói tabelas e sumários programaticamente para Word.
```

---

## 🏛️ 2. Arquitetura Full-Stack

A aplicação é projetada sob o paradigma de **desacoplamento seguro de chaves de API**, onde o frontend é um SPA (Single Page Application) e o backend atua como gateway de segurança.

### Frontend:
*   **Framework:** React 19 + TypeScript + Vite.
*   **Estilização:** Tailwind CSS v4 para garantir uma interface limpa, de alto contraste visual e responsiva.
*   **Animações:** Framer Motion (`motion/react`) para transições suaves de abas e estados de carregamento.
*   **Ícones:** Biblioteca unificada `lucide-react`.

### Backend (Garante a Segurança):
*   **Runtime:** Node.js com Express e TypeScript.
*   **Proxy de IA:** Responsável por ocultar segredos como `GEMINI_API_KEY`.
*   **Proxy de Mídia:** Transmite buffers diretamente para o WordPress de destino sem armazenar arquivos locais e sem expor credenciais `WP_APP_PASSWORD` ou logins ao navegador do cliente.

---

## 🤖 3. Integração com Inteligência Artificial (Gemini API)

A inteligência de planos de atividades é alimentada pelo modelo `gemini-3.5-flash` através do SDK oficial `@google/genai`. 

### Estratégia de Prompt Rígido e Estruturação de Resposta:
1.  **Exigência de Resposta JSON Pura:** O servidor configura o parâmetro `responseMimeType: "application/json"` nas configurações da chamada. Isso elimina filtros regex manuais ou código de escape falho.
2.  **System Instruction (Prompt de Sistema):** Define a persona ("Especialista Escoteiro/Akelá experiente") e estabelece regras restritivas absolutas:
    *   **Regras Cronológicas:** Garante início às 14:00, fim às 16:30, inclusão de aberturas escoteiras (IBOGU, Grande Uivo) e encerramentos obrigatórios, respeitando o limite exato de 150 minutos na soma matemática.
    *   **Priorização Terminológica:** Substituir terminologias antigas ("Rocha do Conselho") pela nova terminologia regulamentar usada na União dos Escoteiros do Brasil ("Roca de Conselho").
    *   **Atribuição de Responsáveis:** Obriga que as tarefas geradas usem estritamente a lista de pessoas configuradas no perfil do usuário, e dita regras específicas sobre qual personagem deve cantar as canções iniciais na abertura.
3.  **Composição Dinâmica do Prompt de Entrada:** O prompt é gerado juntando o tema desejado aos links e arquivos em PDF carregados na biblioteca de literaturas selecionadas, otimizando o contexto sob demanda.

*Exemplo de JSON esperado pelo Frontend:*
```json
{
  "cicloPrograma": "Descrição do ciclo...",
  "diferenciacaoEtaria": "Foco nos mais novos vs mais velhos...",
  "recursosMateriais": "Giz, cordas, bexigas...",
  "recursosHumanos": "Akelá, Baloo...",
  "atividades": [
    {
      "horaInicio": "14:00",
      "duracao": "15 min",
      "tipo": "Abertura",
      "nome": "Grande Uivo",
      "responsavel": "Akela",
      "material": "Bandeira",
      "areaDesenvolvimento": "Caráter",
      "descricao": "Passo a passo detalhado do ritual...",
      "fundoDeCena": "Contextualização na Jângal..."
    }
  ]
}
```

---

## 🗄️ 4. Persistência de Dados (Firebase Auth & Firestore)

Para evitar que o usuário perca suas customizações (parâmetros de Velhos Lobos locais, termos proibidos, links de literaturas sincronizados), integrou-se o **Firebase Firestore** de forma transparente.

*   **Identificação do Usuário:** Autenticação anônima ou social utilizando Firebase Auth.
*   **Modelo de Coleção:** `users/{userId}/config/main`.
*   **Funcionamento Resiliente:**
    *   O aplicativo faz uso de um conjunto padrão de dados caso o usuário não esteja logado ou não tenha configurações salvas.
    *   Ao configurar itens nas configurações (Settings de Velhos Lobos, Literaturas, etc.), o app sincroniza esses dados com o Firebase Firestore se detectar uma sessão ativa.
    *   **Fallback com Timeout:** Utilização de um timeout de segurança (ex: 4 segundos) durante a inicialização para evitar telas travadas caso a conexão com as regras do Firestore demore a responder.

---

## 📄 5. Mecanismo de Exportação de Documentos

Sistemas de planejamento de atividades dependem da capacidade de imprimir arquivos físicos e compartilhá-los facilmente. Este projeto disponibiliza duas opções robustas e escaláveis:

### A. Exportação Programática em Microsoft Word (DOCX)
Alimentado pela biblioteca `docx` no cliente, o processo reconstrói programaticamente todas as seções e tabelas gerando um fluxo de bytes (`Blob`) estável e abrível no Office e Google Docs:
```typescript
import { Document, Packer, Paragraph, Table, TableRow, TableCell } from 'docx';
import { saveAs } from 'file-saver';

// 1. Criar estrutura do documento com metadados e estilos
const doc = new Document({
  sections: [{
    properties: {},
    children: [
      new Paragraph({ text: "Título Principal do Planejamento", bold: true }),
      new Table({ rows: [ ... ] }), // Tabela montada iterando o JSON do plano
      // Renderização do detalhamento e ciclo de programa...
    ]
  }]
});

// 2. Empacotar para Blob binário e baixar localmente
const blob = await Packer.toBlob(doc);
saveAs(blob, "Planejamento_Atividade.docx");
```

### B. Download Visual em PDF
Utiliza a combinação clássica `html2pdf.js` para capturar a página de forma contida na aba de visualização do plano de atividades configurado, gerando um documento idêntico ao que o usuário vê na tela.

---

## ☁️ 6. Sincronização Inteligente com CMS (WordPress API)

Ideal para equipes que já gerenciam blogs ou repositórios centrais de arquivos. Os chefes e coordenadores podem upar arquivos PDF diretamente de sua máquina pelo Painel de Biblioteca do App, enviando as referências automaticamente para o site WordPress hospedado.

*   **Segurança de Credenciais:** O frontend coleta a imagem/PDF e encaminha como FormData para a rota do servidor `/api/wp/upload` juntamente com metadados. O backend utiliza a variável de ambiente secreta `WP_APP_PASSWORD` para realizar a requisição autenticada.
*   **Conexão Segura Básica (Application Password):** No WordPress Admin, cria-se uma senha de aplicação única, reduzindo o risco de vazamento comparado ao usuário master do banco de dados.
*   **Tratamento de Arquivos Binários em Trânsito:**
    ```typescript
    // Backend recebe o upload via Multer (em memória) e dispara para o WordPress
    const auth = Buffer.from(`${wpUser}:${wpPass}`).toString("base64");
    
    const response = await fetch(`${wpUrl}/wp-json/wp/v2/media`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(req.file.originalname)}"`,
        "Content-Type": req.file.mimetype,
      },
      body: req.file.buffer, // Envio do buffer direto, protegendo o sistema de arquivos
    });
    ```

---

## 💡 7. Lista de Boas Práticas Técnicas Replicáveis

Se você for criar outro aplicativo baseado neste modelo, certifique-se de herdar estes padrões de sucesso:

1.  **Definição Prévia de Tipagem (Types First):** Sempre decida e codifique os contratos de dados e interfaces em `src/types.ts` antes de desenhar a interface de usuário ou as rotas do backend. Isso garante uniformidade.
2.  **Desabilitar Websockets HMR Benignos:** Em ambientes baseados em sandboxes na nuvem e iframes, erros de conexão WebSocket do Vite HMR são normais. Adicione interceptores globais nas primeiras linhas de `src/main.tsx` para filtrá-los, de forma a manter os consoles de depuração limpos e focados no que realmente importa.
3.  **Configuração de Build Unificada:** Garanta que seu script de compilação em produção reuna tanto o frontend SPA quanto a transpilação do servidor de forma limpa, compilando o arquivo de entrada `server.ts` em um único arquivo empacotado `dist/server.cjs` com o `esbuild` para inicialização imediata e segurança contra falhas de escopos relativos de ESM no Node.
4.  **Termos de Substituição (Ajustes de Texto Dinâmicos):** Implemente uma mecânica de filtro no momento de exibição dos textos onde termos digitados de forma inadequada sejam automaticamente remapeados para sua representação oficial (ex: trocar automaticamente "Rocha do Conselho" por "Roca de Conselho" na hora de salvar, exibir ou exportar textos recebidos da inteligência artificial).
