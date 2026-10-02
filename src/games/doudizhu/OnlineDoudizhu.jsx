import RoomLobby from '../../components/RoomLobby.jsx'
import useRoomEntry from '../../components/useRoomEntry.jsx'
import useRoom from '../../services/useOnlineRoom.js'
import DoudizhuGame from './DoudizhuGame.jsx'

const config = {
  kind: 'doudizhu', rooms: 'doudizhu_rooms',
  create: 'create_doudizhu_lobby', join: 'enter_doudizhu_lobby', snapshot: 'get_doudizhu_snapshot',
  initial: () => ({ phase: 'waiting', hand: [], remaining: [0, 0, 0] }),
  decode: ({ room, hand }) => ({ phase: room.status, hand, turn: room.current_turn, bids: room.bids, highestBid: room.highest_bid, landlord: room.landlord, winner: room.winner, lastPlay: room.last_play, passes: room.passes, passed: room.passed, bottom: room.bottom, remaining: room.remaining, multiplier: room.multiplier, spring: room.spring, version: room.version }),
}
const sides = ['seat0', 'seat1', 'seat2']
const names = { seat0: '一号位', seat1: '二号位', seat2: '三号位' }

export default function OnlineDoudizhu({ onBack, inviteCode }) {
  const online = useRoom(config)
  const entry = useRoomEntry(online, inviteCode, onBack)
  if (online.room && online.room.status !== 'waiting') return <DoudizhuGame online={online} onBack={entry.back} headerActions={entry.inviteButton}>{entry.notice}</DoudizhuGame>
  return <RoomLobby online={online} name="斗地主" sides={sides} names={names} onBack={entry.back} inviteCode={inviteCode} inviteButton={entry.inviteButton} notice={entry.notice} onAction={(action, params = {}) => online.submit('doudizhu_lobby_action', { action, ...params })} />
}
