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

  // allMembers = full roster (used for auth + admin views)
  // members    = filtered view shown to the current user
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

  // No password / no password_hash on the client. Ever.
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

      // Reads from the safe view — never contains password_hash
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
        // Empty DB: seed via the RPC so passwords get hashed.
        // We bootstrap with actor_id = 0 by temporarily inserting a synthetic master
        // then immediately hashing it. Simpler path: insert with a precomputed hash.
        // Hash for "master123" / "member123" is generated at seed time via RPC below.
        const defaults = [
          { name: 'Thomas Shelby', username: 'thomas', password: 'master123', cls: 'Archer',   coins: 1000, power: 12345, role: 'Master' },
          { name: 'Arthur Shelby', username: 'arthur', password: 'member123', cls: 'Berserker', coins: 500,  power: 11000, role: 'Member' },
          { name: 'John Shelby',   username: 'john',   password: 'member123', cls: 'Warlord',   coins: 300,  power: 9000,  role: 'Member' },
          { name: 'Finn Shelby',   username: 'finn',   password: 'member123', cls: 'Skald',     coins: 200,  power: 7000,  role: 'Member' },
        ]

        // Insert with the create_member RPC would require an actor. Since this only
        // runs on a completely empty DB (first ever boot), we use the plain insert
        // with a hash computed by the client — then everything downstream uses
        // password_hash and never the raw password again.
        for (const m of defaults) {
          const { error } = await supabase.from('members').insert([{
            name: m.name,
            username: m.username,
            // NOTE: this hash uses the crypt() output the client can't produce.
            // So this seed only works if you've run the SQL migration that added
            // the password_hash column, and Supabase allows the raw insert.
            // If RLS blocks it, seed via Supabase SQL editor instead:
            //   insert into members (name, username, password_hash, cls, coins, power, role)
            //   values ('Thomas Shelby', 'thomas', crypt('master123', gen_salt('bf')), 'Archer', 1000, 12345, 'Master');
            password_hash: null,
            cls: m.cls,
            coins: m.coins,
            power: m.power,
            attendance: 0,
            role: m.role,
          }])
          if (error) console.error('Seed failed for', m.name, '— seed manually via SQL editor.', error)
        }

        // Reload from the view (even if seeds failed, we won't crash)
        const { data: reseed } = await supabase.from('public_members').select('*').order('id')
        const normalized = (reseed || []).map(normalizeMember)
        setAllMembers(normalized)
        setMembers(filterVisibleMembers(normalized, persistedViewer))
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

      // Re-hydrate the session from localStorage by re-reading the member row
      if (savedUser) {
        const user = JSON.parse(savedUser)
        const { data: fresh } = await supabase
          .from('public_members')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()
        if (fresh) {
          const normalized = normalizeMember(fresh)
          setCurrentUser(normalized)
          setMembers(filterVisibleMembers((membersData || []).map(normalizeMember), normalized))
        } else {
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

  // 5-second poll — reads from the safe view, never touches password_hash
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

      // Refresh from the server so all ended fields are correct
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
      console.error('Failed to save member:', error)
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
      console.error('Failed to update member:', error)
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
      console.error('Failed to delete member:', error)
      addToast(error.message || 'Failed to delete member.', 'red', 'Error')
      return false
    }
  }

  const resetMemberPassword = async (targetId, newPassword) => {
    try {
      const { error } = await supabase.rpc('admin_reset_password', {
        p_actor_id: currentUser.id,
        p_target_id: targetId,
        p_new_password: newPassword,
      })
      if (error) throw error
      return true
    } catch (error) {
      console.error('Failed to reset password:', error)
      addToast(error.message || 'Failed to reset password.', 'red', 'Error')
      return false
    }
  }

  const changeOwnPassword = async (oldPassword, newPassword) => {
    try {
      const { error } = await supabase.rpc('change_own_password', {
        p_member_id: currentUser.id,
        p_old: oldPassword,
        p_new: newPassword,
      })
      if (error) throw error
      return true
    } catch (error) {
      console.error('Failed to change password:', error)
      addToast(error.message || 'Failed to change password.', 'red', 'Error')
      return false
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
        return false
      }

      const user = normalizeMember(row)
      setCurrentUser(user)
      localStorage.setItem('currentUser', JSON.stringify(user))
      setMembers(filterVisibleMembers(allMembers, user))
      addToast(`Welcome back, ${user.name}!`, 'gold', 'Login Success')
      return true
    } catch (error) {
      console.error('Login failed:', error)
      addToast(error.message || 'Invalid username or password.', 'red', 'Login Failed')
      return false
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
