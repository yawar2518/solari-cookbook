// Shared types between the Next.js app and the FastAPI backend responses.

export type Plan = 'free' | 'pro'

export interface User {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  plan: Plan
  is_admin: boolean
  search_credits: number
  cover_letter_credits: number
  created_at: string | null
}

export interface UsageBucket {
  used_today: number | null
  limit_today: number | null
  remaining_today?: number
  balance: number | null
  unlimited: boolean
}

export interface Usage {
  plan: Plan
  searches: UsageBucket
  cover_letters: UsageBucket
}

export interface InferredRole {
  role: string
  confidence: 'high' | 'medium' | 'low' | string
  reasoning?: string
}

export interface ParsedProfile {
  education?: { level?: string | null; field?: string | null; year?: string | null; institution?: string | null }
  skills?: { confirmed?: string[]; inferred?: string[] }
  experience?: { level?: string | null; highlights?: string[] }
  preferences?: {
    job_type?: string | null
    location_type?: string | null
    location_scope?: string | null
    city?: string | null
    country?: string | null
    availability?: string | null
  }
  inferred_roles?: InferredRole[]
  search_keywords?: { global?: string[]; local?: string[] }
  summary?: string
}

export interface Completeness {
  score: number
  suggestions: { key: string; label: string; href: string; weight: number }[]
}

export interface Me {
  user: User
  usage: Usage
  profile: {
    raw_context: string | null
    parsed_profile: ParsedProfile | null
    has_cv: boolean
    cv_filename: string | null
    has_generated_cv: boolean
    updated_at: string | null
  }
  stats: { searches: number; saved_jobs: number; cover_letters: number }
  completeness: Completeness
}

export type MatchLabel = 'Strong Match' | 'Good Match' | 'Partial Match' | 'Stretch Role' | 'Unscored' | string

export interface Job {
  id: string
  title: string
  company: string
  location: string
  snippet?: string
  posted?: string
  url: string
  source: string
  match_score?: number
  match_label?: MatchLabel
  matching_skills?: string[]
  missing_skills?: string[]
  what_you_learn?: string | null
  why_it_fits?: string | null
  concern?: string | null
  saved?: boolean
  notes?: string | null
  saved_at?: string
  run_id?: string
  description?: string | null
}

export type SearchRunStatus = 'queued' | 'scraping' | 'matching' | 'done' | 'error'

export interface SearchRun {
  run_id: string
  status: SearchRunStatus
  stage: string | null
  progress: number
  cache_hit: boolean | null
  keywords: string[]
  location: string
  error: string | null
  total: number
  jobs?: Job[]
  created_at: string
  completed_at: string | null
}

export interface SearchRunSummary {
  id: string
  status: SearchRunStatus
  stage: string | null
  progress: number
  total: number
  keywords: string[]
  location: string
  cache_hit: boolean
  error: string | null
  created_at: string
  completed_at: string | null
}

export interface CompanyResearch {
  company_overview?: string
  company_size?: string
  company_type?: string
  industry?: string
  headquarters?: string | null
  tech_stack?: string[]
  day_to_day?: string[]
  culture_signals?: string[]
  glassdoor_rating?: string | null
  glassdoor_note?: string | null
  interview_tips?: string[]
  red_flags?: string[]
  sources?: string[]
  cached?: boolean
}

export interface CoverLetter {
  id: string
  job_id: string | null
  job_title: string
  company: string
  letter_text: string
  tailored: boolean
  cv_suggestions: CvTailoring | null
  created_at: string
}

export interface CvTailoring {
  headline?: string
  keywords_to_add?: string[]
  bullets_to_rewrite?: { current: string; suggested: string; why: string }[]
  sections_to_reorder?: string | null
  remove?: string[]
}

export interface CvContact {
  name?: string
  email?: string
  phone?: string
  location?: string
  linkedin?: string
  github?: string
  website?: string
}

export interface CvExperience {
  title?: string
  company?: string
  location?: string
  start?: string
  end?: string
  bullets?: string[]
}

export interface CvProject {
  name?: string
  tech?: string[]
  link?: string
  bullets?: string[]
}

export interface CvEducation {
  degree?: string
  institution?: string
  location?: string
  start?: string
  end?: string
  details?: string
}

export interface CvDocument {
  contact?: CvContact
  summary?: string
  skills?: { category: string; items: string[] }[]
  experience?: CvExperience[]
  projects?: CvProject[]
  education?: CvEducation[]
  certifications?: string[]
  achievements?: string[]
}

export interface CvReview {
  overall_score?: number
  ats_score?: number
  strengths?: string[]
  improvements?: { section: string; issue: string; fix: string; priority: 'high' | 'medium' | 'low' | string }[]
  missing_keywords?: string[]
  target_roles?: string[]
}

export interface CvState {
  cv_filename: string | null
  cv_download_url: string | null
  cv_parsed: CvDocument | null
  cv_suggestions: CvReview | null
  generated_cv: CvDocument | null
  has_profile: boolean
}

export interface CvForm {
  personal: { name: string; email: string; phone: string; location: string; linkedin: string; github: string; website: string }
  summary: string
  education: { degree: string; institution: string; location: string; start: string; end: string; details: string }[]
  experience: { title: string; company: string; location: string; start: string; end: string; description: string }[]
  skills: string
  projects: { name: string; tech: string; link: string; description: string }[]
  achievements: string
  target_role: string
}

export interface AdminOverview {
  total_users: number
  pro_users: number
  new_users_week: number
  active_today: number
  searches_today: number
  searches_week: number
  cover_letters_today: number
  cover_letters_total: number
  credits_used: number
  llm_cost_week_usd: number
  llm_tokens_week: number
  feedback_count: number
  avg_rating: number | null
  waitlist: number
}

export interface AdminUser {
  id: string
  email: string
  full_name: string | null
  plan: Plan
  is_admin: boolean
  search_credits: number
  cover_letter_credits: number
  last_active_at: string | null
  created_at: string
  searches_used: number
  cover_letters_used: number
}

export interface AdminFeedback {
  id: string
  user_id: string | null
  email: string | null
  rating: number
  message: string | null
  page: string | null
  created_at: string
}

export interface AdminCacheStats {
  cached_entries: number
  active_entries: number
  total_hits: number
  search_runs: number
  cache_hit_rate: number
  top_entries: { id: string; keywords: string[]; location: string; hit_count: number; scraped_at: string; expires_at: string }[]
}

export interface AdminUsageDay {
  date: string
  cost_usd: number
  tokens: number
  searches: number
  cover_letters: number
  calls: number
}

export interface AdminUsage {
  days: AdminUsageDay[]
  cost_by_action: { action: string; cost_usd: number }[]
}
