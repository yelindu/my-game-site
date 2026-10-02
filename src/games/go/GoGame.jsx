import { useState } from 'react'
import { apply, createGame, names, score } from './go.js'
import './go.css'

export default function GoGame({online,onBack,headerActions,children}) {
  const [local,setLocal]=useState(createGame)
  const [error,setError]=useState('')
  const [confirmation,setConfirmation]=useState(null)
  const game=online?.game||local
  const player=online?online.player:game.turn
  const ready=!online||online.connection==='connected'&&!online.busy
  const canMove=ready&&game.phase==='playing'&&player===game.turn
  const canMark=ready&&game.phase==='scoring'&&Boolean(player)
  const result=game.score||(game.phase==='scoring'?score(game.board,game.dead):null)
  const last=game.moves.findLast(m=>m.type==='place')
  let status=game.phase==='finished'?`${names[game.winner]}获胜${game.reason==='resign'?' · 对方认输':''}`:game.phase==='scoring'?'终局确认 · 点击棋子标记死活':`轮到${names[game.turn]}落子${game.passes?' · 上一手停着':''}`
  if(online&&!player&&game.phase!=='finished') status=`观战中 · ${status}`
  if(!ready) status='正在同步对局，请稍候…'
  async function act(action,position=null,color=player) {
    setError('');setConfirmation(null)
    try {
      if(online) await online.submit('go_game_action',{action,move_index:position,expected_version:game.version})
      else setLocal(apply(game,action,color,position))
    } catch(failure) {setError(failure.message)}
  }
  return <section className="go-match" aria-label="围棋对局">
    <header className="boardgame-mini-header"><button className="boardgame-button boardgame-button--small" onClick={onBack}>返回主页</button><div><h1>围棋</h1><small>{online?`房间号：${online.room.code}`:'本地对战'} · 9 路</small></div>{headerActions||<span />}</header>
    {children}<p className="boardgame-match-status" role="status">{status}</p>
    {online&&<p className="boardgame-player-names">黑方：{online.room.black_name||'棋友'} <span>对</span> 白方：{online.room.white_name||'棋友'}</p>}
    <p className="go-summary">黑方提子 {game.captures[1]} · 白方提子 {game.captures[2]} · 白方贴 7.5 目</p>
    <div className="go-board" role="grid" aria-label="九乘九围棋棋盘">{game.board.map((stone,p)=>{
      const dead=game.dead.includes(p),isLast=last?.position===p&&Boolean(stone)
      const owner=result?.territory[p]
      return <button key={p} role="gridcell" className={`go-cell${p%9===0?' go-cell--left':''}${p%9===8?' go-cell--right':''}${p<9?' go-cell--top':''}${p>=72?' go-cell--bottom':''}`} disabled={game.phase==='scoring'? !canMark||!stone : !canMove||Boolean(stone)} aria-label={`第${Math.floor(p/9)+1}行第${p%9+1}列，${stone===1?'黑子':stone===2?'白子':'空位'}${dead?'，标记死子':''}`} aria-pressed={game.phase==='scoring'&&stone?dead:undefined} onClick={()=>act(game.phase==='scoring'?'mark':'place',p)}>
        {[20,24,40,56,60].includes(p)&&<span className="go-star" />}
        {stone?<span className={`go-stone go-stone--${stone===1?'black':'white'}${dead?' go-stone--dead':''}${isLast?' go-stone--last':''}`}>{dead?'×':''}</span>:owner?<span className={`go-territory go-territory--${owner}`} />:null}
      </button>
    })}</div>
    {result&&<p className="go-score" role="status">黑方 {result.black} 目 · 白方 {result.white} 目（含贴目）</p>}
    {game.phase==='playing'&&<div className="boardgame-controls"><button className="boardgame-button" disabled={!canMove} onClick={()=>act('pass')}>停一手</button><button className="boardgame-button" disabled={!ready||!player} onClick={()=>setConfirmation('resign')}>认输</button></div>}
    {game.phase==='scoring'&&<><p className="go-hint">点击一块棋子标记或取消死子。双方认可后确认；有争议可恢复下棋。</p><div className="boardgame-controls">{(online?[player]:[1,2]).filter(Boolean).map(color=><button key={color} className="boardgame-button boardgame-button--primary" disabled={!ready||game.confirmed.includes(color)} onClick={()=>act('confirm',null,color)}>{game.confirmed.includes(color)?`${names[color]}已确认`:`${names[color]}确认终局`}</button>)}<button className="boardgame-button" disabled={!canMark} onClick={()=>act('resume')}>恢复下棋</button></div><p className="go-hint">{game.confirmed.map(c=>names[c]).join('、')||'双方尚未'}{game.confirmed.length?'已确认，等待另一方':'确认'}</p></>}
    {confirmation&&<div className="go-confirm" role="alert"><p>{confirmation==='resign'?'确认认输，结束本局？':'确认重新开始，清空当前棋盘？'}</p><div className="boardgame-controls"><button className="boardgame-button" onClick={()=>setConfirmation(null)}>取消</button><button className="boardgame-button boardgame-button--primary" onClick={()=>confirmation==='resign'?act('resign'):(setLocal(createGame()),setConfirmation(null),setError(''))}>{confirmation==='resign'?'确认认输':'确认重开'}</button></div></div>}
    {!online&&<div className="boardgame-controls"><button className="boardgame-button boardgame-button--small" onClick={()=>setConfirmation('restart')}>重新开始</button></div>}
    {online&&game.phase==='finished'&&<div className="boardgame-controls"><button className="boardgame-button boardgame-button--primary" disabled={!ready||online.room.creator_id!==online.user?.id} onClick={()=>online.submit('go_lobby_action',{action:'reset'})}>再来一局</button></div>}
    {error&&<p role="alert" className="boardgame-notice boardgame-error">{error}</p>}
  </section>
}
