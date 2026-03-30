// Placeholder: supabase gen types typescript 명령으로 자동 생성된 타입으로 교체 예정
// 사용법: npx supabase gen types typescript --project-id <project-id> > src/types/supabase.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
