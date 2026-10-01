import RoomLobby from '../../components/RoomLobby.jsx'
import useRoomEntry from '../../components/useRoomEntry.jsx'
import GomokuGame from './GomokuGame.jsx'
import { playerSide } from './online.js'
import useOnlineRoom from './useOnlineRoom.js'

const sides = ['black', 'white']
const names = { black: '黑方', white: '白方', draw: '平局' }

export default function OnlineGomoku({ onBack, inviteCode }) {
  const online = useOnlineRoom()
  const { back, inviteButton, notice } = useRoomEntry(online, inviteCode, onBack)
  const side = playerSide(online.room, online.user?.id)
  const canMove = online.connection === 'connected' && !online.busy
    && online.room?.status === 'playing' && side === online.game.currentPlayer
  let status = '正在连接房间…'
  if (online.room) {
    if (online.connection !== 'connected') status = '连接恢复中，暂时不能落子'
    else if (online.game.winner) status = online.game.winner === 'draw' ? '本局平局' : `${names[online.game.winner]}获胜`
    else if (online.busy) status = '正在提交落子'
    else if (!side) status = `观战中 · ${names[online.game.currentPlayer]}落子`
    else status = canMove ? '轮到你落子' : '等待对方落子'
  }
  if (online.room?.status === 'playing' || online.room?.status === 'finished') {
    return <GomokuGame onBack={back} headerActions={inviteButton} online={{ ...online, canMove, status }}>{notice}</GomokuGame>
  }
  return <RoomLobby online={online} name="五子棋" sides={sides} names={names} onBack={back} inviteCode={inviteCode}
    inviteButton={inviteButton} notice={notice} onAction={(action, parameters = {}) => online.submit('gomoku_lobby_action', { action, ...parameters })} />
}
