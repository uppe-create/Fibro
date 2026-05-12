import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type CadastroSuccessProps = {
  data: {
    fullName: string;
    cpf: string;
    cns?: string;
  };
  onNewRegistration: () => void;
};

export function CadastroSuccess({ data, onNewRegistration }: CadastroSuccessProps) {
  return (
    <div className="mx-auto max-w-2xl animate-in fade-in zoom-in-95 duration-500">
      <div className="overflow-hidden rounded-3xl border border-white/20 bg-white/80 p-10 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-50">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
        </div>
        <h2 className="mb-2 text-2xl font-semibold tracking-tight text-[#1D1D1F]">Cadastro Realizado com Sucesso!</h2>
        <p className="mb-8 text-[#5E6B7A]">
          A solicitacao da Carteirinha de Fibromialgia foi registrada e enviada para analise.
        </p>
        <div className="mb-8 rounded-2xl border border-gray-100/50 bg-gray-50/50 p-6 text-left">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#5E6B7A]">Detalhes do Registro</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-[#5E6B7A]">Titular</p>
              <p className="font-medium text-[#1D1D1F]">{data.fullName}</p>
            </div>
            <div>
              <p className="text-xs text-[#5E6B7A]">CPF</p>
              <p className="font-medium text-[#1D1D1F]">{data.cpf}</p>
            </div>
            {data.cns && (
              <div>
                <p className="text-xs text-[#5E6B7A]">Cartao SUS</p>
                <p className="font-medium text-[#1D1D1F]">{data.cns}</p>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-6">
          <p className="text-sm text-[#1D1D1F]">
            <strong className="font-semibold">Proximos passos:</strong> um atendente ou administrador deve aprovar o cadastro.
            Apenas o administrador podera emitir e imprimir a carteirinha depois da aprovacao.
          </p>
          <Button
            onClick={onNewRegistration}
            className="h-12 w-full rounded-xl bg-blue-600 px-8 font-medium text-white hover:bg-blue-700 sm:w-auto"
          >
            Cadastrar Novo Beneficiario
          </Button>
        </div>
      </div>
    </div>
  );
}
