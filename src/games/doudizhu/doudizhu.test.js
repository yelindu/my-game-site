import assert from 'node:assert/strict'
import test from 'node:test'
import { bid, beats, classify, computerAction, createGame, findPlays, play, rank } from './doudizhu.js'

export function cardsOf(...ranks) {
  const used = new Map()
  return ranks.map(r => { const i = used.get(r) || 0; used.set(r, i + 1); return r >= 16 ? r + 36 : (r - 3) * 4 + i })
}

test('经典牌型、大小比较和不合法组合', () => {
  const cases = [
    ['single', [17]], ['pair', [15,15]], ['triple', [3,3,3]], ['bomb', [3,3,3,3]], ['rocket', [16,17]],
    ['tripleSingle', [5,5,5,9]], ['triplePair', [5,5,5,9,9]], ['straight', [10,11,12,13,14]],
    ['pairs', [3,3,4,4,5,5]], ['airplane', [3,3,3,4,4,4]],
    ['airplaneSingle', [3,3,3,4,4,4,9,9]], ['airplanePair', [3,3,3,4,4,4,9,9,15,15]],
    ['fourSingle', [3,3,3,3,9,9]], ['fourPair', [3,3,3,3,9,9,15,15]],
  ]
  for (const [type, ranks] of cases) assert.equal(classify(cardsOf(...ranks))?.type, type, type)
  for (const ranks of [[11,12,13,14,15], [3,3,4,4], [3,3,3,4,4,4,4,5], [3,3,3,4,4,4,9], [3,3,3,3,9,9,9,9]]) assert.equal(classify(cardsOf(...ranks)), null)
  for (const cards of [[0,0], [null], [54], [], ['1']]) assert.equal(classify(cards), null)
  const shape = ranks => classify(cardsOf(...ranks))
  assert.ok(beats(shape([3,3,3,3]), shape([14])))
  assert.ok(beats(shape([16,17]), shape([15,15,15,15])))
  assert.ok(!beats(shape([15,15,15,15]), shape([16,17])))
  assert.ok(!beats(shape([10,11,12,13,14]), shape([3,4,5,6,7,8])))
  assert.ok(beats(shape([4,4]), shape([3,3])))
})

test('发牌、叫分、三人全不叫重发，以及底牌只给地主', () => {
  const game = createGame(() => .5)
  assert.equal(new Set([...game.hands.flat(), ...game.bottom]).size, 54)
  assert.deepEqual(game.hands.map(h => h.length), [17,17,17])
  const one = bid(game, 1)
  assert.throws(() => bid(one, 1), /更高/)
  const finish = bid(bid(one, 0), 0)
  assert.equal(finish.phase, 'playing'); assert.equal(finish.landlord, 0); assert.equal(finish.turn, 0)
  assert.deepEqual(finish.hands.map(h => h.length), [20,17,17])
  const redeal = bid(bid(bid(game, 0), 0), 0)
  assert.equal(redeal.phase, 'bidding'); assert.equal(redeal.redealt, true); assert.equal(redeal.version, 3)
  assert.equal(bid(game, 3).phase, 'playing')
})

test('连续两人不出恢复牌权、禁止偷牌/重复牌，炸弹倍数和阵营获胜', () => {
  const game = { ...createGame(), phase: 'playing', landlord: 0, hands: [cardsOf(3,3,3,3,4), cardsOf(5,5), cardsOf(6,6)] }
  assert.throws(() => play(game, []), /不能不出/)
  assert.throws(() => play(game, cardsOf(17)), /自己/)
  assert.throws(() => play(game, [0,0]), /有效牌型/)
  const bomb = play(game, cardsOf(3,3,3,3))
  assert.equal(bomb.multiplier, 2)
  assert.throws(() => play(bomb, cardsOf(5)), /更大的/)
  const lead = play(play(bomb, []), [])
  assert.equal(lead.turn, 0); assert.equal(lead.lastPlay, null)
  const win = play(lead, cardsOf(4))
  assert.equal(win.winner, 'landlord'); assert.equal(win.phase, 'finished')
  assert.equal(win.spring, true); assert.equal(win.multiplier, 4)
  assert.throws(() => play(win, []), /结束/)
  const farmer = play({ ...game, turn: 1 }, cardsOf(5,5))
  assert.equal(farmer.winner, 'farmers')
})

test('电脑与提示使用自己的合法手牌，多次随机对局均可结束', () => {
  let seed = 812345
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
  for (let i = 0; i < 80; i++) {
    let game = createGame(random)
    let steps = 0
    while (game.phase !== 'finished' && steps++ < 600) {
      const action = computerAction(game)
      if (game.phase === 'bidding') game = bid(game, action.bid, random)
      else {
        for (const option of findPlays(game.hands[game.turn], game.lastPlay?.shape)) {
          assert.ok(option.cards.every(c => game.hands[game.turn].includes(c)))
          assert.ok(beats(classify(option.cards), game.lastPlay?.shape))
        }
        game = play(game, action.cards)
      }
    }
    assert.equal(game.phase, 'finished', `game ${i}, ${steps} steps`)
    assert.ok(['landlord', 'farmers'].includes(game.winner))
    assert.ok(game.hands.some(h => h.length === 0))
    assert.ok(game.hands.flat().every(c => rank(c) >= 3))
  }
})
