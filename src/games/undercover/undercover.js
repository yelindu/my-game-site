export const wordPairs = [
  ['苹果','梨'], ['牛奶','豆浆'], ['咖啡','奶茶'], ['可乐','雪碧'], ['饺子','馄饨'], ['包子','馒头'], ['面条','米粉'], ['火锅','麻辣烫'],
  ['蛋糕','面包'], ['西瓜','哈密瓜'], ['薯片','薯条'], ['冰淇淋','冰棍'], ['猫','狗'], ['老虎','狮子'], ['企鹅','鸭子'], ['蝴蝶','蜜蜂'],
  ['吉他','小提琴'], ['钢琴','电子琴'], ['篮球','足球'], ['乒乓球','羽毛球'], ['自行车','电动车'], ['火车','地铁'], ['飞机','直升机'], ['书包','行李箱'],
  ['雨伞','雨衣'], ['眼镜','墨镜'], ['毛衣','卫衣'], ['牙膏','洗面奶'], ['电风扇','空调'], ['冰箱','冰柜'], ['手机','平板'], ['沙发','椅子'],
]

export const undercoverCount = count => count >= 7 ? 2 : 1
export function createGame(names, random = Math.random) {
  if (!Array.isArray(names) || names.length < 4 || names.length > 8 || names.some(n => typeof n !== 'string' || !n.trim() || [...n.trim()].length > 12)) throw new Error('需要 4 到 8 位玩家，名字为 1 到 12 个字')
  const seats = names.map((_, i) => i)
  const shuffled = [...seats]
  for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]] }
  const spies = shuffled.slice(0, undercoverCount(names.length))
  const pair = [...wordPairs[Math.floor(random() * wordPairs.length)]]
  if (random() < .5) pair.reverse()
  return { phase: 'speaking', players: names.map(name => ({ name: name.trim() })), alive: seats, round: 1, turn: 0, spoken: [], speeches: [], voted: [], candidates: seats, ballotId: 0, revotes: 0, ballots: {}, lastVote: null, eliminated: [], winner: null, version: 0, assignments: seats.map(s => ({ word: pair[spies.includes(s) ? 1 : 0], role: spies.includes(s) ? 'undercover' : 'civilian' })) }
}

export function speak(game, seat, text, skip = false) {
  if (game.phase !== 'speaking' || seat !== game.turn || !game.alive.includes(seat)) throw new Error('还没轮到你发言')
  if (!skip && (typeof text !== 'string' || !text.trim() || [...text.trim()].length > 120)) throw new Error('描述请填写 1 到 120 个字')
  if (!skip && text.includes(game.assignments[seat].word)) throw new Error('描述里不能直接写出自己的词语')
  const next = { ...game, spoken: [...game.spoken, seat], speeches: [...game.speeches, { seat, round: game.round, text: skip ? '（跳过发言）' : text.trim() }], version: game.version + 1 }
  next.turn = game.alive.find(s => !next.spoken.includes(s)) ?? null
  if (next.turn === null) { next.phase = 'voting'; next.candidates = [...game.alive]; next.ballots = {}; next.voted = []; next.ballotId++; next.revotes = 0 }
  return next
}

export function vote(game, seat, target) {
  if (game.phase !== 'voting' || !game.alive.includes(seat) || !game.candidates.includes(target) || target === seat) throw new Error('请选择其他仍在场的候选玩家')
  if (game.voted.includes(seat)) throw new Error('你已经投过票了')
  const next = { ...game, ballots: { ...game.ballots, [seat]: target }, voted: [...game.voted, seat], version: game.version + 1 }
  if (next.voted.length < game.alive.length) return next
  const counts = Object.fromEntries(game.candidates.map(s => [s, 0]))
  for (const target of Object.values(next.ballots)) counts[target]++
  const max = Math.max(...Object.values(counts))
  const tied = game.candidates.filter(s => counts[s] === max)
  next.lastVote = { round: game.round, counts, tied: tied.length > 1, eliminated: null }
  next.ballots = {}; next.voted = []
  if (tied.length > 1 && !game.revotes) { next.candidates = tied; next.revotes = 1; next.ballotId++; return next }
  if (tied.length === 1) {
    const out = tied[0]
    next.alive = game.alive.filter(s => s !== out)
    next.eliminated = [...game.eliminated, { seat: out, role: game.assignments[out].role }]
    next.lastVote.eliminated = out
    const spies = next.alive.filter(s => game.assignments[s].role === 'undercover').length
    if (!spies) next.winner = 'civilian'
    else if (next.alive.length <= 3) next.winner = 'undercover'
  }
  if (next.winner) { next.phase = 'finished'; next.turn = null; return next }
  next.phase = 'speaking'; next.round++; next.turn = next.alive[0]; next.spoken = []; next.revotes = 0; next.candidates = [...next.alive]
  return next
}

export function playerSeat(room, id) {
  if (!id || !room?.players) return null
  const seat = room.players.findIndex(p => p?.id === id)
  return seat < 0 ? null : seat
}
