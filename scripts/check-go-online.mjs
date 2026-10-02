import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {score} from '../src/games/go/go.js'
const clients=[]
const client=()=>{const c=createClient(process.env.VITE_SUPABASE_URL,process.env.VITE_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(url,options={})=>fetch(url,{...options,signal:AbortSignal.timeout(20000)})}});clients.push(c);return c}
const rpc=async(c,name,args)=>{const {data,error}=await c.rpc(name,args);if(error)throw new Error(`${name}: ${error.code} ${error.message}`);return data}
let room
const snapshot=c=>rpc(c,'get_go_snapshot',{target_room_id:room.room_id})
const lobby=(c,action,seat,nickname)=>rpc(c,'go_lobby_action',{target_room_id:room.room_id,action,seat,nickname})
const act=(c,state,action,move_index=null)=>rpc(c,'go_game_action',{target_room_id:room.room_id,action,expected_version:state.version,move_index})
try {
  const peer=process.argv[2]==='--peer',players=Array.from({length:peer?1:4},client)
  for(const c of players){const {error}=await c.auth.signInAnonymously();if(error)throw error}
  if(peer) {
    room={room_id:await rpc(players[0],'enter_go_lobby',{invite_code:process.argv[3]})}
    await lobby(players[0],'name',null,'测试棋友');await lobby(players[0],'seat','white')
    console.log('PEER READY: independent white player seated; waiting for browser host.')
    let pending=false
    const poll=async()=>{
      const {room:r}=await snapshot(players[0]),g=r.state
      if(r.status==='playing'&&g.turn===2) await act(players[0],g,g.moves.some(m=>m.player===2)?'pass':'place',20)
      else if(r.status==='scoring'&&!g.confirmed.includes(2)) await act(players[0],g,'confirm')
    }
    const timer=setInterval(()=>{if(!pending){pending=true;poll().catch(e=>console.error(e.message)).finally(()=>pending=false)}},3000)
    await new Promise(resolve=>{const end=setTimeout(resolve,600000);process.once('SIGINT',()=>{clearTimeout(end);resolve()})})
    clearInterval(timer)
  } else {
    room=(await rpc(players[0],'create_go_lobby'))[0];console.log(`Created real test room ${room.room_code}`)
    assert.equal(await snapshot(players[3]),null)
    for(const c of players.slice(1,3))await rpc(c,'enter_go_lobby',{invite_code:room.room_code})
    await lobby(players[0],'seat','black');await lobby(players[1],'seat','white');await assert.rejects(lobby(players[1],'start'),/only host/)
    let updates=0
    const channel=players[2].channel(`go-test-${room.room_id}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'go_rooms',filter:`id=eq.${room.room_id}`},()=>updates++)
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Realtime subscription timeout')),20000);channel.subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timer);resolve()}})})
    await lobby(players[0],'start')
    let state=(await snapshot(players[0])).room.state
    assert.ok((await players[0].from('go_rooms').update({status:'finished'}).eq('id',room.room_id)).error)
    await assert.rejects(act(players[2],state,'place',0),/spectator/);await assert.rejects(act(players[1],state,'place',0),/not your turn/)
    for(const p of [1,10,9,80,11,79,19]) {const old=state;await act(players[state.turn-1],state,'place',p);state=(await snapshot(players[0])).room.state;await assert.rejects(act(players[0],old,'pass'),/stale/)}
    assert.equal(state.board[10],0);assert.equal(state.captures[1],1)
    const {data:{session}}=await players[0].auth.getSession(),restored=client()
    assert.equal((await restored.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token})).error,null)
    assert.deepEqual((await snapshot(restored)).room.state,state)
    const step=async(action,player=state.turn,p=null)=>{await act(players[player-1],state,action,p);state=(await snapshot(players[2])).room.state}
    await step('pass');await step('pass');assert.equal(state.phase,'scoring')
    await step('mark',1,79);assert.deepEqual(state.dead,[79,80]);await step('confirm',1)
    const old=state;await step('mark',2,80);assert.deepEqual(state.confirmed,[])
    await assert.rejects(act(players[0],old,'confirm'),/stale/)
    await step('resume',2);assert.equal(state.phase,'playing')
    await step('pass');await step('pass');await step('confirm',1);await step('confirm',2)
    assert.equal(state.phase,'finished');assert.deepEqual(state.score,score(state.board,state.dead));assert.ok(updates>0)
    await lobby(players[0],'reset');assert.equal((await snapshot(players[2])).room.status,'waiting')
    console.log(`PASS: cloud lobby, legal capture, unauthorized/stale requests, ${updates} Realtime updates, identity restoration, dead-chain changes invalidating confirmation, resume, agreed scoring and reset.`)
  }
} finally {for(const c of clients)await c.removeAllChannels()}
