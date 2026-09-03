import React, { useState } from 'react'

export default function Login({ ctx }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const allUsers = ctx.members || []

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (!username || !password) {
      setError('Please enter both username and password.')
      return
    }
    
    setIsLoading(true)
    setError('')
    
    const success = ctx.handleLogin(username, password)
    setIsLoading(false)
    
    if (!success) {
      setError('Invalid username or password.')
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-void p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🪙</div>
          <h1 className="font-spectral text-3xl font-bold text-gold-light">Coin & Bids</h1>
          <p className="text-text-dim text-sm mt-2">Clan Management System</p>
        </div>

        <div className="card border-gold/40 p-6">
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="bg-blood/30 border border-blood/60 text-[#e07070] rounded p-3 text-sm mb-4">
                ❌ {error}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-text-dim text-xs uppercase tracking-wider font-bold mb-2">
                Username
              </label>
              <input
                type="text"
                className="input"
                placeholder="Enter your username..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
            </div>

            <div className="mb-6">
              <label className="block text-text-dim text-xs uppercase tracking-wider font-bold mb-2">
                Password
              </label>
              <input
                type="password"
                className="input"
                placeholder="Enter your password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              className="btn-gold w-full py-3 text-base"
              disabled={isLoading}
            >
              {isLoading ? '⏳ Logging in...' : '🔐 Login'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gold/20">
            <p className="text-text-dim text-xs uppercase tracking-wider font-bold text-center mb-3">
              📋 Available Accounts ({allUsers.length})
            </p>
            {allUsers.length === 0 ? (
              <div className="text-center text-text-dim text-sm py-4">
                No accounts found. Please contact your Master.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-xs max-h-[200px] overflow-y-auto">
                {allUsers.map((acc) => (
                  <div
                    key={acc.id}
                    className="bg-void/50 border border-gold/10 rounded p-2 text-center cursor-pointer hover:border-gold/40 hover:bg-gold/5 transition-colors"
                    onClick={() => {
                      setUsername(acc.username)
                      setPassword(acc.password)
                      setError('')
                    }}
                  >
                    <div className="font-semibold text-gold-light">{acc.name}</div>
                    <div className="text-text-dim text-[10px]">{acc.username}</div>
                    <div className="text-text-dim text-[8px] opacity-60">Role: {acc.role}</div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-text-dim text-xs text-center mt-3">
              Click an account above, then click Login
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}