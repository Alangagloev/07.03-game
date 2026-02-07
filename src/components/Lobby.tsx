import { useState, useEffect } from 'react'
import { ArrowLeft, Bot, Swords, Users, Coins, Play, Plus, RefreshCw, Loader2, User, Clock } from 'lucide-react'
import { BET_AMOUNTS, getFriends, getOpenRooms, createGameRoom, joinRoom, subscribeToOpenRooms } from '../services/gameService'
import type { User as UserType, GameMode, GameConfig, Friend, GameRoom } from '../types'

interface Props {
  user: UserType
  onJoin: (config: GameConfig) => void
  onBack: () => void
  isOnline: boolean
}

export function Lobby({ user, onJoin, onBack, isOnline }: Props) {
  const [mode, setMode] = useState<GameMode | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [selectedFriends, setSelectedFriends] = useState<string[]>([])
  const [openRooms, setOpenRooms] = useState<GameRoom[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [showArena, setShowArena] = useState(false)

  useEffect(() => {
    if (isOnline && showArena) {
      loadOpenRooms()
      const channel = subscribeToOpenRooms((rooms) => setOpenRooms(rooms))
      return () => { channel.unsubscribe() }
    }
  }, [isOnline, showArena])

  useEffect(() => {
    if (mode === 'friends' && isOnline) {
      loadFriends()
    }
  }, [mode])

  const loadOpenRooms = async () => {
    setLoadingRooms(true)
    const rooms = await getOpenRooms()
    setOpenRooms(rooms)
    setLoadingRooms(false)
  }

  const loadFriends = async () => {
    const f = await getFriends(user.id)
    setFriends(f)
  }

  const toggleFriend = (friendId: string) => {
    setSelectedFriends(prev => 
      prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]
    )
  }

  // Создать комнату
  const handleCreateRoom = async (roomMode: 'random' | 'friends') => {
    setLoading(true)
    const bet = BET_AMOUNTS[roomMode]
    
    if (user.balance < bet) {
      alert('Недостаточно токенов!')
      setLoading(false)
      return
    }

    const roomId = await createGameRoom(user.id, roomMode, bet, selectedFriends)
    if (roomId) {
      onJoin({ mode: roomMode, betAmount: bet, roomId, isHost: true })
    } else {
      alert('Ошибка создания комнаты')
    }
    setLoading(false)
  }

  // Присоединиться к комнате
  const handleJoinRoom = async (room: GameRoom) => {
    setLoading(true)
    const bet = room.bet_amount
    
    if (user.balance < bet) {
      alert('Недостаточно токенов!')
      setLoading(false)
      return
    }

    const success = await joinRoom(room.id, user.id)
    if (success) {
      onJoin({ mode: room.mode as GameMode, betAmount: bet, roomId: room.id, isHost: false })
    } else {
      alert('Не удалось присоединиться')
    }
    setLoading(false)
  }

  // Игра с ботами
  const handleBotGame = () => {
    onJoin({ mode: 'bot', betAmount: 0 })
  }

  // Арена битв - список комнат
  if (showArena) {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button onClick={() => setShowArena(false)} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Swords className="text-amber-400" /> Арена Битв
            </h1>
            <button onClick={loadOpenRooms} disabled={loadingRooms} className="ml-auto p-2 bg-slate-800 rounded-lg hover:bg-slate-700">
              <RefreshCw size={18} className={loadingRooms ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700 bg-gradient-to-r from-amber-600/20 to-orange-600/20">
              <p className="text-amber-200 text-sm text-center">
                Выберите комнату и сразитесь с другими игроками!
              </p>
            </div>

            {loadingRooms ? (
              <div className="p-8 text-center">
                <Loader2 className="animate-spin mx-auto mb-2" size={32} />
                <p className="text-slate-400">Загрузка комнат...</p>
              </div>
            ) : openRooms.length === 0 ? (
              <div className="p-8 text-center">
                <Swords size={48} className="mx-auto mb-4 text-slate-600" />
                <p className="text-slate-400 mb-2">Нет открытых комнат</p>
                <p className="text-slate-500 text-sm">Создайте свою или подождите</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700 max-h-96 overflow-y-auto">
                {openRooms.map(room => (
                  <div key={room.id} className="p-4 hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img 
                          src={room.host_avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default'} 
                          className="w-10 h-10 rounded-full border-2 border-amber-500/50" 
                        />
                        <div>
                          <p className="font-semibold">{room.host_username || 'Игрок'}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <User size={12} />
                            <span>{room.player_count || 1} / 10</span>
                            <Clock size={12} className="ml-2" />
                            <span>{getTimeAgo(room.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-amber-400 font-bold">{room.bet_amount} TKN</p>
                        <button 
                          onClick={() => handleJoinRoom(room)}
                          disabled={loading || user.balance < room.bet_amount}
                          className="mt-1 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 rounded-lg text-sm font-medium"
                        >
                          Войти
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 border-t border-slate-700">
              <button 
                onClick={() => handleCreateRoom('random')}
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <Plus size={20} /> Создать комнату ({BET_AMOUNTS.random} TKN)
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Главное меню лобби
  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold">Выбор режима</h1>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-6 p-3 bg-slate-900 rounded-lg">
            <span className="text-slate-400">Ваш баланс:</span>
            <span className="font-bold text-amber-400 flex items-center gap-1">
              <Coins size={16} /> {user.balance} TKN
            </span>
          </div>

          <div className="space-y-3">
            {/* Тренировка с ботами */}
            <button 
              onClick={handleBotGame}
              className="w-full p-4 rounded-xl border-2 border-slate-700 bg-slate-800 hover:border-emerald-500 hover:bg-emerald-500/10 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <Bot size={24} className="text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold">Тренировка</h3>
                  <p className="text-sm text-slate-400">Игра с ботами без ставки</p>
                </div>
                <span className="text-emerald-400 font-bold">Бесплатно</span>
              </div>
            </button>

            {/* Арена битв */}
            <button 
              onClick={() => isOnline && setShowArena(true)}
              disabled={!isOnline}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                isOnline 
                  ? 'border-slate-700 bg-slate-800 hover:border-amber-500 hover:bg-amber-500/10' 
                  : 'border-slate-700 bg-slate-800 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <Swords size={24} className="text-amber-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold">Арена Битв</h3>
                  <p className="text-sm text-slate-400">Найди комнату или создай свою</p>
                </div>
                <span className="text-amber-400 font-bold">{BET_AMOUNTS.random} TKN</span>
              </div>
            </button>

            {/* Игра с друзьями */}
            <button 
              onClick={() => isOnline && setMode('friends')}
              disabled={!isOnline}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                isOnline 
                  ? mode === 'friends' 
                    ? 'border-purple-500 bg-purple-500/10' 
                    : 'border-slate-700 bg-slate-800 hover:border-purple-500 hover:bg-purple-500/10'
                  : 'border-slate-700 bg-slate-800 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Users size={24} className="text-purple-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold">С друзьями</h3>
                  <p className="text-sm text-slate-400">Пригласите друзей в игру</p>
                </div>
                <span className="text-purple-400 font-bold">{BET_AMOUNTS.friends} TKN</span>
              </div>
            </button>
          </div>

          {/* Выбор друзей */}
          {mode === 'friends' && isOnline && (
            <div className="mt-6 pt-6 border-t border-slate-700">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <Users size={18} /> Выберите друзей для приглашения
              </h3>
              
              {friends.length === 0 ? (
                <div className="p-4 text-center text-slate-400 bg-slate-900 rounded-lg">
                  <p>У вас пока нет друзей</p>
                  <p className="text-sm mt-1">Добавьте друзей в разделе "Друзья"</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
                  {friends.map(f => (
                    <button 
                      key={f.friend_id} 
                      onClick={() => toggleFriend(f.friend_id)}
                      className={`w-full p-3 rounded-lg flex items-center gap-3 transition-all ${
                        selectedFriends.includes(f.friend_id) 
                          ? 'bg-purple-600/20 border border-purple-500' 
                          : 'bg-slate-900 hover:bg-slate-700'
                      }`}
                    >
                      <img 
                        src={f.friend_avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default'} 
                        className="w-10 h-10 rounded-full" 
                      />
                      <span className="flex-1 text-left">{f.friend_username}</span>
                      {selectedFriends.includes(f.friend_id) && (
                        <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                          <span className="text-xs">✓</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <button 
                onClick={() => handleCreateRoom('friends')}
                disabled={loading || selectedFriends.length === 0}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-slate-700 disabled:to-slate-700 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" /> : <Play size={20} />}
                Создать комнату {selectedFriends.length > 0 && `(${selectedFriends.length})`}
              </button>
            </div>
          )}

          {!isOnline && (
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-center">
              <p className="text-amber-200 text-sm">
                Для онлайн игры необходимо войти в аккаунт
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getTimeAgo(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин`
  return `${Math.floor(diff / 3600)} ч`
}
