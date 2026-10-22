import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCupStore, cupLibraryPlugin } from '../server/cupStore.js'
import { createCupProfile, createProfileCup } from '../src/objects/createProfileCup.js'
import { createServer } from 'vite'
import { Group, Vector3 } from 'three'
import { defaults } from '../src/controls/createGUI.js'
import { findDishPosition } from '../src/objects/placeDishes.js'

const dir = await mkdtemp(join(tmpdir(), 'cup-store-'))
try {
  const file = join(dir, 'cups.json')
  const store = createCupStore(file)
  const profile = createCupProfile({ radialOffsets: Array(65).fill(0.005) }).map((p) => p.toArray())
  const input = { name: 'Test cup', thickness: 0.003, profile }
  assert.equal((await store.read()).cups.length, 0)
  await Promise.all(Array.from({ length: 8 }, () => store.append(input)))
  const data = await createCupStore(file).read()
  assert.equal(data.cups.length, 8)
  assert.equal(new Set(data.cups.map((cup) => cup.id)).size, 8)
  assert.deepEqual(data.cups[0].profile, profile)
  assert.throws(() => store.append({ ...input, profile: [[NaN, 0, 0]] }))
  assert.equal(JSON.parse(await readFile(file)).cups.length, 8)
  const table = { plate: new Group() }, params = { ...defaults }
  const gravity = { vector: new Vector3(0, -9.81, 0), direction: new Vector3(0, -1, 0) }
  const dishes = []
  let omitted = 0
  for (const entry of data.cups) {
    const cup = createProfileCup(table, params, { storedProfile: entry.profile })
    const position = findDishPosition(cup.footprintRadius, dishes)
    if (!position) { omitted++; cup.dispose(); continue }
    cup.root.position.set(position.x, 0, position.z)
    cup.update(gravity)
    const before = cup.profile.map((p) => p.toArray())
    params.cupThickness = 8
    cup.update(gravity)
    assert.deepEqual(cup.profile.map((p) => p.toArray()), before)
    dishes.push(cup)
  }
  assert.ok(dishes.length > 0)
  assert.equal(dishes.length + omitted, 8)
  for (const [i, cup] of dishes.entries()) {
    for (const other of dishes.slice(0, i)) {
      assert.ok(Math.hypot(cup.root.position.x - other.root.position.x, cup.root.position.z - other.root.position.z)
        >= cup.footprintRadius + other.footprintRadius + 0.012 - 1e-10)
    }
    cup.dispose()
  }
  const server = await createServer({ configFile: false, plugins: [cupLibraryPlugin(file)],
    server: { host: '127.0.0.1', port: 0 } })
  try {
    await server.listen()
    const url = `http://127.0.0.1:${server.httpServer.address().port}/api/cups`
    assert.equal((await (await fetch(url)).json()).cups.length, 8)
    assert.equal((await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })).status, 201)
    assert.equal((await (await fetch(url)).json()).cups.length, 9)
    assert.equal((await fetch(url, { method: 'POST', headers: { Origin: 'https://example.com', 'Content-Type': 'application/json' }, body: JSON.stringify(input) })).status, 403)
  } finally { await server.close() }
  console.log('Cup store: concurrent append, reload, exact profile and invalid-input checks passed')
} finally { await rm(dir, { recursive: true, force: true }) }
