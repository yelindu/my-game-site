import RoomLobby from '../../components/RoomLobby.jsx'
import useRoomEntry from '../../components/useRoomEntry.jsx'
import useRoom from '../../services/useOnlineRoom.js'
import {playerSide} from '../gomoku/online.js'
import {createGame} from './go.js'
import GoGame from './GoGame.jsx'
const config={kind:'go',rooms:'go_rooms',create:'create_go_lobby',join:'enter_go_lobby',snapshot:'get_go_snapshot',initial:createGame,decode:({room})=>room.state}
const sides=['black','white'],names={black:'黑方',white:'白方'}
export default function OnlineGo({onBack,inviteCode}) {
  const online=useRoom(config),entry=useRoomEntry(online,inviteCode,onBack)
  const side=playerSide(online.room,online.user?.id),player=side==='black'?1:side==='white'?2:null
  if(online.room&&online.room.status!=='waiting') return <GoGame online={{...online,player}} onBack={entry.back} headerActions={entry.inviteButton}>{entry.notice}</GoGame>
  return <RoomLobby online={online} name="围棋" sides={sides} names={names} onBack={entry.back} inviteCode={inviteCode} inviteButton={entry.inviteButton} notice={entry.notice} onAction={(action,parameters={})=>online.submit('go_lobby_action',{action,...parameters})} />
}
