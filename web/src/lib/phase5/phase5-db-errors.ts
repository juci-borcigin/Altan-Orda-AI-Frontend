/** Phase 5: Supabase 正本（system_template / 変数）が欠けている */
export class Phase5DbConfigError extends Error {
  readonly code = "phase5_db_config" as const;

  constructor(message: string) {
    super(message);
    this.name = "Phase5DbConfigError";
  }
}
