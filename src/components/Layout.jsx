import React, { useState, useEffect, useRef } from 'react'
import ChangePasswordModal from './ChangePasswordModal'

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
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)

  const userMenuRef = useRef(null)

  // Close the dropdown when clicking anywhere outside it
  useEffect(() => {
    if (!userMenuOpen) return
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
    }
    const handleEscape = (e) => {
      if (e.key === 'Escape') setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [userMenuOpen])

  const handleLogout = () => {
    setCurrentUser(null)
    localStorage.removeItem('currentUser')
    addToast('Logged out.', 'blue', 'Goodbye')
    setUserMenuOpen(false)
  }

  const roleBadgeClass = (role) => {
    if (role === 'Admin') return 'bg-red-500/20 text-red-400 border border-red-500/40'
    if (role === 'Master') return 'bg-gold/15 text-gold-light border border-gold/40'
    if (role === 'Elder') return 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
    return 'bg-gold/10 text-text-dim border border-gold/20'
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-void/95 border-b border-gold/20 backdrop-blur-sm px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🪙</span>
          <span className="font-spectral font-bold text-gold-light text-lg tracking-wider">PeakyBlinder</span>
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

          {currentUser && (
            <div
              ref={userMenuRef}
              className="relative ml-4 pl-4 border-l border-gold/20"
            >
              <button
                type="button"
                onClick={() => setUserMenuOpen(o => !o)}
                className="flex items-center gap-2 text-sm text-gold-light hover:text-gold-bright transition-colors"
              >
                <span className="font-bold">{currentUser.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${roleBadgeClass(currentUser.role)}`}>
                  {currentUser.role}
                </span>
                <span
                  className="text-[10px] text-text-dim transition-transform"
                  style={{ transform: userMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}
                >
                  ▾
                </span>
              </button>

              {userMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-2 min-w-[200px] rounded-lg border border-gold/30 bg-dark/95 backdrop-blur-md shadow-xl overflow-hidden z-50"
                  style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.9)' }}
                >
                  <button
                    type="button"
                    onClick={() => { setShowChangePassword(true); setUserMenuOpen(false) }}
                    className="block w-full text-left px-4 py-2.5 text-sm text-text hover:bg-gold/10 hover:text-gold-light transition-colors"
                  >
                    🔑 Change Password
                  </button>
                  <div className="border-t border-gold/15" />
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                  >
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
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
              <>
                <div className="mt-4 pt-4 border-t border-gold/15 flex items-center gap-2 px-2">
                  <span className="text-sm font-bold text-gold-light truncate">{currentUser.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded flex-shrink-0 ${roleBadgeClass(currentUser.role)}`}>
                    {currentUser.role}
                  </span>
                </div>
                <button
                  onClick={() => { setShowChangePassword(true); setMobileOpen(false) }}
                  className="block w-full text-left py-3 px-2 text-text hover:text-gold-light transition-colors"
                >
                  🔑 Change Password
                </button>
                <button onClick={handleLogout} className="block w-full text-left py-3 px-2 text-red-400 hover:text-red-300 transition-colors">
                  🚪 Logout
                </button>
              </>
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

      {showChangePassword && currentUser && (
        <ChangePasswordModal ctx={ctx} onClose={() => setShowChangePassword(false)} />
      )}

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