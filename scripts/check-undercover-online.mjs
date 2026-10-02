import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
const clients=[]
const client=()=>{
  const c=createClient(process.env.VITE_SUPABASE_URL,process.env.VITE_SUPABASE_ANON_KEY,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:(url,options={})=>fetch(url,{...options,signal:AbortSignal.timeout(20000)})},
  }); clients.push(c); return c
}
const rpc=async(c,name,args)=>{const {data,error}=await c.rpc(name,args); if(error) throw new Error(`${name}: ${error.code} ${error.message}`); return data}
let room
const snapshot=c=>rpc(c,'get_undercover_snapshot',{target_room_id:room.room_id})
const lobby=(c,action,seat,nickname)=>rpc(c,'undercover_lobby_action',{target_room_id:room.room_id,action,seat,nickname})
const action=(c,state,command,target=null,description='生活里可以见到')=>rpc(c,'undercover_game_action',{target_room_id:room.room_id,action:command,expected_version:state.room.version,description,target_seat:target,expected_ballot:state.room.ballot_id})
try {
  const peers=process.argv[2]==='--peers'
  const players=Array.from({length:peers?3:5},client)
  for(const c of players) {const {error}=await c.auth.signInAnonymously(); if(error) throw error}
  if(peers) {
    room={room_id:await rpc(players[0],'enter_undercover_lobby',{invite_code:process.argv[3]})}
    for(let i=0;i<3;i++) {
      if(i) await rpc(players[i],'enter_undercover_lobby',{invite_code:process.argv[3]})
      await lobby(players[i],'name',null,`测试朋友${i+1}`); await lobby(players[i],'seat',`seat${i+1}`)
    }
    console.log('PEERS READY: three independent players seated; waiting for browser host.')
    let pending=false
    const poll=async()=>{
      for(let i=0;i<3;i++) {
        const s=await snapshot(players[i])
        if(s.room.status==='speaking'&&s.room.current_turn===i+1) await action(players[i],s,'speak')
        else if(s.room.status==='voting'&&!s.room.voted.includes(i+1)) await action(players[i],s,'vote',s.room.vote_candidates.find(v=>v!==i+1))
      }
    }
    const timer=setInterval(()=>{if(!pending){pending=true;poll().catch(e=>console.error(e.message)).finally(()=>pending=false)}},3000)
    await new Promise(resolve=>{const end=setTimeout(resolve,600000);process.once('SIGINT',()=>{clearTimeout(end);resolve()})})
    clearInterval(timer)
  } else {
    room=(await rpc(players[0],'create_undercover_lobby'))[0]
    console.log(`Created real test room ${room.room_code}`)
    assert.equal(await snapshot(players[4]),null)
    for(const c of players.slice(1)) await rpc(c,'enter_undercover_lobby',{invite_code:room.room_code})
    for(let i=0;i<4;i++) await lobby(players[i],'seat',`seat${i}`)
    await assert.rejects(lobby(players[1],'start'),/only host/)
    let updates=0; const leaks=[]
    const channel=players[4].channel(`uc-test-${room.room_id}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'undercover_rooms',filter:`id=eq.${room.room_id}`},payload=>{
      if(['word','assignments','ballots'].some(k=>Object.hasOwn(payload.new,k))||payload.new.status!=='finished'&&payload.new.result!==null) leaks.push(payload.new.version)
      updates++
    })
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Realtime subscription timeout')),20000)
      channel.subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timer);resolve()}})
    })
    await lobby(players[0],'start')
    const views=await Promise.all(players.map(snapshot))
    const frequencies=Object.values(views.slice(0,4).reduce((map,v)=>({...map,[v.word]:(map[v.word]||0)+1}),{})).sort()
    assert.deepEqual(frequencies,[1,3]); assert.equal(views[4].word,null)
    assert.ok(views.every(v=>!Object.hasOwn(v,'role')&&!Object.hasOwn(v.room,'assignments')&&!Object.hasOwn(v.room,'ballots')&&v.room.result===null))
    assert.ok((await players[0].from('undercover_secrets').select('*')).error)
    await assert.rejects(rpc(players[0],'undercover_deal',{target_room_id:room.room_id}),/permission denied/)
    await assert.rejects(action(players[1],views[1],'speak'),/not your turn/)
    await assert.rejects(action(players[0],views[0],'speak',null,views[0].word),/word in description/)
    let state=views[0]
    for(let i=0;i<4;i++) {await action(players[i],state,'speak'); state=await snapshot(players[0])}
    assert.equal(state.room.status,'voting')
    await action(players[0],state,'vote',1)
    assert.equal((await snapshot(players[0])).my_vote,1)
    assert.equal((await snapshot(players[4])).my_vote,null)
    assert.equal((await snapshot(players[4])).room.last_vote,null)
    await assert.rejects(action(players[0],state,'vote',2),/already voted/)
    // These simultaneous clients all use the same cached version and ballot token.
    await Promise.all(players.slice(1,4).map(c=>action(c,state,'vote',0)))
    state=await snapshot(players[4]); assert.equal(state.room.status,'finished')
    assert.equal(state.room.alive.length,3); assert.equal(state.room.result.filter(p=>p?.role==='undercover').length,1)
    assert.equal(state.room.winner,state.room.result[0].role==='undercover'?'civilian':'undercover')
    assert.ok(updates>0); assert.deepEqual(leaks,[])
    const {data:{session}}=await players[0].auth.getSession()
    const restored=client();const auth=await restored.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token});assert.equal(auth.error,null)
    assert.deepEqual(await snapshot(restored),await snapshot(players[0]))
    await lobby(players[0],'reset')
    const waiting=await snapshot(players[4]); assert.equal(waiting.room.status,'waiting');assert.equal(waiting.room.result,null);assert.equal(waiting.word,null)
    console.log(`PASS: real four-player game, outsider/spectator isolation, private words and votes, concurrent ballots, ${updates} sanitized Realtime updates, role reveal, identity restoration and host reset.`)
  }
} finally {for(const c of clients) await c.removeAllChannels()}
