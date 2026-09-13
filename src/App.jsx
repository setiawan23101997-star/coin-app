import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import Members from './components/Members'
import Attendance from './components/Attendance'
import Auctions from './components/Auctions'
import Leaderboard from './components/Leaderboard'
import Login from './components/Login'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

function App() {
  const [page, setPage] = useState('dashboard')

  const [allMembers, setAllMembers] = useState([])
  const [members, setMembers] = useState([])

  const [auctions, setAuctions] = useState([])
  const [attendanceLogs, setAttendanceLogs] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [toasts, setToasts] = useState([])
  const [loading, setLoading] = useState(true)

  const autoEndedRef = useRef(new Set())

  const addToast = (msg, type = 'gold', title = '') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, msg, type, title }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  // ---------- normalizers ----------

  const normalizeAuction = (a) => ({
    id: String(a.id),
    name: a.name ?? '',
    description: a.description ?? '',
    rarity: a.rarity ?? 'epic',
    status: a.status ?? 'active',
    currentBid: Number(a.current_bid ?? a.currentBid) || 0,
    startBid: Number(a.min_bid ?? a.startBid) || 0,
    topBidder: a.top_bidder ?? a.topBidder ?? null,
    endsAt: Number(a.ends_at ?? a.endsAt) || 0,
    startedAt: Number(a.started_at ?? a.startedAt) || 0,
    endedAt: Number(a.ended_at ?? a.endedAt) || 0,
    distributedBy: a.distributed_by ?? a.distributedBy ?? null,
    bids: (() => {
      try {
        if (typeof a.bids === 'string') return JSON.parse(a.bids)
        if (Array.isArray(a.bids)) return a.bids
        return []
      } catch { return [] }
    })(),
    imageName: a.image_name ?? null,
  })

  const toJsonArray = (v) => {
    try {
      if (typeof v === 'string') return JSON.parse(v)
      if (Array.isArray(v)) return v
      return []
    } catch { return [] }
  }

  const normalizeMember = (m) => ({
    id: Number(m.id),
    name: m.name ?? '',
    username: m.username ?? '',
    cls: m.cls ?? '',
    role: m.role ?? 'Member',
    coins: Number(m.coins) || 0,
    power: Number(m.power) || 0,
    attendance: Number(m.attendance) || 0,
    auction_wins: Number(m.auction_wins ?? m.auctionWins) || 0,
    join_date: m.join_date ?? m.joinDate ?? '',
    discord: m.discord ?? '',
    tx_log: toJsonArray(m.tx_log),
    attend_log: toJsonArray(m.attend_log),
  })

  const filterVisibleMembers = (list, viewer) => {
    if (viewer?.role === 'Admin') return list
    return list.filter(m => m.role !== 'Admin')
  }

  // ---------- loaders ----------

  const loadAllData = async () => {
    try {
      setLoading(true)

      const { data: membersData, error: membersError } = await supabase
        .from('public_members')
        .select('*')
        .order('id')
      if (membersError) throw membersError
      console.log('Loaded members:', membersData?.length || 0)

      let persistedViewer = null
      const savedUser = localStorage.getItem('currentUser')
      if (savedUser) {
        try { persistedViewer = JSON.parse(savedUser) } catch { persistedViewer = null }
      }

      if (!membersData || membersData.length === 0) {
        // Empty DB — the seed has to run in the SQL editor because the client
        // can't produce a bcrypt hash. Just tell the user.
        console.warn('Members table is empty. Seed via Supabase SQL editor:')
        console.warn("insert into members (name, username, password_hash, cls, coins, power, role)")
        console.warn("values ('Thomas Shelby', 'thomas', crypt('master123', gen_salt('bf')), 'Archer', 1000, 12345, 'Master');")
        setAllMembers([])
        setMembers([])
      } else {
        const normalized = membersData.map(normalizeMember)
        setAllMembers(normalized)
        setMembers(filterVisibleMembers(normalized, persistedViewer))
      }

      const { data: auctionsData, error: auctionsError } = await supabase
        .from('auctions')
        .select('*')
      if (auctionsError) throw auctionsError
      setAuctions((auctionsData || []).map(normalizeAuction))

      const { data: logsData, error: logsError } = await supabase
        .from('attendance_logs')
        .select('*')
      if (logsError) throw logsError
      setAttendanceLogs(logsData || [])

      // Re-hydrate the session from localStorage
      if (savedUser) {
        const user = JSON.parse(savedUser)
        const { data: fresh } = await supabase
          .from('public_members')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()
        if (fresh) {
          const normalized = normalizeMember(fresh)
          console.log('[session restore] currentUser.id =', normalized.id)
          setCurrentUser(normalized)
          setMembers(filterVisibleMembers((membersData || []).map(normalizeMember), normalized))
        } else {
          console.warn('[session restore] no member found for id', user.id, '— clearing localStorage')
          localStorage.removeItem('currentUser')
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      addToast('Could not connect to database. Please check your connection.', 'red', 'Connection Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAllData()
  }, [])

  // 5-second poll
  useEffect(() => {
    const interval = setInterval(async () => {
      const { data: membersData } = await supabase.from('public_members').select('*').order('id')
      const { data: auctionsData } = await supabase.from('auctions').select('*')
      const { data: logsData } = await supabase.from('attendance_logs').select('*')
      if (membersData) {
        const normalized = membersData.map(normalizeMember)
        setAllMembers(normalized)
        setMembers(filterVisibleMembers(normalized, currentUser))
      }
      if (auctionsData) setAuctions(auctionsData.map(normalizeAuction))
      if (logsData) setAttendanceLogs(logsData)
    }, 5000)
    return () => clearInterval(interval)
  }, [currentUser])

  // Auto-end expired auctions via the RPC
  useEffect(() => {
    const autoEndExpired = async () => {
      const now = Date.now()

      const expired = auctions.filter(a =>
        a.status === 'active' &&
        a.endsAt > 0 &&
        a.endsAt <= now &&
        !autoEndedRef.current.has(a.id)
      )

      if (expired.length === 0) return

      expired.forEach(a => autoEndedRef.current.add(a.id))

      const { error } = await supabase.rpc('auto_end_expired_auctions')
      if (error) {
        console.error('Auto-end failed:', error)
        expired.forEach(a => autoEndedRef.current.delete(a.id))
        return
      }

      const { data } = await supabase.from('auctions').select('*')
      if (data) setAuctions(data.map(normalizeAuction))

      expired.forEach(a => {
        const winner = a.topBidder
        if (winner) {
          addToast(`"${a.name}" ended — won by ${winner} for ${a.currentBid.toLocaleString()} coins.`, 'gold', 'Auction Ended')
        } else {
          addToast(`"${a.name}" ended with no bids.`, 'blue', 'Auction Ended')
        }
      })
    }

    autoEndExpired()
    const id = setInterval(autoEndExpired, 5000)
    return () => clearInterval(id)
  }, [auctions])

  // ---------- mutations ----------

  const saveMember = async (member) => {
    try {
      const { data, error } = await supabase.rpc('create_member', {
        p_actor_id: currentUser.id,
        p_name: member.name,
        p_username: member.username,
        p_password: member.password,
        p_cls: member.cls,
        p_power: member.power,
        p_role: member.role,
      })
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      const normalized = normalizeMember(row)
      setAllMembers(prev => [...prev, normalized])
      setMembers(prev => [...prev, normalized])
      return normalized
    } catch (error) {
      console.error('[saveMember] failed:', error)
      addToast(error.message || 'Failed to save member.', 'red', 'Error')
      return null
    }
  }

  const updateMember = async (id, updates) => {
    try {
      const { data, error } = await supabase.rpc('admin_update_member', {
        p_actor_id: currentUser.id,
        p_target_id: id,
        p_updates: updates,
      })
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      const normalized = normalizeMember(row)
      setAllMembers(prev => prev.map(m => m.id === id ? normalized : m))
      setMembers(prev => prev.map(m => m.id === id ? normalized : m))
      return normalized
    } catch (error) {
      console.error('[updateMember] failed:', error)
      addToast(error.message || 'Failed to update member.', 'red', 'Error')
      return null
    }
  }

  const deleteMember = async (id) => {
    try {
      const { error } = await supabase.rpc('admin_delete_member', {
        p_actor_id: currentUser.id,
        p_target_id: id,
      })
      if (error) throw error
      setAllMembers(prev => prev.filter(m => m.id !== id))
      setMembers(prev => prev.filter(m => m.id !== id))
      return true
    } catch (error) {
      console.error('[deleteMember] failed:', error)
      addToast(error.message || 'Failed to delete member.', 'red', 'Error')
      return false
    }
  }

  /**
   * Change the logged-in user's own password.
   *
   * Returns { ok: boolean, error?: string } so the modal can show the exact
   * server error inline (e.g. "Current password is incorrect" vs "Too many
   * failed attempts").
   */
  const changeOwnPassword = async (oldPassword, newPassword) => {
    if (!currentUser || !currentUser.id) {
      console.error('[changeOwnPassword] no currentUser.id — aborting')
      return { ok: false, error: 'You are not logged in. Please log out and log back in.' }
    }

    console.log('[changeOwnPassword] calling RPC with:', {
      p_member_id: currentUser.id,
      oldLen: oldPassword?.length ?? 0,
      newLen: newPassword?.length ?? 0,
    })

    try {
      const { data, error } = await supabase.rpc('change_own_password', {
        p_member_id: currentUser.id,
        p_old: oldPassword,
        p_new: newPassword,
      })

      if (error) {
        console.error('[changeOwnPassword] RPC error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        })
        return { ok: false, error: error.message || 'Could not change the password.' }
      }

      console.log('[changeOwnPassword] success:', data)
      addToast('Your password has been updated.', 'gold', 'Password Changed')
      return { ok: true }
    } catch (err) {
      console.error('[changeOwnPassword] threw:', err)
      return { ok: false, error: err.message || 'Could not change the password.' }
    }
  }

  /**
   * Admin resets another member's password.
   * Returns { ok, error } for the same reason.
   */
  const resetMemberPassword = async (targetId, newPassword) => {
    if (!currentUser || !currentUser.id) {
      console.error('[resetMemberPassword] no currentUser.id — aborting')
      return { ok: false, error: 'You are not logged in. Please log out and log back in.' }
    }

    console.log('[resetMemberPassword] calling RPC with:', {
      p_actor_id: currentUser.id,
      p_target_id: targetId,
      newLen: newPassword?.length ?? 0,
    })

    try {
      const { data, error } = await supabase.rpc('admin_reset_password', {
        p_actor_id: currentUser.id,
        p_target_id: targetId,
        p_new_password: newPassword,
      })

      if (error) {
        console.error('[resetMemberPassword] RPC error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        })
        return { ok: false, error: error.message || 'Could not reset the password.' }
      }

      console.log('[resetMemberPassword] success:', data)
      addToast('Password reset successfully.', 'gold', 'Updated')
      return { ok: true }
    } catch (err) {
      console.error('[resetMemberPassword] threw:', err)
      return { ok: false, error: err.message || 'Could not reset the password.' }
    }
  }

  const reloadMembers = async () => {
    const { data } = await supabase.from('public_members').select('*').order('id')
    if (data) {
      const normalized = data.map(normalizeMember)
      setAllMembers(normalized)
      setMembers(filterVisibleMembers(normalized, currentUser))
    }
  }

  // ---------- auth ----------

  const handleLogin = async (username, password) => {
    try {
      const { data, error } = await supabase.rpc('login_member', {
        p_username: username,
        p_password: password,
      })
      if (error) throw error

      const row = Array.isArray(data) ? data[0] : data
      if (!row) {
        addToast('Invalid username or password.', 'red', 'Login Failed')
        return { ok: false, error: 'Invalid username or password.' }
      }

      const user = normalizeMember(row)
      console.log('[handleLogin] logged in as:', user.name, 'id =', user.id)
      setCurrentUser(user)
      localStorage.setItem('currentUser', JSON.stringify(user))
      setMembers(filterVisibleMembers(allMembers, user))
      addToast(`Welcome back, ${user.name}!`, 'gold', 'Login Success')
      return { ok: true }
    } catch (error) {
      console.error('[handleLogin] failed:', error)
      const msg = error.message || 'Invalid username or password.'
      addToast(msg, 'red', 'Login Failed')
      return { ok: false, error: msg }
    }
  }

  const handleLogout = () => {
    setCurrentUser(null)
    localStorage.removeItem('currentUser')
    setMembers(filterVisibleMembers(allMembers, null))
    addToast('Logged out successfully.', 'blue', 'Goodbye')
  }

  const ctx = {
    members,
    setMembers,
    allMembers,
    saveMember,
    updateMember,
    deleteMember,
    resetMemberPassword,
    changeOwnPassword,
    reloadMembers,
    auctions,
    setAuctions,
    attendanceLogs,
    setAttendanceLogs,
    currentUser,
    setCurrentUser,
    addToast,
    handleLogin,
    handleLogout,
    loadAllData,
    supabase,
  }

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-void">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-spin">⚙️</div>
          <div className="text-text-dim">Loading...</div>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return <Login ctx={ctx} />
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard':   return <Dashboard   ctx={ctx} setPage={setPage} />
      case 'members':     return <Members     ctx={ctx} />
      case 'attendance':  return <Attendance  ctx={ctx} />
      case 'auctions':    return <Auctions    ctx={ctx} />
      case 'leaderboard': return <Leaderboard ctx={ctx} />
      default:            return <Dashboard   ctx={ctx} setPage={setPage} />
    }
  }

  return (
    <Layout ctx={ctx} page={page} setPage={setPage} toasts={toasts}>
      {renderPage()}
    </Layout>
  )
}

export default App
