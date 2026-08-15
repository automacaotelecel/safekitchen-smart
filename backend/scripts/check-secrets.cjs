const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const roots = ['src', 'prisma', 'tests', 'scripts'];
const rootFiles = ['.env.example'];
const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.cjs', '.json', '.sql']);
const secretPatterns = [
  { name: 'Google API key', regex: new RegExp('AI' + 'za[0-9A-Za-z_-]{30,}') },
  { name: 'OpenAI API key', regex: new RegExp('sk-' + '[0-9A-Za-z_-]{32,}') },
];
const findings = [];
const exampleSecretNames = new Set([
  'JWT_SECRET',
  'GEMINI_API_KEY',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'MERCADO_PAGO_ACCESS_TOKEN',
  'MERCADO_PAGO_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'BILLING_OPERATIONS_SECRET',
  'ALERT_JOB_SECRET',
  'SEED_DEMO_PASSWORD',
]);

function visit(target) {
  if (!fs.existsSync(target)) return;

  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target)) visit(path.join(target, entry));
    return;
  }

  if (
    !allowedExtensions.has(path.extname(target)) &&
    path.basename(target) !== '.env.example'
  ) return;
  const content = fs.readFileSync(target, 'utf8');

  for (const pattern of secretPatterns) {
    if (pattern.regex.test(content)) {
      findings.push(`${pattern.name}: ${path.relative(projectRoot, target)}`);
    }
  }

  if (path.basename(target) === '.env.example') {
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match || !exampleSecretNames.has(match[1])) continue;

      const value = match[2].trim().replace(/^['"]|['"]$/g, '');
      if (value && !/^(CHANGE_ME|REPLACE_ME)/i.test(value)) {
        findings.push(`Valor sensível em .env.example: ${match[1]}`);
      }
    }
  }
}

for (const root of roots) visit(path.join(projectRoot, root));
for (const file of rootFiles) visit(path.join(projectRoot, file));

if (findings.length) {
  console.error('Possível credencial exposta em arquivo versionado:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Verificação de credenciais concluída sem exposições em arquivos versionados.');
