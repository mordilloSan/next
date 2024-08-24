"use client";

// React Imports
import { useEffect, useRef } from "react";

// Next Imports
import Link from "next/link";

// MUI Imports
import { styled, useTheme } from "@mui/material/styles";

// Component Imports
import VerticalNav, {
  NavHeader,
  NavCollapseIcons,
} from "@/theme/styles/vertical";
import VerticalMenu from "../vertical-menu/VerticalMenu";
import Logo from "../vertical-menu/Logo";

// Hook Imports
import useVerticalNav from "./useVerticalNav";
import { useSettings } from "@/hooks/useSettings";

// Style Imports
import navigationCustomStyles from "@/theme/styles/vertical/navigationCustomStyles";

const StyledBoxForShadow = styled("div")(({ theme }) => ({
  top: 60,
  left: -8,
  zIndex: 2,
  opacity: 0,
  position: "absolute",
  pointerEvents: "none",
  width: "calc(100% + 15px)",
  height: theme.mixins.toolbar.minHeight,
  transition: "opacity .15s ease-in-out",
  background: `linear-gradient(var(--mui-palette-background-default)  '5%', rgb(var(--mui-palette-background-defaultChannel) / 0.85) 30%, rgb(var(--mui-palette-background-defaultChannel) / 0.5) 65%, rgb(var(--mui-palette-background-defaultChannel) / 0.3) 75%, transparent)`,
  "&.scrolled": {
    opacity: 1,
  },
}));

const Navigation = () => {
  // Hooks
  const verticalNavOptions = useVerticalNav();
  const { updateSettings, settings } = useSettings();
  const theme = useTheme();

  // Refs
  const shadowRef = useRef(null);

  // Vars
  const { isCollapsed, isHovered, collapseVerticalNav, isBreakpointReached } =
    verticalNavOptions;
  const isSemiDark = settings.semiDark;
  let isDark;

  const scrollMenu = (container, isPerfectScrollbar) => {
    container =
      isBreakpointReached || !isPerfectScrollbar ? container.target : container;

    if (shadowRef && container.scrollTop > 0) {
      // @ts-ignore
      if (!shadowRef.current.classList.contains("scrolled")) {
        // @ts-ignore
        shadowRef.current.classList.add("scrolled");
      }
    } else {
      // @ts-ignore
      shadowRef.current.classList.remove("scrolled");
    }
  };

  useEffect(() => {
    if (settings.layout === "collapsed") {
      collapseVerticalNav(true);
    } else {
      collapseVerticalNav(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.layout]);

  return (
    // eslint-disable-next-line lines-around-comment
    // Sidebar Vertical Menu
    <VerticalNav
      customStyles={navigationCustomStyles(verticalNavOptions, theme)}
      collapsedWidth={68}
      backgroundColor="var(--mui-palette-background-default)"
      // eslint-disable-next-line lines-around-comment
      // The following condition adds the data-mui-color-scheme='dark' attribute to the VerticalNav component
      // when semiDark is enabled and the mode is light
      {...(isSemiDark &&
        !isDark && {
          "data-mui-color-scheme": "dark",
        })}
    >
      {/* Nav Header including Logo & nav toggle icons  */}
      <NavHeader>
        <Link href="/">
          <Logo />
        </Link>
        {!(isCollapsed && !isHovered) && (
          <NavCollapseIcons
            lockedIcon={<i className="ri-radio-button-line text-xl" />}
            unlockedIcon={
              <i className="ri-checkbox-blank-circle-line text-xl" />
            }
            closeIcon={<i className="ri-close-line text-xl" />}
            className="text-textSecondary"
            onClick={() =>
              updateSettings({
                layout: !isCollapsed ? "collapsed" : "vertical",
              })
            }
          />
        )}
      </NavHeader>
      <StyledBoxForShadow ref={shadowRef} />
      <VerticalMenu scrollMenu={scrollMenu} />
    </VerticalNav>
  );
};

export default Navigation;
