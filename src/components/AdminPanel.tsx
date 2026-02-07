import { useState, useEffect } from 'react'
import { ArrowLeft, Users, History, Loader2, Search, Edit2, Save, Shield, ShieldOff } from 'lucide-react'
import { getAllUsers, getAllGameHistory, updateUserBalance, setUserAdmin } from '../services/gameService'
import type { User, GameHistory } from '../types'

interface Props { user: User; onBack: () => void }

export function AdminPanel({ user, onBack }: Props) {
  const [tab, setTab] = useState<'users' | 'history'>('users')
  const [users, setUsers] = useState<User[]>([])
  const [history, setHistory] = useState<GameHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBalance, setEditBalance] = useState('')

  useEffect(() => { loadData() }, [tab])

  const loadData = async () => {
    setLoading(true)
    if (tab === 'users') {
      setUsers(await getAllUsers())
    } else {
      setHistory(await getAllGameHistory())
    }
    setLoading(false)
  }

  const handleSaveBalance = async (userId: string) => {
    const balance = parseInt(editBalance)
    if (!isNaN(balance) && balance >= 0) {
      await updateUserBalance(userId, balance)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, balance } : u))
    }
    setEditingId(null)
  }

  const handleToggleAdmin = async (userId: string, currentAdmin: boolean) => {
    await setUserAdmin(userId, !currentAdmin)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_admin: !currentAdmin } : u))
  }

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.player_id?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700"><ArrowLeft size={20} /></button>
          <h1 className="text-2xl font-bold">Админ-панель</h1>
        </div>

        <div className="flex mb-6 bg-slate-800 rounded-lg p-1">
          <button onClick={() => setTab('users')} className={`flex-1 py-2 rounded-md flex items-center justify-center gap-2 ${tab === 'users' ? 'bg-indigo-600' : 'text-slate-400'}`}>
            <Users size={18} /> Пользователи
          </button>
          <button onClick={() => setTab('history')} className={`flex-1 py-2 rounded-md flex items-center justify-center gap-2 ${tab === 'history' ? 'bg-indigo-600' : 'text-slate-400'}`}>
            <History size={18} /> История игр
          </button>
        </div>

        {tab === 'users' && (
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input type="text" placeholder="Поиск по имени или ID..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-10 pr-4 py-2" />
            </div>
          </div>
        )}

        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto" size={32} /></div>
          ) : tab === 'users' ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900">
                  <tr>
                    <th className="text-left p-3 text-slate-400 text-sm">Игрок</th>
                    <th className="text-center p-3 text-slate-400 text-sm">ID</th>
                    <th className="text-center p-3 text-slate-400 text-sm">Баланс</th>
                    <th className="text-center p-3 text-slate-400 text-sm">Игр</th>
                    <th className="text-center p-3 text-slate-400 text-sm">Побед</th>
                    <th className="text-center p-3 text-slate-400 text-sm">Админ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-slate-700/50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <img src={u.avatar_url} className="w-8 h-8 rounded-full" />
                          <span>{u.username}</span>
                        </div>
                      </td>
                      <td className="p-3 text-center text-slate-400 text-sm">{u.player_id}</td>
                      <td className="p-3 text-center">
                        {editingId === u.id ? (
                          <div className="flex items-center justify-center gap-1">
                            <input type="number" value={editBalance} onChange={e => setEditBalance(e.target.value)} className="w-20 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-center" />
                            <button onClick={() => handleSaveBalance(u.id)} className="p-1 bg-emerald-600 rounded"><Save size={14} /></button>
                          </div>
                        ) : (
                          <span onClick={() => { setEditingId(u.id); setEditBalance(u.balance.toString()) }} className="cursor-pointer hover:text-indigo-400">
                            {u.balance} <Edit2 size={12} className="inline" />
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">{u.total_games}</td>
                      <td className="p-3 text-center text-emerald-400">{u.total_wins}</td>
                      <td className="p-3 text-center">
                        <button onClick={() => handleToggleAdmin(u.id, !!u.is_admin)} className={`p-1 rounded ${u.is_admin ? 'bg-amber-600' : 'bg-slate-600'}`}>
                          {u.is_admin ? <Shield size={16} /> : <ShieldOff size={16} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="divide-y divide-slate-700 max-h-[500px] overflow-y-auto">
              {history.map(h => (
                <div key={h.id} className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{h.mode} • {h.result === 'win' ? '🏆 Победа' : h.result === 'surrender' ? '🏳️ Сдался' : '❌ Поражение'}</p>
                    <p className="text-sm text-slate-400">{new Date(h.played_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className={h.earnings >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{h.earnings >= 0 ? '+' : ''}{h.earnings} TKN</p>
                    <p className="text-sm text-slate-400">{h.correct_answers}✓ {h.wrong_answers}✗</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
