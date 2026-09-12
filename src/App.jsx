import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import Members from './components/Members'
import Attendance from './components/Attendance'
import Auctions from './components/Auctions'
import Leaderboard from './components/Leaderboard'
import Login from './components/Login'

// Initialize Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

function App() {
  const [page, setPage] = useState('dashboard')
  const [members, setMembers] = useState([])
  const [auctions, setAuctions] = useState([])
  const [attendanceLogs, setAttendanceLogs] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [toasts, setToasts] = useState([])
  const [loading, setLoading] = useState(true)

  // Load all data from Supabase
  const loadAllData = async () => {
    try {
      setLoading(true)
      
      // Load members
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('*')
        .order('id')
      
      if (membersError) throw membersError
      console.log('✅ Loaded members from Supabase:', membersData?.length || 0)
      
      // If no members exist, create default ones
      if (!membersData || membersData.length === 0) {
        console.log('📝 No members found, creating defaults...')
        const defaultMembers = [
          { id: 1, name: 'Thomas Shelby', username: 'thomas', password: 'master123', cls: 'Archer', coins: 1000, power: 12345, attendance: 0, role: 'Master' },
          { id: 2, name: 'Arthur Shelby', username: 'arthur', password: 'member123', cls: 'Berserker', coins: 500, power: 11000, attendance: 0, role: 'Member' },
          { id: 3, name: 'John Shelby', username: 'john', password: 'member123', cls: 'Warlord', coins: 300, power: 9000, attendance: 0, role: 'Member' },
          { id: 4, name: 'Finn Shelby', username: 'finn', password: 'member123', cls: 'Skald', coins: 200, power: 7000, attendance: 0, role: 'Member' },
        ]
        for (const m of defaultMembers) {
          await supabase.from('members').insert([m])
        }
        setMembers(defaultMembers)
      } else {
        setMembers(membersData)
      }

      // Load auctions
      const { data: auctionsData, error: auctionsError } = await supabase
        .from('auctions')
        .select('*')
      
      if (auctionsError) throw auctionsError
      setAuctions(auctionsData || [])

      // Load attendance logs
      const { data: logsData, error: logsError } = await supabase
        .from('attendance_logs')
        .select('*')
      
      if (logsError) throw logsError
      setAttendanceLogs(logsData || [])

      // Check if user was logged in
      const savedUser = localStorage.getItem('currentUser')
      if (savedUser) {
        const user = JSON.parse(savedUser)
        const currentMembers = membersData || []
        const found = currentMembers.find(m => m.id === user.id)
        if (found) {
          setCurrentUser(found)
        } else {
          localStorage.removeItem('currentUser')
        }
      }
    } catch (error) {
      console.error('❌ Failed to load data:', error)
      addToast('Could not connect to database. Please check your connection.', 'red', 'Connection Error')
    } finally {
      setLoading(false)
    }
  }

  // Save member to Supabase
  const saveMember = async (member) => {
    try {
      const { data, error } = await supabase
        .from('members')
        .insert([member])
        .select()
      
      if (error) throw error
      if (data && data.length > 0) {
        const newMembers = [...members, data[0]]
        setMembers(newMembers)
        return data[0]
      }
      return null
    } catch (error) {
      console.error('Failed to save member:', error)
      addToast('Failed to save member. Please try again.', 'red', 'Error')
      return null
    }
  }

  // Update member in Supabase
  const updateMember = async (id, updates) => {
    try {
      const { data, error } = await supabase
        .from('members')
        .update(updates)
        .eq('id', id)
        .select()
      
      if (error) throw error
      if (data && data.length > 0) {
        setMembers(members.map(m => m.id === id ? data[0] : m))
        return data[0]
      }
      return null
    } catch (error) {
      console.error('Failed to update member:', error)
      addToast('Failed to update member. Please try again.', 'red', 'Error')
      return null
    }
  }

  // Delete member from Supabase
  const deleteMember = async (id) => {
    try {
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      setMembers(members.filter(m => m.id !== id))
      return true
    } catch (error) {
      console.error('Failed to delete member:', error)
      addToast('Failed to delete member. Please try again.', 'red', 'Error')
      return false
    }
  }

  useEffect(() => {
    loadAllData()
useEffect(() => {
  const interval = setInterval(async () => {
    const { data: membersData } = await supabase.from('members').select('*').order('id')
    const { data: auctionsData } = await supabase.from('auctions').select('*')
    if (membersData) setMembers(membersData)
    if (auctionsData) setAuctions(auctionsData.map(a => ({
      id: String(a.id),
      name: a.name,
      rarity: a.rarity,
      status: a.status,
      currentBid: Number(a.current_bid) || 0,
      topBidder: a.top_bidder,
      endsAt: Number(a.ends_at) || 0,
      startedAt: Number(a.started_at) || 0,
      startBid: Number(a.min_bid) || 0,
      bids: typeof a.bids === 'string' ? JSON.parse(a.bids) : (a.bids || []),
    })))
  }, 5000) // every 5 seconds

  return () => clearInterval(interval)
}, [])
  }, [])

  const addToast = (msg, type = 'gold', title = '') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, msg, type, title }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  const handleLogin = (username, password) => {
    const user = members.find(m => 
      m.username.toLowerCase() === username.toLowerCase() && 
      m.password === password
    )
    
    if (user) {
      setCurrentUser(user)
      localStorage.setItem('currentUser', JSON.stringify(user))
      addToast(`Welcome back, ${user.name}!`, 'gold', 'Login Success')
      return true
    } else {
      addToast('Invalid username or password.', 'red', 'Login Failed')
      return false
    }
  }

  const handleLogout = () => {
    setCurrentUser(null)
    localStorage.removeItem('currentUser')
    addToast('Logged out successfully.', 'blue', 'Goodbye')
  }

  const ctx = {
    members,
    setMembers,
    saveMember,
    updateMember,
    deleteMember,
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
      case 'dashboard': return <Dashboard ctx={ctx} setPage={setPage} />
      case 'members': return <Members ctx={ctx} />
      case 'attendance': return <Attendance ctx={ctx} />
      case 'auctions': return <Auctions ctx={ctx} />
      case 'leaderboard': return <Leaderboard ctx={ctx} />
      default: return <Dashboard ctx={ctx} setPage={setPage} />
    }
  }

  return (
    <Layout ctx={ctx} page={page} setPage={setPage} toasts={toasts}>
      {renderPage()}
    </Layout>
  )
}

export default App