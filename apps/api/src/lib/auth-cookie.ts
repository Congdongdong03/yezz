export const AUTH_SESSION_SECONDS = 60 * 60 * 24;

export function buildAuthCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ("none" as const) : ("lax" as const),
    path: "/",
    maxAge: AUTH_SESSION_SECONDS,
  };
}
