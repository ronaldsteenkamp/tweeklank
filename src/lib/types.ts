export type Profile = {
  id: string;
  display_name: string;
  birthday: string | null;
  notify_new_question: boolean;
  notify_partner_answered: boolean;
  notify_dates: boolean;
  explicit_opt_in: boolean;
  adult_confirmed_at: string | null;
  show_year_ago: boolean;
  notify_nudges: boolean;
  notify_hour: number;
};

export type TodayQuestion = {
  day: string;
  question_id: number;
  text: string;
  depth: 1 | 2 | 3;
  answered: boolean;
  partner_answered: boolean;
  /** reeks in weken (zie src/lib/rhythm.ts) */
  streak: number;
  /** dag waarop jullie deze vraag de vorige keer kregen, of null */
  repeat_of: string | null;
  /** themaweek: titel, intro, stap 1–7 en de afsluitende oefening (anders null) */
  series_title: string | null;
  series_intro: string | null;
  series_step: number | null;
  series_exercise_slug: string | null;
};

export type Reaction = {
  id: number;
  answer_id: number;
  user_id: string;
  emoji: string | null;
  message: string | null;
  created_at: string;
};

export type Answer = {
  id: number;
  user_id: string;
  day: string;
  body: string;
  created_at: string;
  updated_at: string;
  answer_reactions: Reaction[];
};

export type ArchiveDay = {
  day: string;
  daily_questions: { text: string; depth: number };
  daily_answers: Answer[];
};
