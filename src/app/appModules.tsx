import React from 'react';
import { getAuthMode } from '@/lib/auth-mode';
import { normalizeRole, type UserRole } from '@/lib/permissions';
import { logClientDiagnostic } from '@/lib/runtime-compat';

export const APP_VERSION = String((import.meta as any).env?.VITE_APP_VERSION || '1.0.0');
export const APP_NAME = 'Carteirinha de Fibromialgia';
export const SESSION_CHECK_INTERVAL_MS = 30_000;
export const IS_PRODUCTION = Boolean((import.meta as any).env?.PROD);
export const AUTH_MODE = getAuthMode((import.meta as any).env || {});

const loadCadastro = () => import('@/modules/Cadastro').then((module) => ({ default: module.Cadastro }));
const loadAcessibilidade = () => import('@/modules/Acessibilidade').then((module) => ({ default: module.Acessibilidade }));
const loadAuditoria = () => import('@/modules/Auditoria').then((module) => ({ default: module.Auditoria }));
const loadCarteirinha = () => import('@/modules/Carteirinha').then((module) => ({ default: module.Carteirinha }));
const loadContato = () => import('@/modules/Contato').then((module) => ({ default: module.Contato }));
const loadConfiguracoes = () => import('@/modules/Configuracoes').then((module) => ({ default: module.Configuracoes }));
const loadDashboard = () => import('@/modules/Dashboard').then((module) => ({ default: module.Dashboard }));
const loadDevTools = () => import('@/modules/DevTools').then((module) => ({ default: module.DevTools }));
const loadDocumentos = () => import('@/modules/Documentos').then((module) => ({ default: module.Documentos }));
const loadGovernanca = () => import('@/modules/Governanca').then((module) => ({ default: module.Governanca }));
const loadHome = () => import('@/modules/Home').then((module) => ({ default: module.Home }));
const loadOperacao = () => import('@/modules/Operacao').then((module) => ({ default: module.Operacao }));
const loadPessoas = () => import('@/modules/Pessoas').then((module) => ({ default: module.Pessoas }));
const loadPrivacidade = () => import('@/modules/Privacidade').then((module) => ({ default: module.Privacidade }));
const loadRelatorios = () => import('@/modules/Relatorios').then((module) => ({ default: module.Relatorios }));
const loadRetiradas = () => import('@/modules/Retiradas').then((module) => ({ default: module.Retiradas }));
const loadSuporte = () => import('@/modules/Suporte').then((module) => ({ default: module.Suporte }));
const loadTermos = () => import('@/modules/Termos').then((module) => ({ default: module.Termos }));
const loadValida = () => import('@/modules/Valida').then((module) => ({ default: module.Valida }));

const withLazyDiagnostics = <T,>(moduleName: string, loader: () => Promise<T>) => {
  return () => {
    logClientDiagnostic('lazy-import-start', `Carregando modulo ${moduleName}`, { moduleName });
    return loader().catch((error) => {
      logClientDiagnostic('lazy-import-error', error?.message || `Falha ao carregar ${moduleName}`, { moduleName });
      throw error;
    });
  };
};

export const Acessibilidade = React.lazy(withLazyDiagnostics('acessibilidade', loadAcessibilidade));
export const Auditoria = React.lazy(withLazyDiagnostics('auditoria', loadAuditoria));
export const Cadastro = React.lazy(withLazyDiagnostics('cadastro', loadCadastro));
export const Carteirinha = React.lazy(withLazyDiagnostics('carteirinha', loadCarteirinha));
export const Contato = React.lazy(withLazyDiagnostics('contato', loadContato));
export const Configuracoes = React.lazy(withLazyDiagnostics('configuracoes', loadConfiguracoes));
export const Dashboard = React.lazy(withLazyDiagnostics('dashboard', loadDashboard));
export const DevTools = React.lazy(withLazyDiagnostics('dev', loadDevTools));
export const Documentos = React.lazy(withLazyDiagnostics('documentos', loadDocumentos));
export const Governanca = React.lazy(withLazyDiagnostics('governanca', loadGovernanca));
export const Home = React.lazy(withLazyDiagnostics('inicio', loadHome));
export const Operacao = React.lazy(withLazyDiagnostics('operacao', loadOperacao));
export const Pessoas = React.lazy(withLazyDiagnostics('pessoas', loadPessoas));
export const Privacidade = React.lazy(withLazyDiagnostics('privacidade', loadPrivacidade));
export const Relatorios = React.lazy(withLazyDiagnostics('relatorios', loadRelatorios));
export const Retiradas = React.lazy(withLazyDiagnostics('retiradas', loadRetiradas));
export const Suporte = React.lazy(withLazyDiagnostics('suporte', loadSuporte));
export const Termos = React.lazy(withLazyDiagnostics('termos', loadTermos));
export const Valida = React.lazy(withLazyDiagnostics('validar', loadValida));

const MODULE_PRELOADERS = {
  inicio: loadHome,
  validar: loadValida,
  acessibilidade: loadAcessibilidade,
  suporte: loadSuporte,
  privacidade: loadPrivacidade,
  termos: loadTermos,
  contato: loadContato,
  cadastro: loadCadastro,
  carteirinha: loadCarteirinha,
  configuracoes: loadConfiguracoes,
  dashboard: loadDashboard,
  pessoas: loadPessoas,
  operacao: loadOperacao,
  documentos: loadDocumentos,
  retiradas: loadRetiradas,
  relatorios: loadRelatorios,
  auditoria: loadAuditoria,
  governanca: loadGovernanca,
  dev: loadDevTools
} as const;

export function preloadModuleForTab(tab: string) {
  const loader = MODULE_PRELOADERS[tab as keyof typeof MODULE_PRELOADERS];
  return loader ? loader() : Promise.resolve(null);
}

export function preloadLikelyInternalModules(role: UserRole | string) {
  const normalizedRole = normalizeRole(role);
  const tabsByRole: Record<UserRole, string[]> = {
    admin: ['dashboard', 'operacao'],
    attendant: ['pessoas', 'operacao'],
    viewer: ['configuracoes']
  };

  return Promise.allSettled(tabsByRole[normalizedRole].map(preloadModuleForTab));
}
