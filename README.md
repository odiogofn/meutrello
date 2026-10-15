# MeuTrello Monitor — Vercel

## Publicação
1. Envie **o conteúdo desta pasta** para um repositório GitHub, mantendo `api/`, `public/`, `vercel.json` e `package.json` na raiz.
2. No Vercel, importe o repositório. **Framework Preset: Other**. **Root Directory:** raiz do projeto. **Output Directory:** deixe vazio (não configure `public`).
3. Em Settings → Environment Variables, crie `TRELLO_KEY` e `TRELLO_TOKEN`, com valores do Trello. Marque Production e Preview se necessário.
4. Faça **Redeploy** após adicionar as variáveis. Abra `/api/state` para conferir se retorna JSON e depois a página inicial.

## Funcionamento
A função serverless `/api/state` consulta ações recentes dos quadros acessíveis ao token; o navegador atualiza a cada **30 segundos**, enquanto a aba estiver aberta. Eventos já vistos ficam guardados no `localStorage` **somente daquele navegador**, até 2.000 registros. Não há processo contínuo no servidor, nem SSE; `/api/stream` devolve aviso HTTP 410.

## Limitações importantes
- Não é tempo real instantâneo. Em Vercel, para notificações por webhook mesmo com a página fechada, é preciso um banco persistente (ex.: Supabase) e endpoint público de webhook, com verificação e controle de acesso.
- A API não garante que exclusões definitivas e reações estejam disponíveis em todas as ações. O monitor não inventa esses eventos.
- A cada consulta são recuperadas até 100 ações por quadro, ou `ACTIONS_PER_BOARD` (máximo 100). Se houver muitas ações entre consultas, pode haver lacunas.
- O endpoint atualmente usa o token do servidor para servir dados ao navegador **sem autenticação de usuários**. Configure proteção de acesso no Vercel antes de publicar para terceiros; o token nunca é enviado ao cliente, mas o histórico é sensível.
- `localStorage` não sincroniza entre dispositivos e não substitui banco de dados.

## Novidades 2.2
- Menu horizontal no topo, com seletor de quadros.
- Indicadores de última sincronização e contagem regressiva da próxima consulta.
- Botão Pausar/Retomar: mantém a preferência neste navegador e impede consultas automáticas quando pausado.
- Botão Atualizar agora: consulta manualmente mesmo quando pausado.
- Intervalo configurado em `public/app.js`, constante `INTERVAL_MS=30000`.

## Versão 2.3
- Mostra **etiquetas atuais** para os 10 cartões criados mais recentemente retornados pela consulta (não é possível garantir que sejam as mesmas etiquetas do instante da criação).
- Botão **Responder** nos eventos de comentário: publica novo comentário no mesmo cartão usando a conta do token Trello.
- No Vercel, adicione também `MONITOR_WRITE_PASSWORD` (senha longa e exclusiva) em Settings > Environment Variables, e faça Redeploy. O botão solicita essa senha a cada resposta; ela não fica salva no navegador.
- **Segurança:** esta senha simples é uma proteção básica para a rota de escrita, não substitui autenticação individual nem controle de usuários. Recomenda-se proteger também o acesso ao painel e à API de leitura.
- A leitura de etiquetas acrescenta até 10 consultas por ciclo, podendo aumentar o uso da API.

## Versão 2.4
Exibe etiquetas atuais em todos os tipos de evento, quando o cartão ainda pode ser consultado. Cartões sem etiquetas mostram Sem etiquetas. Consultas por cartão único aumentam chamadas à API; cache compartilhado é recomendado para muitos cartões.

## MeuTrello Monitor 2.5 — filtro por etiquetas
- Novo filtro **Todas as etiquetas**, na barra superior do feed, ao lado dos filtros de quadro e tipo.
- Lista de opções gerada dinamicamente a partir das etiquetas atuais dos cartões retornados pelo Trello e presentes no histórico local.
- O filtro combina com pesquisa, quadro e tipo de evento; selecione **Todas as etiquetas** para limpar.
- O filtro usa o nome da etiqueta (ou cor, caso não tenha nome). Etiquetas homônimas em quadros diferentes aparecem como uma opção.
- Eventos de cartões inacessíveis ou excluídos podem não conter etiquetas para filtrar.
- Mantidos atualização de 30 segundos, pausa/retomada, comentários e menu superior.
