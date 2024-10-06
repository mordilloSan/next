"use client";

// React Imports
import { useEffect, useRef } from "react";

// Third-party Imports
import styled from "@emotion/styled";

// Component Imports
import MaterioLogo from "@/assets/svg/Logo";

// Config Imports
import themeConfig from "@configs/themeConfig";

// Hook Imports
import useVerticalNav from "../NavBar/useVerticalNav";
import { useSettings } from "@/hooks/useSettings";

const LogoText = styled.span`
  margin-right: 10px; /* Added margin-right */
  color: ${({ color }) => color ?? "var(--mui-palette-text-primary)"};
  font-size: 1.25rem;
  line-height: 1.2;
  font-weight: 600;
  letter-spacing: 0.15px;
  text-transform: uppercase;
  transition: ${({ transitionDuration }) =>
    `margin-inline-start ${transitionDuration}ms ease-in-out, opacity ${transitionDuration}ms ease-in-out`};

  ${({ isHovered, isCollapsed, isBreakpointReached }) =>
    !isBreakpointReached && isCollapsed && !isHovered
      ? "opacity: 0; margin-inline-start: 0;"
      : "opacity: 1; margin-inline-start: 10px;"}
`;

const Logo = ({ color }) => {
  const logoTextRef = useRef(null);
  const { isHovered, transitionDuration, isBreakpointReached } = useVerticalNav();
  const { settings } = useSettings();
  const { layout } = settings;

  useEffect(() => {
    if (layout !== "collapsed") { return; }
    if (logoTextRef && logoTextRef.current) {
      if (!isBreakpointReached && layout === "collapsed" && !isHovered) {
        logoTextRef.current?.classList.add("hidden");
      } else {
        logoTextRef.current.classList.remove("hidden");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHovered, layout, isBreakpointReached]);

  return (
    <div className="flex items-center min-bs-[24px]">

      <LogoText
        color={color}
        ref={logoTextRef}
        isHovered={isHovered}
        isCollapsed={layout === "collapsed"}
        transitionDuration={transitionDuration}
        isBreakpointReached={isBreakpointReached}
      >
        {themeConfig.templateName}
      </LogoText>
      <MaterioLogo className="text-[22px] text-primary" />
    </div>
  );
};

export default Logo;
