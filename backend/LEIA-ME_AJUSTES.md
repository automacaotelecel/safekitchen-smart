# SafeKitchen Smart — arquivos alterados do backend

Este pacote contém os arquivos completos que foram criados ou alterados no backend. Copie-os sobre o projeto original preservando a estrutura de pastas.

## Principais ajustes

- PDF térmico ajustado para a Tomate MDK-022 em 102 x 152 mm (203 dpi);
- utilitário de data ausente restaurado, com validação de datas e fuso IANA do restaurante;
- ambiente de testes isolado de credenciais de desenvolvimento e produção;
- datas e horários interpretados com o fuso do restaurante;
- nomes e formatos de data corrigidos nas etiquetas e PDFs;
- amostras com retenção de 96 horas;
- temperatura de recebimento aceita apenas em armazenamento de carnes;
- cadastro e sugestão assistida de critérios de validade;
- evidências validadas por estabelecimento em controles e auditorias;
- checklist complementar de São Paulo com fontes versionadas;
- dossiê com quantidades de etiquetas, documentos e auditorias, sem trilha interna;
- exportação JSON dos registros com hash SHA-256;
- preços configurados: Start R$ 990 + R$ 197/mês; Pro R$ 3.700 + R$ 497/mês;
- mensagens de erro da Sana saneadas e verificação automática de credenciais no build.

## Validação

O backend compilou com sucesso. Os 15 testes automatizados passaram e o PDF térmico da
MDK-022 foi renderizado e conferido visualmente, sem cortes ou sobreposições.

## Segurança antes do deploy

O `.env.example` foi saneado. O `.env` real não faz parte deste pacote. Revogue e substitua as chaves Sana/Gemini, Mercado Pago, JWT e demais segredos que tenham sido compartilhados ou versionados. Não reutilize os valores antigos.

Configure S3/R2 para os anexos. Para continuidade dos registros, mantenha backups automáticos, recuperação pontual (PITR) e testes de restauração no provedor PostgreSQL; a exportação JSON é uma cópia complementar.

## Implantação

Use Node.js 20.x, conforme o campo `engines` do projeto:

```bash
npm ci
npm run build
npm test
```

Não foi necessária nova migração de banco para estes ajustes.
