"use client";

// React Imports
import { useMemo } from "react";

// MUI Imports
import { deepmerge } from "@mui/utils";
import {
  Experimental_CssVarsProvider as CssVarsProvider,
  experimental_extendTheme as extendTheme,
  lighten,
  darken,
} from "@mui/material/styles";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import CssBaseline from "@mui/material/CssBaseline";

// Component Imports
import ModeChanger from "./ModeChanger";

// Config Imports
import themeConfig from "@configs/themeConfig";

// Hook Imports
import { useSettings } from "@/hooks/useSettings";

// Core Theme Imports
import defaultCoreTheme from "@/theme";

const ThemeProvider = (props) => {
  // Props
  const { children } = props;

  // Hooks
  const { settings } = useSettings();

  let currentMode = settings.mode;

  // Merge the primary color scheme override with the core theme
  const theme = useMemo(() => {
    const newColorScheme = {
      colorSchemes: {
        light: {
          palette: {
            primary: {
              main: settings.primaryColor,
              light: lighten(settings.primaryColor, 0.2),
              dark: darken(settings.primaryColor, 0.1),
            },
          },
        },
        dark: {
          palette: {
            primary: {
              main: settings.primaryColor,
              light: lighten(settings.primaryColor, 0.2),
              dark: darken(settings.primaryColor, 0.1),
            },
          },
        },
      },
    };

    const coreTheme = deepmerge(
      defaultCoreTheme(settings, currentMode),
      newColorScheme,
    );

    return extendTheme(coreTheme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.primaryColor, currentMode]);

  return (
    <AppRouterCacheProvider
      options={{
        prepend: true,
      }}
    >
      <CssVarsProvider
        theme={theme}
        defaultMode={currentMode}
        modeStorageKey={`${themeConfig.templateName.toLowerCase().split(" ").join("-")}-mui-template-mode`}
      >
        <>
          <ModeChanger />
          <CssBaseline />
          {children}
        </>
      </CssVarsProvider>
    </AppRouterCacheProvider>
  );
};

export default ThemeProvider;
