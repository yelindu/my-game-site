import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { findPlays } from '../src/games/doudizhu/doudizhu.js'

const clients = []
const channels = []
function client() {
  const c = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(20000) }) },
  })
  clients.push(c)
  return c
}
async function rpc(c, name, args) {
  const result = await c.rpc(name,args)
  if (result.error) throw new Error(`${name}: ${result.error.code} ${result.error.message}`)
  return result.data
}
async function signIn(c) {
  const { error } = await c.auth.signInAnonymously()
  if (error) throw error
}
let room
const snapshot = c => rpc(c,'get_doudizhu_snapshot',{target_room_id:room.room_id})
const lobby = (c, action, seat, nickname) => rpc(c,'doudizhu_lobby_action',{target_room_id:room.room_id,action,seat,nickname})
const action = (c, state, command, value = null, cards = []) => rpc(c,'doudizhu_game_action', {target_room_id:room.room_id,action:command,expected_version:state.room.version,bid_value:value,played_cards:cards})
try {
  const peers = process.argv[2] === '--peers'
  const players = Array.from({length:peers ? 2 : 4},client)
  for (const c of players) await signIn(c)
  if (peers) {
    room = { room_id: await rpc(players[0],'enter_doudizhu_lobby',{invite_code:process.argv[3]}) }
    await rpc(players[1],'enter_doudizhu_lobby',{invite_code:process.argv[3]})
    for (let i=0;i<2;i++) { await lobby(players[i],'name',null,`测试牌友${i+1}`); await lobby(players[i],'seat',`seat${i+1}`) }
    console.log('PEERS READY: two independent players seated; waiting for browser host.')
    const poll = async () => {
      for (let i=0;i<2;i++) {
        const state = await snapshot(players[i])
        if (state.room.current_turn !== i+1) continue
        if (state.room.status === 'bidding') await action(players[i],state,'bid',0)
        else if (state.room.status === 'playing') await action(players[i],state,'play',null,findPlays(state.hand,state.room.last_play?.shape)[0]?.cards || [])
      }
    }
    let pending = false
    const timer = setInterval(() => { if (!pending) { pending=true; poll().catch(e=>console.error(e.message)).finally(()=>pending=false) } },1500)
    await new Promise(resolve => { process.on('SIGINT',resolve); setTimeout(resolve,600000) })
    clearInterval(timer)
  } else {
    room = (await rpc(players[0],'create_doudizhu_lobby'))[0]
    console.log(`Created real test room ${room.room_code}`)
    const outsider = await snapshot(players[3]); assert.equal(outsider,null)
    for (const c of players.slice(1)) await rpc(c,'enter_doudizhu_lobby',{invite_code:room.room_code})
    for (let i=0;i<3;i++) await lobby(players[i],'seat',`seat${i}`)
    await assert.rejects(lobby(players[1],'start'),/only host/)
    let updates = 0
    const channel = players[3].channel(`ddz-test-${room.room_id}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'doudizhu_rooms',filter:`id=eq.${room.room_id}`}, payload => {
      assert.ok(!Object.hasOwn(payload.new,'hands')); assert.ok(!Object.hasOwn(payload.new,'hand')); updates++
    })
    channels.push({client:players[3],channel})
    await new Promise((resolve,reject)=> {
      const timeout=setTimeout(()=>reject(new Error('Realtime subscription timeout')),20000)
      channel.subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timeout);resolve()}})
    })
    await lobby(players[0],'start')
    const states = await Promise.all(players.map(snapshot))
    assert.deepEqual(states.map(s=>s.hand.length),[17,17,17,0])
    assert.equal(new Set(states.flatMap(s=>s.hand)).size,51)
    assert.equal(states[3].room.bottom,null)
    assert.ok((await players[0].from('doudizhu_deals').select('*')).error)
    let state=states[0]
    const landlord=state.room.current_turn
    await assert.rejects(action(players[3],state,'bid',3),/not your turn/)
    await action(players[landlord],state,'bid',3)
    state=await snapshot(players[landlord]); assert.equal(state.hand.length,20)
    await assert.rejects(action(players[landlord],state,'play',null,[]),/cannot pass/)
    const stolen=(await snapshot(players[(landlord+1)%3])).hand[0]
    await assert.rejects(action(players[landlord],state,'play',null,[stolen]),/not owned/)
    const old=state
    await action(players[landlord],state,'play',null,findPlays(state.hand)[0].cards)
    await assert.rejects(action(players[landlord],old,'play',null,findPlays(old.hand)[0].cards),/not your turn|stale/)
    console.log('PASS: Realtime subscribed; distinct hands, hidden bottom, spectator and unauthorized moves checked.')
    let steps=1
    while (steps++ < 500) {
      state=await snapshot(players[0])
      if(state.room.status==='finished') break
      const c=players[state.room.current_turn]
      const own=await snapshot(c)
      await action(c,own,'play',null,findPlays(own.hand,own.room.last_play?.shape)[0]?.cards || [])
    }
    assert.equal(state.room.status,'finished'); assert.ok(state.room.remaining.includes(0))
    assert.ok(updates>0)
    const {data:{session}}=await players[0].auth.getSession()
    const restored=client(); const auth=await restored.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token}); assert.equal(auth.error,null)
    assert.deepEqual(await snapshot(restored),await snapshot(players[0]))
    await lobby(players[0],'restart')
    const restarted=await snapshot(players[3]); assert.equal(restarted.room.status,'bidding'); assert.equal(restarted.hand.length,0)
    console.log(`PASS: real three-player game finished in ${steps} turns; ${updates} sanitized Realtime updates; same identity restores snapshot and host redeals.`)
  }
} finally {
  for(const {client:c,channel} of channels) await c.removeChannel(channel)
  for(const c of clients) await c.removeAllChannels()
}
