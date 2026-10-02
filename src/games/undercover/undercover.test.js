import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGame, speak, vote, playerSeat, wordPairs } from './undercover.js'
const party = count => createGame(Array.from({length:count},(_,i)=>`玩家${i+1}`),()=>.25)
const describe = game => { while(game.phase==='speaking') game=speak(game,game.turn,'生活里可以见到'); return game }
const ballot = (game, targets) => targets.reduce((state,target,seat)=>vote(state,seat,target),game)

test('4–8 players get two related words and the correct hidden role count',()=>{
  for(let n=4;n<=8;n++) {
    const game=party(n)
    assert.equal(game.assignments.filter(p=>p.role==='undercover').length,n>=7?2:1)
    assert.equal(new Set(game.assignments.map(p=>p.word)).size,2)
    assert.ok(wordPairs.some(pair=>game.assignments.every(p=>pair.includes(p.word))))
  }
  assert.throws(()=>party(3)); assert.throws(()=>party(9))
  assert.throws(()=>createGame(['a','b','c',' ']))
  assert.throws(()=>createGame(['a','b','c','过长的名字'.repeat(4)]))
  assert.equal(playerSeat({players:[null,{id:'b'}]},'b'),1)
  assert.equal(playerSeat({players:[]},'a'),null)
})
test('descriptions require the current player and cannot expose their literal word',()=>{
  const game=party(4)
  assert.throws(()=>speak(game,1,'生活里可以见到'))
  assert.throws(()=>speak(game,0,'')); assert.throws(()=>speak(game,0,'字'.repeat(121)))
  assert.throws(()=>speak(game,0,`我的词是${game.assignments[0].word}`))
  const next=speak(game,0,'',true)
  assert.equal(next.turn,1); assert.deepEqual(game.spoken,[])
  assert.equal(describe(next).phase,'voting')
})
test('votes remain private until complete; self-votes, spectators and repeats are rejected',()=>{
  const game=describe(party(4))
  assert.throws(()=>vote(game,0,0)); assert.throws(()=>vote(game,8,0))
  const next=vote(game,0,1)
  assert.equal(next.lastVote,null); assert.deepEqual(next.ballots,{0:1})
  assert.throws(()=>vote(next,0,2)); assert.deepEqual(game.voted,[])
})
test('tie restricts the revote; second tie advances without eliminating anyone',()=>{
  let game=ballot(describe(party(4)),[1,0,1,0])
  assert.equal(game.phase,'voting'); assert.deepEqual(game.candidates,[0,1]); assert.equal(game.revotes,1)
  assert.throws(()=>vote(game,0,2))
  game=ballot(game,[1,0,1,0])
  assert.equal(game.phase,'speaking'); assert.equal(game.round,2); assert.equal(game.alive.length,4)
  assert.equal(game.eliminated.length,0); assert.equal(game.lastVote.tied,true)
})
test('eliminating every undercover wins for civilians; an undercover among the last three wins',()=>{
  for(const eliminateSpy of [true,false]) {
    let game=describe(party(4))
    const out=game.assignments.findIndex(p=>(p.role==='undercover')===eliminateSpy)
    game=ballot(game,game.alive.map(s=>s===out?(s+1)%4:out))
    assert.equal(game.phase,'finished'); assert.equal(game.winner,eliminateSpy?'civilian':'undercover')
    assert.equal(game.eliminated[0].seat,out); assert.deepEqual(game.ballots,{})
  }
})
test('two undercovers require two eliminations, and eliminated players cannot act',()=>{
  let game=describe(party(8))
  const spies=game.alive.filter(s=>game.assignments[s].role==='undercover')
  for(const out of spies) {
    for(const s of [...game.alive]) game=vote(game,s,s===out?game.alive.find(v=>v!==out):out)
    if(out===spies[0]) {
      assert.equal(game.phase,'speaking'); assert.equal(game.winner,null)
      assert.throws(()=>speak(game,out,'生活里可以见到'))
      game=describe(game); assert.throws(()=>vote(game,out,spies[1]))
    }
  }
  assert.equal(game.winner,'civilian')
})
