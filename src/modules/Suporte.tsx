import { AlertTriangle, FileQuestion, LifeBuoy, Mail, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/layout';

const SUPPORT_ITEMS = [
  {
    icon: FileQuestion,
    title: 'Problema no cadastro',
    description: 'Confira campos obrigatórios, formato do CPF/CNS e anexos antes de tentar enviar novamente.'
  },
  {
    icon: ShieldCheck,
    title: 'Validação pública',
    description: 'Use uma imagem nítida do QR Code ou informe o código manual impresso na carteirinha.'
  },
  {
    icon: AlertTriangle,
    title: 'Erro de acesso',
    description: 'Sessões expiram por segurança. Faça login novamente e evite compartilhar usuário ou senha.'
  }
];

export function Suporte() {
  return (
    <div className="cipf-page cipf-page-stack mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Início / Suporte"
        title="Suporte"
        description="Ajuda rápida para operação do sistema, validação de carteirinhas e problemas comuns."
        tone="purple"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {SUPPORT_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <section key={item.title} className="cipf-panel p-5">
              <Icon className="mb-4 h-6 w-6 text-[var(--fibro-purple)]" />
              <h3 className="text-lg font-black text-[#170b24]">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#6f617b]">{item.description}</p>
            </section>
          );
        })}
      </div>

      <section className="cipf-panel p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#f1eaf8] text-[var(--fibro-purple)]">
            <LifeBuoy className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-[#170b24]">Contato oficial</h3>
            <p className="mt-1 text-sm leading-6 text-[#6f617b]">
              Use apenas canais oficiais da Prefeitura ou Secretaria de Saúde para solicitar suporte operacional.
            </p>
          </div>
        </div>
        <div className="mt-5 rounded-lg border border-[#ece7f3] bg-[#faf8fb] p-4 text-sm text-[#6f617b]">
          <p className="flex items-center gap-2 font-bold text-[#170b24]">
            <Mail className="h-4 w-4 text-[var(--fibro-purple)]" />
            Antes de enviar chamado
          </p>
          <p className="mt-2">Informe tela, horário aproximado, ação feita e mensagem exibida. Não envie documentos médicos por e-mail ou mensagem comum.</p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-[#ece7f3] bg-white p-4 text-sm text-[#6f617b]">
            <p className="font-bold text-[#170b24]">Atendimento em Iperó</p>
            <p className="mt-2">Av. Santa Cruz, nº 300, Jardim Irene</p>
            <p>Segunda à Sexta-Feira, das 8 às 16 horas</p>
          </div>
          <div className="rounded-lg border border-[#ece7f3] bg-white p-4 text-sm text-[#6f617b]">
            <p className="font-bold text-[#170b24]">Canais oficiais</p>
            <p className="mt-2">Telefone: 15 3266-2137</p>
            <p>E-mail: saude@ipero.sp.gov.br</p>
          </div>
        </div>
      </section>
    </div>
  );
}
