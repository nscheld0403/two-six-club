// Hand-maintained to match supabase/migrations. Regenerate with
// `npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts`
// once the project is linked.

export type MemberRole = "member" | "admin";
export type MemberStatus = "pending" | "active" | "suspended" | "declined";
export type MemberSex = "male" | "female" | "undisclosed";

export type ProfileRow = {
  id: string;
  member_code: string;
  display_name: string;
  age: number;
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

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        ProfileRow,
        Pick<ProfileRow, "id" | "member_code" | "display_name" | "age"> & Partial<ProfileRow>,
        Partial<ProfileRow>
      >;
      audit_log: Table<AuditLogRow, Partial<AuditLogRow> & Pick<AuditLogRow, "action">, Partial<AuditLogRow>>;
      registration_attempts: Table<
        { id: number; ip_hash: string; created_at: string },
        { ip_hash: string; created_at?: string },
        { ip_hash?: string; created_at?: string }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_active_member: { Args: Record<string, never>; Returns: boolean };
      revoke_member_sessions: { Args: { target: string }; Returns: undefined };
    };
    Enums: {
      member_role: MemberRole;
      member_status: MemberStatus;
      member_sex: MemberSex;
    };
    CompositeTypes: Record<string, never>;
  };
};
