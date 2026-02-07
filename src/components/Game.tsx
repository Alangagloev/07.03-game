import { useState, useEffect, useRef } from 'react'
import { Clock, CheckCircle, XCircle, Award, Users, Loader2, Crown, Home, RefreshCw, Flag, AlertTriangle } from 'lucide-react'
import { generateQuestions } from '../services/aiService'
import { generateBots, simulateBotAnswer, BET_AMOUNTS } from '../services/gameService'
import { GAME_CONSTANTS } from '../types'
import type { User, Question, Player, GameConfig } from '../types'

interface Props { 
  user: User
  config: GameConfig
  onEnd: (won: boolean, correct: number, wrong: number, total: number, surrendered: boolean) => void
  preloadedQuestions?: Question[] | null
  onlinePlayers?: User[]
}

type Phase = 'loading' | 'waiting' | 'playing' | 'result' | 'finished'

const TOTAL = GAME_CONSTANTS.TOTAL_QUESTIONS
const TIME = GAME_CONSTANTS.TIME_PER_QUESTION

export function Game({ user, config, onEnd, preloadedQuestions, onlinePlayers }: Props) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [timeLeft, setTimeLeft] = useState<number>(TIME)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
  // ВАЖНО: displayScores хранит ПРЕДЫДУЩИЕ результаты для отображения
  const [displayScores, setDisplayScores] = useState<{[id: string]: {correct: number, wrong: number}}>({})
  const [error, setError] = useState('')
  const [showSurrenderModal, setShowSurrenderModal] = useState(false)
  
  const timerRef = useRef<number | null>(null)
  const botTimersRef = useRef<number[]>([])
  const gameEndedRef = useRef(false)
  const transitionRef = useRef(false)

  const question = questions[currentIdx]

  const clearAllTimers = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    botTimersRef.current.forEach(t => clearTimeout(t))
    botTimersRef.current = []
  }

  // Загрузка игры
  useEffect(() => {
    let mounted = true
    
    const load = async () => {
      if (!mounted) return
      setPhase('loading')
      setError('')
      gameEndedRef.current = false
      transitionRef.current = false
      
      try {
        // Используем предзагруженные вопросы или генерируем новые
        const qs = preloadedQuestions && preloadedQuestions.length > 0 
          ? preloadedQuestions 
          : await generateQuestions()
        if (!mounted) return
        
        setQuestions(qs)
        
        const me: Player = {
          id: user.id, username: user.username, avatar_url: user.avatar_url,
          correctAnswers: 0, wrongAnswers: 0, currentAnswer: null, hasAnswered: false,
          isBot: false, isMe: true, hasSurrendered: false, isConnected: true
        }
        
        let initialPlayers: Player[]
        if (config.mode === 'bot') {
          // Режим с ботами
          const bots = generateBots(5 + Math.floor(Math.random() * 5))
          initialPlayers = [me, ...bots]
        } else if (onlinePlayers && onlinePlayers.length > 0) {
          // Онлайн режим - используем реальных игроков
          initialPlayers = onlinePlayers.map(p => ({
            id: p.id,
            username: p.username,
            avatar_url: p.avatar_url,
            correctAnswers: 0,
            wrongAnswers: 0,
            currentAnswer: null,
            hasAnswered: false,
            isBot: false,
            isMe: p.id === user.id,
            hasSurrendered: false,
            isConnected: true
          }))
        } else {
          initialPlayers = [me]
        }
        
        setPlayers(initialPlayers)
        
        // Инициализируем displayScores нулями
        const initialScores: {[id: string]: {correct: number, wrong: number}} = {}
        initialPlayers.forEach(p => {
          initialScores[p.id] = { correct: 0, wrong: 0 }
        })
        setDisplayScores(initialScores)
        
        setCurrentIdx(0)
        setPhase('waiting')
        
        setTimeout(() => {
          if (!mounted) return
          setPhase('playing')
          setTimeLeft(TIME)
        }, 2000)
      } catch (err: any) {
        if (mounted) setError(err.message || 'Ошибка загрузки')
      }
    }
    
    load()
    return () => { mounted = false; clearAllTimers() }
  }, [])

  // Таймер
  useEffect(() => {
    if (phase !== 'playing' || transitionRef.current) return
    
    clearAllTimers()
    
    timerRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearAllTimers()
          processAnswer()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    return () => clearAllTimers()
  }, [phase, currentIdx])

  // Боты отвечают (скрыто)
  useEffect(() => {
    if (phase !== 'playing' || !question || config.mode !== 'bot' || transitionRef.current) return
    
    botTimersRef.current.forEach(t => clearTimeout(t))
    botTimersRef.current = []
    
    players.forEach(player => {
      if (!player.isBot || player.hasSurrendered || player.hasAnswered) return
      
      const { correct, delay } = simulateBotAnswer(currentIdx + 1)
      
      const timer = window.setTimeout(() => {
        setPlayers(prev => prev.map(p => {
          if (p.id !== player.id || p.hasAnswered) return p
          return {
            ...p,
            hasAnswered: true,
            correctAnswers: correct ? p.correctAnswers + 1 : p.correctAnswers,
            wrongAnswers: correct ? p.wrongAnswers : p.wrongAnswers + 1
          }
        }))
      }, delay)
      
      botTimersRef.current.push(timer)
    })
  }, [phase, currentIdx, question?.id])

  const processAnswer = () => {
    if (transitionRef.current) return
    transitionRef.current = true
    
    clearAllTimers()
    
    // Обновляем реальные данные
    setPlayers(prev => prev.map(p => {
      if (p.isMe && !p.hasAnswered) {
        return { ...p, hasAnswered: true, wrongAnswers: p.wrongAnswers + 1 }
      }
      if (p.isBot && !p.hasAnswered) {
        return { ...p, hasAnswered: true, wrongAnswers: p.wrongAnswers + 1 }
      }
      return p
    }))
    
    setShowCorrectAnswer(true)
    setPhase('result')
    
    setTimeout(() => goToNextQuestion(), 2000)
  }

  const goToNextQuestion = () => {
    const nextIdx = currentIdx + 1
    
    // КЛЮЧЕВОЙ МОМЕНТ: Обновляем displayScores ТОЛЬКО при переходе к следующему вопросу
    // Это данные ПОСЛЕ завершения раунда, которые увидят игроки
    setDisplayScores(() => {
      const newScores: {[id: string]: {correct: number, wrong: number}} = {}
      players.forEach(p => {
        newScores[p.id] = { correct: p.correctAnswers, wrong: p.wrongAnswers }
      })
      return newScores
    })
    
    if (nextIdx >= questions.length) {
      setPhase('finished')
      return
    }
    
    setCurrentIdx(nextIdx)
    setSelectedAnswer(null)
    setShowCorrectAnswer(false)
    setTimeLeft(TIME)
    setPlayers(prev => prev.map(p => ({ ...p, hasAnswered: false, currentAnswer: null })))
    
    transitionRef.current = false
    setPhase('playing')
  }

  const handleSelectAnswer = (answerIndex: number) => {
    if (selectedAnswer !== null || phase !== 'playing' || !question || transitionRef.current) return
    
    setSelectedAnswer(answerIndex)
    const isCorrect = answerIndex === question.correctIndex
    
    setPlayers(prev => prev.map(p => {
      if (!p.isMe) return p
      return {
        ...p,
        hasAnswered: true,
        currentAnswer: answerIndex,
        correctAnswers: isCorrect ? p.correctAnswers + 1 : p.correctAnswers,
        wrongAnswers: isCorrect ? p.wrongAnswers : p.wrongAnswers + 1
      }
    }))
  }

  const handleSurrender = () => {
    if (gameEndedRef.current) return
    gameEndedRef.current = true
    
    setShowSurrenderModal(false)
    clearAllTimers()
    
    const me = players.find(p => p.isMe)
    setTimeout(() => {
      onEnd(false, me?.correctAnswers || 0, me?.wrongAnswers || 0, players.length, true)
    }, 0)
  }

  // Для отображения используем displayScores (предыдущий раунд)
  const getDisplayedPlayers = () => {
    return players.map(p => ({
      ...p,
      displayCorrect: displayScores[p.id]?.correct || 0,
      displayWrong: displayScores[p.id]?.wrong || 0
    }))
  }

  const displayedPlayers = getDisplayedPlayers()
  const sortedForDisplay = [...displayedPlayers]
    .filter(p => !p.hasSurrendered)
    .sort((a, b) => {
      if (a.displayWrong !== b.displayWrong) return a.displayWrong - b.displayWrong
      return b.displayCorrect - a.displayCorrect
    })

  // Для финала используем реальные данные
  const sortedReal = [...players]
    .filter(p => !p.hasSurrendered)
    .sort((a, b) => {
      if (a.wrongAnswers !== b.wrongAnswers) return a.wrongAnswers - b.wrongAnswers
      return b.correctAnswers - a.correctAnswers
    })

  const myRankDisplay = sortedForDisplay.findIndex(p => p.isMe) + 1
  const me = players.find(p => p.isMe)

  const getDifficultyInfo = (num: number) => {
    if (num <= 5) return { label: 'Простой', color: 'text-emerald-400 bg-emerald-500/20' }
    if (num <= 15) return { label: 'Средний', color: 'text-amber-400 bg-amber-500/20' }
    if (num <= 25) return { label: 'Сложный', color: 'text-orange-400 bg-orange-500/20' }
    return { label: 'Эксперт', color: 'text-rose-400 bg-rose-500/20' }
  }

  // === РЕНДЕР ===

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        {error ? (
          <>
            <p className="text-rose-400 mb-4">{error}</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-indigo-600 rounded-lg flex items-center gap-2">
              <RefreshCw size={18} /> Повторить
            </button>
          </>
        ) : (
          <>
            <Loader2 size={48} className="animate-spin text-indigo-500 mb-4" />
            <p className="text-xl">Генерация {TOTAL} вопросов...</p>
          </>
        )}
      </div>
    )
  }

  if (phase === 'waiting') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Users size={48} className="text-indigo-500 mb-4" />
        <p className="text-xl mb-4">Игроки готовы!</p>
        <div className="flex flex-wrap justify-center gap-2 max-w-md">
          {players.map(p => (
            <div key={p.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${p.isMe ? 'bg-indigo-600/30 border border-indigo-500' : 'bg-slate-800'}`}>
              <img src={p.avatar_url} className="w-6 h-6 rounded-full" />
              <span className="text-sm">{p.username}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (phase === 'finished' && me) {
    const myRankFinal = sortedReal.findIndex(p => p.isMe) + 1
    const isWinner = myRankFinal === 1
    const bank = BET_AMOUNTS[config.mode] * players.length
    
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          {isWinner ? (
            <>
              <Award size={64} className="text-amber-400 mx-auto mb-4 animate-bounce" />
              <h2 className="text-3xl font-bold mb-2">ПОБЕДА!</h2>
            </>
          ) : (
            <>
              <div className="text-6xl font-bold text-slate-400 mb-2">#{myRankFinal}</div>
              <h2 className="text-xl text-slate-300">Место</h2>
            </>
          )}
          
          <div className="bg-slate-800 rounded-xl p-4 my-4 border border-slate-700 grid grid-cols-2 gap-4">
            <div>
              <p className="text-3xl font-bold text-emerald-400">{me.correctAnswers}</p>
              <p className="text-xs text-slate-400">Правильных</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-rose-400">{me.wrongAnswers}</p>
              <p className="text-xs text-slate-400">Ошибок</p>
            </div>
          </div>
          
          {config.mode !== 'bot' && (
            <p className={`text-2xl font-bold my-4 ${isWinner ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isWinner ? `+${bank}` : `-${BET_AMOUNTS[config.mode]}`} TKN
            </p>
          )}
          
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden my-4">
            <div className="p-2 border-b border-slate-700 text-slate-400 text-xs uppercase">Итоговая таблица</div>
            <div className="divide-y divide-slate-700 max-h-60 overflow-y-auto">
              {sortedReal.map((p, i) => (
                <div key={p.id} className={`flex items-center justify-between p-3 ${p.isMe ? 'bg-indigo-600/20' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-6 font-bold ${i === 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                      {i === 0 && <Crown size={14} className="inline" />}{i + 1}
                    </span>
                    <img src={p.avatar_url} className="w-6 h-6 rounded-full" />
                    <span className={p.isMe ? 'text-indigo-300 font-bold' : ''}>{p.username}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-emerald-400">{p.correctAnswers}✓</span>
                    {' '}
                    <span className="text-rose-400">{p.wrongAnswers}✗</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <button 
            onClick={() => onEnd(isWinner, me.correctAnswers, me.wrongAnswers, players.length, false)} 
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg flex items-center gap-2 mx-auto"
          >
            <Home size={18} /> В меню
          </button>
        </div>
      </div>
    )
  }

  if (!question) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Loader2 size={48} className="animate-spin text-indigo-500 mb-4" />
        <p>Загрузка...</p>
      </div>
    )
  }

  const diffInfo = getDifficultyInfo(currentIdx + 1)

  return (
    <div className="min-h-screen flex flex-col p-4 max-w-4xl mx-auto">
      {showSurrenderModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full border border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-amber-400" size={24} />
              <h3 className="text-lg font-bold">Сдаться?</h3>
            </div>
            <p className="text-slate-300 mb-4">Вы покинете игру. Токены останутся в банке.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowSurrenderModal(false)} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg">Отмена</button>
              <button onClick={handleSurrender} className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 rounded-lg">Сдаться</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-800 rounded-xl p-4 mb-4 border border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${diffInfo.color}`}>{diffInfo.label}</span>
            <span className="text-slate-400 text-sm">{question.category}</span>
          </div>
          <button onClick={() => setShowSurrenderModal(true)} className="px-3 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 rounded-lg text-sm flex items-center gap-1">
            <Flag size={14} /> Сдаться
          </button>
        </div>
        
        <div className="grid grid-cols-3 items-center">
          <div className="text-center">
            <p className="text-xs text-slate-400">Место</p>
            <p className="text-2xl font-bold">#{myRankDisplay || 1}</p>
          </div>
          <div className="text-center">
            <div className={`text-4xl font-black flex items-center justify-center gap-2 ${timeLeft <= 3 ? 'text-rose-500 animate-pulse' : ''}`}>
              <Clock size={28} /> {timeLeft}
            </div>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-400">Вопрос</p>
            <p className="text-2xl font-bold text-indigo-400">
              {currentIdx + 1}<span className="text-slate-500 text-lg">/{questions.length}</span>
            </p>
          </div>
        </div>
        
        <div className="mt-3 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all" style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }} />
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 flex-1">
        {/* Таблица игроков - показывает ПРЕДЫДУЩИЕ результаты */}
        <div className="md:w-56 bg-slate-800 rounded-xl p-3 border border-slate-700 h-fit">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700 text-slate-400 text-sm">
            <Users size={14} /> Игроки ({sortedForDisplay.length})
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {sortedForDisplay.slice(0, 8).map((p, i) => (
              <div key={p.id} className={`flex items-center justify-between p-2 rounded-lg text-sm ${p.isMe ? 'bg-indigo-600/20' : 'bg-slate-700/30'}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-4 font-bold ${i === 0 ? 'text-amber-400' : 'text-slate-500'}`}>{i + 1}</span>
                  <img src={p.avatar_url} className="w-5 h-5 rounded-full" />
                  <span className="truncate max-w-[60px]">{p.username}</span>
                </div>
                <div className="text-xs">
                  {/* Показываем displayCorrect/displayWrong - данные ПРЕДЫДУЩЕГО раунда */}
                  <span className="text-emerald-400">{p.displayCorrect}✓</span>
                  {' '}
                  <span className="text-rose-400">{p.displayWrong}✗</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="bg-slate-800 rounded-xl p-6 mb-4 border border-slate-700 flex-1 flex items-center justify-center min-h-[120px]">
            <h2 className="text-lg md:text-xl font-medium text-center leading-relaxed">{question.text}</h2>
          </div>
          
          <div className="grid gap-3">
            {question.options.map((option, i) => {
              let buttonClass = 'bg-slate-700 hover:bg-slate-600 border-slate-600'
              let icon = null
              
              if (showCorrectAnswer) {
                if (i === question.correctIndex) {
                  buttonClass = 'bg-emerald-600 border-emerald-500'
                  icon = <CheckCircle size={20} />
                } else if (selectedAnswer === i) {
                  buttonClass = 'bg-rose-600 border-rose-500'
                  icon = <XCircle size={20} />
                } else {
                  buttonClass = 'bg-slate-800 border-slate-700 opacity-50'
                }
              } else if (selectedAnswer === i) {
                buttonClass = 'bg-indigo-600 border-indigo-500 ring-2 ring-indigo-400'
              }
              
              return (
                <button 
                  key={i} 
                  onClick={() => handleSelectAnswer(i)} 
                  disabled={selectedAnswer !== null || phase !== 'playing'}
                  className={`p-4 rounded-xl border-2 text-left font-medium flex items-center justify-between transition ${buttonClass}`}
                >
                  <span>{option}</span>
                  {icon}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
