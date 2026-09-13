import React, { useState } from 'react'

export default function ChangePasswordModal({ ctx, onClose }) {
  const { changeOwnPassword } = ctx
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setError('')

    if (!current) { setError('Enter your current password.'); return }
    if (!next)    { setError('Enter a new password.'); return }
    if (next.length < 4) { setError('New password must be at least 4 characters.'); return }
    if (next !== confirm) { setError('New passwords do not match.'); return }
    if (next === current) { setError('New password must be different from the current one.'); return }

    setSubmitting(true)
    try {
      const ok = await changeOwnPassword(current, next)
      if (ok) {
        onClose()
      } else {
        setError('Current password is incorrect.')
      }
    } catch (err) {
      console.error('Change password failed:', err)
      setError(err.message || 'Could not change the password. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Change Password</div>
          <button
            className="text-text-dim hover:text-gold-light text-xl leading-none px-1"
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="modal-body space-y-4">
          {error && (
            <div role="alert" className="bg-blood/30 border border-blood/60 text-[#e07070] rounded p-3 text-sm">
              ❌ {error}
            </div>
          )}

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-text-dim mb-1">
              Current Password
            </label>
            <input
              type="password"
              className="input"
              placeholder="Enter your current password"
              value={current}
              onChange={e => setCurrent(e.target.value)}
              disabled={submitting}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-text-dim mb-1">
              New Password
            </label>
            <input
              type="password"
              className="input"
              placeholder="Choose a new password"
              value={next}
              onChange={e => setNext(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-text-dim mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              className="input"
              placeholder="Repeat the new password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
              disabled={submitting}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-outline" onClick={onClose} disabled={submitting} type="button">
            Cancel
          </button>
          <button className="btn-gold" onClick={handleSubmit} disabled={submitting} type="button">
            {submitting ? 'Saving…' : 'Save Password'}
          </button>
        </div>
      </div>
    </div>
  )
}
