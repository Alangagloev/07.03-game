-- =============================================
-- АРЕНА УМОВ - СХЕМА БАЗЫ ДАННЫХ v4 (MULTIPLAYER)
-- =============================================

-- ============ ПРОФИЛИ ============
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    avatar_url TEXT,
    balance INTEGER DEFAULT 100,
    total_wins INTEGER DEFAULT 0,
    total_games INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    player_id TEXT UNIQUE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles viewable" ON public.profiles;
CREATE POLICY "Public profiles viewable" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ============ ИСТОРИЯ ИГР ============
CREATE TABLE IF NOT EXISTS public.game_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    room_id TEXT,
    mode TEXT,
    result TEXT,
    correct_answers INTEGER DEFAULT 0,
    wrong_answers INTEGER DEFAULT 0,
    total_players INTEGER DEFAULT 1,
    bet_amount INTEGER DEFAULT 0,
    earnings INTEGER DEFAULT 0,
    played_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.game_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own history" ON public.game_history;
CREATE POLICY "Users view own history" ON public.game_history FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own history" ON public.game_history;
CREATE POLICY "Users insert own history" ON public.game_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============ ДРУЖБА ============
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    friend_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, friend_id)
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view friendships" ON public.friendships;
CREATE POLICY "Users view friendships" ON public.friendships FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users send requests" ON public.friendships;
CREATE POLICY "Users send requests" ON public.friendships FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update friendships" ON public.friendships;
CREATE POLICY "Users update friendships" ON public.friendships FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users delete friendships" ON public.friendships;
CREATE POLICY "Users delete friendships" ON public.friendships FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- ============ ИГРОВЫЕ КОМНАТЫ ============
CREATE TABLE IF NOT EXISTS public.game_rooms (
    id TEXT PRIMARY KEY,
    host_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    mode TEXT NOT NULL,
    status TEXT DEFAULT 'waiting',
    bet_amount INTEGER DEFAULT 0,
    questions JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone view rooms" ON public.game_rooms;
CREATE POLICY "Anyone view rooms" ON public.game_rooms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users create rooms" ON public.game_rooms;
CREATE POLICY "Users create rooms" ON public.game_rooms FOR INSERT WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts update rooms" ON public.game_rooms;
CREATE POLICY "Hosts update rooms" ON public.game_rooms FOR UPDATE USING (auth.uid() = host_id);

-- ============ ИГРОКИ В КОМНАТЕ ============
CREATE TABLE IF NOT EXISTS public.room_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id TEXT REFERENCES public.game_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'joined',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_id, user_id)
);

ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone view room players" ON public.room_players;
CREATE POLICY "Anyone view room players" ON public.room_players FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users join rooms" ON public.room_players;
CREATE POLICY "Users join rooms" ON public.room_players FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update status" ON public.room_players;
CREATE POLICY "Users update status" ON public.room_players FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users leave rooms" ON public.room_players;
CREATE POLICY "Users leave rooms" ON public.room_players FOR DELETE USING (auth.uid() = user_id);

-- ============ ОТВЕТЫ ИГРОКОВ ============
CREATE TABLE IF NOT EXISTS public.player_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id TEXT REFERENCES public.game_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    question_index INTEGER NOT NULL,
    answer_index INTEGER NOT NULL,
    is_correct BOOLEAN NOT NULL,
    answered_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_id, user_id, question_index)
);

ALTER TABLE public.player_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone view answers" ON public.player_answers;
CREATE POLICY "Anyone view answers" ON public.player_answers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users submit answers" ON public.player_answers;
CREATE POLICY "Users submit answers" ON public.player_answers FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============ ПРИГЛАШЕНИЯ В ИГРУ ============
CREATE TABLE IF NOT EXISTS public.game_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id TEXT REFERENCES public.game_rooms(id) ON DELETE CASCADE,
    from_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    to_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.game_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view invites" ON public.game_invites;
CREATE POLICY "Users view invites" ON public.game_invites FOR SELECT USING (auth.uid() = to_user_id OR auth.uid() = from_user_id);

DROP POLICY IF EXISTS "Users send invites" ON public.game_invites;
CREATE POLICY "Users send invites" ON public.game_invites FOR INSERT WITH CHECK (auth.uid() = from_user_id);

DROP POLICY IF EXISTS "Recipients update invites" ON public.game_invites;
CREATE POLICY "Recipients update invites" ON public.game_invites FOR UPDATE USING (auth.uid() = to_user_id);

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_invites;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_answers;
