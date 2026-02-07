import { useState } from 'react'
import { X, Check, Gamepad2, Loader2 } from 'lucide-react'
import { respondToInvite, joinRoom, deductTokens, BET_AMOUNTS } from '../services/gameService'
import type { GameInvite, User } from '../types'

interface Props {
  invite: GameInvite
  user: User
  onAccept: (roomId: string) => void
  onDecline: () => void
}

export function GameInviteModal({ invite, user, onAccept, onDecline }: Props) {
  const [loading, setLoading] = useState(false)
  
  const bet = BET_AMOUNTS.friends

  const handleAccept = async () => {
    setLoading(true)
    
    if (user.balance < bet) {
      alert('Недостаточно токенов!')
      setLoading(false)
      return
    }
    
    const success = await deductTokens(user.id, bet)
    if (!success) {
      alert('Ошибка списания токенов!')
      setLoading(false)
      return
    }
    
    await respondToInvite(invite.id, true)
    await joinRoom(invite.room_id, user.id)
    
    onAccept(invite.room_id)
    setLoading(false)
  }

  const handleDecline = async () => {
    setLoading(true)
    await respondToInvite(invite.id, false)
    onDecline()
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full border border-slate-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-indigo-500/20 rounded-full">
            <Gamepad2 className="text-indigo-400" size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold">Приглашение в игру</h3>
            <p className="text-slate-400 text-sm">от {invite.from_username}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4 p-3 bg-slate-900 rounded-lg">
          <img src={invite.from_avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default'} className="w-12 h-12 rounded-full" />
          <div>
            <p className="font-medium">{invite.from_username}</p>
            <p className="text-sm text-slate-400">приглашает вас сыграть!</p>
          </div>
        </div>

        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-4">
          <p className="text-amber-200 text-sm">Для участия спишется <span className="font-bold">{bet} TKN</span></p>
          <p className="text-xs text-amber-300/70 mt-1">Ваш баланс: {user.balance} TKN</p>
        </div>

        <div className="flex gap-3">
          <button onClick={handleDecline} disabled={loading} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg flex items-center justify-center gap-2">
            <X size={18} /> Отклонить
          </button>
          <button onClick={handleAccept} disabled={loading || user.balance < bet} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 rounded-lg flex items-center justify-center gap-2">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            Принять
          </button>
        </div>
      </div>
    </div>
  )
}
