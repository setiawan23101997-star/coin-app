import React from 'react'

export default function Leaderboard({ ctx }) {
  const { members, currentUser } = ctx

  const sortedByCoins = [...members].sort((a, b) => b.coins - a.coins)
  const sortedByPower = [...members].sort((a, b) => b.power - a.power)
  const sortedByAttendance = [...members].sort((a, b) => b.attendance - a.attendance)

  const RankRow = ({ rank, member, value, label }) => (
    <div className={`flex items-center gap-3 py-2 border-b border-gold/10 ${member.id === currentUser?.id ? 'bg-gold/5 px-2 rounded' : ''}`}>
      <div className={`w-8 text-center font-bold text-sm ${rank <= 3 ? 'text-gold-bright' : 'text-text-dim'}`}>
        #{rank}
      </div>
      <div className="flex-1 font-medium">{member.name}</div>
      <div className="text-xs text-text-dim hidden sm:block">{member.cls}</div>
      <div className="text-right font-bold text-gold-light">{value}</div>
      <div className="text-[10px] text-text-dim uppercase tracking-wider min-w-[40px] text-right">{label}</div>
    </div>
  )

  return (
    <div>
      <h1 className="font-spectral text-2xl font-bold text-gold-light mb-2">Leaderboard</h1>
      <p className="text-text-dim text-sm mb-6">The mightiest warriors of the clan</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Richest */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🪙</span>
            <span className="font-bold text-text-dim uppercase tracking-wider text-sm">Richest</span>
          </div>
          {sortedByCoins.map((m, i) => (
            <RankRow key={m.id} rank={i + 1} member={m} value={m.coins.toLocaleString()} label="coins" />
          ))}
        </div>

        {/* Most Powerful */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">⚔️</span>
            <span className="font-bold text-text-dim uppercase tracking-wider text-sm">Most Powerful</span>
          </div>
          {sortedByPower.map((m, i) => (
            <RankRow key={m.id} rank={i + 1} member={m} value={m.power.toLocaleString()} label="power" />
          ))}
        </div>

        {/* Most Active */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">📋</span>
            <span className="font-bold text-text-dim uppercase tracking-wider text-sm">Most Active</span>
          </div>
          {sortedByAttendance.map((m, i) => (
            <RankRow key={m.id} rank={i + 1} member={m} value={`${m.attendance}x`} label="events" />
          ))}
        </div>
      </div>
    </div>
  )
}