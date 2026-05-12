import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const MAX_FILES = 18;
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

const moduleNotes = [
  ['App shell', 'src/app/AppShell.tsx', 'Sessao, navegacao, layout, bloqueio MFA e renderizacao de modulos.'],
  ['Rotas publicas', 'src/app/PublicRoutes.tsx', 'Entrada publica, validacao e protecao por permissao.'],
  ['Estado global', 'src/store/useAppStore.ts', 'Auth local/Supabase, MFA, sessao, cadastros e exportacao.'],
  ['Cadastro', 'src/modules/Cadastro.tsx', 'Wizard fino; submit/upload vive em hooks e componentes de cadastro.'],
  ['Submit cadastro', 'src/modules/cadastro/hooks/useCadastroSubmit.ts', 'Validacoes finais, Storage privado, upsert publico e rollback.'],
  ['Validacao publica', 'src/modules/Valida.tsx', 'Consulta por QR/arquivo/codigo manual usando RPC publica.'],
  ['Valida lib', 'src/modules/valida/lib/publicValidation.ts', 'Chama somente validate_cipf_public e falha fechado.'],
  ['Carteirinha fisica', 'src/components/CarteirinhaPreview.tsx', 'Layout impresso 8.5cm x 5.4cm. Evite alterar sem teste visual.'],
  ['Tela de impressao', 'src/modules/Carteirinha.tsx', 'Busca, permissao admin, emissao e download PNG.'],
  ['Operacao', 'src/modules/Operacao.tsx', 'Aprovacao, emissao, WhatsApp, retirada e acoes sensiveis.'],
  ['Pessoas', 'src/modules/Pessoas.tsx', 'Lista interna, filtros, ficha, edicao e historico individual.'],
  ['Workflow', 'src/modules/dashboard/hooks/useRegistrationWorkflow.ts', 'Transicoes, auditoria e fallback RPC/admin.'],
  ['Exportacao', 'src/modules/dashboard/hooks/useDashboardExports.ts', 'CSV/PDF, auditoria e protecao contra CSV Injection.'],
  ['MFA', 'src/modules/MfaChallenge.tsx', 'Desafio TOTP para promover sessao admin a aal2.'],
  ['Configuracoes', 'src/modules/Configuracoes.tsx', 'Painel MFA, sessao, permissoes e status do sistema.'],
  ['Regras de status', 'src/lib/registration-status.ts', 'Labels, status legados, validade publica e transicoes.'],
  ['Permissoes', 'src/lib/permissions.ts', 'Papeis admin/attendant/viewer e permissoes de interface.'],
  ['Admin RPC', 'src/lib/admin-rpc.ts', 'Chamadas admin_transition_registration e admin_request_export.'],
  ['Supabase', 'src/lib/supabase.ts', 'Cliente Supabase e verificacao de ambiente.']
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
console.log('Use este resumo antes de abrir arquivos grandes. Abra so o modulo afetado pela tarefa.');
console.log('');
console.log('## Mapa rapido');
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
console.log('- Prefira `npm run ai:context` e buscas especificas antes de abrir arquivos inteiros.');
console.log('- Para UI, comece por `src/index.css`, `src/components/ui/*` e so depois a tela afetada.');
console.log('- Para cadastro, abra componentes em `src/modules/cadastro/components` antes de `Cadastro.tsx`.');
console.log('- Para dashboard/operacao, prefira hooks/componentes em `src/modules/dashboard/*`.');
console.log('- Evite `git diff` completo; use `git diff --stat` ou `git diff -- <arquivo>`.');
