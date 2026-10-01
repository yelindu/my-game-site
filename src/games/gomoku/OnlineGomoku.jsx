import OnlineRoomPanel from '../../components/OnlineRoomPanel.jsx'
import GomokuGame from './GomokuGame.jsx'
import { playerSide } from './online.js'
import useOnlineRoom from './useOnlineRoom.js'

const names = { black: '黑方', white: '白方', draw: '平局' }

export default function OnlineGomoku({ onBack, onLocal }) {
  const online = useOnlineRoom()
  const side = playerSide(online.room, online.user?.id)
  const canMove = online.connection === 'connected' && !online.busy
    && online.room?.status === 'playing' && side === online.room.current_turn
  let status = '创建房间或输入邀请码加入'
  if (online.roomId) {
    if (online.connection !== 'connected') status = '连接恢复中，暂时不能落子'
    else if (online.room?.status === 'waiting') status = '等待朋友加入'
    else if (online.game.winner) status = online.game.winner === 'draw' ? '本局平局' : `${names[online.game.winner]}获胜`
    else if (online.busy) status = '正在提交落子'
    else status = side === online.game.currentPlayer ? '轮到你落子' : '等待对方落子'
  }

  function backToLocal() {
    online.leave()
    onLocal()
  }

  function backToLobby() {
    online.leave()
    onBack()
  }

  return (
    <GomokuGame onBack={backToLobby} online={{ ...online, canMove, status }}>
      <OnlineRoomPanel online={online} side={side} names={names} onLocal={backToLocal} />
    </GomokuGame>
  )
}
