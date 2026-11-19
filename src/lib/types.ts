export type Role = "admin" | "member";
export type ProjectStatus = "on_track" | "at_risk" | "blocked" | "done";

export type Profile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
};

export type Team = {
  id: string;
  name: string;
  invite_code: string;
};

export type Membership = {
  user: { id: string; email: string };
  profile: Profile;
  team: Team;
  role: Role;
};

export type Person = { id: string; full_name: string };

export type Project = {
  id: string;
  team_id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  progress: number;
  target_date: string | null;
  is_private: boolean;
  created_by: string | null;
  created_at: string;
  last_log_at: string | null;
  owner: Person | null;
};

export type ProjectDetail = Project & {
  creator: Person | null;
  members: Person[];
};

export type LogPhoto = { id: string; storage_path: string; width: number | null; height: number | null; url: string };

export type LogEntry = {
  id: string;
  body: string;
  status: ProjectStatus | null;
  progress: number | null;
  created_at: string;
  edited_at: string | null;
  author: Person | null;
  photos: LogPhoto[];
};

export type TimelineEntry = LogEntry & { relative: string; fallbackTime: string };
