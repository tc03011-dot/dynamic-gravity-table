import initialLibrary from '../../data/cups.json'

// Bundle the five starter profiles so the first scene does not depend on the
// local save API being available (for example before a dev-server restart).
export const initialCups = initialLibrary.cups.filter((cup) => /^Sample [1-5] - /.test(cup.name))

export async function loadCups() {
  if (import.meta.env.MODE === 'pages') return initialLibrary.cups
  const response = await fetch('/api/cups', { signal: AbortSignal.timeout(3000) })
  if (!response.ok) throw new Error('저장 컵을 불러오지 못했습니다. npm.cmd run dev로 실행해 주세요.')
  const cups = (await response.json()).cups
  const byId = new Map(initialCups.map((cup) => [cup.id, cup]))
  for (const cup of cups) byId.set(cup.id, cup)
  return [...byId.values()]
}

export async function saveCup(cup) {
  if (import.meta.env.MODE === 'pages') throw new Error('웹 배포에서는 프로파일 파일 저장을 사용해 주세요.')
  const response = await fetch('/api/cups', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cup),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || '컵 저장 실패')
  return result
}
