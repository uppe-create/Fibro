import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

const SECTIONS = [
  {
    title: '1. Introdução',
    body: (
      <p className="mt-3">
        A Secretaria Municipal de Saúde, responsável pelo programa CIPF - Carteirinha de
        Identificação da Pessoa com Fibromialgia, está comprometida com a proteção dos dados
        pessoais de seus usuários. Esta Política de Privacidade descreve como coletamos,
        utilizamos, armazenamos e protegemos suas informações, em conformidade com a Lei Geral
        de Proteção de Dados Pessoais (Lei nº 13.709/2018 - LGPD).
      </p>
    )
  },
  {
    title: '2. Dados que coletamos',
    body: (
      <>
        <p className="mt-3">
          Coletamos apenas os dados necessários para a finalidade de emissão da carteirinha e
          prestação dos serviços vinculados ao programa, incluindo:
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6">
          <li>Dados de identificação: nome completo, RG, CPF e data de nascimento.</li>
          <li>Dados de contato: e-mail, telefone e endereço.</li>
          <li>Dados de saúde: laudo médico e CID relacionado à fibromialgia.</li>
          <li>Dados de uso: registros de acesso, IP e informações técnicas do dispositivo.</li>
        </ul>
      </>
    )
  },
  {
    title: '3. Finalidade do tratamento',
    body: (
      <>
        <p className="mt-3">Seus dados são utilizados para:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6">
          <li>Análise e emissão da carteirinha de identificação.</li>
          <li>Comunicação sobre o status do cadastro e renovações.</li>
          <li>Cumprimento de obrigações legais e regulatórias.</li>
          <li>Produção de estatísticas anonimizadas sobre o programa.</li>
        </ul>
      </>
    )
  },
  {
    title: '4. Base legal (LGPD)',
    body: (
      <p className="mt-3">
        O tratamento dos dados é realizado com base nas seguintes hipóteses do art. 7º e art.
        11 da LGPD: cumprimento de obrigação legal, execução de políticas públicas e, no que se
        refere a dados sensíveis de saúde, mediante consentimento expresso do titular ou para a
        tutela da saúde.
      </p>
    )
  },
  {
    title: '5. Compartilhamento',
    body: (
      <p className="mt-3">
        Não comercializamos dados pessoais. O compartilhamento ocorre apenas com órgãos públicos
        parceiros, mediante convênio, e sempre limitado ao mínimo necessário para a finalidade do
        programa. Eventualmente podem ser compartilhados em razão de obrigação legal ou ordem
        judicial.
      </p>
    )
  },
  {
    title: '6. Armazenamento e segurança',
    body: (
      <p className="mt-3">
        Os dados são armazenados em ambientes controlados, com medidas técnicas e administrativas
        adequadas para protegê-los contra acessos não autorizados, destruição, perda, alteração
        ou qualquer forma de tratamento inadequado.
      </p>
    )
  },
  {
    title: '7. Direitos do titular',
    body: (
      <>
        <p className="mt-3">Você tem o direito de, a qualquer momento:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6">
          <li>Confirmar a existência de tratamento de seus dados.</li>
          <li>Acessar, corrigir ou atualizar seus dados.</li>
          <li>Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários.</li>
          <li>Revogar o consentimento, quando aplicável.</li>
          <li>Solicitar a portabilidade dos dados.</li>
        </ul>
        <p className="mt-3">
          Para exercer seus direitos, entre em contato pelo e-mail{' '}
          <a href="mailto:saude@ipero.sp.gov.br" className="text-[hsl(271_52%_32%)] hover:underline">
            saude@ipero.sp.gov.br
          </a>
          .
        </p>
      </>
    )
  },
  {
    title: '8. Cookies',
    body: (
      <p className="mt-3">
        Utilizamos cookies estritamente necessários para o funcionamento da plataforma, bem como
        cookies de medição para entender o uso do serviço e aprimorá-lo. Você pode gerenciar
        cookies nas configurações do seu navegador.
      </p>
    )
  },
  {
    title: '9. Alterações nesta política',
    body: (
      <p className="mt-3">
        Esta política pode ser atualizada periodicamente. Recomendamos a revisão regular desta
        página. Alterações significativas serão comunicadas pelos canais oficiais do programa.
      </p>
    )
  },
  {
    title: '10. Contato do Encarregado (DPO)',
    body: (
      <p className="mt-3">
        Para dúvidas sobre proteção de dados, entre em contato:
        <br />
        <strong>E-mail:</strong>{' '}
        <a href="mailto:saude@ipero.sp.gov.br" className="text-[hsl(271_52%_32%)] hover:underline">
          saude@ipero.sp.gov.br
        </a>
        <br />
        <strong>Telefone:</strong> (15) 3266-2137
        <br />
        <strong>Endereço:</strong> Av. Santa Cruz, nº 300 - Jardim Irene
      </p>
    )
  }
];

export function Privacidade() {
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
          Política de Privacidade
        </span>
        <h1 className="font-display mt-4 text-4xl font-semibold leading-tight md:text-5xl">
          Como tratamos seus dados.
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
