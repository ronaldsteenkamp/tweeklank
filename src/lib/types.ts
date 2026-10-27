export type Profile = {
  id: string;
  display_name: string;
  birthday: string | null;
  notify_new_question: boolean;
  notify_partner_answered: boolean;
  notify_dates: boolean;
  explicit_opt_in: boolean;
  adult_confirmed_at: string | null;
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
