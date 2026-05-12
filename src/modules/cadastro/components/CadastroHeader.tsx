import { Button } from '@/components/ui/button';

type CadastroHeaderProps = {
  draftSavedAt: number | null;
  draftRestored: boolean;
  onDiscardDraft: () => void;
};

export function CadastroHeader({ draftSavedAt, draftRestored, onDiscardDraft }: CadastroHeaderProps) {
  return (
    <div className="cipf-page-header-card">
      <div>
        <p className="cipf-kicker">Cadastro presencial</p>
        <h2 className="cipf-title mt-2 text-3xl">Nova Emissão de CIPF</h2>
        <p className="cipf-description mt-2 text-base">
          Preencha os dados para solicitar a Carteira de Identificação da Pessoa com Fibromialgia.
        </p>
      </div>
      {(draftSavedAt || draftRestored) && (
        <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">{draftRestored ? 'Rascunho recuperado automaticamente' : 'Rascunho salvo automaticamente'}</p>
            <p className="mt-1">
              Rascunho temporário desta aba. Não use em computadores compartilhados sem supervisão.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={onDiscardDraft} className="shrink-0 border-amber-300 bg-white" size="sm">
            Descartar rascunho
          </Button>
        </div>
      )}
    </div>
  );
}
