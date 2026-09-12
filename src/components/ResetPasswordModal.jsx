import React, { useState } from 'react'

export default function ResetPasswordModal({ ctx, member, onClose }) {
  const { addToast, supabase, reloadMembers } = ctx
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setError('')
    if (!newPassword) { setError('Enter a new password.'); return }
    if (newPassword.length < 4) { setError('Password must be at least 4 characters.'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }

    setSaving(true)
    try {
      const { error: updErr } = await supabase
        .from('members')
        .update({ password: newPassword })
        .eq('id', member.id)

      if (updErr) throw updErr

      if (reloadMembers) await reloadMembers()

      addToast(`${member.name}'s password has been reset.`, 'gold', 'Password Reset')
      onClose()
    } catch (e) {
      console.error('Reset password failed:', e)
      setError('Could not reset the password. Please try again.')
    } finally {
      setSaving(false)
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
            Set a new password for <span className="text-gold-light font-semibold">{member.name}</span>.
            They can change it themselves afterwards.
          </div>

          {error && (
            <div className="bg-blood/30 border border-blood/60 text-[#e07070] rounded p-3 text-sm">
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
              disabled={saving}
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
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
              disabled={saving}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-outline" onClick={onClose} disabled={saving} type="button">
            Cancel
          </button>
          <button className="btn-gold" onClick={submit} disabled={saving} type="button">
            {saving ? 'Saving…' : 'Reset Password'}
          </button>
        </div>
      </div>
    </div>
  )
}