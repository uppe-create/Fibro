import { useMemo, useState } from 'react';
import { parseBRDate } from '@/lib/date';
import {
  buildAgeStats,
  buildBairroStats,
  buildStats,
  filterDashboardRegistrations,
  findLikelyRegistrations,
  getDocumentIssues,
  getNextOperationalAction,
  getStaleAlerts,
  isAwaitingPatientNotice,
  isAwaitingPickup,
  isReadyToPrint,
  toDigits,
  type ReviewFilter,
  type StatusFilter
} from '@/lib/dashboard-utils';
import { normalizeRegistrationStatus } from '@/lib/registration-status';
import type { CIPFRegistration } from '@/store/useAppStore';
import type { DashboardFiltersActions, DashboardFiltersState, DashboardQueueItem } from '../lib/types';

const DASHBOARD_COMPACT_STORAGE_KEY = 'cipf_dashboard_compact_mode';

export function useDashboardData(registrations: CIPFRegistration[]) {
  const [searchTerm, setSearchTerm] = useState('');
  const [cidFilter, setCidFilter] = useState('all');
  const [bairroFilter, setBairroFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'expiring30'>('all');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [quickSearchTerm, setQuickSearchTerm] = useState('');
  const [isCompactMode, setIsCompactMode] = useState(() => localStorage.getItem(DASHBOARD_COMPACT_STORAGE_KEY) === 'true');

  const filters: DashboardFiltersState = {
    searchTerm,
    cidFilter,
    bairroFilter,
    statusFilter,
    expiryFilter,
    reviewFilter,
    quickSearchTerm,
    isCompactMode
  };

  const actions: DashboardFiltersActions = {
    setSearchTerm,
    setCidFilter,
    setBairroFilter,
    setStatusFilter,
    setExpiryFilter,
    setReviewFilter,
    setQuickSearchTerm,
    clearFilters: () => {
      setSearchTerm('');
      setCidFilter('all');
      setBairroFilter('all');
      setStatusFilter('all');
      setExpiryFilter('all');
      setReviewFilter('all');
    },
    toggleCompactMode: () => {
      setIsCompactMode((current) => {
        const next = !current;
        localStorage.setItem(DASHBOARD_COMPACT_STORAGE_KEY, String(next));
        return next;
      });
    }
  };

  const cidOptions = useMemo(
    () => ['all', ...Array.from(new Set(registrations.map((r) => r.cid).filter(Boolean) as string[])).sort()],
    [registrations]
  );

  const bairroOptions = useMemo(
    () => ['all', ...Array.from(new Set(registrations.map((r) => r.bairro).filter(Boolean) as string[])).sort()],
    [registrations]
  );

  const filteredRegistrations = useMemo(
    () =>
      filterDashboardRegistrations(registrations, {
        searchTerm,
        cidFilter,
        bairroFilter,
        statusFilter,
        expiryFilter,
        reviewFilter
      }),
    [registrations, searchTerm, cidFilter, bairroFilter, statusFilter, expiryFilter, reviewFilter]
  );

  const stats = useMemo(() => buildStats(registrations, filteredRegistrations), [registrations, filteredRegistrations]);
  const bairroStats = useMemo(() => buildBairroStats(filteredRegistrations), [filteredRegistrations]);
  const ageStats = useMemo(() => buildAgeStats(filteredRegistrations), [filteredRegistrations]);
  const quickResults = useMemo(() => findLikelyRegistrations(registrations, quickSearchTerm, 5), [registrations, quickSearchTerm]);

  const documentIssueQueue = useMemo(
    () => registrations.filter((reg) => getDocumentIssues(reg).length > 0).slice(0, 6),
    [registrations]
  );

  const operationalQueue: DashboardQueueItem[] = useMemo(() => {
    const priority = (reg: CIPFRegistration) => {
      const status = normalizeRegistrationStatus(reg.status);
      const expiry = parseBRDate(reg.expiryDate);
      const daysToExpiry = expiry ? Math.ceil((expiry.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000) : 9999;
      if (status === 'expired' || daysToExpiry < 0) return 10;
      if (status === 'issued' && !reg.picked_up_at) return 20;
      if (status === 'approved' && !reg.patient_notified_at) return 30;
      if (isReadyToPrint(reg)) return 40;
      if (status === 'under_review' && getDocumentIssues(reg).length === 0) return 50;
      if (getDocumentIssues(reg).length > 0) return 60;
      if (daysToExpiry <= 30) return 70;
      return 999;
    };

    return registrations
      .filter((reg) => ['under_review', 'approved', 'issued', 'expired'].includes(normalizeRegistrationStatus(reg.status)))
      .map((registration) => ({
        registration,
        priority: priority(registration),
        nextAction: getNextOperationalAction(registration),
        staleAlerts: getStaleAlerts(registration)
      }))
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 8);
  }, [registrations]);

  const todayActions = useMemo(() => {
    const approvedToNotify = registrations.filter(isAwaitingPatientNotice);
    const readyToPrint = registrations.filter(isReadyToPrint);
    const awaitingPickup = registrations.filter(isAwaitingPickup);
    const missingPhone = registrations.filter((reg) =>
      ['approved', 'issued'].includes(normalizeRegistrationStatus(reg.status)) && toDigits(reg.phone || '').length < 10
    );
    return [
      { label: 'Em análise', value: registrations.filter((reg) => normalizeRegistrationStatus(reg.status) === 'under_review').length },
      { label: 'Avisar paciente', value: approvedToNotify.length },
      { label: 'Prontas p/ imprimir', value: readyToPrint.length },
      { label: 'Aguardando retirada', value: awaitingPickup.length },
      { label: 'Sem telefone', value: missingPhone.length },
      { label: 'Pend. documentos', value: documentIssueQueue.length }
    ];
  }, [registrations, documentIssueQueue.length]);

  const batchPrintableRegistrations = useMemo(() => registrations.filter(isReadyToPrint), [registrations]);

  return {
    filters,
    filterActions: actions,
    cidOptions,
    bairroOptions,
    filteredRegistrations,
    stats,
    bairroStats,
    ageStats,
    quickResults,
    operationalQueue,
    documentIssueQueue,
    todayActions,
    batchPrintableRegistrations
  };
}
