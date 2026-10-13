# MeuTrello Monitor

Painel independente de auditoria de cartões. Node.js 20+ sem dependências externas.

## Iniciar

Configure as variáveis `TRELLO_KEY` e `TRELLO_TOKEN` no ambiente do servidor. No macOS/Linux:

```bash
export TRELLO_KEY="SUA_CHAVE"
export TRELLO_TOKEN="SEU_TOKEN"
npm start
```

No Windows PowerShell:

```powershell
$env:TRELLO_KEY="SUA_CHAVE"
$env:TRELLO_TOKEN="SEU_TOKEN"
npm start
```

Abra http://localhost:3000

## Funcionamento e limites

- Consulta ações recentes de cada quadro acessível a cada 10 segundos (configurável via `POLL_MS`, mínimo 5 segundos). Distribui novos eventos aos navegadores conectados por Server-Sent Events (SSE).
- **Não é push instantâneo do Trello**: há atraso de até um ciclo de consulta, mais latência da API. Para push real, é necessário implementar webhooks públicos com HTTPS.
- Na primeira execução, mostra ações recentes; depois persiste até 1.500 eventos em `data/events.json`. Use disco persistente na hospedagem; ambientes serverless não servem para este processo contínuo.
- Cada quadro retorna até 100 ações por consulta. Em quadros de atividade muito intensa, eventos podem ser perdidos entre consultas. Limites de taxa da API também se aplicam.
- Criação, movimentação, arquivamento, restauração, exclusão e comentários são tratados quando retornados pelo Trello. **Reações não são garantidas**: a API de ações consultada pode não expor os eventos de reação. Exclusões podem não trazer o nome ou link de um cartão já apagado.
- Algumas transferências entre quadros podem aparecer com informações incompletas de origem/destino, conforme o payload retornado pela API.
- Tokens devem ficar exclusivamente no servidor. O projeto antigo incluía token no JS público: revogue-o e crie um novo.
- Este projeto não tem autenticação de visitantes. Restrinja o acesso ao painel se o hospedar na internet, pois os eventos podem conter informações privadas.
