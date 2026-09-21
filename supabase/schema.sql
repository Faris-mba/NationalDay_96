-- =============================================================
-- تحدي العائلة 🇸🇦  —  مخطط قاعدة البيانات
-- شغّل هذا الملف كاملًا في: Supabase Dashboard → SQL Editor → New query
-- =============================================================

-- ------------------------------------------------------------------
-- 1) الغرف: المصدر الوحيد لحالة اللعبة.
--    التلفزيون والجوالات يقرأون الحالة من هنا، ولو انقطع الاتصال
--    تكفي قراءة صف واحد لاستعادة كل شيء.
-- ------------------------------------------------------------------
create table if not exists public.rooms (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique check (char_length(code) = 4),

  -- phase: lobby | round_intro | question | reveal | scores | finished
  phase             text not null default 'lobby',
  round_index       int  not null default 0,   -- موضع الجولة في قائمة التشغيل
  step_index        int  not null default 0,   -- موضع السؤال داخل الجولة
  current_question  jsonb,                     -- نسخة السؤال المعروض حاليًا

  -- التوقيت: يُحسب من ساعة الخادم لا من ساعة الجهاز
  question_started_at timestamptz,
  question_duration   int not null default 20, -- بالثواني
  paused_at           timestamptz,             -- ليس null ⇒ اللعبة موقوفة
  paused_ms           int not null default 0,  -- مجموع مدة الإيقاف للسؤال الحالي

  -- لوحة النقاط
  score_falcons     int not null default 0,
  score_elite       int not null default 0,

  -- إعدادات المقدّم (أسماء العائلة، الأسئلة المخصّصة، الكتم…)
  settings          jsonb not null default '{}'::jsonb,

  -- حالة الجولات الخاصة (البازر، المليون، التصويت)
  round_state       jsonb not null default '{}'::jsonb,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists rooms_code_idx on public.rooms (code);

-- ------------------------------------------------------------------
-- 2) اللاعبون
--    client_id يأتي من localStorage، فلو أعاد اللاعب فتح الصفحة
--    يرجع لنفس الفريق ونفس النقاط.
-- ------------------------------------------------------------------
create table if not exists public.players (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  client_id    text not null,
  name         text not null,
  category     text not null default 'adult' check (category in ('kid','adult')),
  team         text not null check (team in ('falcons','elite')),
  score        int  not null default 0,
  is_finalist  boolean not null default false,
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (room_id, client_id)
);

create index if not exists players_room_idx on public.players (room_id);

-- ------------------------------------------------------------------
-- 3) الإجابات — سؤال واحد لكل لاعب (upsert عند التغيير قبل الوقت)
--    created_at من الخادم: يُستخدم لحساب سرعة الإجابة.
-- ------------------------------------------------------------------
create table if not exists public.answers (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  player_id    uuid not null references public.players(id) on delete cascade,
  question_id  text not null,
  round_key    text not null,
  answer       text not null,        -- 'A'|'B'|'C'|'D' أو نص حر
  is_correct   boolean,
  points       int not null default 0,
  meta         jsonb not null default '{}'::jsonb,  -- مثل مستوى التقريب في «خمّن الصورة»
  created_at   timestamptz not null default now(),
  unique (room_id, player_id, question_id)
);

create index if not exists answers_room_question_idx
  on public.answers (room_id, question_id);

-- ------------------------------------------------------------------
-- 4) البازر — ترتيب الضغطات بوقت الخادم حصرًا
--    created_at يُملأ من now() في Postgres، ولا يُرسله العميل أبدًا.
-- ------------------------------------------------------------------
create table if not exists public.buzzes (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  player_id    uuid not null references public.players(id) on delete cascade,
  question_id  text not null,
  verdict      text,                 -- null = لم يُحكم بعد | 'correct' | 'wrong'
  created_at   timestamptz not null default now(),
  unique (room_id, player_id, question_id)
);

create index if not exists buzzes_order_idx
  on public.buzzes (room_id, question_id, created_at);

-- ------------------------------------------------------------------
-- 5) التصويت — «مين يعرف العائلة؟» و«اسأل العائلة» في المليون
-- ------------------------------------------------------------------
create table if not exists public.votes (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  player_id    uuid not null references public.players(id) on delete cascade,
  question_id  text not null,
  choice       text not null,
  created_at   timestamptz not null default now(),
  unique (room_id, player_id, question_id)
);

create index if not exists votes_room_question_idx
  on public.votes (room_id, question_id);

-- ------------------------------------------------------------------
-- 6) تحديث updated_at تلقائيًا
-- ------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rooms_touch_updated_at on public.rooms;
create trigger rooms_touch_updated_at
  before update on public.rooms
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------
-- 7) ساعة الخادم — تستخدمها الأجهزة لمعايرة انحراف ساعاتها
-- ------------------------------------------------------------------
create or replace function public.server_now()
returns timestamptz
language sql
stable
as $$ select now(); $$;

-- ------------------------------------------------------------------
-- 8) تنظيف الغرف القديمة (اختياري، شغّله متى شئت)
-- ------------------------------------------------------------------
create or replace function public.cleanup_old_rooms()
returns void
language sql
as $$ delete from public.rooms where created_at < now() - interval '2 days'; $$;

-- ------------------------------------------------------------------
-- 9) Realtime: بثّ تغييرات الجداول التي تراقبها الواجهة
-- ------------------------------------------------------------------
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.answers;
alter publication supabase_realtime add table public.buzzes;
alter publication supabase_realtime add table public.votes;

-- الصف الكامل مطلوب في أحداث UPDATE/DELETE
alter table public.rooms    replica identity full;
alter table public.players  replica identity full;
alter table public.answers  replica identity full;
alter table public.buzzes   replica identity full;
alter table public.votes    replica identity full;

-- ------------------------------------------------------------------
-- 10) RLS
--     هذه لعبة عائلية مؤقتة بلا تسجيل دخول: الجميع يستخدم مفتاح anon.
--     نفعّل RLS ونسمح بالوصول للجميع صراحةً بدل تركه مطفأً.
--     ⚠️ لا تضع في هذه الجداول أي بيانات حسّاسة.
-- ------------------------------------------------------------------
alter table public.rooms    enable row level security;
alter table public.players  enable row level security;
alter table public.answers  enable row level security;
alter table public.buzzes   enable row level security;
alter table public.votes    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['rooms','players','answers','buzzes','votes'] loop
    execute format('drop policy if exists %I on public.%I', t || '_anon_all', t);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (true) with check (true)',
      t || '_anon_all', t
    );
  end loop;
end $$;
