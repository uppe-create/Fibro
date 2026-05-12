import { expect, test } from '@playwright/test';

test.describe('basic public navigation', () => {
  test('opens home screen', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Cuidado que acolhe/ })).toBeVisible();
    await expect(page.getByText(/Programa Municipal/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Acessar o sistema/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Solicitar carteirinha/ })).toBeVisible();
  });

  test('opens public validation screen from navigation after landing', async ({ page }) => {
    await page.goto('/');
    await page.goto('/validar');

    await expect(page).toHaveURL(/\/validar$/);
    await expect(page.getByRole('heading', { name: 'Validação pública' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Selecionar arquivo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Validar carteirinha' })).toBeVisible();
  });

  test('public validation header navigates to home and login', async ({ page }) => {
    await page.goto('/validar');

    await page.getByRole('navigation').getByRole('button', { name: 'Início' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /Cuidado que acolhe/ })).toBeVisible();

    await page.goto('/validar');
    await page.getByRole('button', { name: /Entrar/ }).click();
    await expect(page).toHaveURL(/\/configuracoes$/);
    await expect(page.getByRole('heading', { name: 'Acesso administrativo' })).toBeVisible();
  });

  test('opens login screen for restricted configuration route', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Acessar o sistema/ }).click();

    await expect(page).toHaveURL(/\/configuracoes$/);
    await expect(page.getByRole('heading', { name: 'Acesso administrativo' })).toBeVisible();
    await expect(page.getByLabel(/Usuario|E-mail/)).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Senha' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  });

  test('keeps internal people route protected when opened directly', async ({ page }) => {
    await page.goto('/cadastros');

    await expect(page).toHaveURL(/\/cadastros$/);
    await expect(page.getByRole('heading', { name: 'Acesso administrativo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  });
});
