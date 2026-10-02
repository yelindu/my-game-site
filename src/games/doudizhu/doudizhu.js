export const rank = card => card < 52 ? Math.floor(card / 4) + 3 : card - 36
export const sortCards = cards => [...cards].sort((a, b) => rank(b) - rank(a) || b - a)
export const cardLabel = card => card === 52 ? '小王' : card === 53 ? '大王' : `${['♠', '♥', '♣', '♦'][card % 4]}${({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2' })[rank(card)] || rank(card)}`
export const shapeNames = { single: '单张', pair: '对子', triple: '三张', tripleSingle: '三带一', triplePair: '三带二', straight: '顺子', pairs: '连对', airplane: '飞机', airplaneSingle: '飞机带单', airplanePair: '飞机带对', fourSingle: '四带二', fourPair: '四带两对', bomb: '炸弹', rocket: '王炸' }

export function classify(cards) {
  if (!Array.isArray(cards) || !cards.length || cards.length > 20 || new Set(cards).size !== cards.length || cards.some(c => !Number.isInteger(c) || c < 0 || c > 53)) return null
  const counts = new Map()
  for (const card of cards) counts.set(rank(card), (counts.get(rank(card)) || 0) + 1)
  const ranks = [...counts.keys()].sort((a, b) => a - b)
  const n = cards.length
  const shape = (type, main) => ({ type, main, length: n })
  if (n === 2 && counts.has(16) && counts.has(17)) return shape('rocket', 17)
  if (ranks.length === 1) return shape(({ 1: 'single', 2: 'pair', 3: 'triple', 4: 'bomb' })[n], ranks[0])
  const triple = ranks.find(r => counts.get(r) === 3)
  if (n === 4 && triple) return shape('tripleSingle', triple)
  if (n === 5 && triple && ranks.length === 2) return shape('triplePair', triple)
  const consecutive = ranks.at(-1) <= 14 && ranks.every((r, i) => !i || r === ranks[i - 1] + 1)
  if (consecutive && n >= 5 && ranks.length === n) return shape('straight', ranks.at(-1))
  if (consecutive && ranks.length >= 3 && ranks.every(r => counts.get(r) === 2)) return shape('pairs', ranks.at(-1))
  for (const [type, unit] of [['airplane', 3], ['airplaneSingle', 4], ['airplanePair', 5]]) {
    const size = n / unit
    if (!Number.isInteger(size) || size < 2) continue
    for (let start = 3; start + size - 1 <= 14; start++) {
      const body = Array.from({ length: size }, (_, i) => start + i)
      if (!body.every(r => counts.get(r) === 3)) continue
      const wings = ranks.filter(r => !body.includes(r))
      if (type === 'airplane' && !wings.length
        || type === 'airplaneSingle' && wings.every(r => counts.get(r) <= 2)
        || type === 'airplanePair' && wings.length === size && wings.every(r => counts.get(r) === 2)) return shape(type, start + size - 1)
    }
  }
  const four = ranks.find(r => counts.get(r) === 4)
  if (four && n === 6) return shape('fourSingle', four)
  if (four && n === 8 && ranks.length === 3 && ranks.filter(r => r !== four).every(r => counts.get(r) === 2)) return shape('fourPair', four)
  return null
}

export function beats(shape, previous) {
  if (!shape) return false
  if (!previous) return true
  if (previous.type === 'rocket') return false
  if (shape.type === 'rocket') return true
  if (shape.type === 'bomb' && previous.type !== 'bomb') return true
  return shape.type === previous.type && shape.length === previous.length && shape.main > previous.main
}

export function createGame(random = Math.random) {
  const deck = Array.from({ length: 54 }, (_, i) => i)
  for (let i = 53; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]] }
  return { phase: 'bidding', hands: [0, 1, 2].map(s => sortCards(deck.slice(s * 17, (s + 1) * 17))), bottom: deck.slice(51), turn: 0, bids: [null, null, null], highestBid: 0, landlord: null, winner: null, lastPlay: null, passes: 0, passed: [false, false, false], multiplier: 1, playCounts: [0, 0, 0], spring: false, version: 0 }
}

export function bid(game, value, random = Math.random) {
  if (game.phase !== 'bidding' || !Number.isInteger(value) || value < 0 || value > 3 || value && value <= game.highestBid) throw new Error('请选择更高的叫分，或不叫')
  const next = { ...game, bids: [...game.bids], turn: (game.turn + 1) % 3, version: game.version + 1 }
  next.bids[game.turn] = value
  if (value > game.highestBid) { next.highestBid = value; next.landlord = game.turn }
  if (value === 3 || next.bids.every(v => v !== null)) {
    if (!next.highestBid) return { ...createGame(random), version: next.version, redealt: true }
    next.phase = 'playing'; next.turn = next.landlord; next.multiplier = next.highestBid
    next.hands = next.hands.map((hand, s) => s === next.landlord ? sortCards([...hand, ...next.bottom]) : hand)
  }
  return next
}

