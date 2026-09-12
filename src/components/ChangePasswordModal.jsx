import React, { useState } from 'react'

export default function ChangePasswordModal({ ctx, onClose }) {
  const { currentUser, addToast, supabase } = ctx
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setError('')

    if (!currentPassword) { setError('Enter your current password.'); return }
    if (!newPassword) { setError('Enter a new password.'); return }
    if (newPassword.length < 4) { setError('New password must be at least 4 characters.'); return }
    if (newPassword !== confirmPassword) { setError('New passwords do not match.'); return }
    if (newPassword === currentPassword) { setError('New password must be different from the current one.'); return }

    if (currentUser.password !== currentPassword) {
      setError('Current password is incorrect.')
      return
    }

    setSaving(true)
    try {
      const { error: updErr } = await supabase
        .from('members')
        .update({ password: newPassword })
        .eq('id', currentUser.id)

      if (updErr) throw updErr

      const updated = { ...currentUser, password: newPassword }
      ctx.setCurrentUser(updated)
      try { localStorage.setItem('currentUser', JSON.stringify(updated)) } catch {}

      addToast('Your password has been updated.', 'gold', 'Password Changed')
      onClose()
    } catch (e) {
      console.error('Password change failed:', e)
      setError('Could not save the new password. Please try again.')
    } finally {
      setSaving(false)
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
            <div className="bg-blood/30 border border-blood/60 text-[#e07070] rounded p-3 text-sm">
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
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              disabled={saving}
              autoFocus
              autoComplete="current-password"
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
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              disabled={saving}
              autoComplete="new-password"
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
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
              disabled={saving}
              autoComplete="new-password"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-outline" onClick={onClose} disabled={saving} type="button">
            Cancel
          </button>
          <button className="btn-gold" onClick={submit} disabled={saving} type="button">
            {saving ? 'Saving…' : 'Save Password'}
          </button>
        </div>
      </div>
    </div>
  )
}