export const AUTH_TOKEN = "auth_token";
export const REFRESH_TOKEN = process.env.NODE_ENV === "production" ? "__Host-auth_refresh" : "auth_refresh";

export const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 Days
export const ACCESS_MAX_AGE = process.env.NODE_ENV === "development" ? 10 : 15 * 60; // 1 min in dev, 15 mins in prod

export const REFRESH_PATH = "/";

export const getCookieOptions = (type: "access" | "refresh") => {
  const isProd = process.env.NODE_ENV === "production";
  
  const base = {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? "strict" : "lax") as "strict" | "lax", // Lax in dev helps with OAuth redirects
  };

  if (type === "refresh") {
    return {
      ...base,
      path: REFRESH_PATH,
      maxAge: SESSION_MAX_AGE,
    };
  }

  return {
    ...base,
    path: "/",
    maxAge: ACCESS_MAX_AGE,
  };
};
