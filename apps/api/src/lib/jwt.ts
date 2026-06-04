export type UserRole = "admin" | "staff";

export type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
};
