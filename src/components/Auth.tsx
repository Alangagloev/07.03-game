import { useState } from 'react'
import { Brain, Mail, Lock, User, Loader2, Play } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getProfile, createProfile, saveLocal } from '../services/gameService'
import { GAME_CONSTANTS } from '../types'
import type { User as UserType } from '../types'

interface Props { onLogin: (user: UserType, isOnline: boolean) => void }

export function Auth({ onLogin }: Props) {
  const [mode, setMode] = useState<'login' | 'register' | 'demo'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (mode === 'register') {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) throw signUpError
        if (data.user) {
          const profile = await createProfile(data.user.id, username || email.split('@')[0])
          if (profile) onLogin(profile, true)
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
        if (data.user) {
          const profile = await getProfile(data.user.id)
          if (profile) onLogin(profile, true)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка авторизации')
    } finally {
      setLoading(false)
    }
  }

  const handleDemo = () => {
    const demoUser: UserType = {
      id: 'demo-' + Date.now(),
      username: username || 'Игрок',
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username || 'demo'}`,
      balance: GAME_CONSTANTS.STARTING_BALANCE,
      total_wins: 0,
      total_games: 0,
      level: 1
    }
    saveLocal(demoUser)
    onLogin(demoUser, false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-4 shadow-lg">
            <Brain size={40} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Арена Умов</h1>
          <p className="text-slate-400 mt-2">Проверь свои знания!</p>
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
          <div className="flex mb-6 bg-slate-900 rounded-lg p-1">
            {(['login', 'register', 'demo'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError('') }} className={`flex-1 py-2 rounded-md text-sm font-medium transition ${mode === m ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                {m === 'login' ? 'Вход' : m === 'register' ? 'Регистрация' : 'Демо'}
              </button>
            ))}
          </div>

          {error && <div className="mb-4 p-3 bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-400 text-sm">{error}</div>}

          {mode === 'demo' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Ваше имя</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input type="text" placeholder="Введите имя" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-3 focus:border-indigo-500 outline-none" />
                </div>
              </div>
              <button onClick={handleDemo} className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-lg flex items-center justify-center gap-2">
                <Play size={18} /> Играть без регистрации
              </button>
              <p className="text-xs text-slate-500 text-center">Прогресс сохраняется только на этом устройстве</p>
            </div>
          ) : (
            <form onSubmit={handleAuth} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Имя пользователя</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input type="text" placeholder="Введите имя" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-3 focus:border-indigo-500 outline-none" required />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input type="email" placeholder="email@example.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-3 focus:border-indigo-500 outline-none" required />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Пароль</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-3 focus:border-indigo-500 outline-none" required minLength={6} />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2">
                {loading ? <Loader2 className="animate-spin" size={18} /> : null}
                {mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
