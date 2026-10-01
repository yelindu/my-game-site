import useRoom from '../../services/useOnlineRoom.js'
import { createGame } from './xiangqi.js'
import { gameFromSnapshot } from './online.js'

const config = {
  kind: 'xiangqi', rooms: 'xiangqi_rooms', moves: 'xiangqi_moves',
  create: 'create_xiangqi_lobby', join: 'enter_xiangqi_lobby',
  snapshot: 'get_xiangqi_snapshot', play: 'play_xiangqi_move',
  initial: createGame, decode: gameFromSnapshot,
  moveParameters: (room, from, to) => ({ source_index: from, target_index: to, expected_move_number: room?.move_number }),
}
export default function useOnlineRoom() { return useRoom(config) }
