import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'

export function validateCup(value) {
  if (!value || !Array.isArray(value.profile) || value.profile.length !== 135
    || !value.profile.every((p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite)
      && p[0] >= 0 && p[0] <= 0.1 && p[1] >= 0 && p[1] <= 0.2 && p[2] === 0)
    || !Number.isFinite(value.thickness) || value.thickness < 0.001 || value.thickness > 0.008) {
    throw new Error('Invalid cup profile')
  }
  return { id: randomUUID(), name: String(value.name || 'Breath cup').slice(0, 100),
    createdAt: new Date().toISOString(), thickness: value.thickness, profile: value.profile }
}

export function createCupStore(file) {
  let queue = Promise.resolve()
  async function read() {
    try {
      const data = JSON.parse(await readFile(file, 'utf8'))
      if (data.version !== 1 || !Array.isArray(data.cups)) throw new Error('Invalid cup library')
      return data
    } catch (error) {
      if (error.code === 'ENOENT') return { version: 1, unit: 'metres', cups: [] }
      throw error
    }
  }
  function append(value) {
    const cup = validateCup(value)
    const task = queue.then(async () => {
      const data = await read()
      data.cups.push(cup)
      await mkdir(dirname(file), { recursive: true })
      await writeFile(`${file}.tmp`, JSON.stringify(data, null, 2) + '\n', 'utf8')
      await rename(`${file}.tmp`, file)
      return cup
    })
    queue = task.catch(() => {})
    return task
  }
  return { read, append }
}

export function cupLibraryPlugin(file) {
  const store = createCupStore(file)
  function configure(server) {
    server.middlewares.use('/api/cups', async (req, res) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      const reply = (status, value) => { res.statusCode = status; res.end(JSON.stringify(value)) }
      if (req.url !== '/' && req.url !== '') return reply(404, { error: 'Not found' })
      // Refuse cross-origin writes and requests through arbitrary remote hosts.
      const host = req.headers.host || ''
      if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)
        || (req.headers.origin && req.headers.origin !== `http://${host}` && req.headers.origin !== `https://${host}`)) {
        return reply(403, { error: 'Local same-origin access only' })
      }
      try {
        if (req.method === 'GET') return reply(200, await store.read())
        if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' })
        if (!req.headers['content-type']?.startsWith('application/json')) return reply(415, { error: 'JSON required' })
        const chunks = []; let size = 0
        for await (const chunk of req) {
          size += chunk.length
          if (size > 65536) return reply(413, { error: 'Profile too large' })
          chunks.push(chunk)
        }
        const input = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        validateCup(input)
        return reply(201, await store.append(input))
      } catch (error) {
        console.error('Cup library:', error)
        reply(error instanceof SyntaxError || error.message === 'Invalid cup profile' ? 400 : 500,
          { error: '컵 데이터를 읽거나 저장하지 못했습니다. 서버와 data/cups.json을 확인해 주세요.' })
      }
    })
  }
  return { name: 'local-cup-library', configureServer: configure, configurePreviewServer: configure }
}
