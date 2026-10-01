import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])))
const db = new PGlite()
const ids = ['11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444']
try {
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon; create publication supabase_realtime;
    alter default privileges in schema public grant all on tables to authenticated,anon;
    alter default privileges in schema public grant execute on functions to authenticated,anon;`)
  for (const id of ids) await db.query('insert into auth.users values($1)', [id])
  for (const file of ['setup-gomoku.sql','migrations/20261001010000_xiangqi_rooms.sql']) await db.exec(await readFile(new URL(`../supabase/${file}`, import.meta.url), 'utf8'))
  async function user(id, sql, args = []) {
    return db.transaction(async tx => {
      await tx.exec('set local role authenticated')
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [id])
      return (await tx.query(sql, args)).rows
    })
  }
  const legacy = (await user(ids[0], 'select * from create_xiangqi_room()'))[0]
  await user(ids[1], 'select join_xiangqi_room($1)', [legacy.room_code])
  await user(ids[0], 'select play_xiangqi_move($1,54,45,0)', [legacy.room_id])
  await db.exec(await readFile(new URL('../supabase/migrations/20261001020000_xiangqi_lobby.sql', import.meta.url), 'utf8'))
  const snap = async (id, roomId) => (await user(id, 'select get_xiangqi_snapshot($1) as data', [roomId]))[0].data
  assert.equal((await snap(ids[0], legacy.room_id)).moves.length, 1)
  await user(ids[1], 'select play_xiangqi_move($1,27,36,1)', [legacy.room_id])
  const room = (await user(ids[0], 'select * from create_xiangqi_lobby()'))[0]
  const action = (id, command, seat = null, name = null) => user(id, 'select xiangqi_lobby_action($1,$2,$3,$4)', [room.room_id,command,seat,name])
  let state = await snap(ids[0], room.room_id)
  assert.equal(state.room.red_player_id, null)
  assert.equal(state.room.black_player_id, null)
  await assert.rejects(action(ids[0], 'start'), /both seats/)
  assert.equal(await snap(ids[2], room.room_id), null)
  await assert.rejects(action(ids[2], 'seat','red'), /unavailable/)
  for (const id of [ids[1],ids[2]]) await user(id, 'select enter_xiangqi_lobby($1)', [room.room_code])
  await action(ids[0], 'name', null, '阿叶')
  await assert.rejects(action(ids[0], 'name', null, ' '), /invalid nickname/)
  await assert.rejects(action(ids[0], 'name', null, 'x'.repeat(13)), /invalid nickname/)
  await action(ids[0], 'seat','black')
  assert.equal((await snap(ids[0], room.room_id)).room.black_name, '阿叶')
  await assert.rejects(action(ids[1], 'seat','black'), /occupied/)
  await assert.rejects(action(ids[0], 'seat','red'), /leave your seat/)
  await action(ids[0], 'leave')
  await action(ids[0], 'seat','red')
  await action(ids[1], 'seat','black')
  assert.equal((await snap(ids[0], room.room_id)).room.status, 'waiting')
  await assert.rejects(action(ids[1], 'start'), /only host/)
  await assert.rejects(action(ids[2], 'seat','black'), /occupied/)
  await action(ids[0], 'start')
  await assert.rejects(action(ids[0], 'leave'), /already started/)
  await assert.rejects(user(ids[2], 'select play_xiangqi_move($1,54,45,0)', [room.room_id]), /unavailable/)
  await user(ids[0], 'select play_xiangqi_move($1,54,45,0)', [room.room_id])
  assert.equal((await snap(ids[2], room.room_id)).moves.length, 1)
  assert.equal(await snap(ids[3], room.room_id), null)
  assert.equal((await user(ids[3], 'select * from xiangqi_moves')).length, 0)
  await assert.rejects(user(ids[0], 'insert into xiangqi_room_members(room_id,user_id) values($1,$2)', [room.room_id,ids[3]]), /permission denied/)
  await assert.rejects(user(ids[0], 'update xiangqi_rooms set status=$1 where id=$2', ['playing',room.room_id]), /permission denied/)
  const permissions = (await db.query(`select has_function_privilege('anon',oid,'EXECUTE') as allowed from pg_proc where proname in ('create_xiangqi_lobby','enter_xiangqi_lobby','xiangqi_lobby_action')`)).rows
  assert.equal(permissions.length, 3)
  assert.ok(permissions.every(p => !p.allowed))
  const gomoku = (await user(ids[0], 'select * from create_gomoku_room()'))[0]
  await user(ids[1], 'select join_gomoku_room($1)', [gomoku.room_code])
  await user(ids[0], 'select play_gomoku_move($1,0::smallint,0::smallint)', [gomoku.room_id])
  console.log('PASS: migration preserves old games; empty lobby, names, seat conflicts/leave, host-only start, spectators, RLS, direct-write denial and Gomoku regression.')
} finally { await db.close() }
