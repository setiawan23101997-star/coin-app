import React, { useState } from 'react'

export default function Members({ ctx }) {
  const { members, setMembers, saveMember, updateMember, deleteMember, currentUser, addToast } = ctx
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newMember, setNewMember] = useState({ 
    name: '', 
    username: '', 
    password: '', 
    cls: 'Berserker', 
    power: 10000, 
    role: 'Member' 
  })
  const [loading, setLoading] = useState(false)

  const isMaster = currentUser?.role === 'Master'
  const filtered = members.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))

  const addMember = async () => {
    if (!newMember.name.trim()) {
      addToast('Character name is required.', 'red', 'Error')
      return
    }
    if (!newMember.username.trim()) {
      addToast('Username is required.', 'red', 'Error')
      return
    }
    if (!newMember.password.trim()) {
      addToast('Password is required.', 'red', 'Error')
      return
    }
    
    if (members.some(m => m.username.toLowerCase() === newMember.username.toLowerCase())) {
      addToast('Username already taken.', 'red', 'Error')
      return
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
      role: newMember.role,
    }

    const saved = await saveMember(member)
    setLoading(false)
    
    if (saved) {
      addToast(`${member.name} added to the clan!`, 'gold', 'Member Added')
      setNewMember({ name: '', username: '', password: '', cls: 'Berserker', power: 10000, role: 'Member' })
      setShowAdd(false)
    }
  }

  const removeMember = async (id) => {
    const member = members.find(m => m.id === id)
    if (!member) return
    if (member.role === 'Master') {
      addToast('Cannot remove the Master account.', 'red', 'Error')
      return
    }
    if (window.confirm(`Remove ${member.name}?`)) {
      const success = await deleteMember(id)
      if (success) {
        addToast(`${member.name} removed.`, 'red', 'Removed')
      }
    }
  }

  const adjustCoins = async (id, amount) => {
    const member = members.find(m => m.id === id)
    if (!member) return
    const newCoins = Math.max(0, member.coins + amount)
    await updateMember(id, { coins: newCoins })
  }

  const changeRole = async (id, newRole) => {
    const member = members.find(m => m.id === id)
    if (!member) return
    if (member.role === 'Master' && newRole !== 'Master') {
      addToast('Cannot demote the Master.', 'red', 'Error')
      return
    }
    await updateMember(id, { role: newRole })
    addToast(`${member.name} is now ${newRole}.`, 'gold', 'Role Updated')
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-spectral text-2xl font-bold text-gold-light">Members</h1>
          <p className="text-text-dim text-sm">{members.length} warriors in the clan</p>
        </div>
        <div className="flex gap-2">
          <input
            className="input max-w-[200px]"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {isMaster && (
            <button onClick={() => setShowAdd(!showAdd)} className="btn-gold">
              {showAdd ? '✕' : '+ Add'}
            </button>
          )}
        </div>
      </div>

      {showAdd && isMaster && (
        <div className="card mb-4 border-gold/40">
          <div className="text-sm font-bold text-text-dim uppercase tracking-wider mb-3">Add New Member</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="input"
              placeholder="Character Name *"
              value={newMember.name}
              onChange={e => setNewMember({ ...newMember, name: e.target.value })}
              disabled={loading}
            />
            <input
              className="input"
              placeholder="Username (login) *"
              value={newMember.username}
              onChange={e => setNewMember({ ...newMember, username: e.target.value })}
              disabled={loading}
            />
            <input
              className="input"
              type="password"
              placeholder="Password *"
              value={newMember.password}
              onChange={e => setNewMember({ ...newMember, password: e.target.value })}
              disabled={loading}
            />
            <select
              className="input"
              value={newMember.cls}
              onChange={e => setNewMember({ ...newMember, cls: e.target.value })}
              disabled={loading}
            >
              <option>Berserker</option>
              <option>Warlord</option>
              <option>Archer</option>
              <option>Skald</option>
              <option>Volva</option>
              <option>Rune Fighter</option>
            </select>
            <input
              className="input"
              type="number"
              placeholder="Power"
              value={newMember.power}
              onChange={e => setNewMember({ ...newMember, power: parseInt(e.target.value) || 0 })}
              disabled={loading}
            />
            <select
              className="input"
              value={newMember.role}
              onChange={e => setNewMember({ ...newMember, role: e.target.value })}
              disabled={loading}
            >
              <option value="Member">Member</option>
              <option value="Elder">Elder</option>
            </select>
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
              <th className="text-left py-2 px-3 text-text-dim font-bold text-[10px] uppercase tracking-wider">#</th>
              <th className="text-left py-2 px-3 text-text-dim font-bold text-[10px] uppercase tracking-wider">Name</th>
              <th className="text-left py-2 px-3 text-text-dim font-bold text-[10px] uppercase tracking-wider">Username</th>
              <th className="text-left py-2 px-3 text-text-dim font-bold text-[10px] uppercase tracking-wider">Class</th>
              <th className="text-right py-2 px-3 text-text-dim font-bold text-[10px] uppercase tracking-wider">Power</th>
              <th className="text-right py-2 px-3 text-text-dim font-bold text-[10px] uppercase tracking-wider">Coins</th>
              <th className="text-center py-2 px-3 text-text-dim font-bold text-[10px] uppercase tracking-wider">Att</th>
              <th className="text-center py-2 px-3 text-text-dim font-bold text-[10px] uppercase tracking-wider">Role</th>
              <th className="text-right py-2 px-3 text-text-dim font-bold text-[10px] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="9" className="text-center py-8 text-text-dim">No members found.</td></tr>
            ) : (
              filtered.map((m, i) => (
                <tr key={m.id} className="border-b border-gold/10 hover:bg-gold/5 transition-colors">
                  <td className="py-2 px-3 text-text-dim">{i + 1}</td>
                  <td className="py-2 px-3 font-semibold text-gold-light">{m.name}</td>
                  <td className="py-2 px-3 text-text-dim">{m.username}</td>
                  <td className="py-2 px-3 text-text-dim">{m.cls}</td>
                  <td className="py-2 px-3 text-right text-text">{m.power.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right font-bold text-gold-bright">{m.coins.toLocaleString()}</td>
                  <td className="py-2 px-3 text-center text-text">{m.attendance}</td>
                  <td className="py-2 px-3 text-center">
                    <span className={`badge ${m.role === 'Master' ? 'badge-gold' : m.role === 'Elder' ? 'badge-red' : 'badge-blue'}`}>
                      {m.role}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex items-center justify-end gap-1 flex-wrap">
                      {isMaster && m.id !== currentUser?.id ? (
                        <>
                          <button onClick={() => adjustCoins(m.id, 10)} className="text-xs text-gold-light hover:text-gold-bright px-1">+10</button>
                          <button onClick={() => adjustCoins(m.id, -10)} className="text-xs text-text-dim hover:text-red-400 px-1">-10</button>
                          {m.role === 'Member' && (
                            <button onClick={() => changeRole(m.id, 'Elder')} className="text-xs text-blue-400 hover:text-blue-300 px-1">↑Elder</button>
                          )}
                          {m.role === 'Elder' && (
                            <button onClick={() => changeRole(m.id, 'Member')} className="text-xs text-yellow-400 hover:text-yellow-300 px-1">↓Member</button>
                          )}
                          <button onClick={() => removeMember(m.id)} className="text-xs text-red-400 hover:text-red-300 px-1">✕</button>
                        </>
                      ) : (
                        <span className="text-xs text-text-dim">View only</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}