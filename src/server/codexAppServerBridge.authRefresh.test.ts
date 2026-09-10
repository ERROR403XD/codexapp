import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { refreshChatgptAuthTokensForExternalAuth } from './codexAppServerBridge'
import { AccountAuthStore } from './accountAuthStore'

const originalCodexHome = process.env.CODEX_HOME
const originalRefreshUrlOverride = process.env.CODEX_REFRESH_TOKEN_URL_OVERRIDE
const tempDirs: string[] = []

function restoreEnvValue(key: string, value: string | undefined): void {
  if (typeof value === 'string') {
    process.env[key] = value
    return
  }
  delete process.env[key]
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8')
    .toString('base64')
    .replace(/=/gu, '')
    .replace(/\+/gu, '-')
    .replace(/\//gu, '_')
}

function unsignedJwt(payload: unknown): string {
  return `${base64UrlJson({ alg: 'none', typ: 'JWT' })}.${base64UrlJson(payload)}.signature`
}

async function createCodexHome(auth: unknown): Promise<string> {
  const codexHome = await mkdtemp(join(tmpdir(), 'codexui-auth-refresh-'))
  tempDirs.push(codexHome)
  await writeFile(join(codexHome, 'auth.json'), JSON.stringify(auth, null, 2), 'utf8')
  process.env.CODEX_HOME = codexHome
  return codexHome
}

afterEach(async () => {
  restoreEnvValue('CODEX_HOME', originalCodexHome)
  restoreEnvValue('CODEX_REFRESH_TOKEN_URL_OVERRIDE', originalRefreshUrlOverride)
  vi.unstubAllGlobals()
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('ChatGPT auth token refresh', () => {
  it('refreshes external ChatGPT auth tokens and persists auth.json', async () => {
    const codexHome = await createCodexHome({
      auth_mode: 'chatgpt',
      tokens: {
        access_token: unsignedJwt({
          'https://api.openai.com/auth': { chatgpt_account_id: 'acct-old', user_id: 'user-old' },
        }),
        refresh_token: 'refresh-old',
        id_token: 'id-old',
        account_id: 'acct-old',
      },
    })
    const initialRaw = await readFile(join(codexHome, 'auth.json'), 'utf8')
    const authStore = new AccountAuthStore(codexHome)
    await authStore.upsertCredential(initialRaw, { activate: true })
    const initialRevision = (await authStore.readState()).accounts[0]?.credentialRevision ?? 0
    process.env.CODEX_REFRESH_TOKEN_URL_OVERRIDE = 'https://example.test/oauth/token'
    const accessToken = unsignedJwt({
      'https://api.openai.com/auth': {
        chatgpt_account_id: 'acct-old',
        chatgpt_plan_type: 'pro',
        user_id: 'user-old',
      },
    })
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      access_token: accessToken,
      refresh_token: 'refresh-new',
      id_token: 'id-new',
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await refreshChatgptAuthTokensForExternalAuth({
      reason: 'unauthorized',
      previousAccountId: 'acct-old',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('https://example.test/oauth/token')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' })
    const body = new URLSearchParams(String(init?.body ?? ''))
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('refresh-old')
    expect(body.get('client_id')).toBe('app_EMoamEEZ73f0CkXaXp7hrann')
    expect(result).toEqual({
      accessToken,
      chatgptAccountId: 'acct-old',
      chatgptPlanType: 'pro',
    })

    const updatedAuth = JSON.parse(await readFile(join(codexHome, 'auth.json'), 'utf8')) as {
      auth_mode?: string
      last_refresh?: number
      tokens?: Record<string, string>
    }
    expect(updatedAuth.auth_mode).toBe('chatgpt')
    expect(typeof updatedAuth.last_refresh).toBe('number')
    expect(updatedAuth.tokens?.access_token).toBe(accessToken)
    expect(updatedAuth.tokens?.refresh_token).toBe('refresh-new')
    expect(updatedAuth.tokens?.id_token).toBe('id-new')
    expect(updatedAuth.tokens?.account_id).toBe('acct-old')
    const profile = (await authStore.readState()).accounts[0]
    expect(profile?.credentialRevision).toBe(initialRevision + 1)
  })

  it('asks for sign-in when auth.json has no ChatGPT refresh token', async () => {
    const codexHome = await createCodexHome({
      auth_mode: 'chatgpt',
      tokens: {
        access_token: unsignedJwt({
          'https://api.openai.com/auth': { chatgpt_account_id: 'acct-old', user_id: 'user-old' },
        }),
        account_id: 'acct-old',
      },
    })
    const raw = await readFile(join(codexHome, 'auth.json'), 'utf8')
    await new AccountAuthStore(codexHome).upsertCredential(raw, { activate: true })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(refreshChatgptAuthTokensForExternalAuth()).rejects.toThrow(
      'The account credential must be renewed from the account panel.',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
