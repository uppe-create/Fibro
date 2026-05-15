import { expect, test } from '@playwright/test';
import { seedLocalSession } from './helpers/localAuth';

test.describe('governanca permissions', () => {
  test('admin sees LGPD navigation', async ({ page }) => {
    await seedLocalSession(page, 'admin');
    await page.goto('/dashboard');

    await expect(page.getByRole('button', { name: 'LGPD' })).toBeVisible();
  });

  test('attendant does not see LGPD navigation', async ({ page }) => {
    await seedLocalSession(page, 'attendant');
    await page.goto('/dashboard');

    await expect(page.getByRole('button', { name: 'LGPD' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Aprovar' })).toBeVisible();
  });
});
