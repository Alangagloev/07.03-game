import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { getProfile, loadLocal, saveLocal, clearLocal, updateStats, BET_AMOUNTS, saveGameHistory, deductTokens, updateBalance, getPendingRequests, getGameInvites, subscribeToInvites } from './services/gameService'
import type { User, GameConfig, GameInvite, GameRoom, Question } from './types'
import { Auth } from './components/Auth'
import { Dashboard } from './components/Dashboard'
import { Lobby } from './components/Lobby'
import { Game } from './components/Game'
import { Profile } from './components/Profile'
import { Friends } from './components/Friends'
import { AdminPanel } from './components/AdminPanel'
import { GameInviteModal } from './components/GameInviteModal'
import { WaitingRoom } from './components/WaitingRoom'

type View = 'auth' | 'dashboard' | 'lobby' | 'game' | 'profile' | 'friends' | 'admin' | 'waiting'

export default function App() {
  const [view, setView] = useState<View>('auth')
  const [user, setUser] = useState<User | null>(null)
  const [config, setConfig] = useState<GameConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(false)
  const [pendingFriendRequests, setPendingFriendRequests] = useState(0)
  const [gameInvites, setGameInvites] = useState<GameInvite[]>([])
  const [currentInvite, setCurrentInvite] = useState<GameInvite | null>(null)
  const [waitingRoomId, setWaitingRoomId] = useState<string | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [gameQuestions, setGameQuestions] = useState<Question[] | null>(null)

  const refreshProfile = async (userId: string) => {
    const profile = await getProfile(userId)
    if (profile) setUser(profile)
    return profile
  }

  const loadPendingRequests = async (userId: string) => {
    const requests = await getPendingRequests(userId)
    setPendingFriendRequests(requests.length)
  }

  const loadGameInvites = async (userId: string) => {
    const invites = await getGameInvites(userId)
    setGameInvites(invites)
    if (invites.length > 0 && !currentInvite) {
      setCurrentInvite(invites[0])
    }
  }

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const profile = await getProfile(session.user.id)
          if (profile) {
            setUser(profile)
            setIsOnline(true)
            setView('dashboard')
            await loadPendingRequests(session.user.id)
            await loadGameInvites(session.user.id)
          }
        }
      } catch (e) {
        console.log('Local mode')
      }
      
      if (!user) {
        const local = loadLocal()
        if (local) {
          setUser(local)
          setView('dashboard')
        }
      }
      setLoading(false)
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await getProfile(session.user.id)
        if (profile) {
          setUser(profile)
          setIsOnline(true)
          setView('dashboard')
          await loadPendingRequests(session.user.id)
          await loadGameInvites(session.user.id)
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setIsOnline(false)
        setView('auth')
        setPendingFriendRequests(0)
        setGameInvites([])
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!isOnline || !user) return
    
    const channel = subscribeToInvites(user.id, (invite) => {
      setGameInvites(prev => [...prev, invite])
      if (!currentInvite) setCurrentInvite(invite)
    })

    return () => { channel.unsubscribe() }
  }, [isOnline, user?.id])

  useEffect(() => {
    if (!isOnline || !user) return
    const interval = setInterval(() => {
      loadPendingRequests(user.id)
      loadGameInvites(user.id)
    }, 15000)
    return () => clearInterval(interval)
  }, [isOnline, user?.id])

  useEffect(() => {
    if (user && !isOnline) saveLocal(user)
  }, [user, isOnline])

  const handleLogin = (u: User, online: boolean) => {
    setUser(u)
    setIsOnline(online)
    setView('dashboard')
    if (online) {
      loadPendingRequests(u.id)
      loadGameInvites(u.id)
    }
  }

  const handleLogout = async () => {
    if (isOnline) await supabase.auth.signOut()
    clearLocal()
    setUser(null)
    setIsOnline(false)
    setView('auth')
    setPendingFriendRequests(0)
    setGameInvites([])
  }

  const handlePlay = async (cfg: GameConfig) => {
    if (!user) return
    
    // Для режимов random и friends переходим в комнату ожидания
    if ((cfg.mode === 'random' || cfg.mode === 'friends') && cfg.roomId) {
      setWaitingRoomId(cfg.roomId)
      setIsHost(cfg.mode === 'friends') // Хост только если создал игру с друзьями
      setConfig(cfg)
      setView('waiting')
      return
    }
    
    // Режим с ботами - сразу в игру
    setConfig(cfg)
    setView('game')
  }

  const handleGameStart = (room: GameRoom, questions: Question[]) => {
    setGameQuestions(questions)
    setConfig({ mode: room.mode as any, betAmount: room.bet_amount, roomId: room.id })
    setWaitingRoomId(null)
    setView('game')
  }

  const handleGameEnd = async (won: boolean, correct: number, wrong: number, totalPlayers: number, surrendered: boolean) => {
    if (!user || !config) return
    const bet = BET_AMOUNTS[config.mode]
    const bank = bet * totalPlayers
    let earnings = 0
    if (config.mode !== 'bot' && won && !surrendered) earnings = bank
    const newBalance = user.balance + earnings
    
    if (isOnline) {
      await updateBalance(user.id, newBalance)
      await updateStats(user.id, won)
      await saveGameHistory({
        user_id: user.id, room_id: config.roomId || 'room-' + Date.now(), mode: config.mode,
        result: surrendered ? 'surrender' : (won ? 'win' : 'loss'),
        correct_answers: correct, wrong_answers: wrong, total_players: totalPlayers,
        bet_amount: bet, earnings: earnings - bet
      })
      await refreshProfile(user.id)
    } else {
      setUser({
        ...user, balance: newBalance, total_games: user.total_games + 1,
        total_wins: user.total_wins + (won ? 1 : 0), level: Math.floor((user.total_games + 1) / 5) + 1
      })
    }
    setConfig(null)
    setGameQuestions(null)
    setView('dashboard')
  }

  const handleInviteAccept = (roomId: string) => {
    setCurrentInvite(null)
    setGameInvites(prev => prev.filter(i => i.room_id !== roomId))
    setWaitingRoomId(roomId)
    setIsHost(false)
    setView('waiting')
  }

  const handleInviteDecline = () => {
    if (currentInvite) {
      setGameInvites(prev => prev.filter(i => i.id !== currentInvite.id))
    }
    setCurrentInvite(null)
    const remaining = gameInvites.filter(i => i.id !== currentInvite?.id)
    if (remaining.length > 0) {
      setCurrentInvite(remaining[0])
    }
  }

  const handleBackFromFriends = () => {
    if (user && isOnline) loadPendingRequests(user.id)
    setView('dashboard')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-indigo-900/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-purple-900/20 rounded-full blur-3xl" />
      </div>
      
      <div className={`fixed top-2 right-2 z-50 px-2 py-1 rounded text-xs ${isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
        {isOnline ? '● Online' : '● Demo'}
      </div>
      
      {currentInvite && user && view === 'dashboard' && (
        <GameInviteModal invite={currentInvite} user={user} onAccept={handleInviteAccept} onDecline={handleInviteDecline} />
      )}
      
      <div className="relative z-10 min-h-screen">
        {view === 'auth' && <Auth onLogin={handleLogin} />}
        
        {view === 'dashboard' && user && (
          <Dashboard 
            user={user}
            pendingFriendRequests={pendingFriendRequests}
            pendingGameInvites={gameInvites.length}
            onPlay={() => setView('lobby')} 
            onLogout={handleLogout} 
            onProfile={() => setView('profile')} 
            onFriends={() => setView('friends')} 
            onAdmin={() => setView('admin')}
            onViewInvites={() => gameInvites.length > 0 && setCurrentInvite(gameInvites[0])}
          />
        )}
        
        {view === 'lobby' && user && <Lobby user={user} onJoin={handlePlay} onBack={() => setView('dashboard')} isOnline={isOnline} />}
        
        {view === 'waiting' && user && waitingRoomId && (
          <WaitingRoom 
            roomId={waitingRoomId} 
            user={user} 
            isHost={isHost}
            onGameStart={handleGameStart}
            onCancel={() => { setWaitingRoomId(null); setView('dashboard') }}
          />
        )}
        
        {view === 'game' && user && config && (
          <Game 
            user={user} 
            config={config} 
            onEnd={handleGameEnd}
            preloadedQuestions={gameQuestions}
          />
        )}
        {view === 'profile' && user && <Profile user={user} isOnline={isOnline} onBack={() => setView('dashboard')} onUserUpdate={setUser} />}
        {view === 'friends' && user && <Friends user={user} isOnline={isOnline} onBack={handleBackFromFriends} />}
        {view === 'admin' && user?.is_admin && <AdminPanel user={user} onBack={() => setView('dashboard')} />}
      </div>
    </div>
  )
}
