import { useState, useEffect } from 'react'
import { Users, Loader2, Clock, ArrowLeft, Play, UserPlus } from 'lucide-react'
import { findOrCreateRoom, getRoomPlayers, subscribeToRoom, subscribeToRoomPlayers, leaveRoom, startGame } from '../services/gameService'
import { generateQuestions } from '../services/aiService'
import type { User, GameRoom, GameConfig } from '../types'
import { GAME_CONSTANTS } from '../types'

interface Props {
  user: User
  mode: 'random' | 'friends'
  betAmount: number
  onGameStart: (config: GameConfig, questions: any[], players: User[]) => void
  onCancel: () => void
}

export function MatchmakingLobby({ user, mode, betAmount, onGameStart, onCancel }: Props) {
  const [status, setStatus] = useState<'searching' | 'waiting' | 'ready' | 'starting'>('searching')
  const [room, setRoom] = useState<GameRoom | null>(null)
  const [players, setPlayers] = useState<User[]>([])
  const [countdown, setCountdown] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    let roomChannel: any = null
    let playersChannel: any = null

    const init = async () => {
      try {
        // Ищем или создаём комнату
        const foundRoom = await findOrCreateRoom(user.id, mode, betAmount)
        
        if (!mounted || !foundRoom) {
          setError('Не удалось найти или создать комнату')
          return
        }
        
        setRoom(foundRoom)
        setStatus('waiting')
        
        // Загружаем текущих игроков
        const currentPlayers = await getRoomPlayers(foundRoom.id)
        setPlayers(currentPlayers)
        
        // Подписываемся на изменения комнаты
        roomChannel = subscribeToRoom(foundRoom.id, (updatedRoom) => {
          setRoom(updatedRoom)
          
          if (updatedRoom.status === 'playing' && updatedRoom.questions) {
            // Игра началась!
            onGameStart(
              { mode, betAmount, roomId: updatedRoom.id },
              updatedRoom.questions,
              players
            )
          }
        })
        
        // Подписываемся на игроков
        playersChannel = subscribeToRoomPlayers(foundRoom.id, (updatedPlayers) => {
          setPlayers(updatedPlayers)
          
          // Проверяем достаточно ли игроков для старта
          if (updatedPlayers.length >= 2) {
            setStatus('ready')
          }
        })
        
      } catch (err) {
        setError('Ошибка подключения')
      }
    }

    init()

    return () => {
      mounted = false
      if (roomChannel) roomChannel.unsubscribe()
      if (playersChannel) playersChannel.unsubscribe()
    }
  }, [user.id, mode, betAmount])

  // Автостарт когда есть 2+ игрока и прошло время ожидания
  useEffect(() => {
    if (status !== 'ready' || players.length < 2) return
    
    // Запускаем обратный отсчёт
    setCountdown(10)
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer)
          handleStartGame()
          return null
        }
        return prev - 1
      })
    }, 1000)
    
    return () => clearInterval(timer)
  }, [status, players.length])

  const handleStartGame = async () => {
    if (!room || status === 'starting') return
    
    setStatus('starting')
    
    // Генерируем вопросы (хост генерирует)
    if (room.host_id === user.id) {
      const questions = await generateQuestions(room.id)
      await startGame(room.id, questions)
    }
  }

  const handleCancel = async () => {
    if (room) {
      await leaveRoom(room.id, user.id)
    }
    onCancel()
  }

  const handleForceStart = async () => {
    if (players.length >= 2) {
      setCountdown(3)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <button onClick={handleCancel} className="flex items-center gap-2 text-slate-400 hover:text-white">
              <ArrowLeft size={20} /> Отмена
            </button>
            <div className="text-amber-400 text-sm">
              {mode === 'random' ? 'Случайная игра' : 'Игра с друзьями'}
            </div>
          </div>

          <div className="p-6">
            {/* Статус */}
            <div className="text-center mb-6">
              {status === 'searching' && (
                <>
                  <Loader2 size={48} className="animate-spin text-indigo-500 mx-auto mb-3" />
                  <h2 className="text-xl font-bold">Поиск комнаты...</h2>
                </>
              )}
              
              {status === 'waiting' && (
                <>
                  <div className="relative mx-auto w-20 h-20 mb-3">
                    <Users size={48} className="text-indigo-500 absolute inset-0 m-auto" />
                    <div className="absolute inset-0 border-4 border-indigo-500/30 rounded-full animate-ping" />
                  </div>
                  <h2 className="text-xl font-bold">Ожидание игроков...</h2>
                  <p className="text-slate-400 text-sm mt-1">Минимум 2 игрока для старта</p>
                </>
              )}
              
              {status === 'ready' && (
                <>
                  <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Play size={32} className="text-emerald-400" />
                  </div>
                  <h2 className="text-xl font-bold text-emerald-400">Готово к игре!</h2>
                  {countdown !== null && (
                    <p className="text-2xl font-bold text-amber-400 mt-2">
                      Старт через {countdown}...
                    </p>
                  )}
                </>
              )}
              
              {status === 'starting' && (
                <>
                  <Loader2 size={48} className="animate-spin text-emerald-500 mx-auto mb-3" />
                  <h2 className="text-xl font-bold">Запуск игры...</h2>
                  <p className="text-slate-400 text-sm mt-1">Генерация вопросов</p>
                </>
              )}
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-400 text-center">
                {error}
              </div>
            )}

            {/* Список игроков */}
            <div className="bg-slate-900 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-400 text-sm flex items-center gap-2">
                  <Users size={16} /> Игроки в комнате
                </span>
                <span className="text-indigo-400 font-bold">
                  {players.length} / {GAME_CONSTANTS.MAX_PLAYERS}
                </span>
              </div>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {players.map((p, i) => (
                  <div 
                    key={p.id} 
                    className={`flex items-center gap-3 p-2 rounded-lg ${p.id === user.id ? 'bg-indigo-600/20 border border-indigo-500/30' : 'bg-slate-800'}`}
                  >
                    <span className="w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </span>
                    <img src={p.avatar_url} className="w-8 h-8 rounded-full" />
                    <span className="flex-1 truncate">
                      {p.username}
                      {p.id === user.id && <span className="text-indigo-400 ml-1">(вы)</span>}
                    </span>
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" title="Онлайн" />
                  </div>
                ))}
                
                {players.length < 2 && (
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50 border border-dashed border-slate-700">
                    <div className="w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center">
                      <UserPlus size={12} className="text-slate-500" />
                    </div>
                    <span className="text-slate-500 text-sm">Ожидаем игроков...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Кнопка быстрого старта (только если >= 2 игроков и это хост) */}
            {status === 'ready' && players.length >= 2 && room?.host_id === user.id && countdown === null && (
              <button 
                onClick={handleForceStart}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2"
              >
                <Play size={20} /> Начать сейчас
              </button>
            )}
            
            {/* Информация */}
            <div className="mt-4 p-3 bg-slate-900/50 rounded-lg text-center text-sm text-slate-400">
              <Clock size={14} className="inline mr-1" />
              Игра начнётся автоматически когда соберётся минимум 2 игрока
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
