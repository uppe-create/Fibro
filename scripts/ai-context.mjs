import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const MAX_FILES = 18;
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

const moduleNotes = [
  ['App shell', 'src/App.tsx', 'Rotas/tabs, navegação, permissões visuais e layout principal.'],
  ['Estado global', 'src/store/useAppStore.ts', 'Usuário local, sessão, carregamento Supabase e cadastros.'],
  ['Cadastro', 'src/modules/Cadastro.tsx', 'Wizard de emissão, validações, upload, rascunho e gravação no Supabase.'],
  ['Validação pública', 'src/modules/Valida.tsx', 'Consulta por QR/arquivo/código manual usando RPC/tabela pública.'],
  ['Carteirinha física', 'src/components/CarteirinhaPreview.tsx', 'Layout impresso 8.5cm x 5.4cm. Evite alterar sem teste visual.'],
  ['Tela de impressão', 'src/modules/Carteirinha.tsx', 'Busca, permissão admin, emissão e download PNG.'],
  ['Operação', 'src/modules/Operacao.tsx', 'Aprovação, emissão, WhatsApp, retirada e ações sensíveis de admin.'],
  ['Pessoas', 'src/modules/Pessoas.tsx', 'Lista interna, filtros, ficha, edição e histórico individual.'],
  ['Filas', 'src/modules/dashboard/components', 'Componentes compartilhados para listas, modais, métricas e filtros.'],
  ['Regras de status', 'src/lib/registration-status.ts', 'Labels, status legados, validade pública e transições.'],
  ['Permissões', 'src/lib/permissions.ts', 'Papéis admin/attendant/viewer e permissões de interface.'],
  ['Supabase', 'src/lib/supabase.ts', 'Cliente Supabase e verificação de ambiente.']
];

function walk(dir) {
  const entries = fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : [];
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) return [];
    return [full];
  });
}

function lineCount(file) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).length;
}

function rel(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, '/');
}

const files = walk(SRC)
  .map((file) => ({ file, kb: fs.statSync(file).size / 1024, lines: lineCount(file) }))
  .sort((a, b) => b.kb - a.kb)
  .slice(0, MAX_FILES);

console.log('# CIPF AI Context');
console.log('');
console.log('Use este resumo antes de abrir arquivos grandes. Abra só o módulo afetado pela tarefa.');
console.log('');
console.log('## Mapa rápido');
for (const [area, file, note] of moduleNotes) {
  console.log(`- ${area}: ${file} - ${note}`);
}
console.log('');
console.log('## Maiores arquivos');
for (const item of files) {
  console.log(`- ${rel(item.file)}: ${Math.round(item.kb * 10) / 10} KB, ${item.lines} linhas`);
}
console.log('');
console.log('## Regras para economizar tokens');
console.log('- Prefira `npm run ai:context` e buscas específicas antes de abrir arquivos inteiros.');
console.log('- Para UI, comece por `src/index.css`, `src/components/ui/*` e só depois a tela afetada.');
console.log('- Para cadastro, abra componentes em `src/modules/cadastro/components` antes de `Cadastro.tsx`.');
console.log('- Para dashboard/operação, prefira hooks/componentes em `src/modules/dashboard/*`.');
console.log('- Evite `git diff` completo; use `git diff --stat` ou `git diff -- <arquivo>`.');
