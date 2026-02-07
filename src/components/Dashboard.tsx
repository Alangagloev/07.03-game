import { Play, LogOut, Wallet, Trophy, Target, Gamepad2, User, Users, Shield, Bell } from 'lucide-react'
import type { User as UserType } from '../types'

interface Props { 
  user: UserType
  pendingFriendRequests: number
  pendingGameInvites: number
  onPlay: () => void
  onLogout: () => void
  onProfile: () => void
  onFriends: () => void
  onAdmin: () => void
  onViewInvites: () => void
}

export function Dashboard({ user, pendingFriendRequests, pendingGameInvites, onPlay, onLogout, onProfile, onFriends, onAdmin, onViewInvites }: Props) {
  const winRate = user.total_games > 0 ? Math.round((user.total_wins / user.total_games) * 100) : 0

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6">
            <div className="flex items-center gap-4">
              <img src={user.avatar_url} alt="" className="w-16 h-16 rounded-full border-4 border-white/20 object-cover" />
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white">{user.username}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs text-white">Уровень {user.level}</span>
                  {user.player_id && <span className="px-2 py-0.5 bg-white/10 rounded-full text-xs text-white/70">#{user.player_id}</span>}
                </div>
              </div>
              {/* Уведомления */}
              {pendingGameInvites > 0 && (
                <button onClick={onViewInvites} className="relative p-2 bg-white/20 rounded-full hover:bg-white/30">
                  <Bell size={20} />
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-rose-500 text-white text-xs rounded-full animate-pulse">
                    {pendingGameInvites}
                  </span>
                </button>
              )}
            </div>
          </div>
          
          <div className="p-6 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 rounded-xl"><Wallet size={24} className="text-emerald-400" /></div>
              <div>
                <p className="text-slate-400 text-sm">Баланс</p>
                <p className="text-3xl font-bold text-white">{user.balance} <span className="text-lg text-slate-400">TKN</span></p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 divide-x divide-slate-700 border-b border-slate-700">
            <div className="p-4 text-center"><Gamepad2 size={20} className="text-indigo-400 mx-auto mb-1" /><p className="text-xl font-bold">{user.total_games}</p><p className="text-xs text-slate-400">Игр</p></div>
            <div className="p-4 text-center"><Trophy size={20} className="text-amber-400 mx-auto mb-1" /><p className="text-xl font-bold">{user.total_wins}</p><p className="text-xs text-slate-400">Побед</p></div>
            <div className="p-4 text-center"><Target size={20} className="text-emerald-400 mx-auto mb-1" /><p className="text-xl font-bold">{winRate}%</p><p className="text-xs text-slate-400">Винрейт</p></div>
          </div>
          
          <div className="p-6 space-y-3">
            <button onClick={onPlay} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl flex items-center justify-center gap-2">
              <Play size={22} fill="currentColor" /> Играть
            </button>
            
            <div className="grid grid-cols-2 gap-3">
              <button onClick={onProfile} className="py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl flex items-center justify-center gap-2">
                <User size={18} /> Профиль
              </button>
              <button onClick={onFriends} className="py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl flex items-center justify-center gap-2 relative">
                <Users size={18} /> Друзья
                {pendingFriendRequests > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-rose-500 text-white text-xs rounded-full animate-pulse">
                    +{pendingFriendRequests}
                  </span>
                )}
              </button>
            </div>
            
            {user.is_admin && (
              <button onClick={onAdmin} className="w-full py-3 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 rounded-xl flex items-center justify-center gap-2 border border-rose-600/30">
                <Shield size={18} /> Админ-панель
              </button>
            )}
            
            <button onClick={onLogout} className="w-full py-3 bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 rounded-xl flex items-center justify-center gap-2">
              <LogOut size={18} /> Выйти
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
