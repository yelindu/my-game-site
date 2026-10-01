import useRoom from '../../services/useOnlineRoom.js'
import { createGame } from './gomoku.js'
import { gameFromSnapshot } from './online.js'

const config = {
  kind: 'gomoku', rooms: 'rooms', moves: 'moves',
  create: 'create_gomoku_lobby', join: 'enter_gomoku_lobby',
  snapshot: 'get_gomoku_snapshot', play: 'play_gomoku_move',
  initial: createGame, decode: gameFromSnapshot,
  moveParameters: (_room, row, column) => ({ target_x: column, target_y: row }),
}
export default function useOnlineRoom() { return useRoom(config) }
