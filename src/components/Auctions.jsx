import React, { useState } from 'react'

export default function Auctions({ ctx }) {
  const { members, setMembers, auctions, setAuctions, currentUser, addToast } = ctx
  const [showCreate, setShowCreate] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', rarity: 'epic', startBid: 100, duration: 60 })
  const [bidAmounts, setBidAmounts] = useState({})

  const isElder = currentUser?.role === 'Elder' || currentUser?.role === 'Master'
  const isMaster = currentUser?.role === 'Master'

  const createAuction = () => {
    if (!newItem.name.trim()) {
      addToast('Enter an item name.', 'red', 'Error')
      return
    }
    const endsAt = Date.now() + (parseInt(newItem.duration) || 60) * 60 * 1000
    const auction = {
      id: Date.now(),
      name: newItem.name.trim(),
      rarity: newItem.rarity,
      startBid: parseInt(newItem.startBid) || 100,
      currentBid: parseInt(newItem.startBid) || 100,
      topBidder: null,
      status: 'active',
      endsAt,
      bids: [],
    }
    setAuctions([auction, ...auctions])
    setNewItem({ name: '', rarity: 'epic', startBid: 100, duration: 60 })
    setShowCreate(false)
    addToast(`"${auction.name}" is now up for auction!`, 'gold', 'Auction Live')
  }

  const placeBid = (auctionId) => {
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

    // Refund previous top bidder
    if (auction.topBidder) {
      const prev = members.find(m => m.name === auction.topBidder)
      if (prev) {
        setMembers(members.map(m => m.id === prev.id ? { ...m, coins: m.coins + auction.currentBid } : m))
      }
    }

    // Deduct from bidder
    setMembers(members.map(m => m.id === bidder.id ? { ...m, coins: m.coins - amount } : m))

    // Update auction
    const updated = {
      ...auction,
      currentBid: amount,
      topBidder: currentUser.name,
      bids: [...(auction.bids || []), { bidder: currentUser.name, amount, time: Date.now() }],
    }
    setAuctions(auctions.map(a => a.id === auctionId ? updated : a))

    setBidAmounts({ ...bidAmounts, [auctionId]: '' })
    addToast(`Bid of ${amount} coins placed on ${auction.name}.`, 'gold', 'Bid Placed')

    // Check if auction should auto-end (snipe protection)
    const timeLeft = auction.endsAt - Date.now()
    if (timeLeft < 60000 && timeLeft > 0) {
      const newEnd = Date.now() + 120000
      setAuctions(auctions.map(a => a.id === auctionId ? { ...a, endsAt: newEnd } : a))
      addToast('⏱️ Timer extended 2 mins (snipe protection)', 'blue', 'Extension')
    }
  }

  const endAuction = (auctionId) => {
    if (!isMaster) return
    const auction = auctions.find(a => a.id === auctionId)
    if (!auction) return
    if (window.confirm(`End "${auction.name}" early?`)) {
      setAuctions(auctions.map(a => a.id === auctionId ? { ...a, status: 'ended' } : a))
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

      {/* Create Auction Form */}
      {showCreate && (
        <div className="card mb-6 border-gold/40">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              className="input"
              placeholder="Item name"
              value={newItem.name}
              onChange={e => setNewItem({ ...newItem, name: e.target.value })}
            />
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
            <input
              className="input"
              type="number"
              placeholder="Start bid"
              value={newItem.startBid}
              onChange={e => setNewItem({ ...newItem, startBid: parseInt(e.target.value) || 0 })}
            />
            <div className="flex gap-2">
              <input
                className="input"
                type="number"
                placeholder="Duration (min)"
                value={newItem.duration}
                onChange={e => setNewItem({ ...newItem, duration: parseInt(e.target.value) || 60 })}
              />
              <button onClick={createAuction} className="btn-gold whitespace-nowrap">Start Auction</button>
            </div>
          </div>
        </div>
      )}

      {/* Active Auctions */}
      {activeAuctions.length === 0 ? (
        <div className="card text-center py-12 text-text-dim">No active auctions.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {activeAuctions.map(auction => {
            const isWinning = auction.topBidder === currentUser?.name
            return (
              <div key={auction.id} className={`card ${isWinning ? 'border-green-500/40 bg-green-500/5' : ''}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-gold-light">{auction.name}</div>
                    <div className="text-xs text-text-dim">
                      <span className={`badge badge-${auction.rarity}`}>{auction.rarity}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-text-dim">Ends in</div>
                    <div className="font-bold text-red-400">{formatTime(auction.endsAt)}</div>
                  </div>
                </div>

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
                  <button onClick={() => endAuction(auction.id)} className="text-xs text-red-400 hover:text-red-300 mt-2">
                    End Early
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Ended Auctions */}
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