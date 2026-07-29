export type UserRole = "owner" | "admin" | "staff";

export type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
  sessionVersion: number;
};
