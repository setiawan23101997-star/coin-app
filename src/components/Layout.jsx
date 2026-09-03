import React, { useState } from 'react'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'members', label: 'Members', icon: '👥' },
  { id: 'attendance', label: 'Attendance', icon: '📋' },
  { id: 'auctions', label: 'Auctions', icon: '🔨' },
  { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
]

export default function Layout({ ctx, page, setPage, children, toasts }) {
  const { currentUser, setCurrentUser, addToast } = ctx
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    setCurrentUser(null)
    localStorage.removeItem('currentUser')
    addToast('Logged out.', 'blue', 'Goodbye')
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-void/95 border-b border-gold/20 backdrop-blur-sm px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🪙</span>
          <span className="font-spectral font-bold text-gold-light text-lg tracking-wider">Coin & Bids</span>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`text-sm font-semibold tracking-wider transition-colors ${
                page === item.id ? 'text-gold-bright' : 'text-text-dim hover:text-gold-light'
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
          {currentUser ? (
  <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gold/20">
    <span className="text-sm font-bold text-gold-light">{currentUser.name}</span>
    <span className="text-xs text-text-dim px-2 py-0.5 rounded bg-gold/10">
      {currentUser.role}
    </span>
    <button onClick={ctx.handleLogout} className="text-xs text-text-dim hover:text-red-400 transition-colors">
      Logout
    </button>
  </div>
) : (
            <button
              onClick={() => {
                const guest = { id: 'guest', name: 'Guest', role: 'Guest', coins: 0 }
                setCurrentUser(guest)
                addToast('Entered guest mode.', 'blue', 'Welcome')
              }}
              className="text-sm text-text-dim hover:text-gold-light transition-colors"
            >
              Guest
            </button>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden text-gold-light text-2xl"
        >
          ☰
        </button>
      </nav>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute top-0 left-0 bottom-0 w-64 bg-dark border-r border-gold/20 p-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <span className="font-spectral font-bold text-gold-light">Menu</span>
              <button onClick={() => setMobileOpen(false)} className="text-text-dim">✕</button>
            </div>
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => { setPage(item.id); setMobileOpen(false) }}
                className={`block w-full text-left py-3 px-2 rounded transition-colors ${
                  page === item.id ? 'bg-gold/10 text-gold-bright' : 'text-text-dim hover:text-gold-light hover:bg-gold/5'
                }`}
              >
                {item.icon} {item.label}
              </button>
            ))}
            {currentUser ? (
              <button onClick={handleLogout} className="block w-full text-left py-3 px-2 text-red-400 hover:text-red-300 transition-colors">
                🚪 Logout
              </button>
            ) : (
              <button
                onClick={() => {
                  const guest = { id: 'guest', name: 'Guest', role: 'Guest', coins: 0 }
                  setCurrentUser(guest)
                  setMobileOpen(false)
                  addToast('Entered guest mode.', 'blue', 'Welcome')
                }}
                className="block w-full text-left py-3 px-2 text-text-dim hover:text-gold-light transition-colors"
              >
                👤 Guest
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 mt-16 p-4 md:p-6 max-w-7xl mx-auto w-full">
        {children}
      </main>

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`bg-dark border ${
              toast.type === 'gold' ? 'border-gold/60' :
              toast.type === 'red' ? 'border-blood/60' :
              toast.type === 'blue' ? 'border-blue-500/40' :
              'border-gold/40'
            } rounded p-3 min-w-[200px] max-w-[350px] shadow-xl animate-slideIn`}
          >
            {toast.title && (
              <div className="text-[10px] font-bold uppercase tracking-wider text-gold-light mb-1">
                {toast.title}
              </div>
            )}
            <div className="text-sm text-text">{toast.msg}</div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease forwards;
        }
      `}</style>
    </div>
  )
}