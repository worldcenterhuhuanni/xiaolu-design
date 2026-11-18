/** Branch records persist through the production storage composition and never form a cycle. */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import Storage from '@deepseek-ai/dsh-storage'
import * as Domains from '@deepseek-ai/dsh-storage-domain'
import * as JsonStorage from '@deepseek-ai/dsh-storage-json'
import { expect, it, onTestFinished } from 'vitest'
import * as Lineage from '../src/index.ts'

const id = (value: string) => value as SessionId

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'session-lineage-'))
  const contexts: Context[] = []
  onTestFinished(async () => {
    for (const ctx of contexts) await ctx.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  })
  return async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(Storage)
    await ctx.plugin(JsonStorage, { root })
    await ctx.plugin(Domains, { backend: 'json' })
    await ctx.plugin(Lineage)
    return ctx
  }
}

it('keeps branch records across a restart and lists them oldest first', async () => {
  const open = await setup()
  const first = await open()
  const child = await first.sessionLineage.link({ sessionId: id('b'), parent: id('a'), atSeq: 7, kind: 'ask' })
  expect(child).toMatchObject({ sessionId: 'b', parent: 'a', atSeq: 7, kind: 'ask' })
  await first.sessionLineage.link({ sessionId: id('c'), parent: id('b'), kind: 'regenerate' })
  await first.fiber.dispose()

  const second = await open()
  const branches = await second.sessionLineage.list()
  expect(branches.map(branch => [branch.sessionId, branch.parent, branch.atSeq])).toEqual([['b', 'a', 7], ['c', 'b', undefined]])
})

it('rejects a record that names itself, closes a cycle, or carries an invalid seq', async () => {
  const ctx = await (await setup())()
  const lineage = ctx.sessionLineage
  await lineage.link({ sessionId: id('b'), parent: id('a'), atSeq: 1, kind: 'ask' })
  await lineage.link({ sessionId: id('c'), parent: id('b'), atSeq: 2, kind: 'edit' })

  const reason = (request: Parameters<typeof lineage.link>[0]) =>
    lineage.link(request).then(() => 'accepted', (error: unknown) => (error as { details: { reason: string } }).details.reason)
  expect(await reason({ sessionId: id('a'), parent: id('a'), kind: 'ask' })).toBe('self-parent')
  expect(await reason({ sessionId: id('a'), parent: id('c'), kind: 'ask' })).toBe('cycle')
  expect(await reason({ sessionId: id('a'), parent: id('b'), kind: 'ask' })).toBe('cycle')
  expect(await reason({ sessionId: id('d'), parent: id('a'), atSeq: -1, kind: 'ask' })).toBe('bad-seq')
  expect(await reason({ sessionId: id('d'), parent: id('a'), atSeq: 1.5, kind: 'ask' })).toBe('bad-seq')
  // A rejected request leaves later writes working.
  expect(await reason({ sessionId: id('d'), parent: id('c'), atSeq: 3, kind: 'ask' })).toBe('accepted')
})

it('relinks a branch to a new parent and removes a record once', async () => {
  const ctx = await (await setup())()
  const lineage = ctx.sessionLineage
  await lineage.link({ sessionId: id('b'), parent: id('a'), atSeq: 1, kind: 'ask' })
  await lineage.link({ sessionId: id('b'), parent: id('x'), atSeq: 4, kind: 'edit' })
  expect(await lineage.list()).toMatchObject([{ sessionId: 'b', parent: 'x', atSeq: 4, kind: 'edit' }])

  expect(await lineage.unlink({ sessionId: id('b') })).toEqual({ removed: true })
  expect(await lineage.unlink({ sessionId: id('b') })).toEqual({ removed: false })
  expect(await lineage.list()).toEqual([])
})
