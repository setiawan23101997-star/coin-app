import React, { useState, useEffect } from 'react'

const eventTypes = [
  'Clan Annihilation',
  'Inter-Server Battle',
  'Clan Sanctuary',
  "Sindri's Treasure Island",
  'World Boss',
]

function formatGMT8(ts = Date.now(), opts = {}) {
  return new Date(ts).toLocaleString('en-GB', {
    timeZone: 'Asia/Singapore',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
    ...opts,
  })
}

function formatGMT8Short(ts = Date.now()) {
  return new Date(ts).toLocaleString('en-GB', {
    timeZone: 'Asia/Singapore',
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default function Attendance({ ctx }) {
  const { members, setMembers, attendanceLogs, setAttendanceLogs, currentUser, addToast, supabase } = ctx
  const [selectedEvent, setSelectedEvent] = useState(eventTypes[0])
  const [coinAmount, setCoinAmount] = useState(25)
  const [selectedMembers, setSelectedMembers] = useState({})
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [expandedLogs, setExpandedLogs] = useState({})
  const [deletingId, setDeletingId] = useState(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const isElder = currentUser?.role === 'Elder' || currentUser?.role === 'Master' || currentUser?.role === 'Admin'
  const filtered = members.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))

  const toggleMember = (id) => setSelectedMembers(prev => ({ ...prev, [id]: !prev[id] }))
  const toggleLog = (id) => setExpandedLogs(prev => ({ ...prev, [id]: !prev[id] }))

  const recordAttendance = async () => {
    const ids = Object.keys(selectedMembers).filter(k => selectedMembers[k])
    if (ids.length === 0) {
      addToast('Select at least one member.', 'red', 'Error')
      return
    }

    const coinValue = parseInt(coinAmount)
    if (!Number.isFinite(coinValue) || coinValue < 0) {
      addToast('Enter a valid coin amount.', 'red', 'Error')
      return
    }

    setSubmitting(true)

    const nowDate = new Date()
    const dateStr = nowDate.toLocaleDateString()
    const ts = nowDate.getTime()

    const targets = members.filter(m => ids.includes(String(m.id)))

    const results = await Promise.all(targets.map(async (m) => {
      const attendEntry = {
        event: selectedEvent,
        date: dateStr,
        ts,
        qualifier: 'full',
        coins: coinValue,
      }
      const { data, error } = await supabase.rpc('record_attendance_and_log', {
        p_member_name: m.name,
        p_coins_delta: coinValue,
        p_attendance_delta: 1,
        p_attend_entry: attendEntry,
        p_bonus_tx_entries: [],
      })
      if (error) {
        console.error(`Failed to save ${m.name}:`, error)
        return { id: m.id, name: m.name, ok: false, error }
      }
      return { id: m.id, name: m.name, ok: true, newCoins: data }
    }))

    const failed = results.filter(r => !r.ok)
    if (failed.length > 0) {
      addToast(`Couldn't save attendance for: ${failed.map(f => f.name).join(', ')}`, 'red', 'Save Failed')
      setSubmitting(false)
      return
    }

    const log = {
      id: ts,
      event: selectedEvent,
      date: dateStr,
      ts,
      members: ids.length,
      recorded_by: currentUser?.name || 'System',
      attendees: targets.map(m => ({
        name: m.name,
        cls: m.cls,
        qualifier: 'full',
        earned: coinValue,
      })),
    }

    const { error: logError } = await supabase
      .from('attendance_logs')
      .insert([log])

    if (logError) {
      console.error('Failed to save log:', logError)
      addToast('Coins saved, but the attendance log failed to save.', 'red', 'Partial Save')
    }

    setMembers(prev => prev.map(m => {
      if (!ids.includes(String(m.id))) return m
      const attendEntry = { event: selectedEvent, date: dateStr, ts, qualifier: 'full', coins: coinValue }
      return {
        ...m,
        coins: (m.coins || 0) + coinValue,
        attendance: (m.attendance || 0) + 1,
        attend_log: [...(m.attend_log || []), attendEntry],
      }
    }))
    setAttendanceLogs(prev => [log, ...prev])

    setSelectedMembers({})
    setSubmitting(false)
    addToast(`${ids.length} members recorded for ${selectedEvent} (+${coinValue} coins each).`, 'gold', 'Attendance Saved')
  }

  const deleteLog = async (log) => {
    if (!isElder) {
      addToast('Only Elders and Masters can delete attendance.', 'red', 'Not Allowed')
      return
    }

    const attendees = log.attendees || []
    const totalCoins = attendees.reduce((s, a) => s + (a.earned || 0), 0)

    const confirmMsg =
      `Delete "${log.event}" attendance from ${formatGMT8Short(log.ts || log.id)}?\n\n` +
      `This will reverse:\n` +
      `• ${attendees.length} member(s)\n` +
      `• ${totalCoins.toLocaleString()} coins total\n\n` +
      `This cannot be undone.`

    if (!window.confirm(confirmMsg)) return

    setDeletingId(log.id)

    const reversed = await Promise.all(attendees.map(async (a) => {
      const member = members.find(m => m.name === a.name)
      if (!member) return { name: a.name, ok: true, skipped: true }

      const newCoins = Math.max(0, (member.coins || 0) - (a.earned || 0))
      const newAttendance = Math.max(0, (member.attendance || 0) - 1)

      const filteredLog = (member.attend_log || []).filter(entry => {
        if (entry.event !== a.event && entry.event !== log.event) return true
        const entryTs = entry.ts || 0
        if (entryTs && log.ts && entryTs === log.ts) return false
        if (entry.event === log.event && entry.date === log.date) return false
        return true
      })

      const { error } = await supabase
        .from('members')
        .update({
          coins: newCoins,
          attendance: newAttendance,
          attend_log: filteredLog,
        })
        .eq('id', member.id)

      if (error) {
        console.error(`Failed to reverse ${a.name}:`, error)
        return { name: a.name, ok: false, error }
      }
      return { name: a.name, ok: true, memberId: member.id, newCoins, newAttendance, filteredLog }
    }))

    const failed = reversed.filter(r => !r.ok)
    if (failed.length > 0) {
      addToast(`Couldn't reverse all members: ${failed.map(f => f.name).join(', ')}`, 'red', 'Partial Reversal')
    }

    setMembers(prev => prev.map(m => {
      const r = reversed.find(x => x.memberId === m.id)
      if (!r) return m
      return {
        ...m,
        coins: r.newCoins,
        attendance: r.newAttendance,
        attend_log: r.filteredLog,
      }
    }))

    const { error: delErr } = await supabase
      .from('attendance_logs')
      .delete()
      .eq('id', log.id)

    if (delErr) {
      console.error('Failed to delete log row:', delErr)
      addToast(`Couldn't remove the log: ${delErr.message}`, 'red', 'Delete Failed')
      setDeletingId(null)
      return
    }

    setAttendanceLogs(prev => prev.filter(l => l.id !== log.id))
    setDeletingId(null)
    addToast(
      `Attendance reversed — ${attendees.length} member(s), ${totalCoins.toLocaleString()} coins removed.`,
      'red',
      'Attendance Deleted'
    )
  }

  const sortedLogs = [...attendanceLogs].sort((a, b) => {
    const ta = a.ts || Number(a.id) || new Date(a.date).getTime() || 0
    const tb = b.ts || Number(b.id) || new Date(b.date).getTime() || 0
    return tb - ta
  })

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-spectral text-2xl font-bold text-gold-light mb-2">Attendance</h1>
          <p className="text-text-dim text-sm">
            {isElder ? 'Record attendance for events and award coins' : 'Attendance history for clan events'}
          </p>
        </div>

        <div className="card px-4 py-2 border-gold/30 flex items-center gap-3">
          <div className="text-lg">🕒</div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-gold-dim">
              Server Time · GMT+8
            </div>
            <div className="font-mono text-sm text-gold-bright tabular-nums">
              {formatGMT8(now)}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Logs — everyone can see */}
      {sortedLogs.length > 0 ? (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-text-dim uppercase tracking-wider">
              Recent Logs ({sortedLogs.length})
            </div>
            <div className="text-[10px] text-text-dim uppercase tracking-wider">
              Newest first · GMT+8
            </div>
          </div>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {sortedLogs.slice(0, 30).map(log => {
              const isExpanded = !!expandedLogs[log.id]
              const attendees = log.attendees || []
              const coinEach = attendees[0]?.earned ?? 0
              const logTs = log.ts || Number(log.id) || new Date(log.date).getTime() || 0
              const isDeleting = deletingId === log.id

              return (
                <div key={log.id} className="rounded border border-gold/15 bg-void/40">
                  <div
                    onClick={() => toggleLog(log.id)}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 px-3 cursor-pointer hover:bg-gold/5 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-wrap">
                      <span className="text-xs text-gold-dim">{isExpanded ? '▾' : '▸'}</span>
                      <span className="font-semibold text-gold-light">{log.event}</span>
                      <span className="text-xs text-text-dim font-mono tabular-nums">
                        {formatGMT8Short(logTs)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-green-400 font-semibold">
                        +{coinEach.toLocaleString()} coins each
                      </span>
                      <span className="text-xs text-text-dim">{log.members} members</span>
                      <span className="text-xs text-text-dim">
                        by <span className="text-gold">{log.recorded_by || log.recordedBy}</span>
                      </span>
                      {isElder && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteLog(log)
                          }}
                          disabled={isDeleting}
                          className="text-[10px] px-2 py-1 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          title="Reverse & delete this attendance"
                        >
                          {isDeleting ? '…' : '🗑 Delete'}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gold/10 px-3 py-3 bg-void/60">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-gold-light mb-2">
                        Attendees ({attendees.length})
                      </div>
                      {attendees.length === 0 ? (
                        <div className="text-xs text-text-dim italic">No attendee details saved for this log.</div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {attendees.map((a, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-2 rounded border border-gold/15 bg-gold/5 px-3 py-2"
                            >
                              <div className="min-w-0">
                                <div className="font-semibold text-text text-sm truncate">{a.name}</div>
                                {a.cls && <div className="text-[10px] text-text-dim">{a.cls}</div>}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-xs font-bold text-green-400">
                                  +{(a.earned || 0).toLocaleString()}
                                </div>
                                <div className="text-[9px] uppercase tracking-wider text-text-dim">
                                  {a.qualifier || 'full'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 pt-3 border-t border-gold/10 flex flex-wrap justify-between items-center gap-2 text-[10px] uppercase tracking-wider text-text-dim">
                        <span>
                          Total awarded:{' '}
                          <span className="text-gold-light font-bold normal-case">
                            {attendees.reduce((s, a) => s + (a.earned || 0), 0).toLocaleString()} coins
                          </span>
                        </span>
                        <span>
                          Recorded by{' '}
                          <span className="text-gold-light normal-case">
                            {log.recorded_by || log.recordedBy}
                          </span>
                          {' · '}
                          <span className="text-gold-light normal-case font-mono">
                            {formatGMT8(logTs)}
                          </span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="card text-center py-12 mb-6">
          <div className="text-3xl mb-3 opacity-50">📋</div>
          <div className="text-text-dim">No attendance recorded yet.</div>
        </div>
      )}

      {/* Record form — Elder / Master only, hidden entirely for members */}
      {isElder && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card md:col-span-1">
            <div className="text-sm font-bold text-text-dim uppercase tracking-wider mb-3">Event</div>
            <select
              className="input"
              value={selectedEvent}
              onChange={e => setSelectedEvent(e.target.value)}
            >
              {eventTypes.map(e => <option key={e}>{e}</option>)}
            </select>

            <div className="text-sm font-bold text-text-dim uppercase tracking-wider mb-3 mt-5">
              Coins per Member
            </div>
            <div className="flex items-center gap-2">
              <input
                className="input flex-1"
                type="number"
                min="0"
                step="1"
                value={coinAmount}
                onChange={e => setCoinAmount(e.target.value)}
                placeholder="25"
              />
              <span className="text-xs text-text-dim">coins</span>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {[10, 25, 50, 100, 200].map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCoinAmount(v)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    Number(coinAmount) === v
                      ? 'bg-gold/20 border-gold text-gold-bright'
                      : 'border-gold/20 text-text-dim hover:text-gold-light hover:border-gold/40'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            <div className="text-xs text-text-dim mt-3">
              Each selected member will receive <span className="text-gold-light font-bold">{coinAmount || 0}</span> coins.
            </div>

            <div className="mt-5 pt-4 border-t border-gold/20 text-[10px] text-text-dim uppercase tracking-wider">
              Session time: <span className="text-gold-light font-mono normal-case">{formatGMT8(now)}</span>
            </div>
          </div>

          <div className="card md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="text-sm font-bold text-text-dim uppercase tracking-wider">Members</div>
              <span className="text-xs text-gold-light">
                {Object.values(selectedMembers).filter(Boolean).length} selected
              </span>
            </div>
            <input
              className="input mb-3"
              placeholder="Search members..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {filtered.map(m => (
                <div
                  key={m.id}
                  onClick={() => toggleMember(m.id)}
                  className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors ${
                    selectedMembers[m.id] ? 'bg-gold/10 border border-gold/30' : 'hover:bg-gold/5'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    selectedMembers[m.id] ? 'bg-gold border-gold' : 'border-gold/40'
                  }`}>
                    {selectedMembers[m.id] && <span className="text-black text-xs">✓</span>}
                  </div>
                  <span className="font-medium">{m.name}</span>
                  <span className="text-xs text-text-dim ml-auto">{m.cls}</span>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="text-text-dim text-sm py-4">No members found.</div>
              )}
            </div>
            <button
              onClick={recordAttendance}
              disabled={submitting}
              className="btn-gold w-full mt-3"
            >
              {submitting ? 'Saving...' : 'Submit Attendance'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}