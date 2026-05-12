import { Eye, Keyboard, MousePointerClick, ShieldCheck, Type } from 'lucide-react';
import { PageHeader } from '@/components/ui/layout';

const ACCESSIBILITY_ITEMS = [
  {
    icon: Type,
    title: 'Texto legível',
    description: 'Use o zoom do navegador para aumentar textos e campos. O layout acompanha sem quebrar.'
  },
  {
    icon: Keyboard,
    title: 'Navegação por teclado',
    description: 'Use Tab para avançar, Enter para acionar botões e Esc para fechar modais quando disponíveis.'
  },
  {
    icon: Eye,
    title: 'Contraste',
    description: 'Cores principais foram escolhidas para leitura em telas comuns e ambientes de atendimento.'
  },
  {
    icon: MousePointerClick,
    title: 'Áreas clicáveis',
    description: 'Botões e campos mantêm altura confortável para mouse, toque e uso assistido.'
  }
];

export function Acessibilidade() {
  return (
    <div className="cipf-page cipf-page-stack mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Início / Acessibilidade"
        title="Acessibilidade"
        description="Recursos e orientações para usar o sistema com mais conforto no atendimento e na validação pública."
        tone="purple"
      />

      <div className="grid gap-4 md:grid-cols-2">
        {ACCESSIBILITY_ITEMS.map((item) => {
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

      <div className="cipf-subpanel p-5 text-sm leading-6 text-[#6f617b]">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--fibro-purple)]" />
          <p>
            Em caso de dificuldade de acesso, procure o suporte da Secretaria de Saúde. Não envie CPF, laudo ou documentos por canais não oficiais.
          </p>
        </div>
      </div>
    </div>
  );
}
