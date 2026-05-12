import React from 'react';
import { Home as HomeIcon, QrCode, type LucideIcon } from 'lucide-react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AppUser } from '@/store/useAppStore';

type NavItem = {
  value: string;
  label: string;
  icon: LucideIcon;
};

type NavigationTabsProps = {
  activeTab: string;
  currentUser: AppUser | null;
  setActiveTab: (tab: string) => void;
};

const NAV_ITEMS: NavItem[] = [
  { value: 'inicio', label: 'Início', icon: HomeIcon },
  { value: 'validar', label: 'Validar', icon: QrCode }
];

export function NavigationTabs({ activeTab, currentUser, setActiveTab }: NavigationTabsProps) {
  const navItems = currentUser ? [] : NAV_ITEMS;
  const primaryMobileItems = navItems;

  const selectTab = (value: string) => {
    setActiveTab(value);
  };

  return (
    <nav className="min-w-0 flex-1 xl:flex xl:justify-center" aria-label="Navegação principal">
      <div className="xl:hidden">
        <TabsList className="grid h-auto grid-cols-2 gap-1 rounded-none bg-transparent p-0">
          {primaryMobileItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => selectTab(item.value)}
                className={`flex h-11 flex-col items-center justify-center gap-1 rounded-md bg-transparent px-1 text-[11px] transition ${
                  activeTab === item.value ? 'bg-[hsl(271_52%_32%/0.08)] text-[hsl(271_52%_32%)]' : 'text-[hsl(270_8%_42%)] hover:bg-[hsl(270_15%_96%)] hover:text-[hsl(270_25%_14%)]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </TabsList>
      </div>

      <div className="hidden min-w-0 xl:block">
        <TabsList className="h-auto max-w-full min-w-0 justify-center gap-6 overflow-x-auto rounded-none bg-transparent p-0 2xl:gap-7">
          {navItems.map((item) => (
            <React.Fragment key={item.value}>
              <TabsTrigger
                value={item.value}
                className="h-10 shrink-0 rounded-md bg-transparent px-0 text-sm font-medium text-[hsl(270_25%_14%/0.70)] shadow-none transition hover:bg-transparent hover:text-[hsl(270_25%_14%)] data-[state=active]:bg-transparent data-[state=active]:text-[hsl(271_52%_32%)] data-[state=active]:shadow-none"
              >
                {item.label}
              </TabsTrigger>
            </React.Fragment>
          ))}
        </TabsList>
      </div>
    </nav>
  );
}
