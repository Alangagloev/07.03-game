import { useState } from 'react'
import { ArrowLeft, Trophy, Gamepad2, Target, TrendingUp, Edit2, Save, X, Camera, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { User } from '../types'

interface Props { 
  user: User
  isOnline: boolean
  onBack: () => void
  onUserUpdate: (user: User) => void
}

export function Profile({ user, isOnline, onBack, onUserUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [username, setUsername] = useState(user.username)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const winRate = user.total_games > 0 ? Math.round((user.total_wins / user.total_games) * 100) : 0

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Файл слишком большой (макс 5MB)')
        return
      }
      setAvatarFile(file)
      setAvatarPreview(URL.createObjectURL(file))
    }
  }

  const handleSave = async () => {
    if (!isOnline) return
    setSaving(true)

    try {
      let newAvatarUrl = user.avatar_url

      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop()
        const fileName = `${user.id}-${Date.now()}.${ext}`
        
        const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, avatarFile, { upsert: true })
        
        if (!uploadError) {
          const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
          newAvatarUrl = data.publicUrl
        }
      }

      const { error } = await supabase.from('profiles').update({ username, avatar_url: newAvatarUrl }).eq('id', user.id)

      if (!error) {
        onUserUpdate({ ...user, username, avatar_url: newAvatarUrl })
        setEditing(false)
        setAvatarFile(null)
        setAvatarPreview(null)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditing(false)
    setUsername(user.username)
    setAvatarFile(null)
    setAvatarPreview(null)
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700"><ArrowLeft size={20} /></button>
          <h1 className="text-2xl font-bold">Профиль</h1>
          {isOnline && !editing && (
            <button onClick={() => setEditing(true)} className="ml-auto p-2 bg-slate-800 rounded-lg hover:bg-slate-700">
              <Edit2 size={18} />
            </button>
          )}
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-center">
            <div className="relative inline-block">
              <img src={avatarPreview || user.avatar_url} className="w-24 h-24 rounded-full border-4 border-white/20 mx-auto object-cover" />
              {editing && (
                <label className="absolute bottom-0 right-0 p-2 bg-indigo-600 rounded-full cursor-pointer hover:bg-indigo-500">
                  <Camera size={16} />
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
              )}
            </div>

            {editing ? (
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="mt-4 bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-center text-white placeholder-white/50 focus:outline-none focus:border-white/50 w-full max-w-[200px]" placeholder="Имя пользователя" />
            ) : (
              <h2 className="text-2xl font-bold mt-4">{user.username}</h2>
            )}
            
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="px-3 py-1 bg-white/20 rounded-full text-sm">Уровень {user.level}</span>
              {user.player_id && <span className="px-3 py-1 bg-white/10 rounded-full text-sm text-white/70">#{user.player_id}</span>}
            </div>

            {editing && (
              <div className="flex justify-center gap-2 mt-4">
                <button onClick={handleCancel} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg flex items-center gap-2">
                  <X size={16} /> Отмена
                </button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-2">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Сохранить
                </button>
              </div>
            )}
          </div>

          <div className="p-6 grid grid-cols-2 gap-4">
            <div className="bg-slate-900 rounded-xl p-4 text-center">
              <Gamepad2 size={24} className="text-indigo-400 mx-auto mb-2" />
              <p className="text-2xl font-bold">{user.total_games}</p>
              <p className="text-sm text-slate-400">Всего игр</p>
            </div>
            <div className="bg-slate-900 rounded-xl p-4 text-center">
              <Trophy size={24} className="text-amber-400 mx-auto mb-2" />
              <p className="text-2xl font-bold">{user.total_wins}</p>
              <p className="text-sm text-slate-400">Побед</p>
            </div>
            <div className="bg-slate-900 rounded-xl p-4 text-center">
              <Target size={24} className="text-emerald-400 mx-auto mb-2" />
              <p className="text-2xl font-bold">{winRate}%</p>
              <p className="text-sm text-slate-400">Винрейт</p>
            </div>
            <div className="bg-slate-900 rounded-xl p-4 text-center">
              <TrendingUp size={24} className="text-purple-400 mx-auto mb-2" />
              <p className="text-2xl font-bold">{user.balance}</p>
              <p className="text-sm text-slate-400">Токенов</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
