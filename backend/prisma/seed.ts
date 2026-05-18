import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type SeedProduct = {
  name: string;
  category: string;
  mode: 'AMBIENTE' | 'REFRIGERADO' | 'CONGELADO';
  value: number;
  unit?: 'days' | 'hours';
  keywords?: string;
};

const products: SeedProduct[] = [
  { name: 'LEITE EM PÓ', category: 'Pós para infusões, açúcares e chocolates', mode: 'AMBIENTE', value: 30, keywords: 'composto lacteo cafe fermento sal suco em po' },
  { name: 'AÇÚCAR', category: 'Pós para infusões, açúcares e chocolates', mode: 'AMBIENTE', value: 30, keywords: 'adocante gelatina curau pudim flan sagu achocolatado chocolate granulado' },
  { name: 'ÓLEO DE SOJA', category: 'Óleos e gorduras', mode: 'AMBIENTE', value: 30, keywords: 'margarina emulsificante azeite dende oleo composto' },
  { name: 'FARINHA DE TRIGO', category: 'Farinhas e massas secas', mode: 'AMBIENTE', value: 30, keywords: 'farinha rosca mandioca fuba trigo quibe mistura bolo macarrao lasanha seca amido milho' },
  { name: 'VINHO', category: 'Bebidas alcoólicas', mode: 'AMBIENTE', value: 7 },
  { name: 'PÃO FRANCÊS', category: 'Produtos de panificação', mode: 'AMBIENTE', value: 1, keywords: 'pao leite sem recheio' },
  { name: 'BOLO SEM RECHEIO', category: 'Produtos de panificação', mode: 'AMBIENTE', value: 2, keywords: 'massa torta biscoitos secos' },
  { name: 'PÃO DE FORMA', category: 'Produtos de panificação', mode: 'AMBIENTE', value: 5, keywords: 'torradas bolo fatiado sem recheio cobertura' },
  { name: 'ALHO COM CASCA', category: 'Temperos, especiarias e grãos secos', mode: 'AMBIENTE', value: 90, keywords: 'cabeca de alho' },
  { name: 'BATATA PALHA', category: 'Temperos, especiarias e grãos secos', mode: 'AMBIENTE', value: 4 },
  { name: 'BACON FRITO', category: 'Temperos, especiarias e grãos secos', mode: 'AMBIENTE', value: 1, keywords: 'alho frito' },
  { name: 'TEMPEROS SECOS', category: 'Temperos, especiarias e grãos secos', mode: 'AMBIENTE', value: 30, keywords: 'sal pimenta canela cravo bicarbonato noz moscada curry oregano louro cha colorau caldo amaciante' },
  { name: 'GOIABADA', category: 'Doces industrializados', mode: 'REFRIGERADO', value: 15, keywords: 'marmelada beijinho brigadeiro doce de leite mel calda sorvete frutas secas cristalizadas' },
  { name: 'CREME DE LEITE', category: 'Doces industrializados', mode: 'REFRIGERADO', value: 3 },
  { name: 'FRUTA EM CALDA', category: 'Enlatados e conservas', mode: 'REFRIGERADO', value: 7, keywords: 'leite coco ervilha milho verde extrato tomate palmito ameixa leite condensado' },
  { name: 'AZEITONAS', category: 'Enlatados e conservas', mode: 'REFRIGERADO', value: 15, keywords: 'picles alcaparras champignon' },
  { name: 'VINAGRE', category: 'Temperos', mode: 'REFRIGERADO', value: 15, keywords: 'molho shoyo molho ingles pimenta catchup mostarda maionese molho salada pronto' },
  { name: 'MANTEIGA', category: 'Gorduras', mode: 'REFRIGERADO', value: 15 },
  { name: 'QUEIJO EM PEÇA', category: 'Frios, embutidos e laticínios', mode: 'REFRIGERADO', value: 15, keywords: 'parmesao mucarela prato salsicha mortadela presunto bacon linguica calabresa em peca' },
  { name: 'PRESUNTO FATIADO', category: 'Frios, embutidos e laticínios', mode: 'REFRIGERADO', value: 3, keywords: 'fatiados ralados mortadela linguica calabresa mucarela queijo prato parmesao ricota minas requeijao catupiry' },
  { name: 'CARNE SECA', category: 'Carnes e pescados salgados', mode: 'REFRIGERADO', value: 15, keywords: 'charque' },
  { name: 'BACALHAU', category: 'Carnes e pescados salgados', mode: 'REFRIGERADO', value: 1 },
  { name: 'SUCO CONCENTRADO', category: 'Suco concentrado', mode: 'REFRIGERADO', value: 15, keywords: 'liquido galao bombona' },
  { name: 'PÃO ASSADO', category: 'Pães', mode: 'REFRIGERADO', value: 3 },
  { name: 'MASSA FRESCA RECHEADA REFRIGERADA', category: 'Massa fresca recheada', mode: 'REFRIGERADO', value: 1 },
  { name: 'PÃO DE QUEIJO CONGELADO', category: 'Pães', mode: 'CONGELADO', value: 7 },
  { name: 'PÃO ASSADO CONGELADO', category: 'Pães', mode: 'CONGELADO', value: 7 },
  { name: 'MASSA FRESCA RECHEADA CONGELADA', category: 'Massa fresca recheada', mode: 'CONGELADO', value: 7 },
  { name: 'FOLHAS SANITIZADAS', category: 'Saladas e frutas', mode: 'REFRIGERADO', value: 12, unit: 'hours', keywords: 'frutas sanitizadas legumes crus graos legumes cozidos sem tempero decoracao' },
  { name: 'CONSERVAS PREPARADAS', category: 'Saladas e frutas', mode: 'REFRIGERADO', value: 1, keywords: 'frutas cozidas' },
  { name: 'DOCE EM CALDA', category: 'Sobremesas manipuladas', mode: 'REFRIGERADO', value: 3, keywords: 'calda de acucar geleia' },
  { name: 'GELATINA SEM CREME', category: 'Sobremesas manipuladas', mode: 'REFRIGERADO', value: 2, keywords: 'sem leite' },
  { name: 'ALHO DESCASCADO', category: 'Temperos manipulados', mode: 'REFRIGERADO', value: 3, keywords: 'salsa cebolinha manjericao azeite vinagre aromatizado ervas frescas sanitizadas' },
  { name: 'MARINADOS', category: 'Temperos manipulados', mode: 'REFRIGERADO', value: 1, keywords: 'vinagre limao temperos acidos' },
  { name: 'TEMPEROS BATIDOS', category: 'Temperos manipulados', mode: 'REFRIGERADO', value: 7, keywords: 'alho molho de pimenta elaborado' },
  { name: 'DOCES CREMOSOS', category: 'Doces manipulados', mode: 'REFRIGERADO', value: 1, keywords: 'canjica arroz doce pudins flans mousses tortas bolo recheio brigadeiro beijinho trufas' },
  { name: 'DISCO PARA PANQUECA COM LEITE', category: 'Outros manipulados', mode: 'REFRIGERADO', value: 12, unit: 'hours' },
  { name: 'PESCADO CRU PRÉ-PREPARADO', category: 'Pescado cru', mode: 'REFRIGERADO', value: 1, keywords: 'apos descongelamento parcial' },
  { name: 'CARNES PRÉ-PREPARADAS COM TEMPERO', category: 'Carnes bovinas, suínas e aves', mode: 'REFRIGERADO', value: 1, keywords: 'fatiada moida unidade tempero' },
  { name: 'CARNES PRÉ-PREPARADAS SEM TEMPERO', category: 'Carnes bovinas, suínas e aves', mode: 'REFRIGERADO', value: 3 },
  { name: 'SORVETES', category: 'Sobremesas manipuladas', mode: 'CONGELADO', value: 7 },
  { name: 'BOLO SEM RECHEIO CONGELADO', category: 'Sobremesas manipuladas', mode: 'CONGELADO', value: 1 },
  { name: 'ALHO COM CASCA CONGELADO', category: 'Temperos manipulados', mode: 'CONGELADO', value: 7 }
];

async function main() {
  const existing = await prisma.product.count({ where: { isGlobal: true } });
  if (existing === 0) {
    for (const p of products) {
      await prisma.product.create({
        data: {
          name: p.name,
          category: p.category,
          defaultMode: p.mode,
          keywords: p.keywords || '',
          isGlobal: true,
          validityRules: {
            create: {
              category: p.category,
              description: p.name,
              conservationMode: p.mode,
              validityValue: p.value,
              validityUnit: p.unit || 'days',
              source: 'Tabela técnica inicial configurável'
            }
          }
        }
      });
    }
  }

  const adminEmail = 'admin@safekitchen.com.br';
  const hasAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!hasAdmin) {
    const passwordHash = await bcrypt.hash('123456', 10);
    await prisma.restaurant.create({
      data: {
        name: 'Restaurante Demonstração',
        users: { create: { name: 'Administrador', email: adminEmail, passwordHash, role: 'ADMIN' } },
        employees: { createMany: { data: [{ name: 'Administrador' }, { name: 'Cozinha' }, { name: 'Nutrição' }] } }
      }
    });
  }
}

main()
  .then(async () => {
    console.log('Seed finalizado. Login demo: admin@safekitchen.com.br / 123456');
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
