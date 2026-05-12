import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

const SECTIONS = [
  {
    title: '1. Aceitação dos termos',
    body: (
      <p className="mt-3">
        Ao acessar e utilizar a plataforma do programa CIPF, você declara ter lido, compreendido
        e concordado com estes Termos de Uso, bem como com a Política de Privacidade. Caso não
        concorde com qualquer disposição, recomendamos que não utilize o serviço.
      </p>
    )
  },
  {
    title: '2. Sobre o serviço',
    body: (
      <p className="mt-3">
        O CIPF - Carteirinha de Identificação da Pessoa com Fibromialgia - é um serviço público
        gratuito oferecido pela Secretaria Municipal de Saúde, com base na Lei Municipal nº
        8.452/2024. Tem por finalidade emitir documento oficial de identificação e garantir o
        atendimento prioritário previsto em lei.
      </p>
    )
  },
  {
    title: '3. Cadastro e veracidade das informações',
    body: (
      <p className="mt-3">
        O usuário é responsável pela exatidão, veracidade e atualização das informações
        fornecidas. A apresentação de dados ou laudos falsos pode acarretar o cancelamento do
        cadastro e responsabilização nas esferas civil e criminal, conforme art. 299 do Código
        Penal.
      </p>
    )
  },
  {
    title: '4. Uso adequado da plataforma',
    body: (
      <>
        <p className="mt-3">É vedado ao usuário:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6">
          <li>Utilizar a plataforma para fins ilícitos ou fraudulentos.</li>
          <li>Tentar burlar mecanismos de segurança ou autenticação.</li>
          <li>Reproduzir, copiar ou distribuir conteúdo da plataforma sem autorização.</li>
          <li>Criar perfis em nome de terceiros sem o devido consentimento.</li>
        </ul>
      </>
    )
  },
  {
    title: '5. Propriedade intelectual',
    body: (
      <p className="mt-3">
        Todo o conteúdo da plataforma - incluindo marca, logotipos, textos, layout e software -
        é de titularidade da Secretaria Municipal de Saúde ou de seus licenciantes. É proibida a
        sua reprodução total ou parcial sem autorização expressa.
      </p>
    )
  },
  {
    title: '6. Validade da carteirinha',
    body: (
      <p className="mt-3">
        A carteirinha emitida tem validade de 5 (cinco) anos, podendo ser renovada digitalmente.
        A revogação pode ocorrer em casos de fraude, descumprimento destes Termos ou por
        solicitação do próprio titular.
      </p>
    )
  },
  {
    title: '7. Disponibilidade do serviço',
    body: (
      <p className="mt-3">
        Empenhamo-nos para manter a plataforma disponível continuamente, mas não garantimos
        ausência total de interrupções. Eventuais manutenções programadas serão comunicadas com
        antecedência sempre que possível.
      </p>
    )
  },
  {
    title: '8. Limitação de responsabilidade',
    body: (
      <p className="mt-3">
        A Secretaria não se responsabiliza por danos decorrentes do uso indevido da plataforma,
        falhas de conexão de responsabilidade do usuário ou de terceiros, ou por informações
        fornecidas incorretamente pelo próprio titular.
      </p>
    )
  },
  {
    title: '9. Alterações dos termos',
    body: (
      <p className="mt-3">
        Estes Termos podem ser modificados a qualquer momento, sendo a data da última atualização
        sempre indicada no topo desta página. O uso contínuo do serviço após alterações implica
        concordância com a nova versão.
      </p>
    )
  },
  {
    title: '10. Lei aplicável e foro',
    body: (
      <p className="mt-3">
        Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro
        da comarca da sede do município para dirimir quaisquer controvérsias, com renúncia a
        qualquer outro, por mais privilegiado que seja.
      </p>
    )
  },
  {
    title: '11. Contato',
    body: (
      <p className="mt-3">
        Em caso de dúvidas sobre estes Termos:
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
            <ArrowLeft className="h-4 w-4" /> Voltar ao início
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-16 md:px-8">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-[hsl(271_52%_32%)]">
          Termos de Uso
        </span>
        <h1 className="font-display mt-4 text-4xl font-semibold leading-tight md:text-5xl">
          Condições gerais do serviço.
        </h1>
        <p className="mt-4 text-sm text-[hsl(270_8%_42%)]">Última atualização: 8 de maio de 2026</p>

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
          © 2026 Secretaria Municipal de Saúde · CIPF
        </div>
      </footer>
    </div>
  );
}
