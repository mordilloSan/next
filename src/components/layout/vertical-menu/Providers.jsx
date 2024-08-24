// Context Imports
import { VerticalNavProvider } from "@/contexts/verticalNavContext";
import { SettingsProvider } from "@/contexts/settingsContext";
import ThemeProvider from "@components/theme";

// Util Imports
import { getSettingsFromCookie } from "@/utils/serverHelpers";

const Providers = (props) => {
  // Props
  const { children } = props;

  // Vars

  const settingsCookie = getSettingsFromCookie();

  return (
    <VerticalNavProvider>
      <SettingsProvider settingsCookie={settingsCookie}>
        <ThemeProvider>{children}</ThemeProvider>
      </SettingsProvider>
    </VerticalNavProvider>
  );
};

export default Providers;
