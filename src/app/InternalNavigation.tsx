import {
  Activity,
  ClipboardCheck,
  ClipboardList,
  ClipboardPlus,
  FileWarning,
  Home,
  IdCard,
  PackageCheck,
  Settings,
  Shield,
  Users,
  type LucideIcon
} from 'lucide-react';
import { hasPermission, type Permission } from '@/lib/permissions';
import type { AppUser } from '@/store/useAppStore';

type InternalNavigationProps = {
  activeTab: string;
  currentUser: AppUser;
  onSelect: (tab: string) => void;
};

type InternalItem = {
  value: string;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
};

type InternalSection = {
  label: string;
  items: InternalItem[];
};

const INTERNAL_SECTIONS: InternalSection[] = [
  {
    label: 'Painel',
    items: [
      { value: 'dashboard', label: 'Painel', icon: Home, permission: 'viewDashboard' },
      { value: 'pessoas', label: 'Cadastros', icon: Users, permission: 'viewPeople' },
      { value: 'cadastro', label: 'Novo cadastro', icon: ClipboardPlus, permission: 'createRegistration' }
    ]
  },
  {
    label: 'Operacao',
    items: [
      { value: 'operacao', label: 'Operacao', icon: ClipboardCheck, permission: 'viewOperations' },
      { value: 'documentos', label: 'Documentos', icon: FileWarning, permission: 'viewDocumentsQueue' },
      { value: 'retiradas', label: 'Retiradas', icon: PackageCheck, permission: 'viewPickupQueue' },
      { value: 'carteirinha', label: 'Carteirinha', icon: IdCard, permission: 'printCarteirinha' }
    ]
  },
  {
    label: 'Controle',
    items: [
      { value: 'relatorios', label: 'Relatorios', icon: ClipboardList, permission: 'viewReports' },
      { value: 'auditoria', label: 'Auditoria', icon: Activity, permission: 'viewAudit' },
      { value: 'configuracoes', label: 'Configuracoes', icon: Settings, permission: 'viewSettings' }
    ]
  }
];

function getVisibleSections(currentUser: AppUser) {
  if (currentUser.role === 'viewer') {
    return [
      {
        label: 'Acesso',
        items: [{ value: 'configuracoes', label: 'Configuracoes', icon: Settings, permission: 'viewSettings' }]
      }
    ];
  }

  return INTERNAL_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.permission || hasPermission(currentUser, item.permission))
  })).filter((section) => section.items.length > 0);
}

export function InternalNavigation({ activeTab, currentUser, onSelect }: InternalNavigationProps) {
  const sections = getVisibleSections(currentUser);

  return (
    <>
      <aside className="hidden w-72 shrink-0 lg:block">
        <div className="sticky top-24 space-y-5 rounded-[1.5rem] border border-[#ebe4f2] bg-white p-5 shadow-[0_18px_45px_rgba(47,20,80,0.08)]">
          <div className="rounded-2xl bg-[#f7f1fb] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--fibro-purple)] text-white">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#876d9f]">Area interna</p>
                <p className="text-sm font-black text-[#1c1028]">{currentUser.role === 'admin' ? 'Administrador' : currentUser.role === 'attendant' ? 'Atendente' : 'Consulta'}</p>
              </div>
            </div>
          </div>

          {sections.map((section) => (
            <div key={section.label}>
              <p className="mb-2 px-3 text-[11px] font-black uppercase tracking-[0.18em] text-[#8a7a97]">{section.label}</p>
              <div className="space-y-1.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => onSelect(item.value)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${
                        active
                          ? 'bg-[var(--fibro-purple)] text-white shadow-[0_14px_30px_rgba(92,38,133,0.22)]'
                          : 'text-[#5d5068] hover:bg-[#f5effa] hover:text-[#261735]'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${active ? 'text-white' : 'text-[var(--fibro-purple)]'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <div className="w-full lg:hidden">
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max gap-2">
            {sections.flatMap((section) => section.items).map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => onSelect(item.value)}
                className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${
                  activeTab === item.value
                    ? 'border-[var(--fibro-purple)] bg-[var(--fibro-purple)] text-white'
                    : 'border-[#e7dfef] bg-white text-[#5d5068]'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
