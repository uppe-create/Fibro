import React from 'react';
import { getAuthMode } from '@/lib/auth-mode';

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
const loadHome = () => import('@/modules/Home').then((module) => ({ default: module.Home }));
const loadOperacao = () => import('@/modules/Operacao').then((module) => ({ default: module.Operacao }));
const loadPessoas = () => import('@/modules/Pessoas').then((module) => ({ default: module.Pessoas }));
const loadPrivacidade = () => import('@/modules/Privacidade').then((module) => ({ default: module.Privacidade }));
const loadRelatorios = () => import('@/modules/Relatorios').then((module) => ({ default: module.Relatorios }));
const loadRetiradas = () => import('@/modules/Retiradas').then((module) => ({ default: module.Retiradas }));
const loadSuporte = () => import('@/modules/Suporte').then((module) => ({ default: module.Suporte }));
const loadTermos = () => import('@/modules/Termos').then((module) => ({ default: module.Termos }));
const loadValida = () => import('@/modules/Valida').then((module) => ({ default: module.Valida }));

export const Acessibilidade = React.lazy(loadAcessibilidade);
export const Auditoria = React.lazy(loadAuditoria);
export const Cadastro = React.lazy(loadCadastro);
export const Carteirinha = React.lazy(loadCarteirinha);
export const Contato = React.lazy(loadContato);
export const Configuracoes = React.lazy(loadConfiguracoes);
export const Dashboard = React.lazy(loadDashboard);
export const DevTools = React.lazy(loadDevTools);
export const Documentos = React.lazy(loadDocumentos);
export const Home = React.lazy(loadHome);
export const Operacao = React.lazy(loadOperacao);
export const Pessoas = React.lazy(loadPessoas);
export const Privacidade = React.lazy(loadPrivacidade);
export const Relatorios = React.lazy(loadRelatorios);
export const Retiradas = React.lazy(loadRetiradas);
export const Suporte = React.lazy(loadSuporte);
export const Termos = React.lazy(loadTermos);
export const Valida = React.lazy(loadValida);

export function preloadAppModules() {
  return Promise.allSettled([
    loadHome(),
    loadAcessibilidade(),
    loadPrivacidade(),
    loadTermos(),
    loadContato(),
    loadValida(),
    loadSuporte(),
    loadDashboard(),
    loadPessoas(),
    loadOperacao(),
    loadRelatorios(),
    loadAuditoria(),
    loadDocumentos(),
    loadRetiradas(),
    loadCadastro(),
    loadCarteirinha(),
    loadConfiguracoes(),
    ...(!IS_PRODUCTION ? [loadDevTools()] : [])
  ]);
}
