import React, { useState, useEffect, useMemo, useId } from 'react'

const RARITY = {
  material:   { label: 'Common',    color: '#4ade80', rgb: '74,222,128' },
  uncommon:   { label: 'Uncommon',  color: '#ffffff', rgb: '255,255,255' },
  rare:       { label: 'Rare',      color: '#60a5fa', rgb: '96,165,250' },
  epic:       { label: 'Epic',      color: '#f87171', rgb: '248,113,113' },
  legendary:  { label: 'Legendary', color: '#f2cc60', rgb: '242,204,96' },
}

const GLOW_RARITIES = new Set(['legendary'])
const URGENT_MS = 5 * 60 * 1000
const MIN_BID_INCREMENT = 5

const presetDescriptions = [
  '',
  'World Boss Drop',
  'Epic Weapon Drop',
  'Rare Armor Piece',
  'Legendary Material',
  'Clan Event Reward',
  'Auction House Special',
  'Crafted by Master',
  'Cross-Server Reward',
  'Ranking Prize',
  'Custom...',
]

function rgba(rgb, alpha) {
  return `rgba(${rgb}, ${alpha})`
}

function getRarityMeta(rarity) {
  return RARITY[rarity] || RARITY.epic
}

function formatServerClock(ts) {
  return new Date(ts).toLocaleString('en-GB', {
    timeZone: 'Asia/Singapore',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
}

function formatClock(ts) {
  return new Date(ts).toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function formatDateTime(ts) {
  return new Date(ts).toLocaleString('en-GB', {
    timeZone: 'Asia/Singapore', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function formatCountdown(endsAt, now) {
  const diff = endsAt - now
  if (diff <= 0) return 'Ended'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`
}

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

// Bids are only allowed while the auction has more than 5 minutes remaining.
function isBiddingOpen(auction, now) {
  return auction.status === 'active' && (auction.endsAt - now) > URGENT_MS
}

/** Compute the minimum amount a bidder must offer on this auction. */
function minNextBidFor(auction) {
  return (auction?.currentBid || 0) + MIN_BID_INCREMENT
}

export default function Auctions({ ctx }) {
  const { members, setMembers, auctions, setAuctions, currentUser, addToast, supabase } = ctx
  const [showCreate, setShowCreate] = useState(false)
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    rarity: 'epic',
    startBid: 100,
    duration: 60,
  })
  const [descChoice, setDescChoice] = useState('')
  const [customDesc, setCustomDesc] = useState('')
  const [bidAmounts, setBidAmounts] = useState({})
  const [expandedBids, setExpandedBids] = useState({})
  const [now, setNow] = useState(() => Date.now())
  const formId = useId()

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  /**
   * Auto-fill the bid input with the minimum next bid for every active
   * auction that doesn't have a value yet.
   */
  useEffect(() => {
    setBidAmounts(prev => {
      const next = { ...prev }
      let changed = false
      for (const a of auctions) {
        if (a.status !== 'active') continue
        const current = next[a.id]
        if (current === undefined || current === '' || current === null) {
          next[a.id] = String(minNextBidFor(a))
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [auctions])

  const isElder = currentUser?.role === 'Elder' || currentUser?.role === 'Master' || currentUser?.role === 'Admin'
  const isMaster = currentUser?.role === 'Master' || currentUser?.role === 'Admin'

  const distributors = useMemo(() => {
    return [...members]
      .filter(m => m.role === 'Master' || m.role === 'Elder' || m.role === 'Admin')
      .sort((a, b) => {
        const rank = { Admin: 0, Master: 1, Elder: 2 }
        const ra = rank[a.role] ?? 99
        const rb = rank[b.role] ?? 99
        if (ra !== rb) return ra - rb
        return a.name.localeCompare(b.name)
      })
  }, [members])

  const finalDescription = descChoice === 'Custom...' ? customDesc.trim() : descChoice

  const createAuction = async () => {
    if (!newItem.name.trim()) {
      addToast('Enter an item name.', 'red', 'Error')
      return
    }

    const startBid = parseInt(newItem.startBid) || 100
    const durationMin = parseInt(newItem.duration) || 60
    const endsAt = Date.now() + durationMin * 60 * 1000
    const id = String(Date.now())
    const description = finalDescription

    const { error } = await supabase.from('auctions').insert([{
      id,
      name: newItem.name.trim(),
      description,
      rarity: newItem.rarity,
      status: 'active',
      started_at: Date.now(),
      ends_at: endsAt,
      current_bid: startBid,
      min_bid: startBid,
      top_bidder: null,
      bids: [],
      distributed_by: null,
    }])

    if (error) {
      console.error('Create auction failed:', error)
      addToast(`Couldn't create auction: ${error.message}`, 'red', 'Save Failed')
      return
    }

    setAuctions(prev => [{
      id,
      name: newItem.name.trim(),
      description,
      rarity: newItem.rarity,
      status: 'active',
      currentBid: startBid,
      startBid,
      topBidder: null,
      endsAt,
      startedAt: Date.now(),
      bids: [],
      distributedBy: null,
    }, ...prev])

    setNewItem({ name: '', description: '', rarity: 'epic', startBid: 100, duration: 60 })
    setDescChoice('')
    setCustomDesc('')
    setShowCreate(false)
    addToast(`"${newItem.name}" is now up for auction!`, 'gold', 'Auction Live')
  }

  const placeBid = async (auctionId) => {
    const auction = auctions.find(a => a.id === auctionId)
    if (!auction || auction.status !== 'active') {
      addToast('This auction has ended.', 'red', 'Auction Ended')
      return
    }

    if (!isBiddingOpen(auction, Date.now())) {
      addToast('Bidding is closed — less than 5 minutes remaining.', 'red', 'Bidding Closed')
      return
    }

    const raw = bidAmounts[auctionId]
    const amount = (raw === '' || raw === undefined || raw === null)
      ? minNextBidFor(auction)
      : parseInt(raw)

    if (!amount || amount <= 0) {
      addToast('Enter a valid bid amount.', 'red', 'Invalid Bid')
      return
    }

    const minNext = minNextBidFor(auction)
    if (amount < minNext) {
      addToast(`Minimum bid is ${minNext.toLocaleString()} coins (current + ${MIN_BID_INCREMENT}).`, 'red', 'Bid Too Low')
      return
    }

    const bidder = members.find(m => m.name === currentUser.name)
    if (!bidder || bidder.coins < amount) {
      addToast('Not enough coins.', 'red', 'Insufficient Funds')
      return
    }

    const prevBidder = auction.topBidder
    const prevAmount = auction.currentBid

    const newBids = [
      ...(auction.bids || []),
      {
        bidder: currentUser.name,
        amount,
        time: Date.now(),
        previousBidder: prevBidder || null,
        previousAmount: prevBidder ? prevAmount : null,
      },
    ]

    const { error: auctionErr } = await supabase
      .from('auctions')
      .update({ current_bid: amount, top_bidder: currentUser.name, bids: newBids })
      .eq('id', auctionId)

    if (auctionErr) {
      console.error('Bid update failed:', auctionErr)
      addToast(`Couldn't place bid: ${auctionErr.message}`, 'red', 'Save Failed')
      return
    }

    await supabase
      .from('members')
      .update({ coins: bidder.coins - amount })
      .eq('id', bidder.id)

    if (prevBidder) {
      const prev = members.find(m => m.name === prevBidder)
      if (prev) {
        await supabase
          .from('members')
          .update({ coins: prev.coins + prevAmount })
          .eq('id', prev.id)
      }
    }

    setMembers(prev => prev.map(m => {
      if (m.id === bidder.id) return { ...m, coins: m.coins - amount }
      if (prevBidder && m.name === prevBidder) return { ...m, coins: m.coins + prevAmount }
      return m
    }))

    let updatedAuction = {
      ...auction,
      currentBid: amount,
      topBidder: currentUser.name,
      bids: newBids,
    }

    setAuctions(prev => prev.map(a => a.id === auctionId ? updatedAuction : a))
    setBidAmounts(prev => ({ ...prev, [auctionId]: '' }))
    addToast(`Bid of ${amount.toLocaleString()} coins placed on ${auction.name}.`, 'gold', 'Bid Placed')
  }

  const endAuction = async (auctionId) => {
    if (!isMaster) return
    const auction = auctions.find(a => a.id === auctionId)
    if (!auction) return

    const hasWinner = !!auction.topBidder
    const winnerNote = hasWinner
      ? `\n\nWinner: ${auction.topBidder} for ${auction.currentBid.toLocaleString()} coins.`
      : `\n\nNo bids were placed — item goes undistributed.`

    if (window.confirm(`End "${auction.name}" early?${winnerNote}`)) {
      const { error } = await supabase
        .from('auctions')
        .update({ status: 'ended' })
        .eq('id', auctionId)
      if (error) {
        addToast(`Couldn't end auction: ${error.message}`, 'red', 'Save Failed')
        return
      }
      setAuctions(prev => prev.map(a =>
        a.id === auctionId ? { ...a, status: 'ended', endedAt: Date.now() } : a
      ))
      addToast(`"${auction.name}" ended. Now pick who distributes it.`, 'gold', 'Auction Ended')
    }
  }

  const assignDistributor = async (auctionId, distributorName) => {
    if (!isElder) return

    const value = distributorName || null

    const { error } = await supabase
      .from('auctions')
      .update({ distributed_by: value })
      .eq('id', auctionId)

    if (error) {
      console.error('Assign distributor failed:', error)
      addToast(`Couldn't save distributor: ${error.message}`, 'red', 'Save Failed')
      return
    }

    setAuctions(prev => prev.map(a =>
      a.id === auctionId ? { ...a, distributedBy: value } : a
    ))

    if (value) {
      addToast(`Distributor set: ${value}.`, 'gold', 'Updated')
    } else {
      addToast(`Distributor cleared.`, 'blue', 'Updated')
    }
  }

  const deleteAuction = async (auctionId) => {
    if (!isElder) return
    const auction = auctions.find(a => a.id === auctionId)
    if (!auction) return

    const refundNote = auction.status === 'active' && auction.topBidder
      ? `\n\n${auction.topBidder} will be refunded ${auction.currentBid.toLocaleString()} coins.`
      : ''

    if (!window.confirm(`Delete "${auction.name}" permanently?${refundNote}`)) return

    if (auction.status === 'active' && auction.topBidder && auction.currentBid > 0) {
      const bidder = members.find(m => m.name === auction.topBidder)
      if (bidder) {
        const { error: refundErr } = await supabase
          .from('members')
          .update({ coins: bidder.coins + auction.currentBid })
          .eq('id', bidder.id)
        if (refundErr) {
          console.error('Refund on delete failed:', refundErr)
        } else {
          setMembers(prev => prev.map(m =>
            m.id === bidder.id ? { ...m, coins: m.coins + auction.currentBid } : m
          ))
        }
      }
    }

    const { error } = await supabase
      .from('auctions')
      .delete()
      .eq('id', auctionId)

    if (error) {
      console.error('Delete auction failed:', error)
      addToast(`Couldn't delete auction: ${error.message}`, 'red', 'Delete Failed')
      return
    }

    setAuctions(prev => prev.filter(a => a.id !== auctionId))
    addToast(`"${auction.name}" removed.`, 'red', 'Auction Deleted')
  }

  const toggleBidsExpanded = (id) => {
    setExpandedBids(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const activeAuctions = useMemo(
    () => auctions.filter(a => a.status === 'active'),
    [auctions]
  )
  const endedAuctions = useMemo(
    () => [...auctions.filter(a => a.status === 'ended')].sort((a, b) => {
      const ax = a.endedAt || a.endsAt || 0
      const bx = b.endedAt || b.endsAt || 0
      return bx - ax
    }),
    [auctions]
  )

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-spectral text-2xl font-bold text-gold-light">Auctions</h1>
          <p className="text-text-dim text-sm">{activeAuctions.length} active, {endedAuctions.length} ended</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="card px-4 py-2 border-gold/30 flex items-center gap-3">
            <div className="text-lg" aria-hidden="true">🕒</div>
            <div>
              <div className="text-[11px] text-gold-dim font-semibold">Server time, GMT+8</div>
              <div className="font-mono text-sm text-gold-bright tabular-nums">{formatServerClock(now)}</div>
            </div>
          </div>
          {isElder && (
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="btn-gold"
              aria-expanded={showCreate}
            >
              {showCreate ? '✕ Cancel' : '+ Create auction'}
            </button>
          )}
        </div>
      </div>

      <div className="card mb-4 border-gold/20 bg-void/40">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-text-dim">
          <span>🔒 Bids lock 5 minutes before the auction ends.</span>
          <span>📈 Minimum bid increment: +{MIN_BID_INCREMENT} coins.</span>
          <span>🎁 Master / Admin assigns the distributor after it ends.</span>
        </div>
      </div>

      {showCreate && (
        <div className="card mb-6 border-gold/40">
          <div className="text-sm font-semibold text-text-bright mb-4">New auction</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor={`${formId}-name`} className="block text-xs text-text-dim font-semibold mb-1">
                Item name
              </label>
              <input
                id={`${formId}-name`}
                className="input"
                placeholder="e.g. Kari Top / Bound"
                value={newItem.name}
                onChange={e => setNewItem({ ...newItem, name: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor={`${formId}-rarity`} className="block text-xs text-text-dim font-semibold mb-1">
                Rarity
              </label>
              <select
                id={`${formId}-rarity`}
                className="input"
                value={newItem.rarity}
                onChange={e => setNewItem({ ...newItem, rarity: e.target.value })}
              >
                {Object.entries(RARITY).map(([key, r]) => (
                  <option key={key} value={key}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor={`${formId}-desc`} className="block text-xs text-text-dim font-semibold mb-1">
              Description (optional)
            </label>
            <select
              id={`${formId}-desc`}
              className="input"
              value={descChoice}
              onChange={e => {
                setDescChoice(e.target.value)
                if (e.target.value !== 'Custom...') setCustomDesc('')
              }}
            >
              {presetDescriptions.map(d => (
                <option key={d} value={d}>
                  {d === '' ? 'No description' : d}
                </option>
              ))}
            </select>
            {descChoice === 'Custom...' && (
              <input
                className="input mt-2"
                aria-label="Custom description"
                placeholder="Type your custom description..."
                value={customDesc}
                onChange={e => setCustomDesc(e.target.value)}
                maxLength={100}
                autoFocus
              />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor={`${formId}-bid`} className="block text-xs text-text-dim font-semibold mb-1">
                Starting bid
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={`${formId}-bid`}
                  className="input flex-1"
                  type="number"
                  min="1"
                  placeholder="100"
                  value={newItem.startBid}
                  onChange={e => setNewItem({ ...newItem, startBid: e.target.value })}
                />
                <span className="text-xs text-text-dim whitespace-nowrap">coins</span>
              </div>
            </div>
            <div>
              <label htmlFor={`${formId}-duration`} className="block text-xs text-text-dim font-semibold mb-1">
                Duration
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={`${formId}-duration`}
                  className="input flex-1"
                  type="number"
                  min="1"
                  placeholder="60"
                  value={newItem.duration}
                  onChange={e => setNewItem({ ...newItem, duration: e.target.value })}
                />
                <span className="text-xs text-text-dim whitespace-nowrap">minutes</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <button onClick={createAuction} className="btn-gold">Start auction</button>
            <span className="text-xs text-text-dim">
              {parseInt(newItem.duration) > 0
                ? `Ends ${formatClock(Date.now() + (parseInt(newItem.duration) || 60) * 60000)} (GMT+8)`
                : ''}
            </span>
          </div>
        </div>
      )}

      {activeAuctions.length === 0 ? (
        <div className="card text-center py-12 text-text-dim">No active auctions.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {activeAuctions.map(auction => (
            <AuctionCard
              key={auction.id}
              auction={auction}
              now={now}
              currentUser={currentUser}
              isElder={isElder}
              isMaster={isMaster}
              bidAmount={bidAmounts[auction.id] || ''}
              onBidChange={v => setBidAmounts(prev => ({ ...prev, [auction.id]: v }))}
              onPlaceBid={() => placeBid(auction.id)}
              onEndEarly={() => endAuction(auction.id)}
              onDelete={() => deleteAuction(auction.id)}
              isBidsExpanded={!!expandedBids[auction.id]}
              onToggleBids={() => toggleBidsExpanded(auction.id)}
            />
          ))}
        </div>
      )}

      {endedAuctions.length > 0 && (
        <section className="mt-8">
          <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <h2 className="font-spectral text-xl font-bold text-text-bright">Ended auctions</h2>
              <span className="text-[11px] font-semibold text-text-dim bg-void/60 border border-gold/20 rounded px-2 py-0.5">
                {endedAuctions.length}
              </span>
            </div>
          </div>

          {/* Compact list — one row per ended auction. Scales to dozens without bloating. */}
          <div className="card p-0 overflow-hidden">
            <ul className="divide-y divide-gold/10">
              {endedAuctions.map(a => (
                <EndedAuctionRow
                  key={a.id}
                  auction={a}
                  now={now}
                  currentUser={currentUser}
                  isElder={isElder}
                  distributors={distributors}
                  isExpanded={!!expandedBids[a.id]}
                  onToggle={() => toggleBidsExpanded(a.id)}
                  onAssignDistributor={(name) => assignDistributor(a.id, name)}
                  onDelete={() => deleteAuction(a.id)}
                />
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────── */

function RarityBadge({ rarity }) {
  const rm = getRarityMeta(rarity)
  return (
    <span
      className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ color: rm.color, backgroundColor: rgba(rm.rgb, 0.12) }}
    >
      {rm.label}
    </span>
  )
}

function AuctionCard({
  auction, now, currentUser, isElder, isMaster,
  bidAmount, onBidChange, onPlaceBid, onEndEarly, onDelete,
  isBidsExpanded, onToggleBids,
}) {
  const isWinning = auction.topBidder === currentUser?.name
  const bids = auction.bids || []
  const history = useMemo(() => [...bids].reverse(), [bids])
  const rm = getRarityMeta(auction.rarity)
  const remaining = auction.endsAt - now
  const isUrgent = remaining > 0 && remaining < URGENT_MS
  const glow = GLOW_RARITIES.has(auction.rarity)
  const biddingOpen = isBiddingOpen(auction, now)
  const minNextBid = auction.currentBid + MIN_BID_INCREMENT

  return (
    <div
      className={`card border-l-4 ${isWinning ? 'bg-green-500/5' : ''}`}
      style={{
        borderLeftColor: isWinning ? '#22c55e' : rm.color,
        boxShadow: glow && !isWinning ? `0 0 16px ${rgba(rm.rgb, 0.12)}` : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold truncate" style={{ color: rm.color }}>{auction.name}</div>
          <div className="mt-1"><RarityBadge rarity={auction.rarity} /></div>
        </div>
        <div className="text-right flex-shrink-0 ml-2">
          <div className="text-xs text-text-dim">Ends in</div>
          <div className={`font-bold text-red-400 ${isUrgent ? 'motion-safe:animate-pulse' : ''}`}>
            {formatCountdown(auction.endsAt, now)}
          </div>
        </div>
      </div>

      {auction.description && (
        <div className="text-xs text-text-dim mt-2 italic">{auction.description}</div>
      )}

      <div className="flex items-center justify-between mt-3">
        <div>
          <div className="text-xs text-text-dim">Current bid</div>
          <div className="text-xl font-bold text-gold-bright tabular-nums">{auction.currentBid.toLocaleString()}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-text-dim">Top bidder</div>
          <div className="font-semibold text-text-bright">{auction.topBidder || '—'}</div>
        </div>
      </div>

      {isWinning && (
        <div className="mt-2 text-[11px] font-semibold text-green-400">✓ You're leading</div>
      )}

      {currentUser && auction.status === 'active' && (
        biddingOpen ? (
          <div className="mt-3">
            <div className="flex gap-2">
              <label htmlFor={`bid-${auction.id}`} className="sr-only">Bid amount for {auction.name}</label>
              <input
                id={`bid-${auction.id}`}
                className="input text-sm flex-1"
                type="number"
                min={minNextBid}
                step={MIN_BID_INCREMENT}
                placeholder={`Min ${minNextBid.toLocaleString()}`}
                value={bidAmount}
                onChange={e => onBidChange(e.target.value)}
                onFocus={e => {
                  if (!e.target.value) onBidChange(String(minNextBid))
                }}
              />
              <button onClick={onPlaceBid} className="btn-gold text-sm px-3">Bid</button>
            </div>
            <div className="text-[10px] text-text-dim mt-1">
              Minimum bid: <span className="text-gold-light font-semibold">{minNextBid.toLocaleString()}</span> coins
              <span className="text-text-dim"> · pre-filled for you</span>
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-center">
            <div className="text-xs font-semibold text-red-400">🔒 Bidding closed</div>
            <div className="text-[10px] text-text-dim mt-0.5">
              Final 5 minutes — waiting for the auction to end.
            </div>
          </div>
        )
      )}

      {history.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gold/10">
          <button
            type="button"
            onClick={onToggleBids}
            aria-expanded={isBidsExpanded}
            className="text-[11px] font-semibold text-gold-light hover:text-gold-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 rounded"
          >
            {isBidsExpanded ? '▲ Hide bid history' : `▼ Show bid history (${history.length})`}
          </button>

          {isBidsExpanded && (
            <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1 mt-2" role="list">
              {history.map((b, idx) => {
                const isCurrentTop = idx === 0
                return (
                  <div
                    key={b.time || idx}
                    role="listitem"
                    className={`text-xs rounded px-2 py-1.5 ${
                      isCurrentTop ? 'bg-green-500/10 border border-green-500/30' : 'bg-void/40 border border-gold/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-semibold truncate ${isCurrentTop ? 'text-green-300' : 'text-text-dim line-through'}`}>
                        {b.bidder}
                      </span>
                      <span className={`font-bold flex-shrink-0 ${isCurrentTop ? 'text-green-300' : 'text-text-dim line-through'}`}>
                        {b.amount.toLocaleString()}
                      </span>
                    </div>
                    <div className={`text-[11px] mt-0.5 ${isCurrentTop ? 'text-green-400' : 'text-text-dim'}`}>
                      {isCurrentTop ? (auction.topBidder === currentUser?.name ? 'winning' : 'leading') : 'outbid'} at {formatClock(b.time)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {isElder && (
        <div className="flex gap-3 mt-3 pt-2 border-t border-gold/10">
          {isMaster && (
            <button
              onClick={onEndEarly}
              className="text-xs text-yellow-400 hover:text-yellow-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 rounded"
            >
              End early
            </button>
          )}
          <button
            onClick={onDelete}
            aria-label={`Delete auction: ${auction.name}`}
            className="text-xs text-red-400 hover:text-red-300 ml-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 rounded"
          >
            🗑 Delete
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Compact ended-auction row.
 *
 * Collapsed (~56px tall) shows everything on one line:
 *   [rarity dot] Item name  ·  🏆 winner  ·  🎁 distributor  ·  💰 1,250  ·  3h ago  ·  ▼  🗑
 *
 * On narrow screens, wraps to a stacked layout.
 * Expanded shows the bid history below.
 */
function EndedAuctionRow({
  auction: a, now, currentUser, isElder, distributors,
  isExpanded, onToggle, onAssignDistributor, onDelete,
}) {
  const bids = a.bids || []
  const totalBids = bids.length
  const rm = getRarityMeta(a.rarity)
  const winner = a.topBidder
  const isMe = winner && currentUser?.name === winner

  const endedAt = a.endedAt || a.endsAt || 0
  const agoLabel = endedAt > 0 ? formatRelativePast(now - endedAt) : ''
  const assignedName = a.distributedBy || ''

  return (
    <li className={`${isMe ? 'bg-green-500/[0.04]' : ''}`}>
      {/* ── Collapsed row ─────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-void/30 transition-colors">
        {/* Rarity dot + name */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: rm.color }}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold truncate" style={{ color: rm.color }}>
                {a.name}
              </span>
              <RarityBadge rarity={a.rarity} />
              {isMe && (
                <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">
                  🎉 You won
                </span>
              )}
            </div>
            {a.description && (
              <div className="text-[11px] text-text-dim italic truncate mt-0.5">
                {a.description}
              </div>
            )}
          </div>
        </div>

        {/* Winner */}
        <div className="hidden md:flex items-center gap-1.5 flex-shrink-0 min-w-0" title="Winner">
          <span className="text-sm" aria-hidden="true">🏆</span>
          <span className={`text-xs font-semibold truncate max-w-[120px] ${isMe ? 'text-green-400' : 'text-text-bright'}`}>
            {winner || <span className="italic text-text-dim font-normal">No bids</span>}
          </span>
        </div>

        {/* Distributor (compact) */}
        {winner && (
          <div className="hidden lg:flex items-center gap-1.5 flex-shrink-0 min-w-0" title="Distributed by">
            <span className="text-sm" aria-hidden="true">🎁</span>
            {isElder ? (
              <select
                className="input text-[11px] py-0.5 px-2 h-6 min-w-0 max-w-[160px]"
                value={assignedName}
                onChange={e => onAssignDistributor(e.target.value)}
                aria-label={`Distributor for ${a.name}`}
              >
                <option value="">— Not yet —</option>
                {distributors.map(d => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            ) : (
              <span className={`text-xs truncate max-w-[120px] ${assignedName ? 'text-text-bright' : 'italic text-text-dim'}`}>
                {assignedName || 'Not yet'}
              </span>
            )}
          </div>
        )}

        {/* Final price */}
        <div className="hidden sm:flex items-baseline gap-1 flex-shrink-0">
          <span className="font-mono font-bold text-gold-bright tabular-nums text-sm">
            {(a.currentBid || 0).toLocaleString()}
          </span>
          <span className="text-[10px] text-text-dim">coins</span>
        </div>

        {/* Timestamp */}
        {agoLabel && (
          <span className="text-[11px] text-text-dim flex-shrink-0 hidden sm:inline">
            {agoLabel}
          </span>
        )}

        {/* Toggle + delete */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {totalBids > 0 && (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Hide bid history' : `Show bid history (${totalBids})`}
              className="text-[11px] text-gold-light hover:text-gold-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 rounded px-1.5 py-1 flex items-center gap-1"
            >
              <span aria-hidden="true">{isExpanded ? '▲' : '▼'}</span>
              <span className="hidden md:inline">{totalBids}</span>
            </button>
          )}
          {isElder && (
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Delete auction: ${a.name}`}
              className="text-[11px] text-red-400 hover:text-red-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold/60 rounded px-1.5 py-1"
            >
              🗑
            </button>
          )}
        </div>
      </div>

      {/* ── Mobile-only summary row (when md/lg columns are hidden) ── */}
      <div className="md:hidden flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-3 text-xs">
        {winner && (
          <span className="flex items-center gap-1">
            <span aria-hidden="true">🏆</span>
            <span className={`font-semibold ${isMe ? 'text-green-400' : 'text-text-bright'}`}>{winner}</span>
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="font-mono font-bold text-gold-bright tabular-nums">
            {(a.currentBid || 0).toLocaleString()}
          </span>
          <span className="text-text-dim">coins</span>
        </span>
        {agoLabel && <span className="text-text-dim">{agoLabel}</span>}
      </div>

      {/* ── Distributor row on narrow screens ──────────────────── */}
      {winner && (
        <div className="lg:hidden flex items-center gap-2 px-4 pb-3 text-xs">
          <span aria-hidden="true">🎁</span>
          <span className="text-text-dim">Distributed by</span>
          {isElder ? (
            <select
              className="input text-[11px] py-0.5 px-2 h-7 flex-1 min-w-0"
              value={assignedName}
              onChange={e => onAssignDistributor(e.target.value)}
              aria-label={`Distributor for ${a.name}`}
            >
              <option value="">— Not yet —</option>
              {distributors.map(d => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          ) : (
            <span className={`truncate ${assignedName ? 'text-text-bright font-semibold' : 'italic text-text-dim'}`}>
              {assignedName || 'Not yet distributed'}
            </span>
          )}
        </div>
      )}

      {/* ── Expanded bid history ───────────────────────────────── */}
      {isExpanded && totalBids > 0 && (
        <div className="px-4 pb-3">
          <div className="rounded-lg bg-void/40 border border-gold/10 overflow-hidden">
            <ul className="divide-y divide-gold/5">
              {bids.map((b, idx) => {
                const isLast = idx === bids.length - 1
                return (
                  <li
                    key={b.time || idx}
                    className={`flex items-center gap-3 px-3 py-1.5 text-xs ${isLast ? 'bg-green-500/[0.06]' : ''}`}
                  >
                    <span className={`font-mono tabular-nums flex-shrink-0 ${isLast ? 'text-green-400' : 'text-text-dim'}`}>
                      {formatClock(b.time)}
                    </span>
                    <span className={`font-semibold truncate flex-1 ${isLast ? 'text-green-300' : 'text-text-dim'}`}>
                      {b.bidder}
                    </span>
                    <span className={`font-mono font-bold tabular-nums flex-shrink-0 ${isLast ? 'text-green-300' : 'text-text-dim'}`}>
                      {b.amount.toLocaleString()}
                    </span>
                    {isLast && (
                      <span className="text-[10px] font-bold text-green-400 uppercase flex-shrink-0">Won</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}

      {/* ── Footer (exact timestamp) — only shown when expanded ── */}
      {isExpanded && (
        <div className="px-4 pb-3 text-[10px] text-text-dim">
          Ended {endedAt > 0 ? formatDateTime(endedAt) : '—'} · GMT+8
        </div>
      )}
    </li>
  )
}