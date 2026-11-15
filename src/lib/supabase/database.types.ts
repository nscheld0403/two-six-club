// Hand-maintained to match supabase/migrations. Once the project is linked,
// this can be regenerated with `npx supabase gen types typescript`.

export type MemberRole = "member" | "admin";
export type MemberStatus = "pending" | "active" | "suspended" | "declined";
export type MemberSex = "male" | "female" | "undisclosed";
export type Discipline = "crossfit" | "hyrox" | "strength" | "conditioning" | "mobility" | "open_gym";
export type SessionKind = "class" | "open_gym";
export type SessionStatus = "scheduled" | "cancelled";
export type WorkoutStatus = "draft" | "published";
export type SectionKind = "warmup" | "strength" | "conditioning" | "skill" | "accessory" | "cooldown";
export type ScoringType =
  | "none"
  | "for_time"
  | "amrap"
  | "emom"
  | "max_weight"
  | "max_reps"
  | "distance"
  | "time_trial"
  | "calories"
  | "sets_reps";
export type RsvpStatus = "going" | "maybe" | "not_going";

export type ProfileRow = {
  id: string;
  member_code: string;
  display_name: string;
  age: number;
  age_recorded_on: string;
  sex: MemberSex;
  role: MemberRole;
  status: MemberStatus;
  results_visible: boolean;
  show_demographics: boolean;
  approved_at: string | null;
  approved_by: string | null;
  access_reset_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditLogRow = {
  id: number;
  actor_id: string | null;
  action: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type ClubSettingsRow = { id: boolean; timezone: string; default_capacity: number; updated_at: string };
export type MovementRow = { id: string; name: string; category: string; created_at: string };

export type WorkoutRow = {
  id: string;
  title: string;
  workout_date: string | null;
  discipline: Discipline;
  summary: string | null;
  coach_notes: string | null;
  status: WorkoutStatus;
  publish_at: string | null;
  is_template: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SectionRow = {
  id: string;
  workout_id: string;
  position: number;
  kind: SectionKind;
  title: string;
  scoring: ScoringType;
  movement_id: string | null;
  benchmark_name: string | null;
  time_cap_seconds: number | null;
  rounds_target: number | null;
  reps_per_round: number | null;
  distance_m: number | null;
  level1: string | null;
  level2: string | null;
  notes: string | null;
};

export type SeriesRow = {
  id: string;
  title: string;
  kind: SessionKind;
  discipline: Discipline;
  weekday: number;
  start_time: string;
  duration_min: number;
  capacity: number;
  coach_label: string | null;
  starts_on: string;
  ends_on: string | null;
  active: boolean;
  created_at: string;
};

export type SessionRow = {
  id: string;
  title: string;
  kind: SessionKind;
  discipline: Discipline;
  starts_at: string;
  duration_min: number;
  capacity: number;
  coach_label: string | null;
  workout_id: string | null;
  series_id: string | null;
  status: SessionStatus;
  published: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ReservationRow = {
  session_id: string;
  member_id: string;
  status: RsvpStatus;
  attended: boolean | null;
  created_at: string;
  updated_at: string;
};

export type ResultRow = {
  id: string;
  member_id: string;
  section_id: string | null;
  session_id: string | null;
  performed_on: string;
  title: string;
  scoring: ScoringType;
  movement_id: string | null;
  benchmark_name: string | null;
  level: number | null;
  rx: boolean;
  time_seconds: number | null;
  capped: boolean;
  rounds: number | null;
  reps: number | null;
  load_lbs: number | null;
  distance_m: number | null;
  calories: number | null;
  rpe: number | null;
  notes: string | null;
  score_value: number | null;
  created_at: string;
  updated_at: string;
};

export type ResultSetRow = { result_id: string; set_no: number; reps: number; load_lbs: number };

export type LiftBestRow = {
  member_id: string;
  movement_id: string;
  movement_name: string;
  reps: number;
  load_lbs: number;
  performed_on: string;
  result_id: string;
};
export type E1rmDailyRow = {
  member_id: string;
  movement_id: string;
  movement_name: string;
  performed_on: string;
  e1rm_lbs: number;
  top_load_lbs: number;
  volume_lbs: number;
};
export type BenchmarkBestRow = Pick<
  ResultRow,
  | "member_id"
  | "benchmark_name"
  | "rx"
  | "scoring"
  | "score_value"
  | "time_seconds"
  | "capped"
  | "rounds"
  | "reps"
  | "load_lbs"
  | "distance_m"
  | "calories"
  | "performed_on"
> & { result_id: string };

export type MemberScheduleRow = {
  id: string;
  title: string;
  kind: SessionKind;
  discipline: Discipline;
  starts_at: string;
  duration_min: number;
  capacity: number;
  coach_label: string | null;
  status: SessionStatus;
  workout_id: string | null;
  workout_title: string | null;
  going_count: number;
  maybe_count: number;
  my_status: RsvpStatus | null;
};

export type LeaderboardRow = {
  result_id: string;
  member_id: string;
  display_name: string;
  is_me: boolean;
  level: number | null;
  rx: boolean;
  score_value: number;
  time_seconds: number | null;
  capped: boolean;
  rounds: number | null;
  reps: number | null;
  load_lbs: number | null;
  distance_m: number | null;
  calories: number | null;
  sex: MemberSex | null;
  age_group: string | null;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};
type View<Row> = { Row: Row; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, Pick<ProfileRow, "id" | "member_code" | "display_name" | "age"> & Partial<ProfileRow>>;
      audit_log: Table<AuditLogRow, Partial<AuditLogRow> & Pick<AuditLogRow, "action">>;
      registration_attempts: Table<
        { id: number; ip_hash: string; created_at: string },
        { ip_hash: string; created_at?: string }
      >;
      club_settings: Table<ClubSettingsRow>;
      movements: Table<MovementRow, Pick<MovementRow, "name"> & Partial<MovementRow>>;
      workouts: Table<WorkoutRow, Pick<WorkoutRow, "title"> & Partial<WorkoutRow>>;
      workout_sections: Table<SectionRow, Pick<SectionRow, "workout_id" | "title"> & Partial<SectionRow>>;
      session_series: Table<
        SeriesRow,
        Pick<SeriesRow, "title" | "weekday" | "start_time" | "starts_on"> & Partial<SeriesRow>
      >;
      class_sessions: Table<SessionRow, Pick<SessionRow, "title" | "starts_at"> & Partial<SessionRow>>;
      reservations: Table<
        ReservationRow,
        Pick<ReservationRow, "session_id" | "member_id" | "status"> & Partial<ReservationRow>
      >;
      results: Table<ResultRow, Pick<ResultRow, "performed_on" | "title" | "scoring"> & Partial<ResultRow>>;
      result_sets: Table<ResultSetRow>;
    };
    Views: {
      lift_bests: View<LiftBestRow>;
      e1rm_daily: View<E1rmDailyRow>;
      benchmark_bests: View<BenchmarkBestRow>;
    };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_active_member: { Args: Record<string, never>; Returns: boolean };
      revoke_member_sessions: { Args: { target: string }; Returns: undefined };
      generate_series_sessions: { Args: { p_series: string; p_until: string }; Returns: number };
      duplicate_week: { Args: { p_from: string; p_to: string; p_include_workouts?: boolean }; Returns: number };
      member_schedule: { Args: { p_from: string; p_to: string }; Returns: MemberScheduleRow[] };
      session_attendees: {
        Args: { p_session: string };
        Returns: { member_id: string; display_name: string; status: RsvpStatus }[];
      };
      section_leaderboard: { Args: { p_section: string }; Returns: LeaderboardRow[] };
      benchmark_leaderboard: {
        Args: { p_benchmark: string };
        Returns: (LeaderboardRow & { performed_on: string; scoring: ScoringType })[];
      };
      benchmark_names: { Args: Record<string, never>; Returns: { benchmark_name: string; entries: number }[] };
    };
    Enums: {
      member_role: MemberRole;
      member_status: MemberStatus;
      member_sex: MemberSex;
      discipline: Discipline;
      session_kind: SessionKind;
      session_status: SessionStatus;
      workout_status: WorkoutStatus;
      section_kind: SectionKind;
      scoring_type: ScoringType;
      rsvp_status: RsvpStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
