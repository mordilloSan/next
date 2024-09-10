"use client";

// React Imports
import {
  createContext,
  forwardRef,
  useEffect,
  useMemo
} from "react";

// Third-party Imports
import classnames from "classnames";
import { FloatingTree } from "@floating-ui/react";

// Hook Imports
import useVerticalNav from "../NavBar/useVerticalNav";

// Util Imports
import { menuClasses } from "@/utils/menuClasses";

// Styled Component Imports
import StyledVerticalMenu from "@/theme/styles/vertical/StyledVerticalMenu";

// Style Imports
import styles from "@/theme/styles/styles.module.css";

export const VerticalMenuContext = createContext({});

const Menu = (props, ref) => {
  // Props
  const {
    children,
    className,
    rootStyles,
    menuItemStyles,
    renderExpandIcon,
    renderExpandedMenuItemIcon,
    browserScroll = false,
    triggerPopout = "hover",
    popoutWhenCollapsed = false,
    popoutMenuOffset = { mainAxis: 0 },
    textTruncate = true,
    ...rest
  } = props;

  // Hooks
  const { updateVerticalNavState } = useVerticalNav();

  // UseEffect, update verticalNav state to set initial values and update values on change
  useEffect(() => {
    updateVerticalNavState({
      isPopoutWhenCollapsed: popoutWhenCollapsed,
    });
  }, [popoutWhenCollapsed, updateVerticalNavState]);

  const providerValue = useMemo(
    () => ({
      browserScroll,
      triggerPopout,
      menuItemStyles,
      renderExpandIcon,
      renderExpandedMenuItemIcon,
      popoutMenuOffset,
      textTruncate,
    }),
    [
      browserScroll,
      triggerPopout,
      menuItemStyles,
      renderExpandIcon,
      renderExpandedMenuItemIcon,
      popoutMenuOffset,
      textTruncate,
    ],
  );

  return (
    <VerticalMenuContext.Provider value={providerValue}>
      <FloatingTree>
        <StyledVerticalMenu
          ref={ref}
          className={classnames(menuClasses.root, className)}
          rootStyles={rootStyles}
          {...rest}
        >
          <ul className={styles.ul}>{children}</ul>
        </StyledVerticalMenu>
      </FloatingTree>
    </VerticalMenuContext.Provider>
  );
};

export default forwardRef(Menu);
