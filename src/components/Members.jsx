import React, { useState } from 'react'
import ResetPasswordModal from './ResetPasswordModal'

export default function Members({ ctx }) {
  const { members, saveMember, updateMember, deleteMember, currentUser, addToast } = ctx
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newMember, setNewMember] = useState({
    name: '', username: '', password: '',
    cls: 'Berserker', power: 10000, role: 'Member',
  })
  const [loading, setLoading] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [coinInput, setCoinInput] = useState('')
  const [powerInput, setPowerInput] = useState('')

  const [resetTarget, setResetTarget] = useState(null)

  const isAdmin = currentUser?.role === 'Admin'
  const isMaster = currentUser?.role === 'Master' || isAdmin
  const isElder = currentUser?.role === 'Elder' || isMaster

  const visibleMembers = isAdmin ? members : members.filter(m => m.role !== 'Admin')
  const filtered = visibleMembers.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))

  const canRemoveMember = (target) => {
    if (!currentUser) return false
    if (target.id === currentUser.id) return false
    if (isAdmin) return true
    if (target.role === 'Master' || target.role === 'Admin') return false
    if (isMaster) return true
    if (currentUser.role === 'Elder' && target.role === 'Member') return true
    return false
  }

  const canChangeRole = (target) => {
    if (!currentUser) return false
    if (target.id === currentUser.id) return false
    if (isAdmin) return true
    if (target.role === 'Master' || target.role === 'Admin') return false
    if (isMaster) return true
    return false
  }

  const canResetPassword = (target) => {
    if (!currentUser) return false
    if (target.id === currentUser.id) return false
    return isAdmin
  }

  const openEditor = (m) => {
    setEditingId(m.id)
    setCoinInput(String(m.coins))
    setPowerInput(String(m.power))
  }
  const closeEditor = () => {
    setEditingId(null)
    setCoinInput('')
    setPowerInput('')
  }

  const addMember = async () => {
    if (!newMember.name.trim()) { addToast('Character name is required.', 'red', 'Error'); return }
    if (!newMember.username.trim()) { addToast('Username is required.', 'red', 'Error'); return }
    if (!newMember.password.trim()) { addToast('Password is required.', 'red', 'Error'); return }
    if (visibleMembers.some(m => m.username && m.username.toLowerCase() === newMember.username.toLowerCase())) {
      addToast('Username already taken.', 'red', 'Error'); return
    }

    let finalRole = 'Member'
    if (isAdmin) {
      finalRole = newMember.role
    } else if (isMaster) {
      if (newMember.role === 'Elder' || newMember.role === 'Master') finalRole = newMember.role
    } else if (isElder) {
      if (newMember.role !== 'Member') {
        addToast('Only Master or Admin can add Elders or Masters.', 'red', 'Not Allowed')
        return
      }
    }

    if (finalRole === 'Master' && !isAdmin) {
      if (!window.confirm(`Create ${newMember.name.trim()} as a MASTER?`)) return
    }
    if (finalRole === 'Admin') {
      if (!window.confirm(`Create ${newMember.name.trim()} as an ADMIN?`)) return
    }

    setLoading(true)
    const member = {
      id: Date.now(),
      name: newMember.name.trim(),
      username: newMember.username.trim(),
      password: newMember.password.trim(),
      cls: newMember.cls,
      power: parseInt(newMember.power) || 10000,
      coins: 100,
      attendance: 0,
      role: finalRole,
    }
    const saved = await saveMember(member)
    setLoading(false)

    if (saved) {
      addToast(`${member.name} added as ${finalRole}!`, 'gold', 'Member Added')
      setNewMember({ name: '', username: '', password: '', cls: 'Berserker', power: 10000, role: 'Member' })
      setShowAdd(false)
    }
  }

  const removeMember = async (id) => {
    const member = visibleMembers.find(m => m.id === id)
    if (!member) return
    if (!canRemoveMember(member)) {
      addToast('You do not have permission to remove this member.', 'red', 'Not Allowed')
      return
    }
    if (window.confirm(`Remove ${member.name}?`)) {
      const ok = await deleteMember(id)
      if (ok) {
        addToast(`${member.name} removed.`, 'red', 'Removed')
        closeEditor()
      }
    }
  }

  const saveEdits = async (member) => {
    const updates = {}
    const coinVal = parseInt(coinInput)
    const powerVal = parseInt(powerInput)

    if (!Number.isFinite(coinVal) || coinVal < 0) { addToast('Enter a valid coin amount.', 'red', 'Error'); return }
    if (!Number.isFinite(powerVal) || powerVal < 0) { addToast('Enter a valid power value.', 'red', 'Error'); return }

    if (coinVal !== member.coins) updates.coins = coinVal
    if (powerVal !== member.power) updates.power = powerVal
    if (Object.keys(updates).length === 0) { closeEditor(); return }

    const ok = await updateMember(member.id, updates)
    if (ok) {
      const parts = []
      if (updates.coins !== undefined) parts.push(`coins → ${updates.coins.toLocaleString()}`)
      if (updates.power !== undefined) parts.push(`power → ${updates.power.toLocaleString()}`)
      addToast(`${member.name}: ${parts.join(', ')}`, 'gold', 'Saved')
      closeEditor()
    }
  }

  const changeRole = async (id, newRole) => {
    const member = visibleMembers.find(m => m.id === id)
    if (!member) return
    if (!canChangeRole(member)) {
      addToast('You do not have permission to change roles.', 'red', 'Not Allowed')
      return
    }
    if (newRole === 'Master' && !isAdmin) {
      if (!window.confirm(`Promote ${member.name} to MASTER?`)) return
    }
    if (newRole === 'Admin') {
      if (!window.confirm(`Promote ${member.name} to ADMIN?`)) return
    }
    await updateMember(id, { role: newRole })
    addToast(`${member.name} is now ${newRole}.`, 'gold', 'Role Updated')
  }

  const colCount = isElder ? 7 : 6

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-spectral text-2xl font-bold text-gold-light">Members</h1>
          <p className="text-text-dim text-sm">{visibleMembers.length} warriors in the clan</p>
        </div>
        <div className="flex gap-2">
          <input
            className="input max-w-[200px]"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {isElder && (
            <button onClick={() => setShowAdd(!showAdd)} className="btn-gold">
              {showAdd ? '✕' : '+ Add'}
            </button>
          )}
        </div>
      </div>

      {showAdd && isElder && (
        <div className="card mb-4 border-gold/40">
          <div className="text-sm font-bold text-text-dim uppercase tracking-wider mb-3">Add New Member</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-text-dim mb-1">Character Name *</label>
              <input className="input" placeholder="e.g. Arthur Shelby" value={newMember.name} onChange={e => setNewMember({ ...newMember, name: e.target.value })} disabled={loading} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-text-dim mb-1">Username (login) *</label>
              <input className="input" placeholder="e.g. arthur" value={newMember.username} onChange={e => setNewMember({ ...newMember, username: e.target.value })} disabled={loading} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-text-dim mb-1">Password *</label>
              <input className="input" type="password" placeholder="Initial password" value={newMember.password} onChange={e => setNewMember({ ...newMember, password: e.target.value })} disabled={loading} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-text-dim mb-1">Class</label>
              <select className="input" value={newMember.cls} onChange={e => setNewMember({ ...newMember, cls: e.target.value })} disabled={loading}>
                <option>Berserker</option><option>Warlord</option><option>Archer</option>
                <option>Skald</option><option>Volva</option><option>Rune Fighter</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-text-dim mb-1">Power</label>
              <input className="input" type="number" min="0" placeholder="10000" value={newMember.power} onChange={e => setNewMember({ ...newMember, power: parseInt(e.target.value) || 0 })} disabled={loading} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-text-dim mb-1">Role</label>
              <select className="input" value={newMember.role} onChange={e => setNewMember({ ...newMember, role: e.target.value })} disabled={loading}>
                <option value="Member">Member</option>
                {isMaster && <option value="Elder">Elder</option>}
                {isMaster && <option value="Master">Master</option>}
                {isAdmin && <option value="Admin">Admin (hidden)</option>}
              </select>
            </div>
          </div>
          <button onClick={addMember} className="btn-gold w-full mt-3" disabled={loading}>
            {loading ? 'Adding...' : 'Add Member'}
          </button>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gold/20">
              <th className="text-left py-3 px-4 text-text-dim font-bold text-[10px] uppercase tracking-wider">#</th>
              <th className="text-left py-3 px-4 text-text-dim font-bold text-[10px] uppercase tracking-wider">Name</th>
              {isElder && <th className="text-left py-3 px-4 text-text-dim font-bold text-[10px] uppercase tracking-wider">Username</th>}
              <th className="text-left py-3 px-4 text-text-dim font-bold text-[10px] uppercase tracking-wider">Class</th>
              <th className="text-right py-3 px-4 text-text-dim font-bold text-[10px] uppercase tracking-wider">Power</th>
              <th className="text-right py-3 px-4 text-text-dim font-bold text-[10px] uppercase tracking-wider">Coins</th>
              <th className="text-center py-3 px-4 text-text-dim font-bold text-[10px] uppercase tracking-wider">Att</th>
              <th className="text-center py-3 px-4 text-text-dim font-bold text-[10px] uppercase tracking-wider">Role</th>
              {isElder && <th className="text-right py-3 px-4 text-text-dim font-bold text-[10px] uppercase tracking-wider">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={colCount + 1} className="text-center py-8 text-text-dim">No members found.</td></tr>
            ) : (
              filtered.map((m, i) => {
                const isEditing = editingId === m.id
                const canRemove = canRemoveMember(m)
                const canRole = canChangeRole(m)
                const canReset = canResetPassword(m)
                const isSelf = m.id === currentUser?.id
                return (
                  <React.Fragment key={m.id}>
                    <tr className={`border-b border-gold/10 transition-colors ${isEditing ? 'bg-gold/10' : 'hover:bg-gold/5'}`}>
                      <td className="py-3 px-4 text-text-dim">{i + 1}</td>
                      <td className="py-3 px-4 font-semibold text-gold-light">{m.name}</td>
                      {isElder && <td className="py-3 px-4 text-text-dim font-mono text-xs">{m.username}</td>}
                      <td className="py-3 px-4 text-text-dim">{m.cls}</td>
                      <td className="py-3 px-4 text-right text-text font-semibold">{m.power.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-bold text-gold-bright">{m.coins.toLocaleString()}</td>
                      <td className="py-3 px-4 text-center text-text">{m.attendance}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`badge ${
                          m.role === 'Admin' ? 'badge-red' :
                          m.role === 'Master' ? 'badge-gold' :
                          m.role === 'Elder' ? 'badge-red' :
                          'badge-blue'
                        }`}>
                          {m.role}
                        </span>
                      </td>
                      {isElder && (
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => isEditing ? closeEditor() : openEditor(m)}
                            className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                              isEditing ? 'border-gold bg-gold/20 text-gold-bright' : 'border-gold/40 text-gold-light hover:bg-gold/10'
                            }`}
                          >
                            {isEditing ? '✕ Close' : '⚙ Adjust'}
                          </button>
                        </td>
                      )}
                    </tr>

                    {isEditing && (
                      <tr className="border-b border-gold/10 bg-void/60">
                        <td></td>
                        <td colSpan={colCount} className="py-4 px-4">
                          <div className="rounded-lg border border-gold/25 bg-gradient-to-b from-gold/5 to-transparent p-4">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-gold-light mb-3">
                              Adjusting: {m.name}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                              <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-gold-light mb-2">🪙 Coins</label>
                                <div className="flex items-center gap-2">
                                  <input type="number" min="0" value={coinInput} onChange={e => setCoinInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEdits(m) }} className="input text-sm px-3 py-2 flex-1 text-right font-mono" autoFocus />
                                  <span className="text-[10px] text-text-dim whitespace-nowrap">{'now ' + m.coins.toLocaleString()}</span>
                                </div>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-blue-300 mb-2">⚔️ Power</label>
                                <div className="flex items-center gap-2">
                                  <input type="number" min="0" value={powerInput} onChange={e => setPowerInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEdits(m) }} className="input text-sm px-3 py-2 flex-1 text-right font-mono" />
                                  <span className="text-[10px] text-text-dim whitespace-nowrap">{'now ' + m.power.toLocaleString()}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 md:justify-end">
                                <button onClick={() => saveEdits(m)} className="btn-gold text-xs px-4 py-2">Save Changes</button>
                                <button onClick={closeEditor} className="text-xs px-3 py-2 rounded border border-gold/30 text-text-dim hover:text-gold-light transition-colors">Cancel</button>
                              </div>
                            </div>

                            {(!isSelf && (canRole || canRemove || canReset)) && (
                              <div className="mt-4 pt-4 border-t border-gold/20 flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim mr-2">Role & Access</span>

                                {canRole && m.role === 'Member' && (
                                  <button onClick={() => changeRole(m.id, 'Elder')} className="text-xs px-3 py-1.5 rounded border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors">↑ Promote to Elder</button>
                                )}
                                {canRole && m.role === 'Elder' && (
                                  <>
                                    <button onClick={() => changeRole(m.id, 'Member')} className="text-xs px-3 py-1.5 rounded border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 transition-colors">↓ Demote to Member</button>
                                    {isMaster && (
                                      <button onClick={() => changeRole(m.id, 'Master')} className="text-xs px-3 py-1.5 rounded border border-gold/60 text-gold-bright hover:bg-gold/20 transition-colors">★ Promote to Master</button>
                                    )}
                                  </>
                                )}
                                {isAdmin && (m.role === 'Member' || m.role === 'Elder' || m.role === 'Master') && (
                                  <button onClick={() => changeRole(m.id, 'Admin')} className="text-xs px-3 py-1.5 rounded border border-red-500/60 text-red-400 hover:bg-red-500/20 transition-colors">⚠ Make Admin</button>
                                )}
                                {isAdmin && m.role === 'Admin' && (
                                  <button onClick={() => changeRole(m.id, 'Master')} className="text-xs px-3 py-1.5 rounded border border-yellow-500/60 text-yellow-400 hover:bg-yellow-500/20 transition-colors">Demote from Admin</button>
                                )}
                                {canReset && (
                                  <button onClick={() => setResetTarget(m)} className="text-xs px-3 py-1.5 rounded border border-gold/40 text-gold-light hover:bg-gold/10 transition-colors">🔑 Reset Password</button>
                                )}
                                {canRemove && (
                                  <button onClick={() => removeMember(m.id)} className="text-xs px-3 py-1.5 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors ml-auto">✕ Remove Member</button>
                                )}
                              </div>
                            )}

                            {isSelf && (
                              <div className="mt-4 pt-4 border-t border-gold/20 text-[10px] text-text-dim">
                                You cannot remove or change the role of your own account. Use the dropdown in the top-right to change your own password.
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {resetTarget && (
        <ResetPasswordModal
          ctx={ctx}
          member={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
    </div>
  )
}