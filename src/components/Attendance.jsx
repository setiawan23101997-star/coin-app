const recordAttendance = async () => {
  const ids = Object.keys(selectedMembers).filter(k => selectedMembers[k])
  if (ids.length === 0) {
    addToast('Select at least one member.', 'red', 'Error')
    return
  }

  const now = new Date()
  const dateStr = now.toLocaleDateString()
  const ts = now.getTime()
  const coinValue = 25

  // Build the list of members to update
  const updatedMembers = members.map(m => {
    if (ids.includes(String(m.id))) {
      const attendEntry = { event: selectedEvent, date: dateStr, ts, qualifier: 'full', coins: coinValue }
      return {
        ...m,
        attendance: (m.attendance || 0) + 1,
        coins: (m.coins || 0) + coinValue,
        attendLog: [...(m.attendLog || []), attendEntry],
      }
    }
    return m
  })

  // Save each affected member to Supabase via the RPC
  const results = await Promise.all(updatedMembers
    .filter(m => ids.includes(String(m.id)))
    .map(async m => {
      const attendEntry = { event: selectedEvent, date: dateStr, ts, qualifier: 'full', coins: coinValue }
      const { data, error } = await ctx.supabase.rpc('record_attendance_and_log', {
        p_member_name: m.name,
        p_coins_delta: coinValue,
        p_attendance_delta: 1,
        p_attend_entry: attendEntry,
        p_bonus_tx_entries: [],
      })
      if (error) {
        console.error(`Failed to save ${m.name}:`, error)
        return { name: m.name, ok: false, error }
      }
      return { name: m.name, ok: true, newCoins: data }
    })
  )

  const failed = results.filter(r => !r.ok)
  if (failed.length > 0) {
    addToast(`Couldn't save attendance for: ${failed.map(f => f.name).join(', ')}`, 'red', 'Save Failed')
    return
  }

  // Update local state
  setMembers(updatedMembers)

  // Save the attendance log to Supabase
  const log = {
    id: ts,
    event: selectedEvent,
    date: dateStr,
    ts,
    members: ids.length,
    recorded_by: currentUser?.name || 'System',
    attendees: ids.map(id => {
      const m = members.find(x => x.id === parseInt(id))
      return { name: m?.name || 'Unknown', qualifier: 'full', earned: coinValue }
    }),
  }

  const { error: logError } = await ctx.supabase
    .from('attendance_logs')
    .insert([log])

  if (logError) {
    console.error('Failed to save log:', logError)
    addToast('Coins saved, but the attendance log failed to save.', 'red', 'Partial Save')
  } else {
    setAttendanceLogs([log, ...attendanceLogs])
  }

  setSelectedMembers({})
  addToast(`${ids.length} members recorded for ${selectedEvent}.`, 'gold', 'Attendance Saved')
}