import {
  auditSearchText,
  matchesAuditMode,
  normalizeAuditEntry,
  type AuditCategory,
  type AuditEntryRow,
  type AuditMode,
  type AuditSeverity,
  type AuditTimelineEntry
} from '@/lib/audit-events';

export const normalizeAuditEntries = (rows: AuditEntryRow[]) =>
  rows
    .map(normalizeAuditEntry)
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

export const filterAuditEntries = ({
  entries,
  search,
  category,
  severity,
  mode,
  actor,
  targetId
}: {
  entries: AuditTimelineEntry[];
  search: string;
  category: AuditCategory | 'all';
  severity: AuditSeverity | 'all';
  mode: AuditMode;
  actor: string;
  targetId: string;
}) => {
  const searchTerm = search.trim().toLowerCase();
  const actorTerm = actor.trim().toLowerCase();
  const targetTerm = targetId.trim().toLowerCase();

  return entries.filter((entry) => {
    if (!matchesAuditMode(entry, mode)) return false;
    if (category !== 'all' && entry.category !== category) return false;
    if (severity !== 'all' && entry.severity !== severity) return false;
    if (actorTerm && !entry.actor.toLowerCase().includes(actorTerm)) return false;
    if (targetTerm && !String(entry.targetId || '').toLowerCase().includes(targetTerm)) return false;
    if (searchTerm && !auditSearchText(entry).includes(searchTerm)) return false;
    return true;
  });
};
