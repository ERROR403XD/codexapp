import { describe, expect, it, vi } from 'vitest'
import { AccountProbeRpcClient } from './accountAppServerProbe.js'

describe('AccountProbeRpcClient', () => {
  it('resolves client requests and ignores unrelated notifications', async () => {
    const sent: Record<string, unknown>[] = []
    const client = new AccountProbeRpcClient((message) => sent.push(message), vi.fn())
    const pending = client.call('account/read', {})
    const id = sent[0]?.id
    client.handleLine(JSON.stringify({ jsonrpc: '2.0', method: 'account/updated', params: {} }))
    client.handleLine(JSON.stringify({ jsonrpc: '2.0', id, result: { account: { email: 'a@example.test' } } }))
    await expect(pending).resolves.toEqual({ account: { email: 'a@example.test' } })
  })

  it('persists rotated credentials before replying to a server refresh request', async () => {
    const order: string[] = []
    const sent: Record<string, unknown>[] = []
    const client = new AccountProbeRpcClient(
      (message) => {
        sent.push(message)
        if (message.id === 71 && 'result' in message) order.push('reply')
      },
      async () => {
        order.push('persist')
        return { accessToken: 'access', chatgptAccountId: 'account-a', chatgptPlanType: 'pro' }
      },
    )
    client.handleLine(JSON.stringify({
      jsonrpc: '2.0',
      id: 71,
      method: 'account/chatgptAuthTokens/refresh',
      params: { reason: 'unauthorized' },
    }))
    await vi.waitFor(() => expect(sent.some((message) => message.id === 71 && 'result' in message)).toBe(true))
    expect(order).toEqual(['persist', 'reply'])
  })

  it('returns a sanitized JSON-RPC error when refresh fails', async () => {
    const sent: Record<string, unknown>[] = []
    const client = new AccountProbeRpcClient(
      (message) => sent.push(message),
      async () => { throw new Error('token_revoked') },
    )
    client.handleLine(JSON.stringify({ jsonrpc: '2.0', id: 72, method: 'account/chatgptAuthTokens/refresh', params: {} }))
    await vi.waitFor(() => expect(sent.some((message) => message.id === 72 && 'error' in message)).toBe(true))
    const reply = sent.find((message) => message.id === 72)
    expect(reply?.error).toEqual({ code: -32001, message: 'token_revoked' })
    expect(JSON.stringify(reply)).not.toContain('refresh_token')
  })
})
