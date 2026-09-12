import React, { useState } from 'react'

const eventTypes = [
  'Clan Annihilation',
  'Inter-Server Battle',
  'Clan Sanctuary',
  "Sindri's Treasure Island",
  'World Boss',
]

export default function Attendance({ ctx }) {
  const { members, setMembers, attendanceLogs, setAttendanceLogs, currentUser, addToast, supabase } = ctx
  const [selectedEvent, setSelectedEvent] = useState(eventTypes[0])
  const [selectedMembers, setSelectedMembers] = useState({})
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isElder = currentUser?.role === 'Elder' || currentUser?.role === 'Master'
  const filtered = members.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))

  const toggleMember = (id) => {
    setSelectedMembers(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const recordAttendance = async () => {
    const ids = Object.keys(selectedMembers).filter(k => selectedMembers[k])
    if (ids.length === 0) {
      addToast('Select at least one member.', 'red', 'Error')
      return
    }

    setSubmitting(true)

    const now = new Date()
    const dateStr = now.toLocaleDateString()
    const ts = now.getTime()
    const coinValue = 25

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

    // Update local state
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
    addToast(`${ids.length} members recorded for ${selectedEvent}.`, 'gold', 'Attendance Saved')
  }

  return (
    <div>
      <h1 className="font-spectral text-2xl font-bold text-gold-light mb-2">Attendance</h1>
      <p className="text-text-dim text-sm mb-6">Record attendance for events and award coins</p>

      {!isElder ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-4">🔒</div>
          <div className="text-text-dim">Only Elders and Masters can record attendance.</div>
        </div>
      ) : (
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
            <div className="text-xs text-text-dim mt-2">+25 coins per attendee</div>
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

      {attendanceLogs.length > 0 && (
        <div className="card mt-6">
          <div className="text-sm font-bold text-text-dim uppercase tracking-wider mb-3">Recent Logs</div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {attendanceLogs.slice(0, 10).map(log => (
              <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gold/10">
                <div>
                  <span className="font-semibold text-gold-light">{log.event}</span>
                  <span className="text-xs text-text-dim ml-2">{log.date}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-dim">{log.members} members</span>
                  <span className="text-xs text-text-dim">by {log.recorded_by || log.recordedBy}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}