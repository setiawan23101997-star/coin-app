import React from 'react'

export default function Dashboard({ ctx, setPage }) {
  const { members, auctions, currentUser, addToast } = ctx

  const totalCoins = members.reduce((sum, m) => sum + m.coins, 0)
  const totalPower = members.reduce((sum, m) => sum + m.power, 0)
  const activeAuctions = auctions.filter(a => a.status === 'active').length
  const topMember = members.length > 0 ? [...members].sort((a, b) => b.power - a.power)[0] : null

  return (
    <div>
      <h1 className="font-spectral text-2xl font-bold text-gold-light mb-2">Dashboard</h1>
      <p className="text-text-dim text-sm mb-6">Overview of your clan's activity</p>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card text-center">
          <div className="text-2xl mb-1">👥</div>
          <div className="text-2xl font-bold text-gold-bright">{members.length}</div>
          <div className="text-xs text-text-dim uppercase tracking-wider">Warriors</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl mb-1">🪙</div>
          <div className="text-2xl font-bold text-gold-bright">{totalCoins.toLocaleString()}</div>
          <div className="text-xs text-text-dim uppercase tracking-wider">Coins in Circulation</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl mb-1">⚔️</div>
          <div className="text-2xl font-bold text-gold-bright">{totalPower.toLocaleString()}</div>
          <div className="text-xs text-text-dim uppercase tracking-wider">Total Power</div>
        </div>
        <div className="card text-center cursor-pointer hover:border-gold/60" onClick={() => setPage('auctions')}>
          <div className="text-2xl mb-1">🔨</div>
          <div className="text-2xl font-bold text-gold-bright">{activeAuctions}</div>
          <div className="text-xs text-text-dim uppercase tracking-wider">Live Auctions</div>
        </div>
      </div>

      {/* Top Member */}
      {topMember && (
        <div className="card border-gold/40 bg-gradient-to-r from-gold/5 to-transparent mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center text-2xl">
              👑
            </div>
            <div>
              <div className="text-sm text-text-dim uppercase tracking-wider">Reigning Champion</div>
              <div className="text-xl font-bold text-gold-bright">{topMember.name}</div>
              <div className="text-sm text-text-dim">{topMember.cls} · {topMember.power.toLocaleString()} Power</div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <button onClick={() => setPage('attendance')} className="card hover:border-gold/60 text-center py-4">
          <div className="text-2xl mb-1">📋</div>
          <div className="text-sm font-semibold">Record Attendance</div>
        </button>
        <button onClick={() => setPage('auctions')} className="card hover:border-gold/60 text-center py-4">
          <div className="text-2xl mb-1">🔨</div>
          <div className="text-sm font-semibold">View Auctions</div>
        </button>
        <button onClick={() => setPage('members')} className="card hover:border-gold/60 text-center py-4">
          <div className="text-2xl mb-1">👥</div>
          <div className="text-sm font-semibold">Manage Members</div>
        </button>
      </div>
    </div>
  )
}