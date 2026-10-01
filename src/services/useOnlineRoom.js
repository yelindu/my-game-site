import { useEffect, useRef, useState } from 'react'
import { ensureUser, getSupabase } from './supabase.js'
import { invitationUrl, normalizeRoomCode, onlineError } from '../games/gomoku/online.js'

export default function useOnlineRoom(config) {
  const [roomId, setRoomId] = useState(null)
  const [snapshot, setSnapshot] = useState(null)
  const [user, setUser] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [connection, setConnection] = useState('idle')
  const syncing = useRef(async () => false)
  const actionPending = useRef(false)
  const mounted = useRef(true)
  const [reconnect, setReconnect] = useState(0)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!roomId || !user) return
    const supabase = getSupabase()
    let active = true
    let running = null
    let rerun = false
    let subscribed = false
    setConnection('connecting')

    // ponytail: reload one game's snapshot per event; paginate history if long games become slow.
    function sync() {
      if (!active) return Promise.resolve(false)
      if (running) { rerun = true; return running }
      running = readSnapshot().finally(() => { running = null })
      return running
    }
    async function readSnapshot() {
      let success = false
      do {
        rerun = false
        try {
          const result = await supabase.rpc(config.snapshot, { target_room_id: roomId })
          if (!active) break
          if (result.error) throw result.error
          if (!result.data) throw new Error('room is unavailable')
          const game = config.decode(result.data)
          setSnapshot({ ...result.data, game })
          setError('')
          setConnection(subscribed ? 'connected' : 'reconnecting')
          success = true
        } catch (failure) {
          if (active) {
            setError(onlineError(failure))
            setConnection('reconnecting')
          }
          success = false
        }
      } while (active && rerun)
      return success
    }
    syncing.current = sync

    const channel = supabase.channel(`${config.kind}:${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: config.rooms, filter: `id=eq.${roomId}` }, sync)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: config.moves, filter: `room_id=eq.${roomId}` }, sync)
      .subscribe((status) => {
        if (!active) return
        subscribed = status === 'SUBSCRIBED'
        if (subscribed) void sync()
        else setConnection('reconnecting')
      })

    void sync()
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void sync() }, 10000)
    const resume = () => {
      if (document.visibilityState === 'visible') void sync()
    }
    const offline = () => { if (active) setConnection('reconnecting') }
    window.addEventListener('online', resume)
    window.addEventListener('offline', offline)
    document.addEventListener('visibilitychange', resume)
    return () => {
      active = false
      syncing.current = async () => false
      clearInterval(timer)
      window.removeEventListener('online', resume)
      window.removeEventListener('offline', offline)
      document.removeEventListener('visibilitychange', resume)
      void supabase.removeChannel(channel)
    }
  }, [roomId, user, reconnect, config])

  async function enterRoom(code) {
    if (actionPending.current) return
    actionPending.current = true
    setBusy(true)
    setError('')
    try {
      const normalized = code == null ? null : normalizeRoomCode(code)
      const currentUser = await ensureUser()
      if (!mounted.current) return
      setUser(currentUser)
      const result = normalized
        ? await getSupabase().rpc(config.join, { invite_code: normalized })
        : await getSupabase().rpc(config.create)
      if (result.error) throw result.error
      if (!mounted.current) return
      const id = normalized ? result.data : result.data[0].room_id
      const inviteCode = normalized || result.data[0].room_code
      window.history.replaceState(null, '', invitationUrl(window.location.href, inviteCode, config.kind))
      setSnapshot(null)
      if (id === roomId) setReconnect((value) => value + 1)
      setRoomId(id)
      setConnection('connecting')
    } catch (failure) {
      setError(failure.message?.startsWith('请输入') ? failure.message : onlineError(failure))
    } finally {
      actionPending.current = false
      setBusy(false)
    }
  }

  async function submit(rpc, parameters) {
    if (actionPending.current || connection !== 'connected') return
    actionPending.current = true
    setBusy(true)
    setError('')
    try {
      const result = await getSupabase().rpc(rpc, { target_room_id: roomId, ...parameters })
      if (result.error) throw result.error
      await syncing.current()
    } catch (failure) {
      // A failed response can still mean a committed action. Block input until a fresh snapshot arrives.
      setConnection('reconnecting')
      setError(onlineError(failure))
    } finally {
      actionPending.current = false
      setBusy(false)
    }
  }

  function leave() {
    setRoomId(null)
    setSnapshot(null)
    setConnection('idle')
    setError('')
    const url = new URL(window.location.href)
    url.searchParams.delete('room')
    url.searchParams.delete('game')
    window.history.replaceState(null, '', url)
  }

  return {
    room: snapshot?.room, game: snapshot?.game || config.initial(), nickname: snapshot?.nickname, user,
    roomId, busy, error, connection, enterRoom, leave, submit,
    move: (...args) => submit(config.play, config.moveParameters(snapshot?.room, ...args)),
    reconnect: () => setReconnect((value) => value + 1),
  }
}
