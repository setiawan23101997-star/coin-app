import React, { useState } from 'react'

export default function Login({ ctx }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

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
          <h1 className="font-spectral text-3xl font-bold text-gold-light">PeakyBlinder</h1>
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
                autoComplete="username"
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
                autoComplete="current-password"
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
        </div>

        <p className="text-text-dim text-xs text-center mt-4">
          Access is by invitation only. Contact your Master if you need an account.
        </p>
      </div>
    </div>
  )
}