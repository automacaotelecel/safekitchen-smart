# SafeKitchen Smart

Webapp/PWA para geração de etiquetas sanitárias, validade automática, histórico e cadastro de produtos personalizados.

## Stack

- Frontend: React + TypeScript + Vite + Tailwind
- Backend: Node.js + TypeScript + Express
- Banco: SQLite via Prisma
- PDF: PDFKit

## Como rodar

### 1. Backend

```bash
cd backend
copy .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

API: http://localhost:3333

Login demo:

- E-mail: admin@safekitchen.com.br
- Senha: 123456

### 2. Frontend

Abra outro terminal:

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173

## Observações importantes

1. A base de validade é técnica e configurável. Antes de vender como regra oficial, valide com a nutricionista/responsável técnico do cliente.
2. O reconhecimento por câmera/IA deve entrar em uma segunda fase. Para o MVP, o sistema já possui busca rápida e estrutura pronta para scanner.
3. Para produção, troque SQLite por PostgreSQL, altere JWT_SECRET e configure HTTPS.

## Próximas evoluções sugeridas

- Scanner de código de barras.
- OCR do rótulo.
- Reconhecimento por IA com confirmação humana.
- Controle de temperatura.
- Checklists sanitários.
- Exportação Excel.
- Assinatura mensal por restaurante.
