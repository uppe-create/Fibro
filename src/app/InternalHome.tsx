import { Activity, ArrowRight, ClipboardCheck, ClipboardPlus, FileWarning, IdCard, LayoutDashboard, PackageCheck, Settings, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/layout';
import { hasPermission, type Permission } from '@/lib/permissions';
import { useAppStore } from '@/store/useAppStore';

type Shortcut = {
  tab: string;
  title: string;
  description: string;
  icon: typeof LayoutDashboard;
  permission: Permission;
};

const shortcuts: Shortcut[] = [
  { tab: 'dashboard', title: 'Painel', description: 'Visao geral da operacao.', icon: LayoutDashboard, permission: 'viewDashboard' },
  { tab: 'pessoas', title: 'Consultar cadastros', description: 'Pesquisar, abrir, editar e ver historico.', icon: Users, permission: 'viewPeople' },
  { tab: 'cadastro', title: 'Novo cadastro', description: 'Cadastrar titular e anexos.', icon: ClipboardPlus, permission: 'createRegistration' },
  { tab: 'operacao', title: 'Aprovar cadastros', description: 'Conferir documentos, aprovar, emitir e registrar segunda via.', icon: ClipboardCheck, permission: 'viewOperations' },
  { tab: 'documentos', title: 'Pendencias', description: 'Fila documental e itens com problema.', icon: FileWarning, permission: 'viewDocumentsQueue' },
  { tab: 'retiradas', title: 'Retiradas', description: 'Controlar entrega presencial.', icon: PackageCheck, permission: 'viewPickupQueue' },
  { tab: 'carteirinha', title: 'Imprimir', description: 'Gerar PNG da carteirinha.', icon: IdCard, permission: 'printCarteirinha' },
  { tab: 'relatorios', title: 'Relatorios', description: 'CSV, PDF e mensal com dados minimizados.', icon: Activity, permission: 'viewReports' },
  { tab: 'auditoria', title: 'Auditoria', description: 'Eventos sensiveis do sistema.', icon: Activity, permission: 'viewAudit' },
  { tab: 'configuracoes', title: 'Configuracoes', description: 'Perfil, sessao e seguranca.', icon: Settings, permission: 'viewSettings' }
];

export function InternalHome() {
  const { currentUser, setActiveTab } = useAppStore();
  const visibleShortcuts = shortcuts.filter((item) => hasPermission(currentUser, item.permission));

  return (
    <div className="cipf-page cipf-page-stack">
      <PageHeader
        eyebrow="Area interna"
        title="Painel operacional"
        description="Atalhos diretos para aprovacao, cadastro, consulta, impressao, relatorios e auditoria."
        tone="purple"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleShortcuts.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.tab}
              type="button"
              onClick={() => setActiveTab(item.tab)}
              className="group rounded-[1.25rem] border border-[#e8deef] bg-white p-5 text-left shadow-[0_12px_34px_rgba(47,20,80,0.06)] transition hover:-translate-y-0.5 hover:border-[#cbb4dc]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f4ecfb] text-[var(--fibro-purple)]">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-black text-[#1c1028]">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#6f617b]">{item.description}</p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--fibro-purple)]">
                Abrir
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </button>
          );
        })}
      </section>

      {currentUser?.role === 'viewer' && (
        <section className="rounded-[1.25rem] border border-[#ece7f3] bg-white p-6 text-sm text-[#6f617b] shadow-[0_12px_34px_rgba(47,20,80,0.05)]">
          Perfil consulta sem operacao. Use configuracoes ou validacao publica.
        </section>
      )}

      <section className="rounded-[1.25rem] border border-[#ece7f3] bg-[#fbf8fe] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a7a97]">Fluxo recomendado</p>
            <p className="mt-2 text-lg font-black text-[#1c1028]">Cadastrar, consultar, operar, imprimir.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasPermission(currentUser, 'viewOperations') && <Button type="button" onClick={() => setActiveTab('operacao')}>Aprovar cadastros</Button>}
            {hasPermission(currentUser, 'createRegistration') && <Button type="button" variant="outline" onClick={() => setActiveTab('cadastro')}>Novo cadastro</Button>}
            {hasPermission(currentUser, 'viewPeople') && <Button type="button" variant="outline" onClick={() => setActiveTab('pessoas')}>Consultar</Button>}
            {hasPermission(currentUser, 'printCarteirinha') && <Button type="button" variant="outline" onClick={() => setActiveTab('carteirinha')}>Imprimir</Button>}
          </div>
        </div>
      </section>
    </div>
  );
}
