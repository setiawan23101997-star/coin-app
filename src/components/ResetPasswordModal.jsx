import React, { useState } from 'react'

export default function ResetPasswordModal({ ctx, member, onClose }) {
  const { resetMemberPassword } = ctx
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setError('')

    if (!newPassword) { setError('Enter a new password.'); return }
    if (newPassword.length < 4) { setError('Password must be at least 4 characters.'); return }
    if (newPassword !== confirm) { setError('Passwords do not match.'); return }

    setSubmitting(true)
    try {
      const ok = await resetMemberPassword(member.id, newPassword)
      if (ok) {
        onClose()
      } else {
        setError('Could not reset the password. Please try again.')
      }
    } catch (err) {
      console.error('Reset password failed:', err)
      setError(err.message || 'Could not reset the password. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Reset Password — {member.name}</div>
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
          <div className="text-xs text-text-dim">
            Set a new password for{' '}
            <span className="text-gold-light font-semibold">{member.name}</span>.
            They can change it themselves afterwards.
          </div>

          {error && (
            <div role="alert" className="bg-blood/30 border border-blood/60 text-[#e07070] rounded p-3 text-sm">
              ❌ {error}
            </div>
          )}

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-text-dim mb-1">
              New Password
            </label>
            <input
              type="text"
              className="input font-mono"
              placeholder="Set a temporary password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              disabled={submitting}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-text-dim mb-1">
              Confirm New Password
            </label>
            <input
              type="text"
              className="input font-mono"
              placeholder="Repeat the password"
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
            {submitting ? 'Saving…' : 'Reset Password'}
          </button>
        </div>
      </div>
    </div>
  )
}
