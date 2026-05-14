import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

const SECTIONS = [
  {
    title: '1. Aceitacao dos termos',
    body: (
      <p className="mt-3">
        Ao usar a plataforma do programa CIPF, o usuario declara que compreende a finalidade
        administrativa do sistema e que fornecera apenas informacoes verdadeiras e atualizadas.
      </p>
    )
  },
  {
    title: '2. Sobre o servico',
    body: (
      <p className="mt-3">
        O CIPF e um servico publico municipal para cadastro, analise, emissao, renovacao,
        cancelamento e validacao da carteirinha da pessoa com fibromialgia.
      </p>
    )
  },
  {
    title: '3. Cadastro e veracidade',
    body: (
      <p className="mt-3">
        O titular ou representante legal responde pela exatidao das informacoes e dos documentos
        apresentados. Dados falsos, laudos indevidos ou uso de identidade de terceiro podem gerar
        cancelamento do registro e responsabilizacao administrativa, civil ou penal.
      </p>
    )
  },
  {
    title: '4. Uso adequado da plataforma',
    body: (
      <>
        <p className="mt-3">Nao e permitido:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6">
          <li>Usar a plataforma para fraude, teste destrutivo ou acesso indevido.</li>
          <li>Tentar contornar autenticacao, MFA, auditoria ou controles de permissao.</li>
          <li>Compartilhar credenciais institucionais com terceiros.</li>
          <li>Submeter documentos de outra pessoa sem representacao legitima.</li>
        </ul>
      </>
    )
  },
  {
    title: '5. Fluxo operacional',
    body: (
      <p className="mt-3">
        O cadastro entra em analise, pode ser aprovado e somente depois emitido. A carteirinha
        emitida tem validade padrao de 2 anos, sujeita a renovacao, cancelamento, segunda via ou
        arquivamento conforme o fluxo interno do programa.
      </p>
    )
  },
  {
    title: '6. Disponibilidade',
    body: (
      <p className="mt-3">
        A Secretaria busca manter a plataforma disponivel, mas pode realizar manutencoes, ajustes
        de seguranca ou indisponibilidades temporarias para proteger dados e continuidade do
        servico.
      </p>
    )
  },
  {
    title: '7. Privacidade e seguranca',
    body: (
      <p className="mt-3">
        O uso da plataforma tambem segue a Politica de Privacidade publicada no proprio sistema.
        Documentos e dados sensiveis devem ser tratados apenas dentro do fluxo oficial e em
        equipamento autorizado.
      </p>
    )
  },
  {
    title: '8. Alteracoes',
    body: (
      <p className="mt-3">
        Estes termos podem ser atualizados para refletir mudancas legais, tecnicas ou operacionais.
        A data da ultima revisao fica publicada nesta pagina.
      </p>
    )
  },
  {
    title: '9. Contato',
    body: (
      <p className="mt-3">
        Para duvidas sobre o servico:
        <br />
        <strong>E-mail:</strong>{' '}
        <a href="mailto:saude@ipero.sp.gov.br" className="text-[hsl(271_52%_32%)] hover:underline">
          saude@ipero.sp.gov.br
        </a>
        <br />
        <strong>Telefone:</strong> (15) 3266-2137
      </p>
    )
  }
];

export function Termos() {
  const setActiveTab = useAppStore((state) => state.setActiveTab);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="lovable-home min-h-screen bg-[hsl(30_25%_98%)] text-[hsl(270_25%_14%)]">
      <header className="border-b border-[hsl(270_15%_90%)]">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-end px-4 md:px-8">
          <button
            type="button"
            onClick={() => setActiveTab('inicio')}
            className="inline-flex items-center gap-2 text-sm text-[hsl(270_8%_42%)] transition hover:text-[hsl(270_25%_14%)]"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao inicio
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-16 md:px-8">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-[hsl(271_52%_32%)]">
          Termos de Uso
        </span>
        <h1 className="font-display mt-4 text-4xl font-semibold leading-tight md:text-5xl">
          Condicoes gerais do servico.
        </h1>
        <p className="mt-4 text-sm text-[hsl(270_8%_42%)]">Ultima atualizacao: 14 de maio de 2026</p>

        <div className="mt-12 space-y-10 leading-relaxed text-[hsl(270_25%_14%/0.85)]">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="font-display text-2xl font-semibold text-[hsl(270_25%_14%)]">
                {section.title}
              </h2>
              {section.body}
            </section>
          ))}
        </div>
      </main>

      <footer className="mt-12 border-t border-[hsl(270_15%_90%)] py-8">
        <div className="mx-auto max-w-[1240px] px-4 text-center text-xs text-[hsl(270_8%_42%)] md:px-8">
          (c) 2026 Secretaria Municipal de Saude - CIPF
        </div>
      </footer>
    </div>
  );
}