export function play(game, cards) {
  if (game.phase !== 'playing') throw new Error('本局尚未开始或已经结束')
  if (!Array.isArray(cards)) throw new Error('请选择手牌')
  const seat = game.turn
  const next = { ...game, turn: (seat + 1) % 3, version: game.version + 1, passed: [...game.passed] }
  if (!cards.length) {
    if (!game.lastPlay || game.lastPlay.seat === seat) throw new Error('你先出牌，不能不出')
    next.passed[seat] = true; next.passes = game.passes + 1
    if (next.passes === 2) { next.lastPlay = null; next.passes = 0; next.passed = [false, false, false] }
    return next
  }
  const shape = classify(cards)
  if (!shape) throw new Error('这些牌不能组成有效牌型')
  if (!cards.every(card => game.hands[seat].includes(card))) throw new Error('请选择自己的手牌')
  if (!beats(shape, game.lastPlay?.shape)) throw new Error('需要出相同牌型且更大的牌，或炸弹、王炸')
  next.hands = game.hands.map((hand, s) => s === seat ? hand.filter(c => !cards.includes(c)) : hand)
  next.lastPlay = { seat, cards: sortCards(cards), shape }; next.passes = 0; next.passed = [false, false, false]
  next.playCounts = [...(game.playCounts || [0, 0, 0])]; next.playCounts[seat]++
  if (shape.type === 'bomb' || shape.type === 'rocket') next.multiplier *= 2
  if (!next.hands[seat].length) {
    next.phase = 'finished'; next.winner = seat === game.landlord ? 'landlord' : 'farmers'
    next.spring = next.winner === 'landlord' ? next.playCounts.every((n, s) => s === game.landlord || n === 0) : next.playCounts[game.landlord] <= 1
    if (next.spring) next.multiplier *= 2
  }
  return next
}

export function findPlays(hand, previous = null) {
  const groups = new Map()
  for (const c of [...hand].sort((a, b) => rank(a) - rank(b))) {
    if (!groups.has(rank(c))) groups.set(rank(c), [])
    groups.get(rank(c)).push(c)
  }
  const found = new Map()
  const add = cards => { const s = classify(cards); if (beats(s, previous)) found.set([...cards].sort((a, b) => a - b).join(','), { cards, shape: s }) }
  const attach = (body, size, pairs) => {
    const used = new Set(body.map(rank))
    const available = [...groups].filter(([r]) => !used.has(r))
    const wings = pairs ? available.filter(([, g]) => g.length >= 2).slice(0, size).flatMap(([, g]) => g.slice(0, 2)) : available.flatMap(([, g]) => g.slice(0, 2)).slice(0, size)
    if (wings.length === size * (pairs ? 2 : 1)) add([...body, ...wings])
  }
  for (const g of groups.values()) {
    for (let n = 1; n <= g.length; n++) add(g.slice(0, n))
    if (g.length >= 3) { attach(g.slice(0, 3), 1, false); attach(g.slice(0, 3), 1, true) }
    if (g.length === 4) { attach(g, 2, false); attach(g, 2, true) }
  }
  if (groups.has(16) && groups.has(17)) add([52, 53])
  for (const [unit, min] of [[1, 5], [2, 3], [3, 2]]) {
    for (let start = 3; start <= 14; start++) {
      const body = []
      for (let end = start; end <= 14 && (groups.get(end)?.length || 0) >= unit; end++) {
        body.push(...groups.get(end).slice(0, unit))
        const size = end - start + 1
        if (size < min) continue
        add([...body])
        if (unit === 3) { attach(body, size, false); attach(body, size, true) }
      }
    }
  }
  // ponytail: lowest available wings suffice for hints and casual bots; search more attachments for a stronger AI.
  return [...found.values()].sort((a, b) => {
    const power = s => s.type === 'rocket' ? 2 : s.type === 'bomb' ? 1 : 0
    return power(a.shape) - power(b.shape) || (previous ? a.shape.main - b.shape.main : b.cards.length - a.cards.length || a.shape.main - b.shape.main)
  })
}

export function computerAction(game) {
  const hand = game.hands[game.turn]
  if (game.phase === 'bidding') {
    const strength = hand.filter(c => rank(c) >= 15).length + findPlays(hand).filter(p => p.shape.type === 'bomb').length * 2
    const score = strength >= 6 ? 3 : strength >= 4 ? 2 : strength >= 2 ? 1 : 0
    return { bid: score > game.highestBid ? score : 0 }
  }
  if (game.lastPlay && game.turn !== game.landlord && game.lastPlay.seat !== game.landlord) return { cards: [] }
  return { cards: findPlays(hand, game.lastPlay?.shape)[0]?.cards || [] }
}

export function playerSeat(room, id) {
  if (!id || !room) return null
  const seat = [0, 1, 2].find(s => room[`seat${s}_player_id`] === id)
  return seat ?? null
}
