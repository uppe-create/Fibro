import { type FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, Clock3, Mail, MapPin, Phone, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAppStore } from '@/store/useAppStore';

const TOPICS = [
  { value: '', label: 'Selecione' },
  { value: 'duvida', label: 'Dúvida sobre o programa' },
  { value: 'cadastro', label: 'Ajuda com cadastro' },
  { value: 'documentacao', label: 'Documentação / laudo' },
  { value: 'segunda-via', label: 'Segunda via da carteirinha' },
  { value: 'outro', label: 'Outro assunto' }
];

type ContactCardProps = {
  icon: typeof MapPin;
  label: string;
  primary: string;
  secondary?: string;
  href?: string;
};

function ContactCard({ icon: Icon, label, primary, secondary, href }: ContactCardProps) {
  const content = (
    <div className="flex items-start gap-4 rounded-[14px] border border-[#e9e0f0] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(27,16,43,0.04)]">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#f3edf8] text-[var(--fibro-purple)]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#7d6c8c]">{label}</p>
        <p className="mt-1 text-[15px] font-semibold leading-6 text-[#180d28]">{primary}</p>
        {secondary ? <p className="text-[15px] leading-6 text-[#6f617b]">{secondary}</p> : null}
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noreferrer' : undefined}>
        {content}
      </a>
    );
  }

  return content;
}

export function Contato() {
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const [form, setForm] = useState({ name: '', email: '', phone: '', topic: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name || !form.email || !form.topic || !form.message) return;

    setSubmitting(true);
    await new Promise((resolve) => window.setTimeout(resolve, 800));
    setSubmitting(false);
    setSent(true);
    setForm({ name: '', email: '', phone: '', topic: '', message: '' });
    window.setTimeout(() => setSent(false), 3200);
  };

  return (
    <div className="lovable-home min-h-screen bg-[#fcfbfd] text-[#21142f]">
      <header className="border-b border-[#ebe4f2]">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-end px-4 md:px-8">
          <button
            type="button"
            onClick={() => setActiveTab('inicio')}
            className="inline-flex items-center gap-2 text-sm text-[#6f617b] transition hover:text-[#21142f]"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao início
          </button>
        </div>
      </header>

      <section className="border-y border-[#ebe4f2] bg-[#fcfbfd] py-20 md:py-24">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-4 md:px-8 lg:grid-cols-[0.95fr_1.1fr] lg:gap-12">
          <div className="pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--fibro-purple)]">Contato</p>
            <h1 className="lovable-display mt-5 max-w-[420px] text-[46px] font-semibold leading-[0.98] tracking-tight text-[#1e1430] sm:text-[56px]">
              Fale com a
              <br />
              Secretaria de Saúde.
            </h1>
            <p className="mt-5 max-w-[470px] text-[16px] leading-8 text-[#6f617b]">
              Tire dúvidas sobre o programa, encaminhe solicitações ou solicite atendimento. Nossa equipe responde em até 2 dias úteis.
            </p>

            <div className="mt-10 space-y-4">
              <ContactCard
                icon={MapPin}
                label="Endereço"
                primary="Av. Santa Cruz, nº 300"
                secondary="Jardim Irene"
                href="https://www.google.com/maps/search/?api=1&query=Av.+Santa+Cruz,+300,+Jardim+Irene"
              />
              <ContactCard icon={Phone} label="Telefone" primary="(15) 3266-2137" href="tel:+551532662137" />
              <ContactCard icon={Mail} label="E-mail" primary="saude@ipero.sp.gov.br" href="mailto:saude@ipero.sp.gov.br" />
              <ContactCard icon={Clock3} label="Horário" primary="Segunda a Sexta-feira" secondary="8h às 16h" />
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-[24px] border border-[#e9e0f0] bg-white px-5 py-6 shadow-[0_10px_30px_rgba(37,24,50,0.05)] sm:px-8 sm:py-8 md:px-9 md:py-9"
          >
            <h2 className="lovable-display text-[34px] font-semibold leading-none text-[#1e1430]">Envie sua solicitação</h2>
            <p className="mt-3 text-[14px] leading-6 text-[#7b6c89]">Preencha o formulário e retornaremos pelo canal informado.</p>

            <div className="mt-8 grid gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="contact-name" className="mb-2 block text-[14px] font-semibold text-[#1b112b]">
                    Nome completo
                  </label>
                  <Input
                    id="contact-name"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    maxLength={100}
                    placeholder="Seu nome"
                    className="h-11 rounded-[8px] border-[#ddd2e7] shadow-none"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="contact-email" className="mb-2 block text-[14px] font-semibold text-[#1b112b]">
                    E-mail
                  </label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    maxLength={255}
                    placeholder="voce@email.com"
                    className="h-11 rounded-[8px] border-[#ddd2e7] shadow-none"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="contact-phone" className="mb-2 block text-[14px] font-semibold text-[#1b112b]">
                    Telefone (opcional)
                  </label>
                  <Input
                    id="contact-phone"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    maxLength={20}
                    placeholder="(15) 99999-0000"
                    className="h-11 rounded-[8px] border-[#ddd2e7] shadow-none"
                  />
                </div>

                <div>
                  <label htmlFor="contact-topic" className="mb-2 block text-[14px] font-semibold text-[#1b112b]">
                    Assunto
                  </label>
                  <select
                    id="contact-topic"
                    value={form.topic}
                    onChange={(event) => setForm({ ...form, topic: event.target.value })}
                    className="h-11 w-full rounded-[8px] border border-[#ddd2e7] bg-white px-3 text-sm text-[#1b112b] shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fibro-purple)]"
                    required
                  >
                    {TOPICS.map((topic) => (
                      <option key={topic.value || 'empty'} value={topic.value}>
                        {topic.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="contact-message" className="mb-2 block text-[14px] font-semibold text-[#1b112b]">
                  Mensagem
                </label>
                <Textarea
                  id="contact-message"
                  value={form.message}
                  onChange={(event) => setForm({ ...form, message: event.target.value })}
                  maxLength={1000}
                  rows={5}
                  placeholder="Descreva sua dúvida ou solicitação..."
                  className="min-h-[134px] rounded-[8px] border-[#ddd2e7] shadow-none"
                  required
                />
                <div className="mt-2 text-right text-[11px] text-[#8a7a97]">{form.message.length}/1000</div>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="mt-1 h-[44px] rounded-[8px] bg-[var(--fibro-purple)] text-[15px] font-semibold shadow-none hover:bg-[var(--fibro-purple-strong)]"
              >
                {submitting ? (
                  'Enviando...'
                ) : (
                  <>
                    Enviar solicitação
                    <Send className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <p className="text-center text-[12px] leading-5 text-[#8a7a97]">
                Ao enviar, você concorda com o uso dos dados para retorno do atendimento.
              </p>

              {sent ? (
                <div className="rounded-[10px] border border-[#d8c6e8] bg-[#f8f2ff] px-4 py-3 text-sm text-[#3a2154]">
                  Solicitação enviada. Nossa equipe responderá em até 2 dias úteis.
                </div>
              ) : null}
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
