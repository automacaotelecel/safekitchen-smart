# Segurança, credenciais e continuidade

## Chave da Sana

1. Revogue imediatamente qualquer chave que tenha sido publicada ou marcada como vazada.
2. Gere uma nova chave e salve-a somente como `GEMINI_API_KEY` no ambiente do backend.
3. Nunca use a chave em variáveis `VITE_*`, no frontend, em capturas de tela ou no Git.
4. Confirme que `.env` não está versionado. Se a chave já entrou no histórico do repositório, remova-a do histórico e mantenha a chave antiga revogada.
5. Restrinja a credencial e monitore o consumo no provedor sempre que esses controles estiverem disponíveis.

O build executa `npm run security:check` e falha quando encontra formatos conhecidos de chaves em arquivos versionados. Mensagens brutas do provedor também não são devolvidas ao navegador.

## Registros e anexos

- Cada consulta operacional aplica o `restaurantId` da sessão autenticada.
- Senhas são armazenadas como hash e não entram na exportação de segurança.
- Chaves de dispositivos e credenciais de provedores não entram na exportação.
- Evidências usam armazenamento de objetos privado e URLs temporárias quando o S3/R2 está configurado.
- Ações relevantes continuam registradas na trilha interna, embora ela não seja exibida no dossiê do cliente.

## Continuidade

O menu Relatórios permite baixar uma cópia JSON dos registros com hash SHA-256. Essa cópia complementa, mas não substitui, os recursos do provedor de PostgreSQL.

Em produção, mantenha habilitados:

- backups automáticos do banco;
- recuperação pontual (PITR), quando disponível;
- retenção compatível com o contrato;
- teste periódico de restauração;
- versionamento ou retenção dos arquivos no S3/R2;
- monitoramento de falhas e espaço disponível.

Nenhum sistema pode prometer risco zero de perda. A garantia operacional depende do plano de backup contratado, da retenção configurada e de testes reais de restauração.
