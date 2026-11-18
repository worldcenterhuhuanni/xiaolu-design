/** Groups and memberships persist through the production storage composition; removing a group keeps its Sessions. */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import Storage from '@deepseek-ai/dsh-storage'
import * as Domains from '@deepseek-ai/dsh-storage-domain'
import * as JsonStorage from '@deepseek-ai/dsh-storage-json'
import { expect, it, onTestFinished } from 'vitest'
import * as Groups from '../src/index.ts'
import type { SessionGroupId } from '../src/types.ts'

const session = (value: string) => value as SessionId
const reasonOf = (operation: Promise<unknown>) =>
  operation.then(() => 'accepted', (error: unknown) => (error as { details: { reason: string } }).details.reason)

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'session-groups-'))
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
    await ctx.plugin(Groups)
    return ctx
  }
}

it('keeps groups and memberships across a restart', async () => {
  const open = await setup()
  const first = await open()
  const group = await first.sessionGroups.create({ name: '  Research  ', theme: 3 })
  expect(group).toMatchObject({ name: 'Research', theme: 3 })
  await first.sessionGroups.assign({ sessionId: session('a'), groupId: group.groupId })
  await first.fiber.dispose()

  const second = await open()
  expect(await second.sessionGroups.list()).toEqual({
    groups: [group],
    members: [{ sessionId: 'a', groupId: group.groupId }],
  })
})

it('moves a Session between groups, ungroups it, and dissolves a group without touching other memberships', async () => {
  const groups = (await (await setup())()).sessionGroups
  const one = await groups.create({ name: 'One', theme: 0 })
  const two = await groups.create({ name: 'Two', theme: 1 })
  await groups.assign({ sessionId: session('a'), groupId: one.groupId })
  await groups.assign({ sessionId: session('b'), groupId: one.groupId })
  await groups.assign({ sessionId: session('c'), groupId: two.groupId })
  await groups.assign({ sessionId: session('a'), groupId: two.groupId })
  await groups.assign({ sessionId: session('c') })

  expect((await groups.dissolve({ groupId: one.groupId })).sort()).toEqual(['b'])
  expect(await groups.dissolve({ groupId: one.groupId })).toEqual([])
  expect(await groups.list()).toEqual({ groups: [two], members: [{ sessionId: 'a', groupId: two.groupId }] })
})

it('renames and recolors a group and rejects invalid requests', async () => {
  const groups = (await (await setup())()).sessionGroups
  const group = await groups.create({ name: 'Draft', theme: 0 })
  expect(await groups.update({ groupId: group.groupId, name: ' Final ' })).toMatchObject({ name: 'Final', theme: 0 })
  expect(await groups.update({ groupId: group.groupId, theme: 5 })).toMatchObject({ name: 'Final', theme: 5 })

  const missing = 'group-missing' as SessionGroupId
  expect(await reasonOf(groups.create({ name: '   ', theme: 0 }))).toBe('bad-name')
  expect(await reasonOf(groups.create({ name: 'x'.repeat(41), theme: 0 }))).toBe('bad-name')
  expect(await reasonOf(groups.create({ name: 'ok', theme: -1 }))).toBe('bad-theme')
  expect(await reasonOf(groups.update({ groupId: group.groupId, theme: 1.5 }))).toBe('bad-theme')
  expect(await reasonOf(groups.update({ groupId: missing, name: 'x' }))).toBe('unknown-group')
  expect(await reasonOf(groups.assign({ sessionId: session('a'), groupId: missing }))).toBe('unknown-group')
  expect((await groups.list()).members).toEqual([])
})
