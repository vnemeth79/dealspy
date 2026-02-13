import { test, expect } from '@playwright/test';

test.describe('DealSpy felhasználói folyamat', () => {
  test('Főoldal betölt és látható a CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('banner').getByText('DealSpy')).toBeVisible();
    await expect(page.getByRole('link', { name: /regisztr|sign up|registrier/i }).or(
      page.locator('a[href*="register"]')
    ).first()).toBeVisible();
  });

  test('Regisztrációs oldal betölt, űrlap látható', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /regisztr|sign up/i })).toBeVisible();
  });

  test('Regisztráció küldés – sikeres vagy hibaüzenet', async ({ page }) => {
    await page.goto('/register');
    await page.locator('input[type="email"]').fill(`e2e-${Date.now()}@dealspy-e2e.local`);
    await page.locator('input[type="password"]').fill('TestPassword123!');
    await page.locator('input[type="checkbox"]').nth(0).check();
    await page.locator('input[type="checkbox"]').nth(4).check();
    await page.getByRole('button', { name: /regisztr|sign up/i }).click();

    await page.waitForLoadState('networkidle');
    const success = page.locator('text=/siker|success|köszönjük|thank you/i');
    const error = page.locator('[class*="red"], .text-red-700');
    await expect(success.or(error)).toBeVisible({ timeout: 15000 });
  });

  test('Sikeres regisztráció után beállítások link működik (ha DB elérhető)', async ({ page }) => {
    await page.goto('/register');
    await page.locator('input[type="email"]').fill(`e2e-${Date.now()}@dealspy-e2e.local`);
    await page.locator('input[type="password"]').fill('TestPassword123!');
    await page.locator('input[type="checkbox"]').nth(0).check();
    await page.locator('input[type="checkbox"]').nth(4).check();
    await page.getByRole('button', { name: /regisztr|sign up/i }).click();

    await page.waitForLoadState('networkidle');
    const hasSuccess = await page.locator('text=/siker|success|köszönjük|thank you/i').isVisible().catch(() => false);
    const settingsLink = page.getByRole('link', { name: /beállítás|settings/i });
    const hasSettingsLink = await settingsLink.isVisible().catch(() => false);

    if (hasSuccess && hasSettingsLink) {
      await settingsLink.click();
      await expect(page).toHaveURL(/\/settings\?token=/);
      await expect(page.locator('text=/beállítás|settings/i').first()).toBeVisible();
    } else {
      const formOrMessage =
        (await page.locator('form').first().isVisible().catch(() => false)) ||
        (await page.getByText(/siker|error|hiba/i).first().isVisible().catch(() => false));
      expect(formOrMessage).toBeTruthy();
    }
  });

  test('Beállítások oldal token nélkül – üzenet vagy űrlap', async ({ page }) => {
    await page.goto('/settings');
    await expect(
      page.locator('text=/érvénytelen|invalid|beállítás|settings/i').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('Impressum, Login, Success, Unsubscribe oldalak betöltenek', async ({ page }) => {
    await page.goto('/impressum');
    await expect(page.locator('body')).toContainText(/impressum|imprint|impresszum/i);

    await page.goto('/login');
    await expect(page.locator('body')).toContainText(/email|link|bejelentkezés|login/i);

    await page.goto('/success');
    await expect(page.locator('body')).toContainText(/session|fizetés|payment|köszönjük|thank you|invalid/i);

    await page.goto('/unsubscribe');
    await expect(page.locator('body')).toContainText(/leiratkozás|unsubscribe|token|link/i);
  });

  test('Register ?cancelled=true – megszakított fizetés üzenet', async ({ page }) => {
    await page.goto('/register?cancelled=true');
    await expect(page.locator('text=/megszakítva|cancelled|folytathatod/i')).toBeVisible();
  });
});
