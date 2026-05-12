import { expect, test } from '@playwright/test';
import { seedLocalSession } from './helpers/localAuth';

test.describe('authenticated profiles', () => {
  test('admin sees internal dashboard and sensitive menu', async ({ page }) => {
    await seedLocalSession(page, 'admin');
    await page.goto('/dashboard');

    await expect(page.getByText(/Vis[aã]o geral da CIPF/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Atualizar/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Auditoria' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Relatorios' })).toBeVisible();
  });

  test('attendant loses admin-only areas', async ({ page }) => {
    await seedLocalSession(page, 'attendant');
    await page.goto('/dashboard');

    await expect(page.getByRole('button', { name: 'Cadastros' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Novo cadastro' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Auditoria' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Relatorios' })).toHaveCount(0);
    await expect(page.getByText(/Vis[aã]o geral da CIPF/i)).toBeVisible();
  });

  test('viewer is kept out of internal workflow', async ({ page }) => {
    await seedLocalSession(page, 'viewer');
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/configuracoes$/);
    await expect(page.getByText(/Ambiente de testes|MFA obrigatorio|usuarios de teste/i)).toBeVisible();
  });
});
