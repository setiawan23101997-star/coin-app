import React, { useState, useEffect, useMemo, useCallback, useId, useRef } from 'react'

const WEEKLY_SCHEDULE = {
  1: [
    { time: '22:00', type: 'boss', name: 'Canyon of Nidavellir 1F', boss: 'Nargrim' },
    { time: '22:10', type: 'boss', name: 'Folkvang 5F · Inter-Server', boss: 'Twilight Disaster Nirva' },
  ],
  2: [
    { time: '20:00', type: 'battle', name: 'Server Battle', subtitle: 'Lv 40+ · Top 500 Growth Power' },
  ],
  3: [
    { time: '22:00', type: 'boss', name: 'Canyon of the World Tree', boss: 'Twilight Overlord Rogvalt' },
    { time: '22:10', type: 'boss', name: 'Crossroads of Ragnarok', boss: 'Faded Oath Vargreif' },
  ],
  4: [
    { time: '13:00', type: 'battle', name: 'Clan Annihilation', subtitle: '13:00 – 14:00' },
    { time: '19:00', type: 'boss', name: 'Myrkrheim', boss: 'Wrath of the Earth Bergbernd' },
    { time: '20:00', type: 'battle', name: 'Clan Annihilation', subtitle: '20:00 – 21:00' },
  ],
  5: [
    { time: '22:00', type: 'boss', name: 'Folkvang 5F · Inter-Server', boss: 'Twilight Disaster Nirva' },
    { time: '22:10', type: 'boss', name: 'Crossroads of Ragnarok', boss: 'Faded Oath Vargreif' },
  ],
  6: [
    { time: '13:00', type: 'treasure', name: "Sindri's Treasure Island", subtitle: '13:00 – 14:00' },
    { time: '19:00', type: 'boss', name: 'Glasir Forest', boss: 'Divine Beast of Void Ulnos' },
    { time: '20:00', type: 'treasure', name: "Sindri's Treasure Island", subtitle: '20:00 – 21:00' },
  ],
  0: [
    { time: '20:00', type: 'arena', name: 'Clan Arena Tournament', subtitle: 'See announcement' },
    { time: '22:00', type: 'boss', name: 'Canyon of the World Tree', boss: 'Twilight Overlord Rogvalt' },
    { time: '22:10', type: 'boss', name: 'Canyon of Nidavellir 1F', boss: 'Nargrim' },
  ],
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const URGENT_MS = 5 * 60 * 1000 // shared "about to happen" threshold for events + auctions
const RECENT_WIN_MS = 7 * 24 * 60 * 60 * 1000 // 7 days — how long a finished auction stays on the dashboard
const JUST_ENDED_MS = 5 * 60 * 1000 // a finished auction younger than this gets the "just ended" pulse
const MAX_RECENT_WINS = 6 // how many finished auctions to show (each win is its own card, even for the same user)
const DEBUG_WINS = false // flip to true to log why auctions are filtered out of "Recently won"

const TYPE = {
  boss:     { color: '#ef4444', icon: '👾', label: 'World Boss' },
  battle:   { color: '#3b82f6', icon: '⚔️', label: 'Battle' },
  treasure: { color: '#eab308', icon: '🏝️', label: 'Treasure' },
  arena:    { color: '#a855f7', icon: '🏟️', label: 'Arena' },
}

const RARITY_COLORS = {
  material:   { color: '#4ade80', border: 'rgba(74,222,128,0.6)' },
  uncommon:   { color: '#ffffff', border: 'rgba(255,255,255,0.55)' },
  rare:       { color: '#60a5fa', border: 'rgba(96,165,250,0.6)' },
  epic:       { color: '#f87171', border: 'rgba(248,113,113,0.7)' },
  legendary:  { color: '#f2cc60', border: 'rgba(242,204,96,0.75)' },
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Non-breaking space (U+00A0) so "10:00 PM" never wraps between the time and the period.
const NBSP = '\u00A0'

function to12h(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')}${NBSP}${period}`
}

function toGMT8(ts) {
  return new Date(ts + 8 * 60 * 60 * 1000)
}

function nextOccurrence(dayOfWeek, hhmm, fromTs) {
  const [hh, mm] = hhmm.split(':').map(Number)
  const now8 = toGMT8(fromTs)
  const delta = (dayOfWeek - now8.getUTCDay() + 7) % 7
  const candidate = Date.UTC(
    now8.getUTCFullYear(), now8.getUTCMonth(), now8.getUTCDate() + delta,
    hh - 8, mm, 0, 0
  )
  return candidate <= fromTs ? candidate + WEEK_MS : candidate
}

function formatCountdown(ms) {
  if (ms <= 0) return 'Now'
  const totalSec = Math.floor(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatAuctionTime(ms) {
  if (ms <= 0) return 'Ended'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

/** "12m ago", "3h ago", "1d ago" — for the recently-won strip. */
function formatRelativePast(ms) {
  if (ms <= 0) return 'just now'
  const totalSec = Math.floor(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return `${s}s ago`
}

function getGreeting(hour) {
  if (hour < 5) return 'Still up'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Normalize a finished auction into a "winner" record.
 */
function readWinner(a, now = Date.now()) {
  const name = a.winner || a.winnerName || a.topBidder || a.soldTo || null
  const price = a.finalBid ?? a.currentBid ?? a.winningBid ?? 0

  const explicit = a.endedAt || a.closedAt || 0
  const scheduled = a.endsAt || 0
  const lastBidTs = (() => {
    const bids = a.bids || []
    for (let i = bids.length - 1; i >= 0; i--) {
      const t = bids[i]?.time
      if (typeof t === 'number' && t > 0) return t
    }
    return 0
  })()

  let endedAt = 0
  if (explicit > 0) endedAt = explicit
  else if (scheduled > 0 && scheduled <= now) endedAt = scheduled
  else if (lastBidTs > 0) endedAt = lastBidTs

  return { name, price, endedAt }
}

export default function Dashboard({ ctx, setPage }) {
  const { members, auctions, currentUser } = ctx
  const [now, setNow] = useState(() => Date.now())
  const [selectedDay, setSelectedDay] = useState(null)
  const idPrefix = useId()

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const clock = useMemo(() => toGMT8(now), [now])
  const todayDow = clock.getUTCDay()

  useEffect(() => {
    setSelectedDay(prev => prev ?? todayDow)
  }, [todayDow])

  const isAdmin = currentUser?.role === 'Admin'
  const isElder = isAdmin || currentUser?.role === 'Elder' || currentUser?.role === 'Master'

  const { visibleMembers, totalCoins, totalPower } = useMemo(() => {
    const visible = isAdmin ? members : members.filter(m => m.role !== 'Admin')
    const coins = visible.reduce((s, m) => s + m.coins, 0)
    const power = visible.reduce((s, m) => s + m.power, 0)
    return { visibleMembers: visible, totalCoins: coins, totalPower: power }
  }, [members, isAdmin])

  const activeAuctions = useMemo(() => {
    return auctions
      .filter(a => a.status === 'active')
      .sort((a, b) => (a.endsAt || 0) - (b.endsAt || 0))
      .slice(0, 3)
  }, [auctions])

  const totalActiveAuctions = useMemo(
    () => auctions.filter(a => a.status === 'active').length,
    [auctions]
  )

  const recentWins = useMemo(() => {
    const cutoff = now - RECENT_WIN_MS
    const allEnded = auctions.filter(a => a.status !== 'active')

    const winners = allEnded
      .filter(a => {
        const { name, endedAt } = readWinner(a, now)
        const hasWinner = !!name
        const hasEnd = endedAt > 0
        const inWindow = hasEnd && endedAt >= cutoff && endedAt <= now
        const pass = hasWinner && hasEnd && inWindow

        if (DEBUG_WINS) {
          console.log('[recentWins]', {
            id: a.id,
            name: a.name,
            winner: name,
            endedAt,
            endsAt: a.endsAt,
            endedAtField: a.endedAt,
            hasWinner,
            hasEnd,
            inWindow,
            pass,
          })
        }
        return pass
      })
      .sort((a, b) => readWinner(b, now).endedAt - readWinner(a, now).endedAt)
      .slice(0, MAX_RECENT_WINS)

    if (DEBUG_WINS) {
      console.log(`[recentWins] ${allEnded.length} ended auctions → ${winners.length} shown`)
    }
    return winners
  }, [auctions, now])

  const scheduleByDay = useMemo(() => {
    const out = {}
    for (const dow of DAY_ORDER) {
      out[dow] = [...(WEEKLY_SCHEDULE[dow] || [])].sort((a, b) => a.time.localeCompare(b.time))
    }
    return out
  }, [])

  const nextEvent = useMemo(() => {
    let best = null
    for (const dow of DAY_ORDER) {
      for (const ev of scheduleByDay[dow]) {
        const nextTs = nextOccurrence(dow, ev.time, now)
        if (!best || nextTs < best.nextTs) best = { ...ev, dow, nextTs }
      }
    }
    return best
  }, [scheduleByDay, now])

  const todayEvents = scheduleByDay[todayDow] || []
  const greeting = getGreeting(clock.getUTCHours())
  const firstName = currentUser?.name?.split(' ')[0] || 'Warrior'
  const activeDay = selectedDay ?? todayDow

  return (
    <div className="space-y-8 pb-8">

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section className="relative rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/[0.06] via-transparent to-transparent overflow-hidden">
        <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-center">
          <div>
            <h1 className="font-spectral text-4xl md:text-5xl font-bold leading-none">
              <span className="text-text-bright">{greeting}, </span>
              <span className="text-gold-bright">{firstName}</span>
            </h1>
            <p className="text-text-dim text-base mt-4 max-w-lg">
              {todayEvents.length > 0
                ? <>{todayEvents.length} {todayEvents.length === 1 ? 'event' : 'events'} on today's schedule — first one at{' '}
                    <span className="text-gold-light font-semibold font-mono whitespace-nowrap">{to12h(todayEvents[0].time)}</span>.</>
                : <>Nothing scheduled today. Good day to rest up.</>}
            </p>
          </div>

          <div className="rounded-xl border border-gold/25 bg-void/60 px-5 py-4 w-full lg:w-[200px] flex lg:block items-center justify-between gap-4">
            <div>
              <div className="text-[11px] text-gold-dim font-semibold mb-1">Server time, GMT+8</div>
              <div className="font-mono tabular-nums leading-none text-gold-bright whitespace-nowrap">
                <span className="text-3xl md:text-4xl">
                  {String(clock.getUTCHours()).padStart(2, '0')}:{String(clock.getUTCMinutes()).padStart(2, '0')}
                </span>
                <span className="text-lg text-gold-light/60 ml-1">:{String(clock.getUTCSeconds()).padStart(2, '0')}</span>
              </div>
            </div>
            <div className="text-sm text-text-dim lg:mt-3 text-right lg:text-left">
              <div>{DAY_NAMES[todayDow]}</div>
              <div className="text-xs">{String(clock.getUTCDate()).padStart(2, '0')} {MONTH_SHORT[clock.getUTCMonth()]} {clock.getUTCFullYear()}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── QUICK ACTIONS ─────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ActionTile icon="📋" label="Attendance" hint={isElder ? 'Record & award coins' : 'View attendance history'} onClick={() => setPage('attendance')} />
        <ActionTile icon="🔨" label="Auctions" hint="Bid on clan items" onClick={() => setPage('auctions')} />
        <ActionTile icon="👥" label={isElder ? 'Manage members' : 'View members'} hint={isElder ? 'Add, edit & remove' : 'See clan roster'} onClick={() => setPage('members')} />
      </section>

      {/* ── LIVE AUCTIONS ─────────────────────────────────────────────── */}
      <LiveAuctionsStrip
        auctions={activeAuctions}
        totalCount={totalActiveAuctions}
        now={now}
        onOpenAll={() => setPage('auctions')}
        currentUser={currentUser}
      />

      {/* ── RECENTLY WON ──────────────────────────────────────────────── */}
      <RecentWinsStrip
        wins={recentWins}
        now={now}
        onOpenAll={() => setPage('auctions')}
        currentUser={currentUser}
      />

      {/* ── STATS ─────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile icon="👥" label="Warriors" value={visibleMembers.length} />
        <StatTile icon="🪙" label="Coins in play" value={totalCoins.toLocaleString()} />
        <StatTile icon="⚔️" label="Total power" value={totalPower.toLocaleString()} />
        <StatTile icon="🔨" label="Live auctions" value={totalActiveAuctions} onClick={() => setPage('auctions')} />
      </section>

      {/* ── SCHEDULE ──────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
          <div>
            <h2 className="font-spectral text-3xl font-bold text-text-bright">Weekly schedule</h2>
            <p className="text-text-dim text-sm mt-1">GMT+8 · repeats every week</p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            {Object.entries(TYPE).map(([k, t]) => (
              <div key={k} className="flex items-center gap-1.5 text-xs text-text-dim">
                <span aria-hidden="true">{t.icon}</span>
                <span>{t.label}</span>
              </div>
            ))}
          </div>
        </div>

        {nextEvent && <NextEventCard event={nextEvent} now={now} />}

        <WeeklyEventTabs
          scheduleByDay={scheduleByDay}
          todayDow={todayDow}
          activeDay={activeDay}
          onSelect={setSelectedDay}
          now={now}
          idPrefix={idPrefix}
        />
      </section>

    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────── */

function LiveAuctionsStrip({ auctions, totalCount, now, onOpenAll, currentUser }) {
  if (totalCount === 0) return null

  return (
    <section>
      <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="font-spectral text-xl font-bold text-text-bright">Live auctions</h2>
          <span className="text-[11px] font-semibold text-gold-bright bg-gold/15 border border-gold/40 rounded px-2 py-0.5">
            {totalCount} active
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenAll}
          className="text-xs font-semibold text-gold-light hover:text-gold-bright transition-colors"
        >
          View all →
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {auctions.map(a => {
          const rarity = RARITY_COLORS[a.rarity] || RARITY_COLORS.epic
          const remaining = (a.endsAt || 0) - now
          const isEnding = remaining > 0 && remaining < URGENT_MS
          const isLeading = a.topBidder && currentUser?.name === a.topBidder
          const bidCount = (a.bids || []).length
          const timeLabel = formatAuctionTime(remaining)
          const cardLabel = `${a.name}, ${a.rarity} rarity, current bid ${(a.currentBid || 0).toLocaleString()}` +
            (a.topBidder ? `, top bidder ${a.topBidder}` : ', no bids yet') +
            `, ${timeLabel} left`

          return (
            <button
              key={a.id}
              type="button"
              onClick={onOpenAll}
              aria-label={cardLabel}
              className="group text-left rounded-xl border bg-void/40 px-4 py-3 transition-colors hover:bg-gold/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60"
              style={{
                borderColor: isLeading ? 'rgba(34,197,94,0.5)' : rarity.border,
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-2" aria-hidden="true">
                <span
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: rarity.color }}
                >
                  {a.rarity}
                </span>
                <span
                  className={`text-[11px] font-mono tabular-nums font-semibold whitespace-nowrap ${
                    isEnding ? 'text-red-400 motion-safe:animate-pulse' : 'text-text-dim'
                  }`}
                >
                  {timeLabel}
                </span>
              </div>

              <div
                className="text-sm font-semibold truncate mb-2"
                style={{ color: rarity.color }}
                aria-hidden="true"
              >
                {a.name}
              </div>

              <div className="flex items-end justify-between gap-2" aria-hidden="true">
                <div className="min-w-0">
                  <div className="text-[10px] text-text-dim">Top bid</div>
                  <div className="font-mono text-lg font-bold text-gold-bright tabular-nums leading-tight">
                    {(a.currentBid || 0).toLocaleString()}
                  </div>
                </div>
                <div className="text-right min-w-0">
                  <div className="text-[10px] text-text-dim">Bidder</div>
                  <div className={`text-xs font-semibold truncate ${isLeading ? 'text-green-400' : 'text-text-bright'}`}>
                    {a.topBidder || '—'}
                  </div>
                  <div className="text-[10px] text-text-dim mt-0.5">
                    {bidCount} {bidCount === 1 ? 'bid' : 'bids'}
                  </div>
                </div>
              </div>

              {isLeading && (
                <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-green-400" aria-hidden="true">
                  ✓ You're leading
                </div>
              )}
            </button>
          )
        })}
      </div>

      {totalCount > auctions.length && (
        <p className="mt-2 w-full text-center text-xs text-text-dim py-2">
          and {totalCount - auctions.length} more {totalCount - auctions.length === 1 ? 'auction' : 'auctions'}
        </p>
      )}
    </section>
  )
}

function RecentWinsStrip({ wins, now, onOpenAll, currentUser }) {
  if (wins.length === 0) return null

  const winCounts = wins.reduce((acc, a) => {
    const { name } = readWinner(a, now)
    if (name) acc[name] = (acc[name] || 0) + 1
    return acc
  }, {})

  return (
    <section>
      <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="font-spectral text-xl font-bold text-text-bright">Recently won</h2>
          <span className="text-[11px] font-semibold text-green-400 bg-green-500/10 border border-green-500/40 rounded px-2 py-0.5">
            last 7 days
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenAll}
          className="text-xs font-semibold text-gold-light hover:text-gold-bright transition-colors"
        >
          View history →
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {wins.map(a => {
          const rarity = RARITY_COLORS[a.rarity] || RARITY_COLORS.epic
          const { name: winnerName, price, endedAt } = readWinner(a, now)
          const isMe = winnerName && currentUser?.name === winnerName
          const justEnded = endedAt > 0 && (now - endedAt) < JUST_ENDED_MS
          const agoLabel = formatRelativePast(now - endedAt)
          const totalWins = winCounts[winnerName] || 1
          const hasMultipleWins = totalWins > 1
          const cardLabel = `${a.name} won by ${winnerName} for ${price.toLocaleString()} coins, ${agoLabel}` +
            (hasMultipleWins ? ` (${totalWins} wins in the last 7 days)` : '') +
            (isMe ? '. Congratulations!' : '') +
            (justEnded ? ' Just ended.' : '')

          return (
            <button
              key={a.id}
              type="button"
              onClick={onOpenAll}
              aria-label={cardLabel}
              className={`group relative text-left rounded-xl border px-4 py-3 transition-colors hover:bg-gold/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 ${
                isMe ? 'bg-green-500/[0.06]' : 'bg-void/40'
              }`}
              style={{
                borderColor: isMe ? 'rgba(34,197,94,0.55)' : rarity.border,
                boxShadow: isMe ? '0 0 0 1px rgba(34,197,94,0.15), 0 0 24px -8px rgba(34,197,94,0.35)' : undefined,
              }}
            >
              {justEnded && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-xl motion-safe:animate-pulse"
                  style={{ boxShadow: '0 0 0 1px rgba(242,204,96,0.45), 0 0 22px -4px rgba(242,204,96,0.55)' }}
                />
              )}

              <div className="flex items-center justify-between gap-2 mb-2" aria-hidden="true">
                <span
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: rarity.color }}
                >
                  {a.rarity}
                </span>
                <span className="text-[11px] font-mono tabular-nums font-semibold text-text-dim whitespace-nowrap">
                  {justEnded ? 'Just ended' : agoLabel}
                </span>
              </div>

              <div
                className="text-sm font-semibold truncate mb-2"
                style={{ color: rarity.color }}
                aria-hidden="true"
              >
                {a.name}
              </div>

              <div className="flex items-end justify-between gap-2" aria-hidden="true">
                <div className="min-w-0">
                  <div className="text-[10px] text-text-dim">Final price</div>
                  <div className="font-mono text-lg font-bold text-gold-bright tabular-nums leading-tight">
                    {price.toLocaleString()}
                  </div>
                </div>
                <div className="text-right min-w-0">
                  <div className="text-[10px] text-text-dim">Won by</div>
                  <div className={`text-xs font-semibold truncate ${isMe ? 'text-green-400' : 'text-text-bright'}`}>
                    {winnerName}
                  </div>
                  {hasMultipleWins && (
                    <div className="text-[10px] text-gold-light mt-0.5">
                      {totalWins} wins this week
                    </div>
                  )}
                </div>
              </div>

              <div
                className={`mt-2 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                  isMe ? 'text-green-400' : 'text-text-dim'
                }`}
                aria-hidden="true"
              >
                <span>{isMe ? '🎉' : '🏆'}</span>
                <span>{isMe ? 'Congratulations!' : 'Sold'}</span>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function NextEventCard({ event, now }) {
  const t = TYPE[event.type]
  const remaining = event.nextTs - now
  const urgent = remaining > 0 && remaining < URGENT_MS
  const progress = Math.min(1, Math.max(0, 1 - remaining / WEEK_MS))

  return (
    <div className="relative rounded-2xl border border-gold/25 overflow-hidden mb-4">
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{ background: `radial-gradient(circle at 0% 0%, ${t.color}, transparent 60%)` }}
        aria-hidden="true"
      />
      <div className="relative p-4 sm:p-6 flex items-center gap-4 sm:gap-6 flex-wrap">
        <div
          className="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center text-2xl sm:text-3xl"
          style={{ background: `${t.color}15`, border: `1px solid ${t.color}40` }}
          aria-hidden="true"
        >
          {t.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold mb-1" style={{ color: t.color }}>Coming up next</div>
          <div className="font-spectral text-xl sm:text-2xl font-bold text-text-bright leading-tight truncate">{event.name}</div>
          <div className="flex items-center gap-3 sm:gap-4 mt-2 text-sm text-text-dim flex-wrap">
            {event.boss && <span className="truncate">👾 {event.boss}</span>}
            <span className="font-mono tabular-nums whitespace-nowrap">{DAY_NAMES[event.dow]} · {to12h(event.time)}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[11px] text-text-dim font-semibold mb-1">Starts in</div>
          <div
            className={`font-mono text-3xl sm:text-4xl font-bold tabular-nums leading-none whitespace-nowrap ${urgent ? 'motion-safe:animate-pulse' : ''}`}
            style={{ color: t.color }}
          >
            {formatCountdown(remaining)}
          </div>
        </div>
      </div>
      <div className="h-1 bg-void/60" role="presentation">
        <div
          className="h-full transition-[width] duration-1000 ease-linear"
          style={{ width: `${progress * 100}%`, background: t.color }}
        />
      </div>
    </div>
  )
}

/**
 * Horizontal day-tab bar (ARIA "tabs" pattern) + a single panel below it
 * showing that day's events. Arrow keys move focus/selection between
 * tabs, Home/End jump to the first/last day.
 */
function WeeklyEventTabs({ scheduleByDay, todayDow, activeDay, onSelect, now, idPrefix }) {
  const tabRefs = useRef({})

  const moveSelection = useCallback((fromDow, step) => {
    const idx = DAY_ORDER.indexOf(fromDow)
    const nextIdx = (idx + step + DAY_ORDER.length) % DAY_ORDER.length
    const nextDow = DAY_ORDER[nextIdx]
    onSelect(nextDow)
    tabRefs.current[nextDow]?.focus()
  }, [onSelect])

  const handleKeyDown = useCallback((e, dow) => {
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); moveSelection(dow, 1); break
      case 'ArrowLeft': e.preventDefault(); moveSelection(dow, -1); break
      case 'Home': e.preventDefault(); onSelect(DAY_ORDER[0]); tabRefs.current[DAY_ORDER[0]]?.focus(); break
      case 'End': e.preventDefault(); onSelect(DAY_ORDER[DAY_ORDER.length - 1]); tabRefs.current[DAY_ORDER[DAY_ORDER.length - 1]]?.focus(); break
      default: break
    }
  }, [moveSelection, onSelect])

  const events = scheduleByDay[activeDay] || []
  const panelId = `${idPrefix}-panel`

  return (
    <div className="rounded-xl border border-gold/15 bg-void/30 overflow-hidden">
      <div
        role="tablist"
        aria-label="Day of the week"
        className="flex overflow-x-auto no-scrollbar border-b border-gold/10"
      >
        {DAY_ORDER.map(dow => {
          const isActive = dow === activeDay
          const isToday = dow === todayDow
          const count = (scheduleByDay[dow] || []).length
          const tabId = `${idPrefix}-tab-${dow}`
          return (
            <button
              key={dow}
              ref={el => { tabRefs.current[dow] = el }}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={panelId}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelect(dow)}
              onKeyDown={e => handleKeyDown(e, dow)}
              className={`relative flex-1 min-w-[64px] sm:min-w-[76px] flex flex-col items-center gap-1 px-2 sm:px-3 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 focus-visible:-outline-offset-2 ${
                isActive ? 'text-gold-bright' : 'text-text-dim hover:text-text-bright'
              }`}
            >
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                {DAY_SHORT[dow]}
                {isToday && <span className="w-1.5 h-1.5 rounded-full bg-gold-bright" aria-label="Today" />}
              </span>
              <span className="text-[11px] font-mono tabular-nums text-text-dim whitespace-nowrap">
                {count} {count === 1 ? 'evt' : 'evts'}
              </span>
              {isActive && (
                <span className="absolute left-2 right-2 bottom-0 h-[2px] bg-gold-bright rounded-full" aria-hidden="true" />
              )}
            </button>
          )
        })}
      </div>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${idPrefix}-tab-${activeDay}`}
        tabIndex={0}
        className="p-3 space-y-2"
      >
        {events.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-text-dim italic">
            Nothing scheduled for {DAY_NAMES[activeDay]}.
          </div>
        ) : (
          events.map((ev, i) => <EventRow key={`${ev.time}-${i}`} ev={ev} dow={activeDay} now={now} />)
        )}
      </div>
    </div>
  )
}

/**
 * Responsive event row.
 *
 * Mobile layout (< sm):
 *   ┌─────────────────────────────────────┐
 *   │ [icon]  Event Name                  │
 *   │         👾 Boss                     │
 *   │ ───                                 │
 *   │ 22:00   10:00 PM        Starts in   │
 *   │                        14h 17m      │
 *   └─────────────────────────────────────┘
 *
 * Desktop layout (≥ sm):
 *   ┌────────────────────────────────────────────────────┐
 *   │ 22:00   [icon]  Event Name          Starts in      │
 *   │ 10:00 PM        👾 Boss             14h 17m        │
 *   └────────────────────────────────────────────────────┘
 */
function EventRow({ ev, dow, now }) {
  const t = TYPE[ev.type]
  const startTs = useMemo(() => nextOccurrence(dow, ev.time, now), [dow, ev.time, now])
  const countdown = formatCountdown(startTs - now)

  return (
    <div className="rounded-lg bg-void/50 border border-gold/10 p-3 sm:p-0 sm:px-4 sm:py-3 hover:border-gold/25 transition-colors">
      {/* ── Mobile layout ── */}
      <div className="sm:hidden">
        {/* Top: icon + name + subtitle */}
        <div className="flex items-start gap-3">
          <div
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-lg"
            style={{ background: `${t.color}10`, border: `1px solid ${t.color}25` }}
            aria-hidden="true"
          >
            {t.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-text-bright leading-snug">
              {ev.name}
            </div>
            {(ev.boss || ev.subtitle) && (
              <div className="text-xs text-text-dim mt-0.5 leading-snug">
                {ev.boss ? `👾 ${ev.boss}` : ev.subtitle}
              </div>
            )}
          </div>
        </div>

        {/* Bottom: time block + countdown block */}
        <div className="mt-2.5 pt-2.5 border-t border-gold/10 flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2 min-w-0">
            <span
              className="font-mono font-bold text-sm tabular-nums leading-none whitespace-nowrap"
              style={{ color: t.color }}
            >
              {ev.time}
            </span>
            <span className="text-[11px] text-text-dim font-mono tabular-nums whitespace-nowrap">
              {to12h(ev.time)}
            </span>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-[10px] text-text-dim leading-none">Starts in</div>
            <div className="font-mono text-xs text-gold-light tabular-nums mt-1 leading-none whitespace-nowrap">
              {countdown}
            </div>
          </div>
        </div>
      </div>

      {/* ── Desktop layout ── */}
      <div className="hidden sm:flex items-center gap-4">
        <div className="flex-shrink-0 w-16 text-center border-r border-gold/15 pr-4">
          <div className="font-mono font-bold text-base tabular-nums leading-tight whitespace-nowrap" style={{ color: t.color }}>
            {ev.time}
          </div>
          <div className="text-[11px] text-text-dim font-mono tabular-nums mt-0.5 whitespace-nowrap">
            {to12h(ev.time)}
          </div>
        </div>

        <div
          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xl"
          style={{ background: `${t.color}10`, border: `1px solid ${t.color}25` }}
          aria-hidden="true"
        >
          {t.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold text-text-bright truncate">{ev.name}</div>
          {(ev.boss || ev.subtitle) && (
            <div className="text-sm text-text-dim truncate mt-0.5">
              {ev.boss ? `👾 ${ev.boss}` : ev.subtitle}
            </div>
          )}
        </div>

        <div className="text-right flex-shrink-0">
          <div className="text-[11px] text-text-dim">Starts in</div>
          <div className="font-mono text-sm text-gold-light tabular-nums mt-0.5 whitespace-nowrap">
            {countdown}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatTile({ icon, label, value, onClick }) {
  const clickable = !!onClick
  const Tag = clickable ? 'button' : 'div'
  return (
    <Tag
      type={clickable ? 'button' : undefined}
      onClick={onClick}
      className={`text-left rounded-xl border border-gold/15 bg-void/40 px-4 sm:px-5 py-4 transition-colors ${
        clickable ? 'hover:border-gold/40 hover:bg-gold/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 cursor-pointer' : ''
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl" aria-hidden="true">{icon}</span>
        <span className="text-[11px] text-text-dim font-semibold">{label}</span>
      </div>
      <div className="font-mono text-2xl sm:text-3xl font-bold text-text-bright tabular-nums leading-none">{value}</div>
    </Tag>
  )
}

function ActionTile({ icon, label, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-4 rounded-xl border border-gold/15 bg-void/40 px-5 py-4 hover:border-gold/40 hover:bg-gold/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 transition-colors text-left"
    >
      <span className="text-2xl opacity-80 group-hover:opacity-100 transition-opacity" aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <div className="text-base font-semibold text-text-bright truncate">{label}</div>
        <div className="text-xs text-text-dim truncate">{hint}</div>
      </div>
    </button>
  )
}
