import {
  AlertCircle,
  Ban,
  Bell,
  ClipboardCheck,
  Clock,
  Database,
  FileWarning,
  MessageCircle,
  PhoneOff,
  Printer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { NotificationAction, NotificationIconKey, NotificationSection, NotificationTone } from './notificationRules';

type Props = {
  key?: string;
  section: NotificationSection;
  onAction?: (action: NotificationAction) => void;
};

const ICONS: Record<NotificationIconKey, typeof AlertCircle> = {
  database: Database,
  alert: AlertCircle,
  'clipboard-check': ClipboardCheck,
  'file-warning': FileWarning,
  printer: Printer,
  'message-circle': MessageCircle,
  'phone-off': PhoneOff,
  ban: Ban,
  clock: Clock
};

const TONE_STYLES: Record<
  NotificationTone,
  {
    container: string;
    iconWrap: string;
    icon: string;
    title: string;
    body: string;
    entry: string;
    actionButton?: string;
  }
> = {
  blue: {
    container: 'bg-blue-50 border-b border-blue-100',
    iconWrap: 'bg-blue-200',
    icon: 'text-blue-700',
    title: 'text-blue-950',
    body: 'text-blue-700',
    entry: 'bg-white/75',
    actionButton: 'bg-blue-600 hover:bg-blue-700 text-white'
  },
  red: {
    container: 'bg-red-50 border-b border-red-100',
    iconWrap: 'bg-red-100',
    icon: 'text-red-600',
    title: 'text-red-900',
    body: 'text-red-700',
    entry: 'bg-white/75'
  },
  amber: {
    container: 'bg-[#fff8e6] border-b border-amber-100',
    iconWrap: 'bg-amber-200',
    icon: 'text-amber-700',
    title: 'text-amber-950',
    body: 'text-amber-700',
    entry: 'bg-white/70'
  },
  orange: {
    container: 'bg-orange-50 border-b border-orange-100',
    iconWrap: 'bg-orange-100',
    icon: 'text-orange-700',
    title: 'text-orange-950',
    body: 'text-orange-700',
    entry: 'bg-white/75'
  },
  green: {
    container: 'bg-green-50 border-b border-green-100',
    iconWrap: 'bg-green-100',
    icon: 'text-green-700',
    title: 'text-green-950',
    body: 'text-green-700',
    entry: 'bg-white/75'
  },
  purple: {
    container: 'bg-[#f8f2ff] border-b border-[#eadcff]',
    iconWrap: 'bg-[#eadcff]',
    icon: 'text-[#7b2cbf]',
    title: 'text-[#3b0764]',
    body: 'text-[#6d28a8]',
    entry: 'bg-white/75'
  },
  slate: {
    container: 'bg-slate-50 border-b border-slate-100',
    iconWrap: 'bg-slate-200',
    icon: 'text-slate-700',
    title: 'text-slate-950',
    body: 'text-slate-600',
    entry: 'bg-white/75'
  },
  zinc: {
    container: 'bg-zinc-50 border-b border-zinc-100',
    iconWrap: 'bg-zinc-200',
    icon: 'text-zinc-700',
    title: 'text-zinc-950',
    body: 'text-zinc-600',
    entry: 'bg-white/75'
  }
};

export function NotificationCard({ section, onAction }: Props) {
  const styles = TONE_STYLES[section.tone];
  const Icon = ICONS[section.icon] || Bell;

  return (
    <div className={`p-4 ${styles.container}`}>
      <div className="mb-3 flex gap-3 items-start">
        <div className={`mt-0.5 p-2 rounded-full ${styles.iconWrap} ${styles.icon}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <p className={`text-sm font-medium ${styles.title}`}>{section.title}</p>
          <p className={`text-xs mt-1 ${styles.body}`}>{section.description}</p>
        </div>
      </div>

      {section.entries?.length ? (
        <div className="space-y-2">
          {section.entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => entry.action && onAction?.(entry.action)}
              disabled={!entry.action}
              className={`w-full rounded-lg px-3 py-2 text-left ${styles.entry} ${entry.action ? 'cursor-pointer hover:ring-2 hover:ring-[#7b2cbf]/20' : 'cursor-default'}`}
            >
              <p className="truncate text-sm font-semibold text-[#1D1D1F]">{entry.title}</p>
              <p className={`text-xs mt-1 ${styles.body}`}>{entry.subtitle}</p>
              {entry.action ? (
                <span className="mt-2 inline-flex h-8 w-full items-center justify-center rounded-lg bg-[#168821] px-3 text-xs font-bold text-white hover:bg-[#126b1c]">
                  {entry.action.label}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {section.action ? (
        <Button
          size="sm"
          className={`mt-3 w-full text-xs h-8 rounded-lg ${styles.actionButton || 'bg-[#17324d] hover:bg-[#10263b] text-white'}`}
          onClick={() => onAction?.(section.action!)}
        >
          {section.action.label}
        </Button>
      ) : null}
    </div>
  );
}
