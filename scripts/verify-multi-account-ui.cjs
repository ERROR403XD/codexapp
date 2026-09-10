const { chromium } = require('playwright')
const { mkdirSync, writeFileSync } = require('node:fs')
const { resolve } = require('node:path')

const baseUrl = process.env.CODEXAPP_MULTI_ACCOUNT_URL || 'http://127.0.0.1:59001'
const outputDir = resolve(process.cwd(), 'output/playwright')
mkdirSync(outputDir, { recursive: true })

const accountState = {
  activeAccountId: 'workspace-account-a',
  activeStorageId: 'storage-account-a',
  operation: null,
  accounts: [
    {
      accountId: 'workspace-account-a',
      storageId: 'storage-account-a',
      userId: 'user-a',
      email: 'alpha@example.test',
      planType: 'plus',
      credentialRevision: 4,
      authStatus: 'ready',
      lastVerifiedAtIso: '2026-09-05T00:00:00.000Z',
      lastRefreshedAtIso: '2026-09-05T00:00:00.000Z',
      lastActivatedAtIso: '2026-09-05T00:00:00.000Z',
      quotaSnapshot: { primary: { usedPercent: 23, windowMinutes: 10080, resetsAt: 1788912000 } },
      quotaUpdatedAtIso: '2026-09-05T00:00:00.000Z',
      quotaStatus: 'ready',
      quotaError: null,
      unavailableReason: null,
      canSwitch: true,
      actionRequired: null,
      isActive: true,
    },
    {
      accountId: 'workspace-account-b',
      storageId: 'storage-account-b',
      userId: 'user-b',
      email: 'beta@example.test',
      planType: 'free',
      credentialRevision: 2,
      authStatus: 'reauth_required',
      lastVerifiedAtIso: '2026-09-04T00:00:00.000Z',
      lastRefreshedAtIso: '2026-09-04T00:00:00.000Z',
      lastActivatedAtIso: null,
      quotaSnapshot: null,
      quotaUpdatedAtIso: null,
      quotaStatus: 'error',
      quotaError: null,
      unavailableReason: 'reauth_required',
      canSwitch: false,
      actionRequired: 'reauthenticate',
      isActive: false,
    },
  ],
}

async function openAccountPanel(page, theme) {
  await page.addInitScript(({ nextTheme }) => {
    localStorage.setItem('codex-web-local.ui-language.v1', 'en')
    localStorage.setItem('codex-web-local.dark-mode.v1', nextTheme)
    localStorage.setItem('codex-web-local.accounts-section-collapsed.v1', '0')
  }, { nextTheme: theme })
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await page.locator('.sidebar-settings-button').click()
  await page.locator('.sidebar-settings-account-item').first().waitFor()
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/snap/bin/chromium',
    args: ['--no-sandbox'],
  })
  try {
    const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
    const page = await context.newPage()
    await page.route('**/codex-api/accounts**', async (route) => {
      const url = new URL(route.request().url())
      if (url.pathname === '/codex-api/accounts') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: accountState }) })
        return
      }
      await route.continue()
    })

    await openAccountPanel(page, 'light')
    const panel = page.locator('.sidebar-settings-panel')
    const activeCard = page.locator('.sidebar-settings-account-item.is-active')
    const reauthCard = page.locator('.sidebar-settings-account-item').filter({ hasText: 'beta@example.test' })
    await panel.getByText('Add account', { exact: true }).waitFor()
    await activeCard.getByText('alpha@example.test', { exact: true }).waitFor()
    await reauthCard.locator('.sidebar-settings-account-status').getByText('Sign-in required', { exact: true }).waitFor()
    await reauthCard.getByRole('button', { name: 'Re-authenticate' }).waitFor()
    await reauthCard.getByRole('button', { name: 'Refresh quota' }).waitFor()
    if (!await reauthCard.getByRole('button', { name: 'Unavailable' }).isDisabled()) {
      throw new Error('Re-authentication-required account switch must be disabled.')
    }
    const lightPath = resolve(outputDir, 'multi-account-light.png')
    await page.waitForTimeout(2500)
    await page.screenshot({ path: lightPath, fullPage: true })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.locator('.sidebar-settings-button').click()
    await page.locator('.sidebar-settings-account-item.is-active').getByText('alpha@example.test', { exact: true }).waitFor()

    await panel.getByRole('button', { name: /Appearance/ }).click()
    await page.locator('html.dark').waitFor()
    if (!await page.locator('html').evaluate((element) => element.classList.contains('dark'))) {
      throw new Error('Dark theme class was not applied.')
    }
    const darkSurface = await page.locator('.sidebar-settings-panel').evaluate((element) => getComputedStyle(element).backgroundColor)
    const darkPath = resolve(outputDir, 'multi-account-dark.png')
    await panel.evaluate((element) => { element.scrollTop = 0 })
    await page.waitForTimeout(2500)
    await page.screenshot({ path: darkPath, fullPage: true })

    const report = {
      url: baseUrl,
      viewport: { width: 1365, height: 900 },
      assertions: {
        distinctActionsVisible: true,
        reauthStatusVisible: true,
        unavailableSwitchDisabled: true,
        activeStatePersistedAfterReload: true,
        darkThemeApplied: true,
      },
      darkSurface,
      screenshots: { light: lightPath, dark: darkPath },
    }
    writeFileSync(resolve(outputDir, 'multi-account-ui-report.json'), `${JSON.stringify(report, null, 2)}\n`)
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
