// Run against embedded PostgreSQL without installing a database server.
// npm install --prefix <temporary-directory> @electric-sql/pglite
// node scripts/check-gomoku-db.mjs <temporary-directory>/node_modules/@electric-sql/pglite/dist/index.js
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

if (!process.argv[2]) throw new Error('Pass the path to the temporary PGlite module; see this file for usage.')
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])))
const db = new PGlite()
const ids = ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333']

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    create publication supabase_realtime;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
  `)
  for (const id of ids) await db.query('insert into auth.users values ($1)', [id])
  await db.exec(await readFile(new URL('../supabase/setup-gomoku.sql', import.meta.url), 'utf8'))
  const permissions = (await db.query(`
    select proname, has_function_privilege('anon', oid, 'EXECUTE') as anon_execute
    from pg_proc where proname in ('create_gomoku_room', 'join_gomoku_room', 'play_gomoku_move', 'get_gomoku_snapshot')
  `)).rows
  assert.equal(permissions.length, 4)
  assert.ok(permissions.every((row) => !row.anon_execute))
  async function asUser(id, statement, parameters = []) {
    return db.transaction(async (tx) => {
      await tx.exec('set local role authenticated')
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [id])
      return (await tx.query(statement, parameters)).rows
    })
  }
  const create = async () => (await asUser(ids[0], 'select * from public.create_gomoku_room()'))[0]
  const join = async (id, code) => (await asUser(id, 'select public.join_gomoku_room($1) as id', [code]))[0].id
  const snapshot = async (id, roomId) => (await asUser(id, 'select public.get_gomoku_snapshot($1) as data', [roomId]))[0].data
  const move = async (id, roomId, x, y) => asUser(id, 'select * from public.play_gomoku_move($1::uuid, $2::smallint, $3::smallint)', [roomId, x, y])

  const first = await create()
  assert.match(first.room_code, /^[A-Z0-9]{8}$/)
  assert.equal(await join(ids[0], first.room_code), first.room_id)
  await assert.rejects(move(ids[0], first.room_id, 0, 0), /not playable/)
  assert.equal(await join(ids[1], first.room_code.toLowerCase()), first.room_id)
  assert.equal(await join(ids[1], first.room_code), first.room_id)
  await assert.rejects(join(ids[2], first.room_code), /unavailable/)
  await assert.rejects(join(ids[2], 'invalid'), /unavailable/)
  assert.equal(await snapshot(ids[2], first.room_id), null)
  assert.equal((await asUser(ids[2], 'select * from public.rooms')).length, 0)
  await assert.rejects(asUser(ids[0], 'update public.rooms set current_turn = $1 where id = $2', ['white', first.room_id]), /permission denied/)
  await assert.rejects(asUser(ids[0], 'insert into public.moves (room_id,player_id,position_x,position_y,move_number) values ($1,$2,0,0,1)', [first.room_id, ids[0]]), /permission denied/)
  await assert.rejects(move(ids[1], first.room_id, 0, 0), /not your turn/)
  await assert.rejects(move(ids[0], first.room_id, 15, 0), /outside/)
  await assert.rejects(move(ids[0], first.room_id, null, 0))
  await move(ids[0], first.room_id, 12, 3)
  await assert.rejects(move(ids[0], first.room_id, 1, 0), /not your turn/)
  await assert.rejects(move(ids[1], first.room_id, 12, 3), /occupied/)
  await move(ids[1], first.room_id, 4, 11)
  const resumed = await snapshot(ids[1], first.room_id)
  assert.equal(resumed.moves.length, 2)
  assert.deepEqual(resumed.moves.map((m) => m.move_number), [1, 2])
  assert.equal(resumed.room.current_turn, 'black')
  console.log('PASS: create/join/resume, private-room RLS, direct-write restrictions, turn/position validation, consistent snapshot')

  for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    const game = await create()
    await join(ids[1], game.room_code)
    for (let step = 0; step < 5; step++) {
      await move(ids[0], game.room_id, 7 + dx * step, 7 + dy * step)
      if (step < 4) await move(ids[1], game.room_id, step, 0)
    }
    const finished = await snapshot(ids[0], game.room_id)
    assert.equal(finished.room.status, 'finished')
    assert.equal(finished.room.winner, 'black')
    await assert.rejects(move(ids[1], game.room_id, 5, 0), /not playable/)
    assert.equal(await join(ids[0], game.room_code), game.room_id)
  }
  console.log('PASS: horizontal/vertical/both diagonals win, terminal move rejection, finished-room recovery')

  const draw = await create()
  await join(ids[1], draw.room_code)
  const cells = [[], []]
  for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) cells[(Math.floor(x / 2) + y) % 2].push([x, y])
  for (let step = 0; step < 225; step++) {
    const side = step % 2
    await move(ids[side], draw.room_id, ...cells[side].shift())
  }
  const drawn = await snapshot(ids[1], draw.room_id)
  assert.equal(drawn.moves.length, 225)
  assert.equal(drawn.room.winner, 'draw')
  console.log('PASS: full 225-move game and draw settlement')
  const publications = (await db.query("select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename")).rows
  assert.deepEqual(publications.map((row) => row.tablename), ['moves', 'rooms'])
  console.log('PASS: both tables registered in Realtime publication (network delivery must be checked on Supabase)')
} finally {
  await db.close()
}
