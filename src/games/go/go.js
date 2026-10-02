export const SIZE = 9
export const KOMI = 7.5
export const names = { 1: '黑方', 2: '白方' }
export function neighbors(p) {
  const out=[]
  if(p>=SIZE) out.push(p-SIZE)
  if(p<SIZE*(SIZE-1)) out.push(p+SIZE)
  if(p%SIZE) out.push(p-1)
  if(p%SIZE<SIZE-1) out.push(p+1)
  return out
}
export function group(board,start) {
  const stones=[start], liberties=new Set()
  for(let i=0;i<stones.length;i++) for(const p of neighbors(stones[i])) {
    if(board[p]===board[start]&&!stones.includes(p)) stones.push(p)
    else if(board[p]===0) liberties.add(p)
  }
  return {stones,liberties:[...liberties]}
}
export function createGame() {
  return {size:SIZE,phase:'playing',board:Array(SIZE*SIZE).fill(0),turn:1,captures:[0,0,0],moves:[],positions:['0'.repeat(SIZE*SIZE)],passes:0,dead:[],confirmed:[],score:null,winner:null,reason:null,version:0}
}
export function score(board,dead=[]) {
  const cleaned=board.map((c,p)=>dead.includes(p)?0:c)
  const territory=Array(SIZE*SIZE).fill(0),seen=new Set(),stones=[0,0,0],points=[0,0,0]
  for(let p=0;p<cleaned.length;p++) {
    if(cleaned[p]) { stones[cleaned[p]]++; continue }
    if(seen.has(p)) continue
    const region=group(cleaned,p).stones, borders=new Set()
    for(const q of region) {seen.add(q);for(const n of neighbors(q)) if(cleaned[n]) borders.add(cleaned[n])}
    if(borders.size===1) {
      const owner=[...borders][0]
      points[owner]+=region.length
      for(const q of region) territory[q]=owner
    }
  }
  return {black:stones[1]+points[1],white:stones[2]+points[2]+KOMI,stones,points,territory,komi:KOMI}
}
export function apply(game,action,player=game.turn,position=null) {
  if(![1,2].includes(player)) throw new Error('观战者不能操作棋盘')
  if(!['playing','scoring'].includes(game.phase)) throw new Error('对局已经结束')
  const next={...game,version:game.version+1}
  if(action==='resign') return {...next,phase:'finished',winner:3-player,reason:'resign',score:null}
  if(['place','pass'].includes(action)) {
    if(game.phase!=='playing'||player!==game.turn) throw new Error('还没轮到你落子')
    next.turn=3-player
    if(action==='pass') {
      next.passes=game.passes+1
      next.moves=[...game.moves,{type:'pass',position:null,player,captured:[]}]
      if(next.passes===2) {next.phase='scoring';next.dead=[];next.confirmed=[]}
      return next
    }
    if(!Number.isInteger(position)||position<0||position>=SIZE*SIZE) throw new Error('请选择棋盘上的交叉点')
    if(game.board[position]) throw new Error('这个位置已经有棋子')
    const board=[...game.board],captured=[]
    board[position]=player
    for(const n of neighbors(position)) if(board[n]===3-player) {
      const block=group(board,n)
      if(!block.liberties.length) for(const p of block.stones) {board[p]=0;captured.push(p)}
    }
    if(!group(board,position).liberties.length) throw new Error('禁入点：这步落子后没有气')
    const key=board.join('')
    if(game.positions.includes(key)) throw new Error('打劫：不能重复已经出现过的棋盘')
    next.board=board;next.positions=[...game.positions,key];next.passes=0
    next.captures=[...game.captures];next.captures[player]+=captured.length
    next.moves=[...game.moves,{type:'place',position,player,captured:captured.sort((a,b)=>a-b)}]
    return next
  }
  if(game.phase!=='scoring') throw new Error('请先由双方连续停一手，再确认终局')
  if(action==='mark') {
    if(!Number.isInteger(position)||position<0||position>=SIZE*SIZE||!game.board[position]) throw new Error('请选择一块棋子来标记死活')
    const block=group(game.board,position).stones
    next.dead=game.dead.includes(position)?game.dead.filter(p=>!block.includes(p)):[...new Set([...game.dead,...block])].sort((a,b)=>a-b)
    next.confirmed=[]
  } else if(action==='confirm') {
    if(game.confirmed.includes(player)) throw new Error('你已经确认，请等待对方')
    next.confirmed=[...game.confirmed,player]
    if(next.confirmed.length===2) {next.score=score(game.board,game.dead);next.winner=next.score.black>next.score.white?1:2;next.phase='finished';next.reason='score'}
  } else if(action==='resume') {
    next.phase='playing';next.passes=0;next.dead=[];next.confirmed=[]
  } else throw new Error('无效操作')
  return next
}
