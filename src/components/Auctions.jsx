import React, { useState } from 'react'

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
  const [bidAmounts, setBidAmounts] = useState({})
  const [expandedEnded, setExpandedEnded] = useState({})

  const isElder = currentUser?.role === 'Elder' || currentUser?.role === 'Master'
  const isMaster = currentUser?.role === 'Master'

  const createAuction = async () => {
    if (!newItem.name.trim()) {
      addToast('Enter an item name.', 'red', 'Error')
      return
    }

    const startBid = parseInt(newItem.startBid) || 100
    const durationMin = parseInt(newItem.duration) || 60
    const endsAt = Date.now() + durationMin * 60 * 1000
    const id = String(Date.now())

    const { error } = await supabase.from('auctions').insert([{
      id,
      name: newItem.name.trim(),
      description: newItem.description.trim(),
      rarity: newItem.rarity,
      status: 'active',
      started_at: Date.now(),
      ends_at: endsAt,
      current_bid: startBid,
      min_bid: startBid,
      top_bidder: null,
      bids: [],
    }])

    if (error) {
      console.error('Create auction failed:', error)
      addToast(`Couldn't create auction: ${error.message}`, 'red', 'Save Failed')
      return
    }

    setAuctions(prev => [{
      id,
      name: newItem.name.trim(),
      description: newItem.description.trim(),
      rarity: newItem.rarity,
      status: 'active',
      currentBid: startBid,
      startBid,
      topBidder: null,
      endsAt,
      startedAt: Date.now(),
      bids: [],
    }, ...prev])

    setNewItem({ name: '', description: '', rarity: 'epic', startBid: 100, duration: 60 })
    setShowCreate(false)
    addToast(`"${newItem.name}" is now up for auction!`, 'gold', 'Auction Live')
  }

  const placeBid = async (auctionId) => {
    const amount = parseInt(bidAmounts[auctionId])
    if (!amount || amount <= 0) {
      addToast('Enter a valid bid amount.', 'red', 'Invalid Bid')
      return
    }

    const auction = auctions.find(a => a.id === auctionId)
    if (!auction || auction.status !== 'active') {
      addToast('This auction has ended.', 'red', 'Auction Ended')
      return
    }
    if (amount <= auction.currentBid) {
      addToast(`Bid must be higher than ${auction.currentBid}.`, 'red', 'Invalid Bid')
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

    const timeLeft = auction.endsAt - Date.now()
    if (timeLeft < 60000 && timeLeft > 0) {
      const newEnd = Date.now() + 120000
      updatedAuction.endsAt = newEnd
      await supabase.from('auctions').update({ ends_at: newEnd }).eq('id', auctionId)
      addToast('Timer extended 2 mins (snipe protection)', 'blue', 'Extension')
    }

    setAuctions(prev => prev.map(a => a.id === auctionId ? updatedAuction : a))
    setBidAmounts({ ...bidAmounts, [auctionId]: '' })
    addToast(`Bid of ${amount} coins placed on ${auction.name}.`, 'gold', 'Bid Placed')
  }

  const endAuction = async (auctionId) => {
    if (!isMaster) return
    const auction = auctions.find(a => a.id === auctionId)
    if (!auction) return
    if (window.confirm(`End "${auction.name}" early?`)) {
      const { error } = await supabase
        .from('auctions')
        .update({ status: 'ended' })
        .eq('id', auctionId)
      if (error) {
        addToast(`Couldn't end auction: ${error.message}`, 'red', 'Save Failed')
        return
      }
      setAuctions(prev => prev.map(a => a.id === auctionId ? { ...a, status: 'ended' } : a))
      addToast(`"${auction.name}" ended early.`, 'red', 'Auction Ended')
    }
  }

  // ── Delete auction ──
  // Removes the auction entirely. If it was active with a top bidder,
  // that bidder gets their coins refunded (since the item never changed hands).
  const deleteAuction = async (auctionId) => {
    if (!isElder) return
    const auction = auctions.find(a => a.id === auctionId)
    if (!auction) return

    const refundNote = auction.status === 'active' && auction.topBidder
      ? `\n\n${auction.topBidder} will be refunded ${auction.currentBid.toLocaleString()} coins.`
      : ''

    if (!window.confirm(`Delete "${auction.name}" permanently?${refundNote}`)) return

    // Refund the current top bidder if the auction is still active
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

  const formatTime = (endsAt) => {
    const diff = endsAt - Date.now()
    if (diff <= 0) return 'Ended'
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  const formatBidTime = (ts) => {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const toggleEndedExpanded = (id) => {
    setExpandedEnded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const activeAuctions = auctions.filter(a => a.status === 'active')
  const endedAuctions = [...auctions.filter(a => a.status === 'ended')]
    .sort((a, b) => (b.endsAt || 0) - (a.endsAt || 0))

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-spectral text-2xl font-bold text-gold-light">Auctions</h1>
          <p className="text-text-dim text-sm">{activeAuctions.length} active · {endedAuctions.length} ended</p>
        </div>
        {isElder && (
          <button onClick={() => setShowCreate(!showCreate)} className="btn-gold">
            {showCreate ? '✕ Cancel' : '+ Create Auction'}
          </button>
        )}
      </div>

      {showCreate && (
        <div className="card mb-6 border-gold/40">
          <div className="text-sm font-bold text-text-dim uppercase tracking-wider mb-4">New Auction</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-text-dim uppercase tracking-wider font-bold mb-1">
                Item Name
              </label>
              <input
                className="input"
                placeholder="e.g. Dragon Scale Armor"
                value={newItem.name}
                onChange={e => setNewItem({ ...newItem, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-text-dim uppercase tracking-wider font-bold mb-1">
                Rarity
              </label>
              <select
                className="input"
                value={newItem.rarity}
                onChange={e => setNewItem({ ...newItem, rarity: e.target.value })}
              >
                <option value="material">Material</option>
                <option value="uncommon">Uncommon</option>
                <option value="rare">Rare</option>
                <option value="epic">Epic</option>
                <option value="legendary">Legendary</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs text-text-dim uppercase tracking-wider font-bold mb-1">
              Description (optional)
            </label>
            <input
              className="input"
              placeholder="e.g. Epic weapon drop from World Boss"
              value={newItem.description}
              onChange={e => setNewItem({ ...newItem, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-text-dim uppercase tracking-wider font-bold mb-1">
                Starting Bid
              </label>
              <div className="flex items-center gap-2">
                <input
                  className="input flex-1"
                  type="number"
                  min="1"
                  placeholder="100"
                  value={newItem.startBid}
                  onChange={e => setNewItem({ ...newItem, startBid: e.target.value })}
                />
                <span className="text-xs text-text-dim whitespace-nowrap">coins</span>
              </div>
              <div className="text-[10px] text-text-dim mt-1">
                The minimum amount the first bidder must offer.
              </div>
            </div>
            <div>
              <label className="block text-xs text-text-dim uppercase tracking-wider font-bold mb-1">
                Duration
              </label>
              <div className="flex items-center gap-2">
                <input
                  className="input flex-1"
                  type="number"
                  min="1"
                  placeholder="60"
                  value={newItem.duration}
                  onChange={e => setNewItem({ ...newItem, duration: e.target.value })}
                />
                <span className="text-xs text-text-dim whitespace-nowrap">minutes</span>
              </div>
              <div className="text-[10px] text-text-dim mt-1">
                How long the auction stays open before it ends.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <button onClick={createAuction} className="btn-gold">Start Auction</button>
            <span className="text-xs text-text-dim">
              {parseInt(newItem.duration) > 0
                ? `Ends ${new Date(Date.now() + (parseInt(newItem.duration) || 60) * 60000).toLocaleTimeString()}`
                : ''}
            </span>
          </div>
        </div>
      )}

      {activeAuctions.length === 0 ? (
        <div className="card text-center py-12 text-text-dim">No active auctions.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {activeAuctions.map(auction => {
            const isWinning = auction.topBidder === currentUser?.name
            const bids = auction.bids || []
            const history = [...bids].reverse()

            return (
              <div key={auction.id} className={`card ${isWinning ? 'border-green-500/40 bg-green-500/5' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="font-bold text-gold-light truncate">{auction.name}</div>
                    <div className="text-xs text-text-dim">
                      <span className={`badge badge-${auction.rarity}`}>{auction.rarity}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <div className="text-xs text-text-dim">Ends in</div>
                    <div className="font-bold text-red-400">{formatTime(auction.endsAt)}</div>
                  </div>
                </div>

                {auction.description && (
                  <div className="text-xs text-text-dim mt-2 italic">{auction.description}</div>
                )}

                <div className="flex items-center justify-between mt-3">
                  <div>
                    <div className="text-xs text-text-dim">Current Bid</div>
                    <div className="text-xl font-bold text-gold-bright">{auction.currentBid.toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-text-dim">Top Bidder</div>
                    <div className="font-semibold text-text">{auction.topBidder || '—'}</div>
                  </div>
                </div>

                {currentUser && auction.status === 'active' && (
                  <div className="flex gap-2 mt-3">
                    <input
                      className="input text-sm flex-1"
                      type="number"
                      placeholder={`Min ${auction.currentBid + 1}`}
                      value={bidAmounts[auction.id] || ''}
                      onChange={e => setBidAmounts({ ...bidAmounts, [auction.id]: e.target.value })}
                    />
                    <button onClick={() => placeBid(auction.id)} className="btn-gold text-sm px-3">
                      Bid
                    </button>
                  </div>
                )}

                {history.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gold/10">
                    <div className="text-[10px] font-bold text-text-dim uppercase tracking-wider mb-2">
                      Bid History ({history.length})
                    </div>
                    <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1">
                      {history.map((b, idx) => {
                        const isCurrentTop = idx === 0
                        return (
                          <div
                            key={b.time || idx}
                            className={`text-xs rounded px-2 py-1.5 ${
                              isCurrentTop
                                ? 'bg-green-500/10 border border-green-500/30'
                                : 'bg-void/40 border border-gold/10'
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
                            <div className={`text-[10px] mt-0.5 ${isCurrentTop ? 'text-green-400' : 'text-text-dim'}`}>
                              {isCurrentTop
                                ? (auction.topBidder === currentUser?.name ? 'winning' : 'leading')
                                : 'outbid'} · {formatBidTime(b.time)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {isElder && (
                  <div className="flex gap-3 mt-3 pt-2 border-t border-gold/10">
                    {isMaster && (
                      <button
                        onClick={() => endAuction(auction.id)}
                        className="text-xs text-yellow-400 hover:text-yellow-300"
                      >
                        End Early
                      </button>
                    )}
                    <button
                      onClick={() => deleteAuction(auction.id)}
                      className="text-xs text-red-400 hover:text-red-300 ml-auto"
                    >
                      🗑 Delete
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {endedAuctions.length > 0 && (
        <div className="card">
          <div className="text-sm font-bold text-text-dim uppercase tracking-wider mb-3">
            Ended Auctions ({endedAuctions.length})
          </div>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {endedAuctions.map(a => {
              const bids = a.bids || []
              const winner = a.topBidder
              const winningBid = a.currentBid
              const totalBids = bids.length
              const isExpanded = !!expandedEnded[a.id]

              return (
                <div key={a.id} className="rounded border border-gold/15 bg-void/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gold-light">{a.name}</span>
                        <span className={`badge badge-${a.rarity}`}>{a.rarity}</span>
                      </div>
                      {a.description && (
                        <div className="text-xs text-text-dim italic mt-0.5">{a.description}</div>
                      )}
                    </div>

                    <div className="text-right">
                      {winner ? (
                        <>
                          <div className="text-[10px] uppercase tracking-wider text-text-dim font-bold">
                            🏆 Winner
                          </div>
                          <div className="text-gold-bright font-bold">{winner}</div>
                          <div className="text-xs text-green-400 font-semibold">
                            spent {winningBid.toLocaleString()} coins
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-text-dim italic">No winner · no bids placed</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gold/10">
                    <div className="text-[10px] text-text-dim">
                      {totalBids} {totalBids === 1 ? 'bid' : 'bids'}
                      {a.endsAt ? ` · ended ${new Date(a.endsAt).toLocaleString()}` : ''}
                    </div>
                    <div className="flex items-center gap-3">
                      {totalBids > 0 && (
                        <button
                          onClick={() => toggleEndedExpanded(a.id)}
                          className="text-[10px] uppercase tracking-wider text-gold-light hover:text-gold-bright"
                        >
                          {isExpanded ? '▲ Hide bids' : '▼ Show all bids'}
                        </button>
                      )}
                      {isElder && (
                        <button
                          onClick={() => deleteAuction(a.id)}
                          className="text-[10px] text-red-400 hover:text-red-300"
                        >
                          🗑 Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && totalBids > 0 && (
                    <div className="mt-2 pt-2 border-t border-gold/10 space-y-1">
                      {bids.map((b, idx) => {
                        const isLast = idx === bids.length - 1
                        return (
                          <div
                            key={b.time || idx}
                            className={`flex items-center justify-between gap-2 text-xs rounded px-2 py-1.5 ${
                              isLast
                                ? 'bg-green-500/10 border border-green-500/30'
                                : 'bg-void/40 border border-gold/10'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-[10px] font-bold ${isLast ? 'text-green-400' : 'text-text-dim'}`}>
                                #{idx + 1}
                              </span>
                              <span className={`font-semibold truncate ${isLast ? 'text-green-300' : 'text-text-dim'}`}>
                                {b.bidder}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className={`font-bold ${isLast ? 'text-green-300' : 'text-text-dim'}`}>
                                {b.amount.toLocaleString()}
                              </span>
                              <span className="text-[10px] text-text-dim">
                                {formatBidTime(b.time)}
                              </span>
                              {isLast && (
                                <span className="text-[10px] text-green-400 font-bold uppercase tracking-wider">
                                  won
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}