import { supabase } from '../lib/supabase'
import type { User, Player, GameHistory, Friend, GameInvite, GameRoom, Question } from '../types'
import { GAME_CONSTANTS } from '../types'

export const BET_AMOUNTS = { bot: 0, random: 10, friends: 5 }

// ============ ПРОФИЛИ ============

export const getProfile = async (userId: string): Promise<User | null> => {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return data
}

export const createProfile = async (userId: string, username: string): Promise<User | null> => {
  const playerId = Math.random().toString(36).substring(2, 8).toUpperCase()
  const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`
  const { data } = await supabase.from('profiles').insert({
    id: userId, username, avatar_url: avatar, balance: GAME_CONSTANTS.STARTING_BALANCE,
    total_wins: 0, total_games: 0, level: 1, player_id: playerId
  }).select().single()
  return data
}

export const updateStats = async (userId: string, won: boolean) => {
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (!profile) return
  await supabase.from('profiles').update({
    total_games: profile.total_games + 1,
    total_wins: profile.total_wins + (won ? 1 : 0),
    level: Math.floor((profile.total_games + 1) / 5) + 1
  }).eq('id', userId)
}

export const deductTokens = async (userId: string, amount: number): Promise<boolean> => {
  if (amount === 0) return true
  const { data: profile } = await supabase.from('profiles').select('balance').eq('id', userId).single()
  if (!profile || profile.balance < amount) return false
  const { error } = await supabase.from('profiles').update({ balance: profile.balance - amount }).eq('id', userId)
  return !error
}

export const updateBalance = async (userId: string, newBalance: number): Promise<boolean> => {
  const { error } = await supabase.from('profiles').update({ balance: newBalance }).eq('id', userId)
  return !error
}

// ============ ЛОКАЛЬНЫЙ РЕЖИМ ============

export const loadLocal = (): User | null => {
  const data = localStorage.getItem('quiz_user')
  return data ? JSON.parse(data) : null
}

export const saveLocal = (user: User) => localStorage.setItem('quiz_user', JSON.stringify(user))
export const clearLocal = () => localStorage.removeItem('quiz_user')

// ============ ИСТОРИЯ ИГР ============

export const saveGameHistory = async (history: Omit<GameHistory, 'id' | 'played_at'>) => {
  await supabase.from('game_history').insert(history)
}

// ============ ДРУЗЬЯ ============

export const searchUsers = async (query: string): Promise<User[]> => {
  const { data } = await supabase.from('profiles').select('*').or(`username.ilike.%${query}%,player_id.ilike.%${query}%`).limit(10)
  return data || []
}

export const getFriends = async (userId: string): Promise<Friend[]> => {
  const { data: friendships } = await supabase.from('friendships').select('*').eq('status', 'accepted').or(`user_id.eq.${userId},friend_id.eq.${userId}`)
  if (!friendships?.length) return []
  const friendIds = friendships.map(f => f.user_id === userId ? f.friend_id : f.user_id)
  const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url, player_id').in('id', friendIds)
  return friendships.map(f => {
    const friendId = f.user_id === userId ? f.friend_id : f.user_id
    const profile = profiles?.find(p => p.id === friendId)
    return { ...f, friend_id: friendId, friend_username: profile?.username, friend_avatar: profile?.avatar_url, friend_player_id: profile?.player_id }
  })
}

export const getPendingRequests = async (userId: string): Promise<Friend[]> => {
  const { data: requests } = await supabase.from('friendships').select('*').eq('friend_id', userId).eq('status', 'pending')
  if (!requests?.length) return []
  const senderIds = requests.map(r => r.user_id)
  const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url, player_id').in('id', senderIds)
  return requests.map(r => {
    const profile = profiles?.find(p => p.id === r.user_id)
    return { ...r, friend_id: r.user_id, friend_username: profile?.username, friend_avatar: profile?.avatar_url, friend_player_id: profile?.player_id }
  })
}

export const sendFriendRequest = async (userId: string, friendId: string) => {
  const { error } = await supabase.from('friendships').insert({ user_id: userId, friend_id: friendId, status: 'pending' })
  return !error
}

export const acceptFriendRequest = async (id: string) => {
  const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', id)
  return !error
}

export const rejectFriendRequest = async (id: string) => {
  const { error } = await supabase.from('friendships').delete().eq('id', id)
  return !error
}

export const removeFriend = async (id: string) => {
  const { error } = await supabase.from('friendships').delete().eq('id', id)
  return !error
}

// ============ МУЛЬТИПЛЕЕР - КОМНАТЫ ============

export const findOrCreateRoom = async (userId: string, mode: string, betAmount: number): Promise<string | null> => {
  const { data: openRooms } = await supabase
    .from('game_rooms')
    .select('*')
    .eq('mode', mode)
    .eq('status', 'waiting')
    .order('created_at', { ascending: true })
    .limit(1)

  if (openRooms && openRooms.length > 0) {
    const room = openRooms[0]
    const players = await getRoomPlayers(room.id)
    if (players.length < GAME_CONSTANTS.MAX_PLAYERS) {
      await joinRoom(room.id, userId)
      return room.id
    }
  }

  return createGameRoom(userId, mode, betAmount)
}

export const createGameRoom = async (hostId: string, mode: string, betAmount: number): Promise<string | null> => {
  const roomId = `room-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
  const { error } = await supabase.from('game_rooms').insert({
    id: roomId, 
    host_id: hostId, 
    mode, 
    status: 'waiting', 
    bet_amount: betAmount,
    created_at: new Date().toISOString()
  })
  
  if (error) return null
  
  await supabase.from('room_players').insert({
    room_id: roomId,
    user_id: hostId,
    status: 'joined'
  })
  
  return roomId
}

