# SafeKitchen Smart — arquivos alterados do frontend

Este pacote contém os arquivos completos que foram criados ou alterados no frontend. Copie-os sobre o projeto original preservando a estrutura de pastas.

## Principais ajustes

- impressão direta refeita para a Tomate MDK-022 em TSPL, 203 dpi e mídia GAP de 102 x 152 mm;
- conexão por BLE no Android e por porta Bluetooth SPP/USB no Chrome ou Edge do computador;
- trava contra clique duplo e comando `PRINT 1,1` por etiqueta, evitando cópias involuntárias;
- modo alternativo pelo navegador ajustado para papel 102 x 152 mm;
- dependência e protocolo proprietários da NIIMBOT removidos;
- datas e horários locais corrigidos, com exibição em `dd/mm/aaaa`;
- nomes de data específicos por tipo de etiqueta;
- temperatura de recebimento exclusiva da etiqueta de armazenamento de carnes;
- amostras com descarte em 96 horas;
- categorias sugeridas durante o cadastro, permitindo novas categorias;
- critério de validade manual ou sugerido pela Sana;
- evidências em controles e por pergunta de auditoria;
- treinamento com próxima data opcional;
- auditoria complementar de São Paulo;
- dossiê revisado e exportação de cópia de segurança;
- nomenclatura “Recebimento de perecíveis”.

## Validação

O frontend foi compilado com sucesso usando `npm run build`.

O espaço entre etiquetas usa 3 mm por padrão. Se a mídia física tiver outro GAP, altere
`VITE_TOMATE_LABEL_GAP_MM` antes do build. O identificador desta revisão aparece na tela
de impressão como `MDK022-2026-08-20-01`.

## Implantação

Use Node.js 20.19.x, conforme o campo `engines` do projeto:

```bash
npm ci
npm run build
```

No primeiro teste, selecione somente uma etiqueta. No Windows, emparelhe a MDK-022 com
PIN `0000` e escolha a porta Bluetooth/USB. No Android, abra pelo Chrome em HTTPS e
selecione `MDK-022` na janela Bluetooth.

Os anexos de evidência ficam disponíveis quando o armazenamento S3/R2 está configurado no backend.
