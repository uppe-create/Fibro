import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Accessibility,
  ArrowRight,
  ChevronDown,
  Clock,
  FileText,
  Hospital,
  QrCode,
  ShieldCheck,
  Sparkles,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchHomeMetrics, formatMetricValue, HOME_METRICS_FALLBACK } from '@/lib/public-home-metrics';
import { getRuntimeCompat } from '@/lib/runtime-compat';
import { useAppStore } from '@/store/useAppStore';
import heroImg from '@/assets/landing-hero.jpg';

const PUBLIC_HOME_SECTION_STORAGE_KEY = 'cipf_public_home_section';

function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number; key?: string }) {
  const compat = getRuntimeCompat();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(compat.preferReducedEffects);

  useEffect(() => {
    if (compat.preferReducedEffects) return;
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [compat.preferReducedEffects]);

  if (compat.preferReducedEffects) {
    return <div className="reveal-safe">{children}</div>;
  }

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`reveal-safe transition-all duration-700 ease-out ${visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}
    >
      {children}
    </div>
  );
}

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export function Home() {
  const compat = getRuntimeCompat();
  const { setActiveTab } = useAppStore();
  const [mounted, setMounted] = useState(compat.preferReducedEffects);
  const [metrics, setMetrics] = useState(HOME_METRICS_FALLBACK);

  useEffect(() => {
    if (compat.preferReducedEffects) return;
    setMounted(true);
  }, [compat.preferReducedEffects]);

  useEffect(() => {
    let active = true;
    void fetchHomeMetrics()
      .then((nextMetrics) => {
        if (active) setMetrics(nextMetrics);
      })
      .catch(() => {
        if (active) setMetrics(HOME_METRICS_FALLBACK);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const sectionId = sessionStorage.getItem(PUBLIC_HOME_SECTION_STORAGE_KEY);
    if (!sectionId) return;

    const timeout = window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      sessionStorage.removeItem(PUBLIC_HOME_SECTION_STORAGE_KEY);
    }, 120);

    return () => window.clearTimeout(timeout);
  }, []);

  const goToLogin = () => setActiveTab('configuracoes');
  const goToValidation = () => setActiveTab('validar');

  const features = [
    {
      icon: ShieldCheck,
      title: 'Reconhecimento oficial',
      desc: 'Documento emitido pela Secretaria Municipal de Saúde de Iperó com validade jurídica.'
    },
    {
      icon: Accessibility,
      title: 'Prioridade garantida',
      desc: 'Apoio à identificação para atendimento prioritário nos serviços públicos e parceiros.'
    },
    {
      icon: QrCode,
      title: 'Validação por QR Code',
      desc: 'Verificação instantânea da autenticidade da carteirinha em qualquer dispositivo.'
    },
    {
      icon: Hospital,
      title: 'Rede integrada',
      desc: 'Acesso facilitado a unidades de saúde e pontos municipais de atendimento.'
    },
    {
      icon: Clock,
      title: 'Processo acompanhado',
      desc: 'Cadastro, análise, emissão e retirada controlados pela equipe municipal de Iperó.'
    },
    {
      icon: Sparkles,
      title: 'Gratuito e oficial',
      desc: 'Política pública municipal de Iperó sem custos para o cidadão diagnosticado.'
    }
  ];

  const steps = [
    {
      n: '01',
      title: 'Procure atendimento',
      desc: 'A solicitação é presencial, com documentos e laudo médico para conferência.'
    },
    {
      n: '02',
      title: 'Análise da equipe',
      desc: 'A Secretaria valida os dados, documentos e critérios do cadastro.'
    },
    {
      n: '03',
      title: 'Receba sua carteirinha',
      desc: 'Após emissão, a carteirinha pode ser impressa e validada por QR Code.'
    }
  ];

  const faq = [
    {
      q: 'Quem pode solicitar a carteirinha?',
      a: 'Moradores de Iperó com diagnóstico médico de fibromialgia, mediante apresentação da documentação exigida pela regulamentação municipal.'
    },
    {
      q: 'Quais documentos são necessários?',
      a: 'Em geral, são solicitados documento oficial com foto, CPF, comprovante de residência atualizado, laudo médico com indicação de fibromialgia e uma foto recente.'
    },
    {
      q: 'O cadastro é feito pelo site?',
      a: 'Não. O pedido da carteirinha é feito presencialmente. Esta área online é usada pela equipe autorizada da Prefeitura de Iperó para analisar, emitir e validar os registros.'
    },
    {
      q: 'Onde eu levo meus documentos para realizar o cadastro?',
      a: 'Leve os documentos ate a Secretaria Municipal de Saude de Ipero, na Av. Santa Cruz, no 300, Jardim Irene.'
    },
    {
      q: 'A carteirinha tem validade?',
      a: 'Sim. A data de validade consta na própria carteirinha e também pode ser conferida na validação pública pelo código ou QR Code.'
    },
    {
      q: 'Posso validar pelo QR Code?',
      a: 'Sim. A consulta pública aceita leitura do QR Code, envio de imagem ou PDF da carteirinha, além do código de validação informado no documento.'
    }
  ];

  return (
    <div className="lovable-home relative bg-[hsl(30_25%_98%)] text-[hsl(270_25%_14%)]">
      <section className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img src={heroImg} alt="" className="h-full w-full scale-110 object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-[hsl(30_25%_98%/0.40)] via-[hsl(30_25%_98%/0.70)] to-[hsl(30_25%_98%)]" />
        </div>

        <header className="relative z-10">
          <div className="mx-auto flex min-h-16 max-w-[1240px] items-center justify-between gap-3 px-4 py-4 md:min-h-20 md:px-8">
            <button type="button" onClick={() => setActiveTab('inicio')} className="flex items-center">
              <div className="leading-tight">
                <div className="lovable-display text-base font-semibold">CIPF</div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-[hsl(270_8%_42%)]">Iperó · Carteirinha Municipal</div>
              </div>
            </button>

            <nav className="hidden items-center gap-7 text-sm text-[hsl(270_25%_14%/0.70)] md:flex">
              <button type="button" onClick={() => scrollTo('sobre')} className="transition hover:text-[hsl(270_25%_14%)]">Sobre</button>
              <button type="button" onClick={() => scrollTo('beneficios')} className="transition hover:text-[hsl(270_25%_14%)]">Benefícios</button>
              <button type="button" onClick={() => scrollTo('como-funciona')} className="transition hover:text-[hsl(270_25%_14%)]">Como funciona</button>
              <button type="button" onClick={() => scrollTo('faq')} className="transition hover:text-[hsl(270_25%_14%)]">Dúvidas</button>
            </nav>

            <div className="flex items-center gap-3">
              <Button type="button" size="sm" onClick={goToLogin} className="h-9 rounded-md px-3 text-xs sm:px-4 sm:text-sm">
                Acessar painel <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </header>

        <main className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1240px] items-center px-4 py-10 md:min-h-[calc(100vh-5rem)] md:px-8">
          <div className="max-w-3xl">
            <div
              className={`inline-flex items-center gap-2 rounded-full border border-[hsl(270_15%_90%)] bg-white/70 px-3 py-1.5 text-xs font-medium text-[hsl(271_52%_32%)] backdrop-blur transition-all duration-700 ${
                mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full bg-[hsl(271_52%_32%)] ${compat.preferReducedEffects ? '' : 'animate-pulse'}`} />
              Programa Municipal de Iperó para Apoio à Pessoa com Fibromialgia
            </div>

            <h1
              className={`mt-6 text-4xl font-semibold leading-[1.05] tracking-tight transition-all delay-150 duration-1000 sm:text-5xl md:text-7xl ${
                mounted ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
              }`}
            >
              Cuidado que <em className="not-italic text-[hsl(271_52%_32%)]">acolhe</em>,
              <br />
              identidade que <em className="not-italic text-[hsl(271_52%_32%)]">respeita</em>.
            </h1>

            <p
              className={`mt-6 max-w-2xl text-base leading-relaxed text-[hsl(270_8%_42%)] transition-all delay-300 duration-1000 sm:text-lg md:text-xl ${
                mounted ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
              }`}
            >
              A Carteirinha de Identificação da Pessoa com Fibromialgia garante prioridade, reconhecimento e dignidade no acesso aos serviços públicos.
            </p>

            <div className={`mt-10 flex flex-col items-stretch gap-4 transition-all delay-500 duration-1000 sm:flex-row sm:flex-wrap sm:items-center ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}>
              <Button type="button" size="lg" onClick={goToLogin} className="h-12 rounded-md px-7 text-base shadow-[0_4px_12px_-4px_hsl(270_25%_14%/0.08),0_2px_4px_hsl(270_25%_14%/0.04)] sm:w-auto">
                Acessar o sistema <ArrowRight className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" size="lg" onClick={() => scrollTo('como-funciona')} className="h-12 rounded-md bg-white/60 px-7 text-base backdrop-blur sm:w-auto">
                Solicitar carteirinha
              </Button>
            </div>

            <div className={`mt-12 grid grid-cols-1 gap-4 text-sm text-[hsl(270_8%_42%)] transition-all delay-700 duration-1000 sm:mt-16 sm:grid-cols-3 sm:gap-8 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
              {[
                [formatMetricValue(metrics.registrationsTotal), 'Pessoas atendidas'],
                ['Documento oficial', 'Validacao por QR Code'],
                ['100%', 'Gratuito e oficial']
              ].map(([value, label], index) => (
                <div key={label} className={index > 0 ? 'border-t border-[hsl(270_15%_90%)] pt-4 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0' : ''}>
                  <div className="lovable-display text-2xl font-semibold text-[hsl(270_25%_14%)]">{value}</div>
                  <div className="text-xs">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </main>

        <button type="button" onClick={() => scrollTo('sobre')} className={`absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-1 text-[hsl(270_8%_42%)] sm:flex ${compat.preferReducedEffects ? '' : 'animate-bounce'}`}>
          <span className="text-[10px] uppercase tracking-[0.2em]">Role para descobrir</span>
          <ChevronDown className="h-4 w-4" />
        </button>
      </section>

      <section id="sobre" className="border-t border-[hsl(270_15%_90%)] py-20 md:py-28">
        <div className="mx-auto grid max-w-[1240px] items-center gap-12 px-4 md:grid-cols-2 md:gap-16 md:px-8">
          <Reveal>
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-[hsl(271_52%_32%)]">Sobre o programa</span>
            <h2 className="mt-4 text-4xl font-semibold leading-tight md:text-5xl">Uma política pública para quem vive com dor invisível.</h2>
            <p className="mt-6 leading-relaxed text-[hsl(270_8%_42%)]">
              A fibromialgia afeta milhões de brasileiros e, por ser uma condição sem marcas visíveis, muitas vezes é invisibilizada. A CIPF de Iperó nasce para apoiar o acesso aos direitos e ao atendimento prioritário no município.
            </p>
            <p className="mt-4 leading-relaxed text-[hsl(270_8%_42%)]">
              O documento oficial é validado pela Secretaria de Saúde e reconhece a condição e seus direitos.
            </p>
            <Button type="button" onClick={() => scrollTo('como-funciona')} className="mt-8 rounded-md">
              Quero minha carteirinha <ArrowRight className="h-4 w-4" />
            </Button>
          </Reveal>

          <Reveal delay={150}>
            <div className="relative">
              <div className="absolute -inset-6 rounded-3xl bg-gradient-to-tr from-[hsl(271_52%_32%/0.20)] to-transparent blur-2xl" />
              <div className="relative grid grid-cols-1 gap-4 min-[430px]:grid-cols-2">
                {[
                  { icon: Users, label: 'Pessoas atendidas', value: formatMetricValue(metrics.registrationsTotal) },
                  { icon: FileText, label: 'Carteirinhas emitidas', value: formatMetricValue(metrics.issuedTotal) },
                  { icon: QrCode, label: 'Validacao por QR Code', value: 'Documento oficial', compact: true },
                  { icon: ShieldCheck, label: 'Aprovação do programa', value: '98%' }
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-[hsl(270_15%_90%)] bg-white p-5 sm:p-6 shadow-[0_1px_2px_hsl(270_25%_14%/0.04),0_1px_3px_hsl(270_25%_14%/0.06)] transition-all hover:-translate-y-1">
                    <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-[hsl(271_52%_32%/0.10)] text-[hsl(271_52%_32%)]">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div className={`lovable-display font-semibold text-[hsl(270_25%_14%)] ${item.compact ? 'max-w-[9ch] text-[clamp(1.5rem,3.4vw,2.15rem)] leading-[1.02] text-balance' : 'text-3xl'}`}>{item.value}</div>
                    <div className="mt-1 text-xs text-[hsl(270_8%_42%)]">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="beneficios" className="border-y border-[hsl(270_15%_90%)] bg-[hsl(270_15%_96%/0.30)] py-20 md:py-28">
        <div className="mx-auto max-w-[1240px] px-4 md:px-8">
          <Reveal>
            <div className="max-w-2xl">
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-[hsl(271_52%_32%)]">Benefícios</span>
              <h2 className="mt-4 text-4xl font-semibold leading-tight md:text-5xl">Tudo o que a carteirinha oferece.</h2>
              <p className="mt-5 text-lg leading-relaxed text-[hsl(270_8%_42%)]">Mais que um documento: reconhecimento institucional para apoiar a rotina.</p>
            </div>
          </Reveal>

          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <Reveal key={feature.title} delay={index * 80}>
                <div className="group h-full rounded-2xl border border-[hsl(270_15%_90%)] bg-white p-7 transition-all hover:border-[hsl(271_52%_32%/0.40)] hover:shadow-[0_4px_12px_-4px_hsl(270_25%_14%/0.08)]">
                  <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-[hsl(271_52%_32%/0.10)] text-[hsl(271_52%_32%)] transition-colors group-hover:bg-[hsl(271_52%_32%)] group-hover:text-white">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[hsl(270_8%_42%)]">{feature.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="como-funciona" className="py-20 md:py-28">
        <div className="mx-auto max-w-[1240px] px-4 md:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-[hsl(271_52%_32%)]">Como funciona</span>
              <h2 className="mt-4 text-4xl font-semibold leading-tight md:text-5xl">Três passos simples até sua carteirinha.</h2>
            </div>
          </Reveal>

          <div className="relative mt-16 grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <Reveal key={step.n} delay={index * 150}>
                <div className="h-full rounded-2xl border border-[hsl(270_15%_90%)] bg-white p-8 transition-all hover:shadow-[0_4px_12px_-4px_hsl(270_25%_14%/0.08)]">
                  <div className="lovable-display text-6xl font-semibold leading-none text-[hsl(271_52%_32%/0.20)]">{step.n}</div>
                  <h3 className="mt-4 text-2xl font-semibold">{step.title}</h3>
                  <p className="mt-3 leading-relaxed text-[hsl(270_8%_42%)]">{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[hsl(271_52%_32%)] py-28 text-[hsl(30_25%_98%)]">
        <div className="relative mx-auto max-w-[1240px] px-4 md:px-8">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <p className="lovable-display -mt-6 text-2xl leading-relaxed md:text-3xl">
                Nosso compromisso é garantir que nenhuma pessoa com fibromialgia seja invisibilizada. O acesso ao atendimento prioritário é um direito.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="faq" className="py-20 md:py-28">
        <div className="mx-auto grid max-w-[1240px] gap-12 px-4 md:grid-cols-[1fr_1.4fr] md:gap-16 md:px-8">
          <Reveal>
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-[hsl(271_52%_32%)]">Dúvidas frequentes</span>
            <h2 className="mt-4 text-4xl font-semibold leading-tight md:text-5xl">Ainda tem perguntas?</h2>
            <p className="mt-5 leading-relaxed text-[hsl(270_8%_42%)]">Reunimos as principais dúvidas sobre o programa.</p>
            <Button type="button" variant="outline" onClick={goToValidation} className="mt-8 rounded-md">Validar carteirinha</Button>
          </Reveal>

          <Reveal delay={150}>
            <div className="divide-y divide-[hsl(270_15%_90%)]">
              {faq.map((item) => (
                <details key={item.q} className="group py-4">
                  <summary className="lovable-display flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                    {item.q}
                    <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
                  </summary>
                  <p className="pt-3 leading-relaxed text-[hsl(270_8%_42%)]">{item.a}</p>
                </details>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-[hsl(270_15%_90%)] py-20 md:py-28">
        <div className="mx-auto max-w-[1240px] px-4 md:px-8">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-[hsl(270_15%_90%)] bg-white p-12 text-center shadow-[0_1px_2px_hsl(270_25%_14%/0.04)] md:p-20">
              <div className="relative">
                <h2 className="mx-auto max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
                  Sua condição é real. <span className="text-[hsl(271_52%_32%)]">Seu direito também.</span>
                </h2>
                <p className="mx-auto mt-6 max-w-xl text-lg text-[hsl(270_8%_42%)]">Procure a Secretaria Municipal de Saúde de Iperó e solicite sua Carteirinha de Identificação da Pessoa com Fibromialgia.</p>
                <div className="mt-10 flex flex-wrap justify-center gap-4">
                  <Button type="button" size="lg" onClick={() => scrollTo('como-funciona')} className="h-12 rounded-md px-8 text-base">
                    Ver como solicitar <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="outline" size="lg" onClick={goToLogin} className="h-12 rounded-md px-8 text-base">
                    Acessar painel
                  </Button>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-[hsl(270_15%_90%)] py-10">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 px-4 text-sm text-[hsl(270_8%_42%)] md:px-8">
          <div className="flex flex-col gap-1">
            <span>© 2026 Prefeitura de Iperó · CIPF</span>
            <span>Av. Santa Cruz, nº 300, Jardim Irene · 15 3266-2137</span>
          </div>
          <div className="flex gap-6">
            <button type="button" onClick={() => setActiveTab('privacidade')} className="transition hover:text-[hsl(270_25%_14%)]">Privacidade</button>
            <button type="button" onClick={() => setActiveTab('termos')} className="transition hover:text-[hsl(270_25%_14%)]">Termos</button>
            <button type="button" onClick={() => setActiveTab('contato')} className="transition hover:text-[hsl(270_25%_14%)]">Contato</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