export const getGameRoom = async (roomId: string): Promise<GameRoom | null> => {
  const { data } = await supabase.from('game_rooms').select('*').eq('id', roomId).single()
  return data
}

export const updateRoomStatus = async (roomId: string, status: string, questions?: Question[]) => {
  const update: any = { status }
  if (questions) update.questions = questions
  await supabase.from('game_rooms').update(update).eq('id', roomId)
}

export const joinRoom = async (roomId: string, userId: string) => {
  await supabase.from('room_players').upsert({ 
    room_id: roomId, 
    user_id: userId, 
    status: 'joined',
    joined_at: new Date().toISOString()
  })
}

export const leaveRoom = async (roomId: string, userId: string) => {
  await supabase.from('room_players').delete().eq('room_id', roomId).eq('user_id', userId)
}

export const getRoomPlayers = async (roomId: string): Promise<User[]> => {
  const { data } = await supabase
    .from('room_players')
    .select('user_id')
    .eq('room_id', roomId)
    .eq('status', 'joined')
    
  if (!data?.length) return []
  
  const userIds = data.map(d => d.user_id)
  const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds)
  return profiles || []
}

export const subscribeToRoom = (roomId: string, callback: (room: GameRoom) => void) => {
  return supabase
    .channel(`room-${roomId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'game_rooms',
      filter: `id=eq.${roomId}`
    }, (payload) => {
      if (payload.new) callback(payload.new as GameRoom)
    })
    .subscribe()
}

export const subscribeToRoomPlayers = (roomId: string, callback: () => void) => {
  return supabase
    .channel(`room-players-${roomId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'room_players',
      filter: `room_id=eq.${roomId}`
    }, () => callback())
    .subscribe()
}

// ============ ОТВЕТЫ ИГРОКОВ ============

export const submitAnswer = async (roomId: string, odId: string, questionIndex: number, answerIndex: number, isCorrect: boolean) => {
  await supabase.from('player_answers').upsert({
    room_id: roomId,
    user_id: odId,
    question_index: questionIndex,
    answer_index: answerIndex,
    is_correct: isCorrect,
    answered_at: new Date().toISOString()
  })
}

