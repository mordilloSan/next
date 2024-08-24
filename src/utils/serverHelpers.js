// Next Imports
import { cookies } from "next/headers";

// Third-party Imports
import "server-only";

// Config Imports
import themeConfig from "@configs/themeConfig";

export const getSettingsFromCookie = () => {
  const cookieStore = cookies();
  const cookieName = themeConfig.settingsCookieName;

  return JSON.parse(cookieStore.get(cookieName)?.value || "{}");
};

export const getMode = () => {
  const settingsCookie = getSettingsFromCookie();
  const _mode = settingsCookie.mode || themeConfig.mode;

  return _mode;
};
