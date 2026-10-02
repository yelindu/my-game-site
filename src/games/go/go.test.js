import {test} from 'node:test'
import assert from 'node:assert/strict'
import {apply,createGame,group,score} from './go.js'
export function position(black=[],white=[]) {
  const game=createGame()
  for(const p of black) game.board[p]=1
  for(const p of white) game.board[p]=2
  game.positions=[game.board.join('')]
  return game
}
test('9x9 starts black, alternates, rejects occupied/bounds/observer, and keeps input immutable',()=>{
  const game=createGame(),next=apply(game,'place',1,0)
  assert.equal(game.board.length,81);assert.equal(next.turn,2);assert.equal(next.board[0],1);assert.equal(game.board[0],0)
  assert.throws(()=>apply(next,'place',1,1));assert.throws(()=>apply(next,'place',2,0))
  for(const p of [-1,81,null,1.2]) assert.throws(()=>apply(game,'place',1,p))
  assert.throws(()=>apply(game,'pass',null))
  assert.deepEqual(group(position([0,10]).board,0).stones,[0])
})
test('connected chains are captured once even when touching a move twice; capture precedes suicide',()=>{
  const next=apply(position([1,2,9,12,18,28],[10,11,19]),'place',1,20)
  assert.equal(next.captures[1],3);assert.deepEqual(next.moves[0].captured,[10,11,19])
  assert.ok([10,11,19].every(p=>next.board[p]===0))
  const filled=apply(position([22,30,32,38,48,42,50,58],[31,39,41,49]),'place',1,40)
  assert.equal(filled.captures[1],4);assert.equal(filled.board[40],1)
  assert.throws(()=>apply(position([],[31,39,41,49]),'place',1,40),/禁入/)
  const capture=apply(position([31,39,49],[40,32,42,50]),'place',1,41)
  assert.equal(capture.board[40],0);assert.equal(capture.captures[1],1)
})
test('positional superko forbids immediate and older repeats, while a ko exchange elsewhere permits recapture',()=>{
  const before=position([31,39,49],[40,32,42,50])
  let game=apply(before,'place',1,41)
  assert.throws(()=>apply(game,'place',2,40),/打劫/)
  game=apply(game,'place',2,0);game=apply(game,'place',1,80);game=apply(game,'place',2,40)
  assert.equal(game.board[41],0);assert.equal(game.captures[2],1)
  const repeat=createGame(); const future=apply(repeat,'place',1,20).board.join('')
  repeat.positions=[future,'0'.repeat(81)]
  assert.throws(()=>apply(repeat,'place',1,20),/打劫/)
})
test('two passes enter scoring; dead chains toggle together and any change invalidates confirmations',()=>{
  let game=position([0,1],[80])
  game=apply(game,'pass',1);game=apply(game,'pass',2)
  assert.equal(game.phase,'scoring');assert.throws(()=>apply(game,'place',1,40))
  game=apply(game,'mark',2,0);assert.deepEqual(game.dead,[0,1])
  game=apply(game,'confirm',1);assert.throws(()=>apply(game,'confirm',1))
  game=apply(game,'mark',2,1);assert.deepEqual(game.dead,[]);assert.deepEqual(game.confirmed,[])
  assert.throws(()=>apply(game,'mark',1,40))
  game=apply(game,'resume',2);assert.equal(game.phase,'playing');assert.equal(game.turn,1);assert.equal(game.passes,0)
  game=apply(game,'pass',1);game=apply(game,'place',2,40);assert.equal(game.passes,0)
})
test('area scoring counts live stones plus single-color empty regions; mixed regions are neutral and komi applies',()=>{
  const black=Array.from({length:9},(_,i)=>i*9+3),white=Array.from({length:9},(_,i)=>i*9+5)
  const board=position(black,white).board
  const result=score(board)
  assert.equal(result.black,36);assert.equal(result.white,43.5);assert.equal(result.territory[4],0)
  board[10]=2
  const cleaned=score(board,[10]);assert.equal(cleaned.black,36);assert.equal(cleaned.white,43.5);assert.equal(cleaned.territory[10],1)
  assert.equal(score(createGame().board).white,7.5)
})
test('both colors must confirm the current proposal; resignation and scored endings lock further moves',()=>{
  let game=apply(apply(createGame(),'pass',1),'pass',2)
  game=apply(game,'confirm',1);assert.equal(game.phase,'scoring')
  game=apply(game,'confirm',2);assert.equal(game.phase,'finished');assert.equal(game.winner,2)
  assert.throws(()=>apply(game,'resume',1));assert.throws(()=>apply(game,'place',1,0))
  const resign=apply(createGame(),'resign',1);assert.equal(resign.winner,2);assert.equal(resign.reason,'resign');assert.equal(resign.score,null)
})
