import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, 'docs', 'manual', 'screenshots');
const baseUrl = process.env.MANUAL_BASE_URL || 'http://127.0.0.1:4175';
const supabaseBase = 'https://dxcvjjmpmginimuxjqme.supabase.co';

const fakePhotoSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640" viewBox="0 0 480 640">
  <rect width="480" height="640" fill="#efe8f8"/>
  <circle cx="240" cy="220" r="88" fill="#7445a4"/>
  <path d="M108 526c34-92 92-138 132-138s98 46 132 138" fill="#7445a4"/>
  <text x="240" y="602" text-anchor="middle" font-family="Arial" font-size="30" fill="#2b193d">FOTO 3x4</text>
</svg>
`.trim();
const fakePhotoDataUri = `data:image/svg+xml;base64,${Buffer.from(fakePhotoSvg).toString('base64')}`;

const registrations = [
  {
    id: 'f31b2d85-6a27-4fb2-8b8c-111111111111',
    fullName: 'MARIA APARECIDA SILVA',
    cpf: '12345678901',
    cns: '700000000000001',
    phone: '15999998888',
    birthDate: '12/06/1985',
    legalGuardian: '',
    photoUrl: fakePhotoDataUri,
    issueDate: '10/04/2026',
    expiryDate: '10/04/2028',
    status: 'approved',
    signature: 'AB12CD34',
    visualSignature: 'AB12-CD34',
    documentUrl: '',
    proofOfResidenceUrl: '',
    medicalReportUrl: '',
    photoFileId: null,
    documentFileId: 'doc-1',
    proofOfResidenceFileId: 'proof-1',
    medicalReportFileId: 'med-1',
    cep: '18560000',
    logradouro: 'AVENIDA SANTA CRUZ, 300',
    bairro: 'JARDIM IRENE',
    cidade: 'IPERO',
    estado: 'SP',
    cid: 'M79.7',
    justificativaCid: '',
    crm: 'CRM 123456',
    proofOfResidenceDate: '01/03/2026',
    medicalReportDate: '20/02/2026',
    checksum: 'CHK12345',
    patient_notified_at: null,
    patient_notified_by: null,
    patient_notification_channel: null,
    picked_up_at: null,
    picked_up_by: null,
    pickup_note: null,
    last_accessed_at: '2026-05-10T14:32:00Z',
    last_accessed_by: 'SEC SAUDE',
    deleted_at: null,
    deleted_by: null
  },
  {
    id: 'f31b2d85-6a27-4fb2-8b8c-222222222222',
    fullName: 'ANA PAULA SOUZA',
    cpf: '98765432100',
    cns: '700000000000002',
    phone: '15988887777',
    birthDate: '01/09/1979',
    legalGuardian: '',
    photoUrl: fakePhotoDataUri,
    issueDate: '18/03/2026',
    expiryDate: '18/03/2028',
    status: 'issued',
    signature: 'EF56GH78',
    visualSignature: 'EF56-GH78',
    documentUrl: '',
    proofOfResidenceUrl: '',
    medicalReportUrl: '',
    photoFileId: null,
    documentFileId: 'doc-2',
    proofOfResidenceFileId: 'proof-2',
    medicalReportFileId: 'med-2',
    cep: '18560000',
    logradouro: 'RUA DAS FLORES, 45',
    bairro: 'CENTRO',
    cidade: 'IPERO',
    estado: 'SP',
    cid: 'M79.7',
    justificativaCid: '',
    crm: 'CRM 654321',
    proofOfResidenceDate: '28/02/2026',
    medicalReportDate: '11/02/2026',
    checksum: 'CHK67890',
    patient_notified_at: '2026-03-20T10:00:00Z',
    patient_notified_by: 'SEC SAUDE',
    patient_notification_channel: 'whatsapp',
    picked_up_at: '2026-03-25T15:30:00Z',
    picked_up_by: 'SEC SAUDE',
    pickup_note: 'Retirada presencial',
    last_accessed_at: '2026-05-11T09:12:00Z',
    last_accessed_by: 'SEC SAUDE',
    deleted_at: null,
    deleted_by: null
  },
  {
    id: 'f31b2d85-6a27-4fb2-8b8c-333333333333',
    fullName: 'JOAO PEDRO LIMA',
    cpf: '11122233344',
    cns: '700000000000003',
    phone: '15977776666',
    birthDate: '14/02/1992',
    legalGuardian: '',
    photoUrl: fakePhotoDataUri,
    issueDate: '',
    expiryDate: '',
    status: 'under_review',
    signature: 'IJ90KL12',
    visualSignature: 'IJ90-KL12',
    documentUrl: '',
    proofOfResidenceUrl: '',
    medicalReportUrl: '',
    photoFileId: null,
    documentFileId: 'doc-3',
    proofOfResidenceFileId: 'proof-3',
    medicalReportFileId: 'med-3',
    cep: '18560000',
    logradouro: 'RUA LIMEIRA, 88',
    bairro: 'VILA GABRIEL',
    cidade: 'IPERO',
    estado: 'SP',
    cid: 'M79.7',
    justificativaCid: '',
    crm: 'CRM 777777',
    proofOfResidenceDate: '17/04/2026',
    medicalReportDate: '15/04/2026',
    checksum: 'CHK24680',
    patient_notified_at: null,
    patient_notified_by: null,
    patient_notification_channel: null,
    picked_up_at: null,
    picked_up_by: null,
    pickup_note: null,
    last_accessed_at: null,
    last_accessed_by: null,
    deleted_at: null,
    deleted_by: null
  }
];

const auditLogs = [
  {
    id: 'a1',
    userId: 'local-sec',
    userName: 'SEC SAUDE',
    registrationId: registrations[0].id,
    action: 'Cadastro aprovado',
    timestamp: '2026-05-12T10:15:00Z',
    ip: '127.0.0.1',
    event_code: 'registration.approved',
    category: 'workflow',
    severity: 'info',
    target_type: 'registration',
    target_id: registrations[0].id,
    target_label: registrations[0].fullName,
    summary: 'Cadastro aprovado',
    details: 'Documentos conferidos e sem pendencias',
    metadata_json: {}
  },
  {
    id: 'a2',
    userId: 'local-sec',
    userName: 'SEC SAUDE',
    registrationId: registrations[1].id,
    action: 'Carteirinha emitida',
    timestamp: '2026-05-11T14:10:00Z',
    ip: '127.0.0.1',
    event_code: 'card.issued',
    category: 'workflow',
    severity: 'sensitive',
    target_type: 'registration',
    target_id: registrations[1].id,
    target_label: registrations[1].fullName,
    summary: 'Carteirinha emitida',
    details: 'Emissao concluida no modulo Carteirinha',
    metadata_json: {}
  },
  {
    id: 'a3',
    userId: 'local-sec',
    userName: 'SEC SAUDE',
    registrationId: null,
    action: 'Exportacao PDF do dashboard',
    timestamp: '2026-05-10T09:00:00Z',
    ip: '127.0.0.1',
    event_code: 'export.dashboard_pdf',
    category: 'export',
    severity: 'sensitive',
    target_type: 'system',
    target_id: null,
    target_label: 'Painel',
    summary: 'Exportacao PDF do dashboard',
    details: 'Relatorio administrativo do mes',
    metadata_json: {}
  }
];

const lgpdRequests = [
  {
    id: 'lgpd-1',
    protocol: 'LGPD-2026-001',
    request_type: 'acesso',
    data_subject_name: 'MARIA APARECIDA SILVA',
    data_subject_cpf: '12345678901',
    channel: 'presencial',
    status: 'open',
    received_at: '2026-05-05',
    due_at: '2026-05-20',
    response_summary: '',
    legal_notes: 'Solicitacao registrada para conferencia documental.',
    owner_name: 'SEC SAUDE'
  },
  {
    id: 'lgpd-2',
    protocol: 'LGPD-2026-002',
    request_type: 'correcao',
    data_subject_name: 'ANA PAULA SOUZA',
    data_subject_cpf: '98765432100',
    channel: 'email',
    status: 'in_progress',
    received_at: '2026-05-07',
    due_at: '2026-05-22',
    response_summary: 'Aguardando comprovacao complementar.',
    legal_notes: '',
    owner_name: 'SEC SAUDE'
  }
];

const incidents = [
  {
    id: 'inc-1',
    protocol: 'INC-2026-001',
    title: 'Tentativa de acesso indevido',
    severity: 'medium',
    status: 'open',
    occurred_at: '2026-05-06T09:10:00Z',
    discovered_at: '2026-05-06T09:20:00Z',
    summary: 'Tentativa repetida de abrir area restrita sem perfil adequado.',
    affected_data: 'Metadados de sessao',
    affected_subjects: 0,
    containment_actions: 'Sessao encerrada e revisao de logs executada.',
    notification_required: false,
    notified_anpd_at: null,
    notified_subjects_at: null,
    owner_name: 'SEC SAUDE'
  }
];

const retentionRules = [
  {
    dataset_key: 'registrations',
    dataset_label: 'Cadastros completos',
    retention_summary: 'Manter ate definicao formal de tabela de retencao.',
    archive_strategy: 'Arquivamento logico',
    purge_blocked: true,
    legal_basis_notes: 'Pendente validacao institucional.'
  },
  {
    dataset_key: 'audit_logs',
    dataset_label: 'Auditoria',
    retention_summary: 'Preservar para rastreabilidade e controle interno.',
    archive_strategy: 'Retencao prolongada',
    purge_blocked: true,
    legal_basis_notes: 'Evento sensivel exige avaliacao juridica.'
  },
  {
    dataset_key: 'cipf_storage_files',
    dataset_label: 'Documentos privados',
    retention_summary: 'Manter vinculados ao ciclo de vida do cadastro.',
    archive_strategy: 'Storage privado com revisao futura',
    purge_blocked: true,
    legal_basis_notes: 'Dados sensiveis de saude.'
  }
];

const operators = [
  {
    operator_key: 'supabase',
    operator_name: 'Supabase',
    category: 'infraestrutura',
    purpose: 'Banco, auth e storage',
    shared_data: 'Dados cadastrais e arquivos privados',
    active: true,
    notes: 'Operador principal do sistema'
  },
  {
    operator_key: 'firebase',
    operator_name: 'Firebase Hosting',
    category: 'hospedagem',
    purpose: 'Entrega do front-end estatico',
    shared_data: 'Arquivos publicos do app',
    active: true,
    notes: 'Sem leitura de registros privados'
  },
  {
    operator_key: 'viacep',
    operator_name: 'ViaCEP',
    category: 'integracao',
    purpose: 'Consulta de CEP',
    shared_data: 'CEP informado pelo operador',
    active: true,
    notes: 'Consulta pontual'
  }
];

const publicValidation = {
  id: 'CIPF2601',
  fullName: 'ANA PAULA SOUZA',
  cpfMasked: '***.654.321-**',
  issueDate: '18/03/2026',
  expiryDate: '18/03/2028',
  status: 'issued',
  visualSignature: 'EF56GH78'
};

const localAdminUser = {
  id: 'local-sec',
  name: 'SEC SAUDE',
  email: 'secsaude@local',
  role: 'admin'
};

const shots = [
  { name: 'home_publica.png', path: '/', auth: false },
  { name: 'login_publico.png', path: '/configuracoes', auth: false },
  { name: 'validacao_publica.png', path: '/validar?id=CIPF2601&sig=EF56GH78', auth: false, scrollY: 340 },
  { name: 'dashboard.png', path: '/dashboard', auth: true },
  { name: 'cadastro.png', path: '/cadastro', auth: true },
  { name: 'pessoas.png', path: '/pessoas', auth: true },
  { name: 'aprovacao.png', path: '/operacao', auth: true },
  { name: 'documentos.png', path: '/documentos', auth: true },
  { name: 'retiradas.png', path: '/retiradas', auth: true },
  { name: 'relatorios.png', path: '/relatorios', auth: true },
  { name: 'auditoria.png', path: '/auditoria', auth: true },
  { name: 'governanca.png', path: '/governanca', auth: true },
  { name: 'configuracoes_admin.png', path: '/dashboard', auth: true, clickText: 'Configuracoes' },
  { name: 'carteirinha.png', path: '/carteirinha?search=MARIA', auth: true, scrollY: 320 }
];

function okJson(route, data, status = 200) {
  return route.fulfill({
    status,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': '*',
      'content-type': 'application/json'
    },
    body: JSON.stringify(data)
  });
}

async function installSupabaseMocks(page) {
  await page.route(`${supabaseBase}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (method === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
          'access-control-allow-headers': '*'
        }
      });
    }

    if (url.pathname.includes('/rest/v1/rpc/get_home_metrics')) {
      return okJson(route, { registrations_total: 14, issued_total: 13 });
    }

    if (url.pathname.includes('/rest/v1/rpc/validate_cipf_public')) {
      return okJson(route, publicValidation);
    }

    if (url.pathname.includes('/rest/v1/rpc/log_audit_event')) {
      return okJson(route, { ok: true });
    }

    if (url.pathname.includes('/rest/v1/rpc/admin_request_export')) {
      return okJson(route, { ok: true });
    }

    if (url.pathname.includes('/rest/v1/rpc/admin_transition_registration')) {
      return okJson(route, { ok: true });
    }

    if (url.pathname.includes('/rest/v1/rpc/admin_update_registration')) {
      return okJson(route, { ok: true });
    }

    if (url.pathname.includes('/rest/v1/rpc/admin_record_patient_contact')) {
      return okJson(route, { ok: true });
    }

    if (url.pathname.includes('/rest/v1/rpc/admin_record_pickup')) {
      return okJson(route, { ok: true });
    }

    if (url.pathname.includes('/rest/v1/rpc/admin_archive_registrations')) {
      return okJson(route, { ok: true });
    }

    if (url.pathname.includes('/rest/v1/rpc/admin_create_lgpd_request') || url.pathname.includes('/rest/v1/rpc/admin_update_lgpd_request')) {
      return okJson(route, { ok: true });
    }

    if (url.pathname.includes('/rest/v1/rpc/admin_create_security_incident') || url.pathname.includes('/rest/v1/rpc/admin_update_security_incident')) {
      return okJson(route, { ok: true });
    }

    if (url.pathname.includes('/rest/v1/registrations')) {
      return okJson(route, registrations);
    }

    if (url.pathname.includes('/rest/v1/public_validations')) {
      return okJson(route, registrations.map((item) => ({
        id: item.id,
        fullName: item.fullName,
        cpfMasked: item.cpf,
        issueDate: item.issueDate,
        expiryDate: item.expiryDate,
        status: item.status,
        visualSignature: item.signature
      })));
    }

    if (url.pathname.includes('/rest/v1/registration_index')) {
      return okJson(route, registrations.map((item) => ({
        cpf: item.cpf,
        status: item.status,
        updated_at: '2026-05-10T10:00:00Z'
      })));
    }

    if (url.pathname.includes('/rest/v1/audit_logs')) {
      return okJson(route, auditLogs);
    }

    if (url.pathname.includes('/rest/v1/lgpd_requests')) {
      return okJson(route, lgpdRequests);
    }

    if (url.pathname.includes('/rest/v1/security_incidents')) {
      return okJson(route, incidents);
    }

    if (url.pathname.includes('/rest/v1/lgpd_retention_rules')) {
      return okJson(route, retentionRules);
    }

    if (url.pathname.includes('/rest/v1/lgpd_operator_registry')) {
      return okJson(route, operators);
    }

    if (url.pathname.includes('/rest/v1/cipf_storage_files')) {
      return okJson(route, []);
    }

    if (url.pathname.includes('/storage/v1/')) {
      return okJson(route, {});
    }

    return okJson(route, []);
  });
}

async function preparePage(page, auth) {
  await installSupabaseMocks(page);
  if (!auth) return;

  await page.addInitScript((user) => {
    sessionStorage.setItem('cipf_local_auth', JSON.stringify(user));
    localStorage.setItem('cipf_login_at', String(Date.now()));
    localStorage.setItem('cipf_last_activity', String(Date.now()));
  }, localAdminUser);
}

async function captureShot(browser, shot) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1180 },
    colorScheme: 'light',
    deviceScaleFactor: 1
  });
  const page = await context.newPage();
  await preparePage(page, shot.auth);
  await page.goto(`${baseUrl}${shot.path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  if (shot.clickText) {
    await page.getByRole('button', { name: shot.clickText, exact: true }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
  }
  if (shot.scrollY) {
    await page.evaluate((scrollY) => window.scrollTo({ top: scrollY, behavior: 'instant' }), shot.scrollY);
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: path.join(outputDir, shot.name) });
  await context.close();
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const shot of shots) {
      await captureShot(browser, shot);
      process.stdout.write(`capturado: ${shot.name}\n`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
