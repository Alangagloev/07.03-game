import { useState, useEffect } from 'react'
import { Users, Loader2, Clock, ArrowLeft, CheckCircle, Play } from 'lucide-react'
import { getGameRoom, getRoomPlayers, subscribeToRoom, subscribeToRoomPlayers, updateRoomStatus } from '../services/gameService'
import { generateQuestions } from '../services/aiService'
import type { User, GameRoom, Question } from '../types'

interface Props {
  roomId: string
  user: User
  isHost: boolean
  onGameStart: (room: GameRoom, questions: Question[]) => void
  onCancel: () => void
}

const MIN_PLAYERS = 2
const COUNTDOWN_SECONDS = 10

export function WaitingRoom({ roomId, user, isHost, onGameStart, onCancel }: Props) {
  const [room, setRoom] = useState<GameRoom | null>(null)
  const [players, setPlayers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [generatingQuestions, setGeneratingQuestions] = useState(false)

  useEffect(() => {
    loadRoom()
    
    const roomChannel = subscribeToRoom(roomId, (updatedRoom) => {
      setRoom(updatedRoom)
      if (updatedRoom.status === 'playing' && updatedRoom.questions) {
        onGameStart(updatedRoom, updatedRoom.questions as Question[])
      }
    })

    const playersChannel = subscribeToRoomPlayers(roomId, () => {
      loadPlayers()
    })

    const interval = setInterval(loadPlayers, 2000)

    return () => {
      roomChannel.unsubscribe()
      playersChannel.unsubscribe()
      clearInterval(interval)
    }
  }, [roomId])

  useEffect(() => {
    if (players.length >= MIN_PLAYERS && countdown === null && !generatingQuestions && isHost) {
      startCountdown()
    } else if (players.length < MIN_PLAYERS && countdown !== null) {
      setCountdown(null)
    }
  }, [players.length])

  useEffect(() => {
    if (countdown === null) return
    
    if (countdown === 0) {
      startGame()
      return
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1)
    }, 1000)

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

  const startCountdown = () => {
    setCountdown(COUNTDOWN_SECONDS)
  }

  const startGame = async () => {
    if (!isHost || generatingQuestions) return
    
    setGeneratingQuestions(true)
    const qs = await generateQuestions()
    await updateRoomStatus(roomId, 'playing', qs)
    onGameStart(room!, qs)
  }

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
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <button onClick={onCancel} className="flex items-center gap-2 text-slate-400 hover:text-white">
              <ArrowLeft size={20} /> Выйти
            </button>
            <div className="flex items-center gap-2 text-amber-400">
              <Clock size={18} className="animate-pulse" />
              <span className="text-sm">
                {countdown !== null ? `Старт через ${countdown}с` : 'Ожидание игроков...'}
              </span>
            </div>
          </div>

          <div className="p-6">
            <div className="text-center mb-6">
              <Users size={48} className="text-indigo-500 mx-auto mb-3" />
              <h2 className="text-xl font-bold">Комната ожидания</h2>
              <p className="text-slate-400 text-sm mt-1">
                {players.length < MIN_PLAYERS 
                  ? `Нужно минимум ${MIN_PLAYERS} игрока`
                  : generatingQuestions 
                    ? 'Генерация вопросов...'
                    : 'Игра скоро начнётся!'
                }
              </p>
            </div>

            {countdown !== null && (
              <div className="mb-6 text-center">
                <div className="text-6xl font-black text-indigo-400 animate-pulse">{countdown}</div>
                <p className="text-slate-400 text-sm">секунд до старта</p>
              </div>
            )}

            {generatingQuestions && (
              <div className="mb-6 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-center">
                <Loader2 size={24} className="animate-spin mx-auto mb-2 text-indigo-400" />
                <p className="text-indigo-300">Генерируем уникальные вопросы...</p>
              </div>
            )}

            <div className="bg-slate-900 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-400 text-sm">Игроки</span>
                <span className="text-indigo-400 font-bold">{players.length} / 10</span>
              </div>
              
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {players.map((p, index) => (
                  <div key={p.id} className={`flex items-center gap-3 p-2 rounded-lg ${p.id === user.id ? 'bg-indigo-600/20 border border-indigo-500/50' : 'bg-slate-800'}`}>
                    <span className="text-slate-500 w-5">{index + 1}.</span>
                    <img src={p.avatar_url} className="w-8 h-8 rounded-full" />
                    <span className="flex-1">{p.username}</span>
                    {p.id === user.id && <span className="text-xs text-indigo-400">(Вы)</span>}
                    <CheckCircle size={18} className="text-emerald-400" />
                  </div>
                ))}
                
                {players.length === 0 && (
                  <div className="text-center text-slate-500 py-4">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                    <p className="text-sm">Ожидаем игроков...</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Минимум игроков</span>
                <span>{players.length} / {MIN_PLAYERS}</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-500 ${players.length >= MIN_PLAYERS ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                  style={{ width: `${Math.min(100, (players.length / MIN_PLAYERS) * 100)}%` }} />
              </div>
            </div>

            {isHost && players.length >= MIN_PLAYERS && countdown === null && !generatingQuestions && (
              <button onClick={startCountdown}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-lg flex items-center justify-center gap-2 font-bold">
                <Play size={18} /> Начать игру
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
