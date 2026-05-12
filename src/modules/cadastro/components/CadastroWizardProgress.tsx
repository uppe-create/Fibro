import type { FormData } from '@/lib/cadastro-utils';

type CadastroStep = {
  title: string;
  description: string;
  fields: Array<keyof FormData>;
};

type CadastroWizardProgressProps = {
  steps: CadastroStep[];
  currentStep: number;
  progressPercent: number;
  onStepClick: (step: number) => void;
};

export function CadastroWizardProgress({ steps, currentStep, progressPercent, onStepClick }: CadastroWizardProgressProps) {
  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="font-semibold text-[#17324d]">
          Etapa {currentStep + 1} de {steps.length}: {steps[currentStep].title}
        </span>
        <span className="font-semibold text-[#617184]">{progressPercent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#e3e9ef]">
        <div className="h-2 rounded-full bg-[#7b2cbf] transition-all duration-300" style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-5">
        {steps.map((step, index) => (
          <button
            key={step.title}
            type="button"
            onClick={() => index < currentStep && onStepClick(index)}
            className={`border px-3 py-2 text-left ${
              index === currentStep
                ? 'border-[#155c9c] bg-[#eaf3fb] text-[#17324d]'
                : index < currentStep
                  ? 'border-[#b9d7c7] bg-[#edf7f1] text-[#166534]'
                  : 'border-[#d9e1ea] bg-white text-[#617184]'
            }`}
          >
            <span className="block text-xs font-black uppercase tracking-wide">{step.title}</span>
            <span className="hidden text-[11px] sm:block">{step.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
