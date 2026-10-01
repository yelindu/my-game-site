import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createGame, legalMoves, playMove, isInCheck } from '../src/games/xiangqi/xiangqi.js'

const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])))
const db = new PGlite()
const ids = ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333']
try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    create publication supabase_realtime;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;`)
  for (const id of ids) await db.query('insert into auth.users values ($1)', [id])
  await db.exec(await readFile(new URL('../supabase/setup-gomoku.sql', import.meta.url), 'utf8'))
  await db.exec(await readFile(new URL('../supabase/migrations/20261001010000_xiangqi_rooms.sql', import.meta.url), 'utf8'))
  async function asUser(id, sql, args = []) {
    return db.transaction(async tx => {
      await tx.exec('set local role authenticated')
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [id])
      return (await tx.query(sql, args)).rows
    })
  }
  const create = async () => (await asUser(ids[0], 'select * from create_xiangqi_room()'))[0]
  const join = async (id, code) => (await asUser(id, 'select join_xiangqi_room($1) as id', [code]))[0].id
  const snapshot = async (id, room) => (await asUser(id, 'select get_xiangqi_snapshot($1) as data', [room]))[0].data
  const move = (id, room, from, to, version) => asUser(id, 'select play_xiangqi_move($1,$2,$3,$4)', [room, from, to, version])
  const draw = (id, room, action) => asUser(id, 'select xiangqi_draw($1,$2)', [room, action])
  const permissions = (await db.query(`select proname,
    has_function_privilege('anon', oid, 'EXECUTE') as anon_execute,
    has_function_privilege('authenticated', oid, 'EXECUTE') as user_execute
    from pg_proc where proname like 'xiangqi_%' or proname in ('create_xiangqi_room','join_xiangqi_room','get_xiangqi_snapshot','play_xiangqi_move')`)).rows
  assert.equal(permissions.length, 12)
  assert.ok(permissions.every(p => !p.anon_execute))
  assert.equal(permissions.filter(p => p.user_execute).length, 5)
  const room = await create()
  assert.equal(await join(ids[0], room.room_code), room.room_id)
  await assert.rejects(move(ids[0], room.room_id, 54, 45, 0), /not playable/)
  assert.equal(await join(ids[1], room.room_code.toLowerCase()), room.room_id)
  await assert.rejects(join(ids[2], room.room_code), /unavailable/)
  assert.equal(await snapshot(ids[2], room.room_id), null)
  assert.equal((await asUser(ids[2], 'select * from xiangqi_rooms')).length, 0)
  assert.equal((await asUser(ids[2], 'select * from xiangqi_moves')).length, 0)
  await assert.rejects(asUser(ids[0], 'update xiangqi_rooms set current_turn = $1', ['black']), /permission denied/)
  await assert.rejects(asUser(ids[0], 'select xiangqi_initial_board()'), /permission denied/)
  await assert.rejects(move(ids[2], room.room_id, 54, 45, 0), /unavailable/)
  await assert.rejects(move(ids[1], room.room_id, 27, 36, 0), /not your turn/)
  await assert.rejects(move(ids[0], room.room_id, 54, 55, 0), /illegal/)
  await assert.rejects(move(ids[0], room.room_id, null, 45, 0), /illegal/)
  let game = createGame()
  assert.deepEqual((await snapshot(ids[0], room.room_id)).room.board, game.board)
  // Compare every legal destination, including blocked legs, river, palace and self-check.
  async function compare(board) {
    const sqlMoves = (await db.query(`select f, t from generate_series(0,89) f cross join generate_series(0,89) t
      where xiangqi_legal_move($1::jsonb,f,t) order by f,t`, [JSON.stringify(board)])).rows
    const jsMoves = board.flatMap((p, f) => p ? legalMoves(board, f).map(t => ({ f, t })) : [])
    assert.deepEqual(sqlMoves, jsMoves)
    for (const side of ['red', 'black']) {
      assert.equal((await db.query('select xiangqi_in_check($1::jsonb,$2) as checked', [JSON.stringify(board), side])).rows[0].checked, isInCheck(board, side))
    }
  }
  await compare(game.board)
  for (let step = 0; step < 80 && !game.winner; step++) {
    const choices = game.board.flatMap((p, from) => p?.side === game.currentPlayer ? legalMoves(game.board, from).map(to => ({ from, to })) : [])
    const { from, to } = choices[(step * 37 + 19) % choices.length]
    await move(ids[game.currentPlayer === 'red' ? 0 : 1], room.room_id, from, to, step)
    game = playMove(game, from, to)
    const data = await snapshot(ids[1], room.room_id)
    assert.deepEqual(data.room.board, game.board)
    assert.equal(data.room.current_turn, game.currentPlayer)
    assert.equal(data.room.winner, game.winner)
    assert.equal(data.room.reason, game.reason)
    assert.equal(data.moves.length, step + 1)
    if (step % 10 === 0) await compare(game.board)
    await assert.rejects(move(ids[0], room.room_id, from, to, step), /stale position|not playable/)
  }
  const second = await create()
  await join(ids[1], second.room_code)
  await draw(ids[0], second.room_id, 'offer')
  await assert.rejects(draw(ids[0], second.room_id, 'accept'), /no opponent/)
  await assert.rejects(draw(ids[2], second.room_id, 'accept'), /unavailable/)
  await draw(ids[1], second.room_id, 'decline')
  await draw(ids[0], second.room_id, 'offer')
  await move(ids[0], second.room_id, 54, 45, 0)
  assert.equal((await snapshot(ids[0], second.room_id)).room.draw_offered_by, null)
  await draw(ids[1], second.room_id, 'offer')
  await draw(ids[1], second.room_id, 'cancel')
  await draw(ids[1], second.room_id, 'offer')
  await draw(ids[0], second.room_id, 'accept')
  assert.equal((await snapshot(ids[1], second.room_id)).room.winner, 'draw')
  await assert.rejects(move(ids[1], second.room_id, 27, 36, 1), /not playable/)
  // Controlled endgame boards exercise both ways of losing, with no direct client writes.
  for (const [reason, pieces, from, to] of [
    ['checkmate', [[4,'black','king'],[85,'red','king'],[22,'red','rook'],[12,'red','rook'],[14,'red','rook']], 22, 13],
    ['stalemate', [[4,'black','king'],[85,'red','king'],[12,'red','rook'],[14,'red','rook'],[49,'red','pawn']], 49, 40],
  ]) {
    const fixture = Array(90).fill(null)
    for (const [i, side, type] of pieces) fixture[i] = { side, type }
    await compare(fixture)
    const expected = playMove({ ...createGame(), board: fixture }, from, to)
    assert.equal(expected.reason, reason)
    const end = await create()
    await join(ids[1], end.room_code)
    await db.query('update xiangqi_rooms set board=$1::jsonb where id=$2', [JSON.stringify(fixture), end.room_id])
    await move(ids[0], end.room_id, from, to, 0)
    assert.equal((await snapshot(ids[0], end.room_id)).room.reason, reason)
  }
  const gomoku = (await asUser(ids[0], 'select * from create_gomoku_room()'))[0]
  await asUser(ids[1], 'select join_gomoku_room($1)', [gomoku.room_code])
  await asUser(ids[0], 'select play_gomoku_move($1,$2::smallint,$3::smallint)', [gomoku.room_id, 0, 0])
  assert.equal((await asUser(ids[0], 'select get_gomoku_snapshot($1) as data', [gomoku.room_id]))[0].data.moves.length, 1)
  assert.deepEqual((await db.query("select tablename from pg_publication_tables where pubname='supabase_realtime' order by tablename")).rows.map(r => r.tablename), ['moves','rooms','xiangqi_moves','xiangqi_rooms'])
  console.log('PASS: xiangqi SQL permissions, rooms, 80 moves, full legal-move comparisons, draw, checkmate/stalemate, and Gomoku regression')
} finally { await db.close() }
