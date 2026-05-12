import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, PackageCheck, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/layout';
import { ModalShell } from '@/components/ui/modal-shell';
import { buildWhatsAppMessage, buildWhatsAppUrl, isAwaitingPickup, maskCpf, toDigits } from '@/lib/dashboard-utils';
import { formatPhone } from '@/lib/utils';
import { useAppStore, type CIPFRegistration } from '@/store/useAppStore';
import { useRegistrationWorkflow } from './dashboard/hooks/useRegistrationWorkflow';

type PickupDraft = {
  reg: CIPFRegistration;
  pickedBy: string;
  documentChecked: boolean;
  note: string;
};

type WhatsAppDraft = {
  reg: CIPFRegistration;
  message: string;
};

export function Retiradas() {
  const { registrations, currentUser, fetchRegistrations } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pickupDraft, setPickupDraft] = useState<PickupDraft | null>(null);
  const [whatsAppDraft, setWhatsAppDraft] = useState<WhatsAppDraft | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      await fetchRegistrations();
    } catch (error: any) {
      setLoadError(error?.message || 'Falha ao carregar retiradas.');
    } finally {
      setIsLoading(false);
    }
  };

  const workflow = useRegistrationWorkflow({ currentUser, reload: loadData, onError: setMessage });

  useEffect(() => {
    void loadData();
  }, []);

  const pickupQueue = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const digits = toDigits(searchTerm);
    return registrations
      .filter(isAwaitingPickup)
      .filter((reg) => {
        if (!term && !digits) return true;
        return reg.fullName.toLowerCase().includes(term) || toDigits(reg.cpf).includes(digits) || toDigits(reg.phone || '').includes(digits);
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [registrations, searchTerm]);

  const confirmWhatsApp = async () => {
    if (!whatsAppDraft) return;
    const url = buildWhatsAppUrl(whatsAppDraft.reg.phone, whatsAppDraft.message);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    await workflow.notifyPatient(whatsAppDraft.reg, 'WhatsApp: retirada');
    setWhatsAppDraft(null);
  };

  const confirmPickup = async () => {
    if (!pickupDraft) return;
    if (!pickupDraft.documentChecked) {
      setMessage('Confirme que o documento apresentado foi conferido.');
      return;
    }
    await workflow.registerPickup(
      pickupDraft.reg,
      [pickupDraft.pickedBy ? `Retirado por: ${pickupDraft.pickedBy}` : 'Retirada registrada', pickupDraft.note].filter(Boolean).join('; ')
    );
    setPickupDraft(null);
  };

  return (
    <div className="cipf-page cipf-page-stack">
      <Header onRefresh={loadData} isLoading={isLoading} />

      {(loadError || message) && <div className="cipf-subpanel border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{loadError || message}</div>}

      <section className="cipf-panel p-6 sm:p-8">
        <div className="mb-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="cipf-kicker">Retirada presencial</p>
            <h3 className="cipf-title mt-2 text-2xl">{pickupQueue.length} carteirinha(s) aguardando retirada</h3>
            <p className="cipf-description mt-2 max-w-2xl text-sm">Controle separado para avisar pacientes e registrar a entrega presencial da carteirinha.</p>
          </div>
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--brand-muted)]" />
            <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar por nome, CPF ou telefone..." className="pl-10" />
          </div>
        </div>

        <div className="grid gap-4">
          {pickupQueue.map((reg) => (
            <div key={reg.id} className="cipf-subpanel bg-white p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-[var(--brand-ink)]">{reg.fullName}</p>
                  <p className="mt-1 text-xs text-[#617184]">{maskCpf(reg.cpf)} • Validade {reg.expiryDate || '-'} • {formatPhone(reg.phone || '') || 'Telefone não informado'}</p>
                  <p className="mt-2 text-sm font-semibold text-[#7b2cbf]">Emitida e aguardando retirada presencial.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {toDigits(reg.phone || '').length >= 10 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setWhatsAppDraft({ reg, message: buildWhatsAppMessage(reg, 'pickup') })}
                      className="h-11 rounded-xl"
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      WhatsApp
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={() => setPickupDraft({ reg, pickedBy: '', documentChecked: false, note: '' })}
                    variant="success"
                  >
                    <PackageCheck className="mr-2 h-4 w-4" />
                    Confirmar retirada
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {!pickupQueue.length && (
            <div className="cipf-empty text-sm text-green-800">
              Nenhuma carteirinha aguardando retirada para os filtros atuais.
            </div>
          )}
        </div>
      </section>

      {whatsAppDraft && (
        <ModalShell open onClose={() => setWhatsAppDraft(null)} title="Mensagem para WhatsApp" description={formatPhone(whatsAppDraft.reg.phone || '') || 'Telefone inválido'} size="md">
          <textarea
            value={whatsAppDraft.message}
            onChange={(event) => setWhatsAppDraft({ ...whatsAppDraft, message: event.target.value })}
            className="min-h-[150px] w-full rounded-xl border border-[#d9e1ea] px-3 py-2 text-sm"
          />
          <Button className="mt-4 w-full" variant="success" onClick={confirmWhatsApp}>
            Abrir WhatsApp e registrar aviso
          </Button>
        </ModalShell>
      )}

      {pickupDraft && (
        <ModalShell open onClose={() => setPickupDraft(null)} title="Confirmar retirada" description={pickupDraft.reg.fullName} size="md">
          <Input value={pickupDraft.pickedBy} onChange={(event) => setPickupDraft({ ...pickupDraft, pickedBy: event.target.value })} placeholder="Quem retirou" className="h-11" />
          <label className="mt-4 flex gap-3 rounded-xl border border-[#d9e1ea] p-3 text-sm">
            <input type="checkbox" checked={pickupDraft.documentChecked} onChange={(event) => setPickupDraft({ ...pickupDraft, documentChecked: event.target.checked })} />
            Documento apresentado conferido.
          </label>
          <textarea
            value={pickupDraft.note}
            onChange={(event) => setPickupDraft({ ...pickupDraft, note: event.target.value })}
            placeholder="Observação opcional"
            className="mt-4 min-h-[92px] w-full rounded-xl border border-[#d9e1ea] px-3 py-2 text-sm"
          />
          <Button className="mt-4 w-full" variant="success" onClick={confirmPickup}>
            Confirmar retirada
          </Button>
        </ModalShell>
      )}
    </div>
  );
}

function Header({ onRefresh, isLoading }: { onRefresh: () => void; isLoading: boolean }) {
  return (
    <PageHeader
      eyebrow="Retiradas"
      title="Carteirinhas aguardando paciente"
      description="Uma visão focada para comunicação e entrega presencial."
      tone="green"
      actions={
        <Button type="button" variant="outline" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      }
    />
  );
}
