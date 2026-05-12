import { Search, SlidersHorizontal } from 'lucide-react';
import type { RefObject } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { WORKFLOW_STATUS_OPTIONS } from '@/lib/registration-status';
import type { DashboardFiltersActions, DashboardFiltersState } from '../lib/types';
import type { ReviewFilter, StatusFilter } from '@/lib/dashboard-utils';

type Props = {
  filters: DashboardFiltersState;
  actions: DashboardFiltersActions;
  cidOptions: string[];
  bairroOptions: string[];
  searchInputRef: RefObject<HTMLInputElement>;
};

const QUICK_STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'under_review', label: 'Em análise' },
  { value: 'approved', label: 'Aprovadas' },
  { value: 'issued', label: 'Emitidas' },
  { value: 'expired', label: 'Vencidas' }
];

export function DashboardFilters({ filters, actions, cidOptions, bairroOptions, searchInputRef }: Props) {
  return (
    <div className="cipf-panel p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a6c86]" />
          <Input
            ref={searchInputRef}
            placeholder="Buscar por nome, CPF, Cartão SUS, CID ou bairro..."
            className="h-12 border-transparent bg-[#faf8fb] pl-10 pr-16 focus:border-[#d8c6e8] focus:bg-white"
            value={filters.searchTerm}
            onChange={(e) => actions.setSearchTerm(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                document.getElementById('dashboard-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-[#e4ddea] bg-white px-2 py-0.5 text-[10px] font-bold text-[#6f617b] lg:block">
            Ctrl K
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {QUICK_STATUS_OPTIONS.map((option) => {
            const active = filters.statusFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => actions.setStatusFilter(option.value)}
                className={`h-9 rounded-lg border px-4 text-sm font-medium ${
                  active
                    ? 'border-[var(--fibro-purple)] bg-[var(--fibro-purple)] text-white'
                    : 'border-[#e4ddea] bg-white text-[#6f617b] hover:border-[#cdb8df] hover:text-[var(--fibro-purple)]'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[#ece7f3] pt-4 sm:grid-cols-2 lg:grid-cols-5">
        <select value={filters.cidFilter} onChange={(e) => actions.setCidFilter(e.target.value)} className="text-sm">
          {cidOptions.map((cid) => <option key={cid} value={cid}>{cid === 'all' ? 'CID: Todos' : `CID: ${cid}`}</option>)}
        </select>
        <select value={filters.bairroFilter} onChange={(e) => actions.setBairroFilter(e.target.value)} className="text-sm">
          {bairroOptions.map((bairro) => <option key={bairro} value={bairro}>{bairro === 'all' ? 'Bairro: Todos' : bairro}</option>)}
        </select>
        <select value={filters.expiryFilter} onChange={(e) => actions.setExpiryFilter(e.target.value as 'all' | 'expiring30')} className="text-sm">
          <option value="all">Validade: Todas</option>
          <option value="expiring30">Vencendo em 30 dias</option>
        </select>
        <select value={filters.reviewFilter} onChange={(e) => actions.setReviewFilter(e.target.value as ReviewFilter)} className="text-sm">
          <option value="all">Revisão: normal</option>
          <option value="document_issues">Pendências documentais</option>
          <option value="archived">Arquivados</option>
        </select>
        <Button type="button" variant="outline" onClick={actions.clearFilters} className="h-11 whitespace-nowrap">
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Limpar filtros
        </Button>
      </div>

      <select value={filters.statusFilter} onChange={(e) => actions.setStatusFilter(e.target.value as StatusFilter)} className="sr-only">
        <option value="all">Status: Todos</option>
        {WORKFLOW_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}
