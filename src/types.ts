export interface User {
  id: string
  username: string
  avatar_url: string
  balance: number
  total_wins: number
  total_games: number
  level: number
  player_id?: string
  is_admin?: boolean
}

export interface Question {
  id: string
  text: string
  options: string[]
  correctIndex: number
  category: string
  questionNumber: number
}

export interface Player {
  id: string
  username: string
  avatar_url: string
  correctAnswers: number
  wrongAnswers: number
  currentAnswer: number | null
  hasAnswered: boolean
  isBot: boolean
  isMe: boolean
  hasSurrendered: boolean
  isConnected: boolean
}

export type GameMode = 'bot' | 'random' | 'friends'

export interface GameConfig {
  mode: GameMode
  betAmount: number
  roomId?: string
  selectedFriends?: string[]
}

export interface GameHistory {
  id: string
  user_id: string
  room_id: string
  mode: string
  result: string
  correct_answers: number
  wrong_answers: number
  total_players: number
  bet_amount: number
  earnings: number
  played_at: string
}

export interface GameLog {
  id: string
  room_id: string
  user_id: string
  action: string
  details: string
  timestamp: string
}

export interface Friend {
  id: string
  user_id: string
  friend_id: string
  status: string
  friend_username?: string
  friend_avatar?: string
  friend_player_id?: string
}

export interface GameInvite {
  id: string
  room_id: string
  from_user_id: string
  to_user_id: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  from_username?: string
  from_avatar?: string
}

export interface GameRoom {
  id: string
  host_id: string
  mode: string
  status: 'waiting' | 'ready' | 'playing' | 'finished'
  bet_amount: number
  player_count: number
  min_players: number
  max_players: number
  created_at: string
  started_at?: string
  questions?: Question[]
}

export const GAME_CONSTANTS = {
  TOTAL_QUESTIONS: 30,
  TIME_PER_QUESTION: 10,
  STARTING_BALANCE: 100,
  MAX_PLAYERS: 10,
} as const
