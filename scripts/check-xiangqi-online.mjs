// Creates three anonymous test identities and one room. Never prints credentials.
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { configurationError } from '../src/services/config.js'
import { gameFromSnapshot } from '../src/games/xiangqi/online.js'

const url = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key || configurationError(url, key)) throw new Error('Configure .env.local first.')
const clients = []
let channel, timer
async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args)
  if (error) throw new Error(`${name}: ${error.message}`)
  return data
}
try {
  for (let i = 0; i < 3; i++) {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, options) => fetch(input, { ...options, signal: AbortSignal.timeout(15000) }) },
    })
    clients.push(client)
    const { error } = await client.auth.signInAnonymously()
    if (error) throw error
  }
  const [red, black, outsider] = clients
  const { room_id: id, room_code: code } = (await rpc(red, 'create_xiangqi_room'))[0]
  console.log(`Created xiangqi test room ${code}.`)
  const snapshot = client => rpc(client, 'get_xiangqi_snapshot', { target_room_id: id })
  const move = (client, from, to, version) => rpc(client, 'play_xiangqi_move', { target_room_id: id, source_index: from, target_index: to, expected_move_number: version })
  const draw = (client, action) => rpc(client, 'xiangqi_draw', { target_room_id: id, action })
  assert.equal(await rpc(black, 'join_xiangqi_room', { invite_code: code.toLowerCase() }), id)
  assert.equal(await rpc(red, 'join_xiangqi_room', { invite_code: code }), id)
  await assert.rejects(rpc(outsider, 'join_xiangqi_room', { invite_code: code }))
  assert.equal(await snapshot(outsider), null)
  for (const table of ['xiangqi_rooms', 'xiangqi_moves']) {
    const read = await outsider.from(table).select('*')
    assert.equal(read.error, null)
    assert.deepEqual(read.data, [])
  }
  assert.ok((await red.from('xiangqi_rooms').update({ current_turn: 'black' }).eq('id', id)).error)
  await assert.rejects(move(black, 27, 36, 0))
  await assert.rejects(move(red, 54, 55, 0))
  let resolveEvent, rejectEvent
  const event = new Promise((resolve, reject) => { resolveEvent = resolve; rejectEvent = reject })
  void event.catch(() => {})
  await new Promise((resolve, reject) => {
    timer = setTimeout(() => { const failure = new Error('Realtime did not deliver within 25 seconds'); reject(failure); rejectEvent(failure) }, 25000)
    channel = black.channel(`xiangqi-check:${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'xiangqi_moves', filter: `room_id=eq.${id}` }, payload => resolveEvent(payload.new))
      .subscribe(status => {
        console.log(`Realtime: ${status}`)
        if (status === 'SUBSCRIBED') resolve()
        if (['CHANNEL_ERROR','TIMED_OUT'].includes(status)) reject(new Error(status))
      })
  })
  await move(red, 54, 45, 0)
  assert.equal((await event).to_index, 45)
  clearTimeout(timer)
  await black.removeChannel(channel)
  channel = null
  await assert.rejects(move(red, 56, 47, 0))
  await move(black, 27, 36, 1)
  await draw(red, 'offer')
  await assert.rejects(draw(red, 'accept'))
  await assert.rejects(draw(outsider, 'accept'))
  await draw(black, 'decline')
  assert.equal((await snapshot(red)).room.draw_offered_by, null)
  await draw(black, 'offer')
  await draw(red, 'accept')
  const a = await snapshot(red), b = await snapshot(black)
  assert.deepEqual(a, b)
  assert.equal(gameFromSnapshot(a).winner, 'draw')
  assert.equal(a.room.status, 'finished')
  await assert.rejects(move(red, 56, 47, 2))
  console.log('PASS: real identities, create/join/resume, RLS and direct-write rejection, Realtime delivery, legal/turn/version validation, mutual draw, identical snapshots.')
  console.log('The finished test room and test identities remain; no user data was deleted.')
} catch (failure) {
  console.error(`FAIL: ${failure.message}`)
  process.exitCode = 1
} finally {
  clearTimeout(timer)
  await Promise.all(clients.map(client => client.removeAllChannels()))
}
