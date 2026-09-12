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

    const newBids = [...(auction.bids || []), { bidder: currentUser.name, amount, time: Date.now() }]

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

    if (auction.topBidder) {
      const prev = members.find(m => m.name === auction.topBidder)
      if (prev) {
        await supabase
          .from('members')
          .update({ coins: prev.coins + auction.currentBid })
          .eq('id', prev.id)
      }
    }

    setMembers(prev => prev.map(m => {
      if (m.id === bidder.id) return { ...m, coins: m.coins - amount }
      if (auction.topBidder && m.name === auction.topBidder) return { ...m, coins: m.coins + auction.currentBid }
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

  const formatTime = (endsAt) => {
    const diff = endsAt - Date.now()
    if (diff <= 0) return 'Ended'
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  const activeAuctions = auctions.filter(a => a.status === 'active')
  const endedAuctions = auctions.filter(a => a.status === 'ended')

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
            <button onClick={createAuction} className="btn-gold">
              Start Auction
            </button>
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

                {isMaster && (
                  <button
                    onClick={() => endAuction(auction.id)}
                    className="text-xs text-red-400 hover:text-red-300 mt-2"
                  >
                    End Early
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {endedAuctions.length > 0 && (
        <div className="card">
          <div className="text-sm font-bold text-text-dim uppercase tracking-wider mb-3">Ended Auctions</div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {endedAuctions.slice(0, 10).map(a => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gold/10">
                <div>
                  <span className="font-semibold">{a.name}</span>
                  <span className={`badge badge-${a.rarity} ml-2`}>{a.rarity}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gold-light">{a.currentBid.toLocaleString()} coins</span>
                  <span className="text-sm text-text">{a.topBidder || 'No winner'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}