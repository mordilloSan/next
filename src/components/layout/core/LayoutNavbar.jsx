"use client";

// MUI Imports
import { useTheme } from "@mui/material/styles";
import useScrollTrigger from "@mui/material/useScrollTrigger";

// Third-party Imports
import classnames from "classnames";

// Config Imports
import themeConfig from "@configs/themeConfig";

// Util Imports
import { verticalLayoutClasses } from "@/utils/layoutClasses";

// Styled Component Imports
import StyledHeader from "@/theme/styles/vertical/StyledHeader";

const LayoutNavbar = (props) => {
  // Props
  const { children, overrideStyles } = props;

  // Hooks
  const theme = useTheme();

  const trigger = useScrollTrigger({
    threshold: 0,
    disableHysteresis: true,
  });

  // Vars
  const headerFixed = themeConfig.navbar.type === "fixed";
  const headerStatic = themeConfig.navbar.type === "static";
  const headerFloating = themeConfig.navbar.floating === true;
  const headerDetached = themeConfig.navbar.detached === true;
  const headerAttached = themeConfig.navbar.detached === false;
  const headerBlur = themeConfig.navbar.blur === true;

  return (
    <StyledHeader
      theme={theme}
      overrideStyles={overrideStyles}
      className={classnames(verticalLayoutClasses.header, {
        [verticalLayoutClasses.headerFixed]: headerFixed,
        [verticalLayoutClasses.headerStatic]: headerStatic,
        [verticalLayoutClasses.headerFloating]: headerFloating,
        [verticalLayoutClasses.headerDetached]:
          !headerFloating && headerDetached,
        [verticalLayoutClasses.headerAttached]:
          !headerFloating && headerAttached,
        [verticalLayoutClasses.headerBlur]: headerBlur,
        scrolled: trigger,
      })}
    >
      <div className={classnames(verticalLayoutClasses.navbar, "flex bs-full")}>
        {children}
      </div>
    </StyledHeader>
  );
};

export default LayoutNavbar;