export const getPlayersStats = async (roomId: string) => {
  const { data } = await supabase
    .from('player_answers')
    .select('user_id, is_correct')
    .eq('room_id', roomId)
  
  if (!data) return {}
  
  const stats: {[odId: string]: {correct: number, wrong: number}} = {}
  data.forEach(answer => {
    if (!stats[answer.user_id]) {
      stats[answer.user_id] = { correct: 0, wrong: 0 }
    }
    if (answer.is_correct) {
      stats[answer.user_id].correct++
    } else {
      stats[answer.user_id].wrong++
    }
  })
  return stats
}

export const subscribeToAnswers = (roomId: string, callback: () => void) => {
  return supabase
    .channel(`answers-${roomId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'player_answers',
      filter: `room_id=eq.${roomId}`
    }, () => callback())
    .subscribe()
}

// ============ ПРИГЛАШЕНИЯ ============

export const sendGameInvite = async (roomId: string, fromUserId: string, toUserId: string): Promise<boolean> => {
  const { error } = await supabase.from('game_invites').insert({
    room_id: roomId, from_user_id: fromUserId, to_user_id: toUserId, status: 'pending'
  })
  return !error
}

export const getGameInvites = async (userId: string): Promise<GameInvite[]> => {
  const { data: invites } = await supabase.from('game_invites').select('*').eq('to_user_id', userId).eq('status', 'pending')
  if (!invites?.length) return []
  const fromIds = invites.map(i => i.from_user_id)
  const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url').in('id', fromIds)
  return invites.map(inv => {
    const profile = profiles?.find(p => p.id === inv.from_user_id)
    return { ...inv, from_username: profile?.username, from_avatar: profile?.avatar_url }
  })
}

export const respondToInvite = async (inviteId: string, accept: boolean): Promise<boolean> => {
  const { error } = await supabase.from('game_invites').update({ status: accept ? 'accepted' : 'declined' }).eq('id', inviteId)
  return !error
}

export const subscribeToInvites = (userId: string, callback: (invite: GameInvite) => void) => {
  return supabase.channel(`invites-${userId}`).on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'game_invites', filter: `to_user_id=eq.${userId}`
  }, async (payload) => {
    const invite = payload.new as GameInvite
    const { data: profile } = await supabase.from('profiles').select('username, avatar_url').eq('id', invite.from_user_id).single()
    callback({ ...invite, from_username: profile?.username, from_avatar: profile?.avatar_url })
  }).subscribe()
}

// ============ БОТЫ ============

const BOT_NAMES = ['Алекс', 'Мария', 'Иван', 'Елена', 'Дмитрий', 'Анна', 'Сергей', 'Ольга', 'Николай', 'Татьяна', 'Павел', 'Юлия']

export const generateBots = (count: number): Player[] => {
  const shuffled = [...BOT_NAMES].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count).map((name, i) => ({
    id: `bot-${i}-${Date.now()}`, 
    username: name, 
    avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}${Date.now()}`,
    correctAnswers: 0, wrongAnswers: 0, currentAnswer: null, hasAnswered: false,
    isBot: true, isMe: false, hasSurrendered: false, isConnected: true
  }))
}

export const simulateBotAnswer = (questionNum: number) => {
  let correctChance = questionNum <= 5 ? 0.9 : questionNum <= 15 ? 0.7 : questionNum <= 25 ? 0.5 : 0.3
  correctChance += (Math.random() - 0.5) * 0.2
  return { correct: Math.random() < correctChance, delay: 1000 + Math.random() * 6000 }
}

// ============ АДМИНКА ============

export const getAllUsers = async (): Promise<User[]> => {
  const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
  return data || []
}

export const getAllGameHistory = async (): Promise<GameHistory[]> => {
  const { data } = await supabase.from('game_history').select('*').order('played_at', { ascending: false }).limit(100)
  return data || []
}

export const updateUserBalance = async (userId: string, balance: number) => {
  await supabase.from('profiles').update({ balance }).eq('id', userId)
}

export const setUserAdmin = async (userId: string, isAdmin: boolean) => {
  await supabase.from('profiles').update({ is_admin: isAdmin }).eq('id', userId)
}
