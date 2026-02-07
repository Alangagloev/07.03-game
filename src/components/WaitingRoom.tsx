import { useState, useEffect } from 'react'
import { Users, Loader2, Clock, ArrowLeft, CheckCircle, Play, Crown, Copy, Check } from 'lucide-react'
import { getGameRoom, getRoomPlayers, subscribeToRoom, subscribeToRoomPlayers, updateRoomStatus, leaveRoom } from '../services/gameService'
import { generateQuestions } from '../services/aiService'
import type { User, GameRoom, Question } from '../types'

interface Props {
  roomId: string
  user: User
  isHost: boolean
  onGameStart: (questions: Question[], players: User[]) => void
  onCancel: () => void
}

const MIN_PLAYERS = 2

export function WaitingRoom({ roomId, user, isHost, onGameStart, onCancel }: Props) {
  const [room, setRoom] = useState<GameRoom | null>(null)
  const [players, setPlayers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadRoom()
    
    const roomChannel = subscribeToRoom(roomId, handleRoomUpdate)
    const playersChannel = subscribeToRoomPlayers(roomId, loadPlayers)
    const interval = setInterval(loadPlayers, 3000)

    return () => {
      roomChannel.unsubscribe()
      playersChannel.unsubscribe()
      clearInterval(interval)
    }
  }, [roomId])

  useEffect(() => {
    if (countdown === null) return
    if (countdown === 0) {
      handleStartGame()
      return
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const loadRoom = async () => {
    setLoading(true)
    const r = await getGameRoom(roomId)
    setRoom(r)
    await loadPlayers()
    setLoading(false)
  }

  const loadPlayers = async () => {
    const p = await getRoomPlayers(roomId)
    setPlayers(p)
  }

  const handleRoomUpdate = (updatedRoom: GameRoom) => {
    setRoom(updatedRoom)
    if (updatedRoom.status === 'playing' && updatedRoom.questions) {
      onGameStart(updatedRoom.questions as Question[], players)
    }
  }

  const handleStartGame = async () => {
    if (!isHost || starting) return
    setStarting(true)
    
    const questions = await generateQuestions()
    await updateRoomStatus(roomId, 'playing', questions)
    onGameStart(questions, players)
  }

  const handleLeave = async () => {
    await leaveRoom(roomId, user.id)
    onCancel()
  }

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const canStart = players.length >= MIN_PLAYERS

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Loader2 size={48} className="animate-spin text-indigo-500 mb-4" />
        <p className="text-xl">Подключение к комнате...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
          {/* Заголовок */}
          <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-gradient-to-r from-indigo-600/20 to-purple-600/20">
            <button onClick={handleLeave} className="flex items-center gap-2 text-slate-400 hover:text-white">
              <ArrowLeft size={20} /> Выйти
            </button>
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-amber-400" />
              <span className="text-sm text-amber-200">
                {countdown !== null ? `Старт через ${countdown}с` : 'Ожидание игроков'}
              </span>
            </div>
          </div>

          <div className="p-6">
            {/* Иконка и заголовок */}
            <div className="text-center mb-6">
              <div className="relative inline-block">
                <Users size={56} className="text-indigo-500 mx-auto" />
                {canStart && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center animate-pulse">
                    <Check size={12} />
                  </div>
                )}
              </div>
              <h2 className="text-xl font-bold mt-3">Комната ожидания</h2>
              <p className="text-slate-400 text-sm mt-1">
                {!canStart 
                  ? `Ожидаем ещё ${MIN_PLAYERS - players.length} игрока` 
                  : starting 
                    ? 'Генерация вопросов...'
                    : 'Готовы к игре!'
                }
              </p>
            </div>

            {/* Код комнаты */}
            <div className="mb-4 p-3 bg-slate-900 rounded-lg">
              <p className="text-xs text-slate-400 mb-1">Код комнаты (для друзей):</p>
              <button 
                onClick={copyRoomId}
                className="w-full flex items-center justify-between p-2 bg-slate-800 rounded border border-slate-600 hover:border-indigo-500 transition-colors"
              >
                <code className="text-indigo-400 text-sm truncate">{roomId}</code>
                {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} className="text-slate-400" />}
              </button>
            </div>

            {/* Обратный отсчёт */}
            {countdown !== null && (
              <div className="mb-6 text-center">
                <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 animate-pulse">
                  {countdown}
                </div>
              </div>
            )}

            {/* Генерация вопросов */}
            {starting && (
              <div className="mb-6 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-center">
                <Loader2 size={28} className="animate-spin mx-auto mb-2 text-indigo-400" />
                <p className="text-indigo-300 font-medium">Генерируем уникальные вопросы...</p>
              </div>
            )}

            {/* Список игроков */}
            <div className="bg-slate-900 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-400 text-sm font-medium">Игроки в комнате</span>
                <span className={`font-bold ${canStart ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {players.length} / 10
                </span>
              </div>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {players.map((p, index) => (
                  <div 
                    key={p.id} 
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                      p.id === user.id 
                        ? 'bg-indigo-600/20 border border-indigo-500/50' 
                        : 'bg-slate-800'
                    }`}
                  >
                    <span className="text-slate-500 w-6 text-center font-bold">{index + 1}</span>
                    <img src={p.avatar_url} className="w-10 h-10 rounded-full border-2 border-slate-600" />
                    <div className="flex-1">
                      <p className="font-medium flex items-center gap-2">
                        {p.username}
                        {p.id === room?.host_id && <Crown size={14} className="text-amber-400" />}
                      </p>
                      {p.id === user.id && <span className="text-xs text-indigo-400">Вы</span>}
                    </div>
                    <CheckCircle size={20} className="text-emerald-400" />
                  </div>
                ))}
                
                {players.length < MIN_PLAYERS && (
                  <div className="p-4 border-2 border-dashed border-slate-700 rounded-lg text-center">
                    <Loader2 size={20} className="animate-spin mx-auto mb-2 text-slate-500" />
                    <p className="text-slate-500 text-sm">Ожидаем игроков...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Прогресс минимума */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Минимум для старта</span>
                <span>{Math.min(players.length, MIN_PLAYERS)} / {MIN_PLAYERS}</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${canStart ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                  style={{ width: `${Math.min(100, (players.length / MIN_PLAYERS) * 100)}%` }}
                />
              </div>
            </div>

            {/* Кнопка старта для хоста */}
            {isHost && canStart && countdown === null && !starting && (
              <button 
                onClick={() => setCountdown(5)}
                className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl flex items-center justify-center gap-2 font-bold text-lg shadow-lg shadow-emerald-500/20"
              >
                <Play size={22} /> Начать игру!
              </button>
            )}

            {/* Информация */}
            <div className="mt-4 p-3 bg-slate-900/50 rounded-lg text-center text-sm text-slate-400">
              {isHost 
                ? canStart 
                  ? '✨ Все готовы! Нажмите "Начать игру"' 
                  : '👑 Вы создатель комнаты'
                : '⏳ Ожидаем пока хост начнёт игру'
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
