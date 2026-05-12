import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type CadastroFormActionsProps = {
  submitError: string;
  isSubmitting: boolean;
  uploadStep: string;
  overallUploadProgress: number;
  currentStep: number;
  isReviewStep: boolean;
  onPrevious: () => void;
  onNext: () => void;
};

export function CadastroFormActions({
  submitError,
  isSubmitting,
  uploadStep,
  overallUploadProgress,
  currentStep,
  isReviewStep,
  onPrevious,
  onNext
}: CadastroFormActionsProps) {
  return (
    <div className="flex flex-col items-end gap-4 pt-6">
      {submitError && (
        <div className="flex w-full animate-in items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-left fade-in">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-red-800">Erro ao salvar</h4>
            <p className="mt-1 text-sm text-red-600">{submitError}</p>
          </div>
        </div>
      )}
      {isSubmitting && (
        <div className="w-full rounded-xl border border-blue-100 bg-blue-50/60 p-3">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-blue-700">
            <span>{uploadStep || 'Processando cadastro...'}</span>
            <span>{overallUploadProgress}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100">
            <div className="h-2 bg-blue-600 transition-all duration-300" style={{ width: `${overallUploadProgress}%` }} />
          </div>
        </div>
      )}
      <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" disabled={isSubmitting || currentStep === 0} onClick={onPrevious} className="h-12 rounded-xl px-8">
          Voltar
        </Button>
        {!isReviewStep ? (
          <Button type="button" onClick={onNext} className="h-12 rounded-xl bg-blue-600 px-10 text-white hover:bg-blue-700">
            Continuar
          </Button>
        ) : (
          <Button type="submit" disabled={isSubmitting} className="h-12 rounded-xl bg-blue-600 px-10 font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70">
            {isSubmitting ? (
              <div className="flex items-center">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Enviando...
              </div>
            ) : (
              'Confirmar e registrar CIPF'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
