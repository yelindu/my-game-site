import RoomLobby from '../../components/RoomLobby.jsx'
import useRoomEntry from '../../components/useRoomEntry.jsx'
import useRoom from '../../services/useOnlineRoom.js'
import UndercoverGame from './UndercoverGame.jsx'

const config = {
  kind: 'undercover', rooms: 'undercover_rooms', create: 'create_undercover_lobby', join: 'enter_undercover_lobby', snapshot: 'get_undercover_snapshot',
  initial: () => ({ phase: 'waiting' }),
  decode: ({ room, word, my_vote }) => ({ phase: room.status, players: room.players, alive: room.alive, round: room.round_number, turn: room.current_turn, spoken: room.spoken, speeches: room.speeches, voted: room.voted, candidates: room.vote_candidates, ballotId: room.ballot_id, revotes: room.revotes, lastVote: room.last_vote, eliminated: room.eliminated, winner: room.winner, result: room.result, version: room.version, gameNo: room.game_number, word, myVote: my_vote }),
}
const sides = Array.from({ length: 8 }, (_, i) => `seat${i}`)
const names = Object.fromEntries(sides.map((s,i) => [s,`${i+1}号位`]))

export default function OnlineUndercover({ onBack, inviteCode }) {
  const online = useRoom(config)
  const entry = useRoomEntry(online, inviteCode, onBack)
  if (online.room && online.room.status !== 'waiting') return <UndercoverGame online={online} onBack={entry.back} headerActions={entry.inviteButton}>{entry.notice}</UndercoverGame>
  return <RoomLobby online={online} name="谁是卧底" sides={sides} names={names} minPlayers={4} defaultNickname="玩家" onBack={entry.back} inviteCode={inviteCode} inviteButton={entry.inviteButton} notice={entry.notice} onAction={(action, parameters = {}) => online.submit('undercover_lobby_action', { action, ...parameters })} />
}
