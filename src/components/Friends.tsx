import { useState, useEffect } from 'react'
import { ArrowLeft, Search, UserPlus, Check, X, Users, Loader2, Trash2, Copy } from 'lucide-react'
import { searchUsers, getFriends, getPendingRequests, sendFriendRequest, acceptFriendRequest, rejectFriendRequest, removeFriend } from '../services/gameService'
import type { User, Friend } from '../types'

interface Props { 
  user: User
  isOnline: boolean
  onBack: () => void
}

export function Friends({ user, isOnline, onBack }: Props) {
  const [tab, setTab] = useState<'friends' | 'search' | 'requests'>('friends')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<User[]>([])
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<Friend[]>([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [msg, setMsg] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => { 
    if (isOnline) loadData() 
  }, [isOnline])

  const loadData = async () => {
    setLoading(true)
    const [f, r] = await Promise.all([getFriends(user.id), getPendingRequests(user.id)])
    setFriends(f)
    setRequests(r)
    setLoading(false)
  }

  const handleSearch = async () => {
    if (!query.trim()) return
    setSearching(true)
    const res = await searchUsers(query)
    const friendIds = friends.map(f => f.friend_id)
    setResults(res.filter(u => u.id !== user.id && !friendIds.includes(u.id)))
    setSearching(false)
  }

  const handleAdd = async (friendId: string) => {
    if (await sendFriendRequest(user.id, friendId)) {
      setMsg('Заявка отправлена!')
      setResults(r => r.filter(u => u.id !== friendId))
      setTimeout(() => setMsg(''), 3000)
    }
  }

  const handleAccept = async (requestId: string) => {
    if (await acceptFriendRequest(requestId)) {
      await loadData()
      setMsg('Друг добавлен!')
      setTimeout(() => setMsg(''), 3000)
    }
  }

  const handleReject = async (requestId: string) => {
    if (await rejectFriendRequest(requestId)) {
      setRequests(prev => prev.filter(r => r.id !== requestId))
    }
  }

  const handleRemoveFriend = async (friendshipId: string) => {
    if (confirm('Удалить из друзей?')) {
      if (await removeFriend(friendshipId)) {
        setFriends(prev => prev.filter(f => f.id !== friendshipId))
        setMsg('Друг удалён')
        setTimeout(() => setMsg(''), 3000)
      }
    }
  }

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (!isOnline) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <Users size={48} className="text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Недоступно в демо</h2>
          <p className="text-slate-400 mb-4">Зарегистрируйтесь для добавления друзей</p>
          <button onClick={onBack} className="px-4 py-2 bg-indigo-600 rounded-lg">Назад</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold">Друзья</h1>
        </div>

        {msg && (
          <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-400 text-center">
            {msg}
          </div>
        )}

        <div className="flex mb-6 bg-slate-800 rounded-lg p-1">
          <button onClick={() => setTab('friends')} className={`flex-1 py-2 rounded-md text-sm flex items-center justify-center gap-2 ${tab === 'friends' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>
            Друзья {friends.length > 0 && <span className="px-1.5 py-0.5 bg-white/20 rounded-full text-xs">{friends.length}</span>}
          </button>
          <button onClick={() => setTab('search')} className={`flex-1 py-2 rounded-md text-sm ${tab === 'search' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>
            Поиск
          </button>
          <button onClick={() => setTab('requests')} className={`flex-1 py-2 rounded-md text-sm flex items-center justify-center gap-2 ${tab === 'requests' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>
            Заявки {requests.length > 0 && <span className="px-1.5 py-0.5 bg-rose-500 text-white rounded-full text-xs animate-pulse">+{requests.length}</span>}
          </button>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          {tab === 'friends' && (
            loading ? (
              <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto" size={32} /></div>
            ) : friends.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Users size={48} className="mx-auto mb-4 opacity-50" />
                <p>У вас пока нет друзей</p>
                <p className="text-sm mt-2">Найдите друзей во вкладке "Поиск"</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {friends.map(f => (
                  <div key={f.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={f.friend_avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default'} className="w-12 h-12 rounded-full" />
                      <div>
                        <p className="font-semibold">{f.friend_username || 'Пользователь'}</p>
                        {f.friend_player_id && (
                          <button onClick={() => copyId(f.friend_player_id!)} className="text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1">
                            ID: {f.friend_player_id}
                            {copiedId === f.friend_player_id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          </button>
                        )}
                      </div>
                    </div>
                    <button onClick={() => handleRemoveFriend(f.id)} className="p-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 rounded-lg" title="Удалить из друзей">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'search' && (
            <div className="p-4">
              <div className="flex gap-2 mb-4">
                <input type="text" placeholder="Введите ник или ID игрока..." value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 focus:border-indigo-500 outline-none" />
                <button onClick={handleSearch} disabled={searching} className="px-4 bg-indigo-600 hover:bg-indigo-500 rounded-lg disabled:opacity-50">
                  {searching ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                </button>
              </div>
              
              {results.length > 0 ? (
                <div className="divide-y divide-slate-700">
                  {results.map(u => (
                    <div key={u.id} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img src={u.avatar_url} className="w-10 h-10 rounded-full" />
                        <div>
                          <p className="font-medium">{u.username}</p>
                          {u.player_id && <p className="text-xs text-slate-400">ID: {u.player_id}</p>}
                        </div>
                      </div>
                      <button onClick={() => handleAdd(u.id)} className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg">
                        <UserPlus size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-400 py-8">{query ? 'Ничего не найдено' : 'Введите ник или ID для поиска'}</p>
              )}
            </div>
          )}

          {tab === 'requests' && (
            requests.length === 0 ? (
              <div className="p-8 text-center text-slate-400"><p>Нет входящих заявок</p></div>
            ) : (
              <div className="divide-y divide-slate-700">
                {requests.map(r => (
                  <div key={r.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={r.friend_avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default'} className="w-10 h-10 rounded-full" />
                      <div>
                        <p className="font-medium">{r.friend_username || 'Пользователь'}</p>
                        <p className="text-xs text-slate-400">Хочет добавить вас в друзья</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleAccept(r.id)} className="p-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg" title="Принять">
                        <Check size={18} />
                      </button>
                      <button onClick={() => handleReject(r.id)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg" title="Отклонить">
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
