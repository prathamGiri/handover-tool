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
