import { useState, useEffect } from 'react'
import { ArrowLeft, Bot, Globe, Users, Coins, Play, Loader2, Check, UserPlus } from 'lucide-react'
import { BET_AMOUNTS, getFriends, findOrCreateRoom, createGameRoom, sendGameInvite, deductTokens } from '../services/gameService'
import type { User, GameMode, GameConfig, Friend } from '../types'

interface Props {
  user: User
  onJoin: (config: GameConfig) => void
  onBack: () => void
  isOnline: boolean
}

export function Lobby({ user, onJoin, onBack, isOnline }: Props) {
  const [mode, setMode] = useState<GameMode | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [selectedFriends, setSelectedFriends] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingFriends, setLoadingFriends] = useState(false)

  useEffect(() => {
    if (mode === 'friends' && isOnline) {
      loadFriends()
    }
  }, [mode])

  const loadFriends = async () => {
    setLoadingFriends(true)
    const f = await getFriends(user.id)
    setFriends(f)
    setLoadingFriends(false)
  }

  const toggleFriend = (friendId: string) => {
    setSelectedFriends(prev => 
      prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]
    )
  }

  const handleStartGame = async () => {
    if (!mode) return
    setLoading(true)

    const bet = BET_AMOUNTS[mode]

    // Режим с ботами - сразу начинаем
    if (mode === 'bot') {
      onJoin({ mode, betAmount: bet })
      return
    }

    // Случайные игроки - ищем или создаём комнату
    if (mode === 'random') {
      // Сначала списываем токены
      if (bet > 0 && isOnline) {
        const success = await deductTokens(user.id, bet)
        if (!success) {
          alert('Недостаточно токенов!')
          setLoading(false)
          return
        }
      }

      const roomId = await findOrCreateRoom(user.id, mode, bet)
      if (roomId) {
        onJoin({ mode, betAmount: bet, roomId })
      } else {
        alert('Ошибка создания комнаты')
      }
      setLoading(false)
      return
    }

    // Игра с друзьями - создаём комнату и отправляем приглашения
    if (mode === 'friends') {
      if (selectedFriends.length === 0) {
        alert('Выберите хотя бы одного друга')
        setLoading(false)
        return
      }

      const roomId = await createGameRoom(user.id, mode, bet)
      if (!roomId) {
        alert('Ошибка создания комнаты')
        setLoading(false)
        return
      }

      // Отправляем приглашения
      for (const friendId of selectedFriends) {
        await sendGameInvite(roomId, user.id, friendId)
      }

      onJoin({ mode, betAmount: bet, roomId })
      setLoading(false)
    }
  }

  const modes = [
    { id: 'bot' as GameMode, icon: Bot, title: 'С ботами', desc: 'Тренировка без ставки', cost: 0, color: 'emerald' },
    { id: 'random' as GameMode, icon: Globe, title: 'Случайные', desc: 'Онлайн с реальными игроками', cost: BET_AMOUNTS.random, color: 'blue', needsOnline: true },
    { id: 'friends' as GameMode, icon: Users, title: 'С друзьями', desc: 'Пригласите друзей', cost: BET_AMOUNTS.friends, color: 'purple', needsOnline: true },
  ]

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

          <div className="space-y-3 mb-6">
            {modes.map(m => {
              const disabled = m.needsOnline && !isOnline
              const selected = mode === m.id
              const canAfford = user.balance >= m.cost

              return (
                <button key={m.id} onClick={() => !disabled && setMode(m.id)} disabled={disabled}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    disabled ? 'opacity-50 cursor-not-allowed border-slate-700 bg-slate-800' :
                    selected ? `border-${m.color}-500 bg-${m.color}-500/10` : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${selected ? `bg-${m.color}-500/20` : 'bg-slate-700'}`}>
                      <m.icon size={24} className={selected ? `text-${m.color}-400` : 'text-slate-400'} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold">{m.title}</h3>
                      <p className="text-sm text-slate-400">{m.desc}</p>
                    </div>
                    <div className="text-right">
                      <span className={`font-bold ${canAfford ? 'text-amber-400' : 'text-rose-400'}`}>
                        {m.cost > 0 ? `${m.cost} TKN` : 'Бесплатно'}
                      </span>
                      {selected && <Check className="ml-2 inline text-emerald-400" size={18} />}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Выбор друзей */}
          {mode === 'friends' && isOnline && (
            <div className="mb-6">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <UserPlus size={18} /> Выберите друзей
              </h3>
              
              {loadingFriends ? (
                <div className="p-4 text-center"><Loader2 className="animate-spin mx-auto" /></div>
              ) : friends.length === 0 ? (
                <div className="p-4 text-center text-slate-400 bg-slate-900 rounded-lg">
                  У вас пока нет друзей
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {friends.map(f => (
                    <button key={f.friend_id} onClick={() => toggleFriend(f.friend_id)}
                      className={`w-full p-3 rounded-lg flex items-center gap-3 transition-all ${
                        selectedFriends.includes(f.friend_id) 
                          ? 'bg-indigo-600/20 border border-indigo-500' 
                          : 'bg-slate-900 hover:bg-slate-700'
                      }`}>
                      <img src={f.friend_avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default'} className="w-10 h-10 rounded-full" />
                      <span className="flex-1 text-left">{f.friend_username}</span>
                      {selectedFriends.includes(f.friend_id) && <Check size={18} className="text-emerald-400" />}
                    </button>
                  ))}
                </div>
              )}
              
              {selectedFriends.length > 0 && (
                <p className="mt-2 text-sm text-indigo-400">Выбрано: {selectedFriends.length}</p>
              )}
            </div>
          )}

          <button onClick={handleStartGame} disabled={!mode || loading || (mode !== 'bot' && user.balance < BET_AMOUNTS[mode])}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-700 rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
            {loading ? <Loader2 className="animate-spin" /> : <Play size={20} />}
            {mode === 'friends' && selectedFriends.length > 0 
              ? `Пригласить (${selectedFriends.length})`
              : mode === 'random'
                ? 'Найти игру'
                : 'Начать игру'
            }
          </button>
        </div>
      </div>
    </div>
  )
}
