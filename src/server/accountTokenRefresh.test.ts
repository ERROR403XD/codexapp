import { describe, expect, it, vi } from 'vitest'
import { classifyAccountAuthError, refreshChatgptAccountCredential } from './accountTokenRefresh.js'

function jwt(accountId: string): string {
  return `header.${Buffer.from(JSON.stringify({
    'https://api.openai.com/auth': { chatgpt_account_id: accountId, chatgpt_plan_type: 'pro', user_id: 'user-a' },
  })).toString('base64url')}.signature`
}

function credential(refreshToken = 'refresh-old'): string {
  return JSON.stringify({
    auth_mode: 'chatgpt',
    tokens: { account_id: 'account-a', access_token: jwt('account-a'), refresh_token: refreshToken, id_token: 'id-old' },
  })
}

describe('refreshChatgptAccountCredential', () => {
  it('returns a rotated credential for persistence before replying to app-server', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      access_token: jwt('account-a'),
      refresh_token: 'refresh-new',
      id_token: 'id-new',
    }), { status: 200 }))
    const result = await refreshChatgptAccountCredential(credential(), {}, {
      fetchImpl,
      refreshUrl: 'https://example.test/oauth/token',
      expectedAccountId: 'account-a',
    })
    const parsed = JSON.parse(result.raw) as { tokens: Record<string, string> }
    expect(parsed.tokens.refresh_token).toBe('refresh-new')
    expect(parsed.tokens.id_token).toBe('id-new')
    expect(result.response.chatgptAccountId).toBe('account-a')
  })

  it('rejects refresh identity changes without returning the rotated secret', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      access_token: jwt('account-b'),
      refresh_token: 'do-not-persist',
    }), { status: 200 }))
    await expect(refreshChatgptAccountCredential(credential(), {}, { fetchImpl }))
      .rejects.toMatchObject({ code: 'account_identity_mismatch' })
  })

  it.each([
    ['token_revoked', 'reauth_required'],
    ['HTTP 402 payment required', 'payment_required'],
    ['network timeout', 'transient_error'],
  ])('classifies %s separately', (message, expected) => {
    expect(classifyAccountAuthError(new Error(message)).authStatus).toBe(expected)
  })
})
