// Creates three temporary anonymous identities and test games. Never prints access tokens.
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { configurationError } from '../src/services/config.js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
const invalid = configurationError(url, key)
if (invalid || !url || !key) throw new Error(invalid || 'Configure .env.local first.')
const clients = []
async function rpc(client, name, parameters) {
  const result = await client.rpc(name, parameters)
  if (result.error) throw new Error(`${name}: ${result.error.message}`)
  return result.data
}
function waitForUpdate(client, roomId) {
  let timer
  let channel
  let rejectReady
  const ready = new Promise((resolve, reject) => {
    rejectReady = reject
    channel = client.channel(`check:${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'moves', filter: `room_id=eq.${roomId}` }, (event) => {
        clearTimeout(timer)
        resolveUpdate(event.new)
      })
      .subscribe((status) => {
        console.log(`Realtime status: ${status}`)
        if (status === 'SUBSCRIBED') resolve()
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(`Realtime: ${status}`))
      })
  })
  let resolveUpdate
  let rejectUpdate
  const updated = new Promise((resolve, reject) => { resolveUpdate = resolve; rejectUpdate = reject })
  // Prevent an unhandled rejection if subscribing fails before the caller awaits the update.
  void updated.catch(() => {})
  timer = setTimeout(() => {
    const error = new Error('Realtime subscription or delivery did not complete in 20 seconds.')
    rejectReady(error)
    rejectUpdate(error)
  }, 20000)
  return { ready, updated, close: async () => { clearTimeout(timer); await client.removeChannel(channel) } }
}

let watch
try {
  const settings = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, signal: AbortSignal.timeout(15000) }).then((response) => response.json())
  assert.equal(settings.external?.anonymous_users, true, 'Enable Anonymous Sign-Ins before running this check.')
  clients.push(...Array.from({ length: 3 }, () => createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, options) => fetch(input, { ...options, signal: AbortSignal.timeout(15000) }) },
  })))
  for (const client of clients) {
    const result = await client.auth.signInAnonymously()
    if (result.error) throw new Error(`Anonymous sign-in: ${result.error.message}`)
  }
  const [black, white, outsider] = clients
  const created = (await rpc(black, 'create_gomoku_room'))[0]
  const roomId = created.room_id
  console.log(`Created test room ${created.room_code}.`)
  assert.equal(await rpc(black, 'join_gomoku_room', { invite_code: created.room_code }), roomId)
  assert.equal(await rpc(white, 'join_gomoku_room', { invite_code: created.room_code }), roomId)
  assert.equal(await rpc(white, 'join_gomoku_room', { invite_code: created.room_code }), roomId)
  await assert.rejects(rpc(outsider, 'join_gomoku_room', { invite_code: created.room_code }))
  assert.equal(await rpc(outsider, 'get_gomoku_snapshot', { target_room_id: roomId }), null)
  const outsiderMoves = await outsider.from('moves').select('*').eq('room_id', roomId)
  assert.equal(outsiderMoves.error, null)
  assert.deepEqual(outsiderMoves.data, [])
  const directWrite = await black.from('rooms').update({ current_turn: 'white' }).eq('id', roomId)
  assert.ok(directWrite.error, 'Direct room updates must be denied.')
  const play = (client, x, y) => rpc(client, 'play_gomoku_move', { target_room_id: roomId, target_x: x, target_y: y })
  await assert.rejects(play(white, 0, 0))
  watch = waitForUpdate(white, roomId)
  await watch.ready
  await play(black, 7, 7)
  const event = await watch.updated
  assert.equal(event.position_x, 7)
  assert.equal(event.position_y, 7)
  await watch.close()
  watch = null
  await assert.rejects(play(black, 8, 7))
  await assert.rejects(play(white, 7, 7))
  for (let step = 0; step < 4; step++) {
    await play(white, step, 0)
    await play(black, 8 + step, 7)
  }
  await assert.rejects(play(white, 4, 0))
  const stateBlack = await rpc(black, 'get_gomoku_snapshot', { target_room_id: roomId })
  const stateWhite = await rpc(white, 'get_gomoku_snapshot', { target_room_id: roomId })
  assert.deepEqual(stateBlack, stateWhite)
  assert.equal(stateBlack.moves.length, 9)
  assert.equal(stateBlack.room.status, 'finished')
  assert.equal(stateBlack.room.winner, 'black')
  console.log('PASS: anonymous identities, room create/join/resume, third-player rejection, private reads, direct-write rejection, real Realtime delivery, turn/position rejection, win settlement, matching snapshots.')
  console.log('Test identities and finished test room remain in this project; no user data was deleted.')
} catch (failure) {
  console.error(`FAIL: ${failure.message}`)
  process.exitCode = 1
} finally {
  if (watch) await watch.close()
  await Promise.all(clients.map((client) => client.removeAllChannels()))
}
