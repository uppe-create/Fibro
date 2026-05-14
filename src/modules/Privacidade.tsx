import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

const SECTIONS = [
  {
    title: '1. Introducao',
    body: (
      <p className="mt-3">
        A Secretaria Municipal de Saude, responsavel pelo programa CIPF, trata dados pessoais para
        cadastrar, analisar, emitir, renovar, cancelar e validar a carteirinha municipal da
        pessoa com fibromialgia. Esta pagina resume as praticas tecnicas atualmente implementadas
        na plataforma.
      </p>
    )
  },
  {
    title: '2. Dados tratados',
    body: (
      <>
        <p className="mt-3">A plataforma trata apenas dados necessarios para a operacao do programa:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6">
          <li>Identificacao: nome, CPF, RG, data de nascimento e dados do responsavel legal quando houver.</li>
          <li>Contato e endereco: telefone, CEP, logradouro, bairro, cidade e estado.</li>
          <li>Saude: laudo medico, CID, CRM e datas documentais exigidas pelo fluxo.</li>
          <li>Arquivos: foto, documento oficial, comprovante de residencia e laudo medico.</li>
          <li>Seguranca e auditoria: usuario autenticado, IP, data, acao, motivo e metadados operacionais.</li>
        </ul>
      </>
    )
  },
  {
    title: '3. Finalidade do tratamento',
    body: (
      <>
        <p className="mt-3">Os dados sao usados para:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6">
          <li>Receber e analisar pedidos da carteirinha.</li>
          <li>Emitir, renovar, reemitir, cancelar e arquivar registros.</li>
          <li>Validar publicamente a autenticidade da carteirinha com exibicao minima de dados.</li>
          <li>Registrar historico operacional e eventos sensiveis para seguranca e rastreabilidade.</li>
          <li>Atender exigencias legais, administrativas e de controle interno do programa.</li>
        </ul>
      </>
    )
  },
  {
    title: '4. Base legal',
    body: (
      <p className="mt-3">
        O tratamento segue as hipoteses legais aplicaveis ao Poder Publico, em especial execucao
        de politica publica, cumprimento de atribuicoes legais e tutela da saude, conforme arts.
        7, 11 e 23 da LGPD. Esta pagina nao substitui parecer juridico formal do Municipio.
      </p>
    )
  },
  {
    title: '5. Divulgacao publica minima',
    body: (
      <p className="mt-3">
        A validacao publica nao consulta diretamente o cadastro interno. Ela usa funcao dedicada e
        exibe somente nome, CPF mascarado, datas da carteirinha, status e codigo visual de
        validacao quando o documento esta emitido e valido.
      </p>
    )
  },
  {
    title: '6. Compartilhamento e operadores',
    body: (
      <>
        <p className="mt-3">Os dados podem ser processados por operadores e servicos de apoio estritamente necessarios ao sistema, como:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6">
          <li>Supabase para autenticacao, banco, funcoes seguras e armazenamento privado de arquivos.</li>
          <li>Firebase Hosting para publicacao do frontend.</li>
          <li>ViaCEP quando ha consulta manual de CEP no cadastro.</li>
          <li>WhatsApp Web apenas quando a equipe opta por abrir mensagem operacional para contato com o titular.</li>
        </ul>
        <p className="mt-3">
          Fora dessas hipoteses, compartilhamento depende de previsao legal, determinacao da
          autoridade competente ou necessidade administrativa formalmente justificada.
        </p>
      </>
    )
  },
  {
    title: '7. Armazenamento e seguranca',
    body: (
      <>
        <p className="mt-3">A plataforma adota controles tecnicos e administrativos, incluindo:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6">
          <li>MFA para administradores, com degradacao para perfil seguro quando `aal2` nao esta presente.</li>
          <li>Bucket privado para documentos e URLs assinadas de curta duracao.</li>
          <li>Validacao de tamanho, extensao, MIME e assinatura basica dos arquivos enviados.</li>
          <li>Rate limit na validacao publica e auditoria de eventos sensiveis.</li>
          <li>Controle de acesso por papel e bloqueio de rotas internas.</li>
        </ul>
      </>
    )
  },
  {
    title: '8. Sessao e navegador',
    body: (
      <p className="mt-3">
        Nao usamos cookies de medicao ou publicidade nesta implementacao. O navegador pode manter
        apenas dados tecnicos necessarios para sessao, navegacao interna e preferencia operacional.
        Rascunho sensivel em navegador permanece desativado por padrao.
      </p>
    )
  },
  {
    title: '9. Retencao',
    body: (
      <p className="mt-3">
        Registros e documentos permanecem armazenados enquanto forem necessarios para a execucao do
        programa, auditoria e cumprimento de obrigacoes legais. No estado atual, arquivamento e
        cancelamento sao logicos. Politica formal de retencao por prazo ainda deve ser aprovada
        pelo Municipio.
      </p>
    )
  },
  {
    title: '10. Direitos do titular',
    body: (
      <>
        <p className="mt-3">Pedidos relacionados a confirmacao, acesso, correcao e demais direitos previstos na LGPD podem ser enviados ao canal oficial do programa.</p>
        <p className="mt-3">
          A resposta observa os limites legais aplicaveis ao Poder Publico, a necessidade de
          identificacao do solicitante e a situacao administrativa do registro.
        </p>
      </>
    )
  },
  {
    title: '11. Incidentes',
    body: (
      <p className="mt-3">
        Em caso de incidente de seguranca com risco ou dano relevante, o Municipio deve seguir o
        fluxo interno de resposta, registro e avaliacao, com comunicacao a ANPD e ao titular quando
        a LGPD assim exigir.
      </p>
    )
  },
  {
    title: '12. Canal de privacidade',
    body: (
      <p className="mt-3">
        Para assuntos de privacidade e atendimento do programa:
        <br />
        <strong>E-mail:</strong>{' '}
        <a href="mailto:saude@ipero.sp.gov.br" className="text-[hsl(271_52%_32%)] hover:underline">
          saude@ipero.sp.gov.br
        </a>
        <br />
        <strong>Telefone:</strong> (15) 3266-2137
        <br />
        <strong>Endereco:</strong> Av. Santa Cruz, no 300 - Jardim Irene
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
            <ArrowLeft className="h-4 w-4" /> Voltar ao inicio
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-16 md:px-8">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-[hsl(271_52%_32%)]">
          Politica de Privacidade
        </span>
        <h1 className="font-display mt-4 text-4xl font-semibold leading-tight md:text-5xl">
          Como tratamos seus dados.
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
