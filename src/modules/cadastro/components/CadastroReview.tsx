import { AlertCircle } from 'lucide-react';
import type { ReviewItem } from '@/modules/cadastro/lib/review';

type ChecklistItem = {
  label: string;
  ok: boolean;
};

type CadastroReviewProps = {
  warnings: string[];
  checklist: ChecklistItem[];
  items: ReviewItem[];
};

export function CadastroReview({ warnings, checklist, items }: CadastroReviewProps) {
  return (
    <div className="wizard-section wizard-step-4 pb-4">
      <div className="mb-6 rounded-2xl border border-[#b9d7c7] bg-[#edf7f1] p-4 text-sm text-[#166534]">
        Confira os dados antes de salvar. Se algo estiver errado, volte para a etapa correspondente.
      </div>

      {warnings.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="mb-2 font-black">Pontos para conferência antes de salvar</p>
          <ul className="space-y-1">
            {warnings.map((warning) => (
              <li key={warning} className="flex gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-[#e3e9ef] bg-white p-4">
        <p className="mb-3 text-sm font-black text-[#17324d]">Checklist vivo de conferência</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {checklist.map((item) => (
            <div
              key={item.label}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                item.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              {item.ok ? 'OK' : 'Atenção'} • {item.label}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[#e3e9ef] bg-[#f8fafc] p-4">
            <p className="text-xs font-black uppercase tracking-wide text-[#617184]">{label}</p>
            <p className="mt-1 break-words font-semibold text-[#17324d]">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
