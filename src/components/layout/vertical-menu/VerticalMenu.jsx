import React from "react";
import { useTheme } from "@mui/material/styles";
import PerfectScrollbar from "react-perfect-scrollbar";
import { Menu, MenuItem } from "@/theme/styles/vertical";
import useVerticalNav from "../NavBar/useVerticalNav";
import StyledVerticalNavExpandIcon from "@/theme/styles/vertical/StyledVerticalNavExpandIcon";
import menuItemStyles from "@/theme/styles/vertical/menuItemStyles";
import menuSectionStyles from "@/theme/styles/vertical/menuSectionStyles";
import routes from "@/configs/routes";
import { Icon } from "@iconify/react";

const RenderExpandIcon = ({ open, transitionDuration }) => (
  <StyledVerticalNavExpandIcon
    open={open}
    transitionDuration={transitionDuration}
  >
    <i className="ri-arrow-right-s-line" />
  </StyledVerticalNavExpandIcon>
);

const VerticalMenu = ({ scrollMenu }) => {
  const theme = useTheme();
  const verticalNavOptions = useVerticalNav();
  const { isBreakpointReached, transitionDuration } = verticalNavOptions;
  const ScrollWrapper = isBreakpointReached ? "div" : PerfectScrollbar;

  return (
    <ScrollWrapper
      {...(isBreakpointReached
        ? {
            className: "bs-full overflow-y-auto overflow-x-hidden",
            onScroll: (container) => scrollMenu(container, false),
          }
        : {
            options: { wheelPropagation: false, suppressScrollX: true },
            onScrollY: (container) => scrollMenu(container, true),
          })}
    >
      <Menu
        popoutMenuOffset={{ mainAxis: 10 }}
        menuItemStyles={menuItemStyles(verticalNavOptions, theme)}
        renderExpandIcon={({ open }) => (
          <RenderExpandIcon
            open={open}
            transitionDuration={transitionDuration}
          />
        )}
        renderExpandedMenuItemIcon={{ icon: <i className="ri-circle-line" /> }}
        menuSectionStyles={menuSectionStyles(verticalNavOptions, theme)}
      >
        {routes.map((route) => (
          <MenuItem
            key={route.path}
            href={route.path}
            icon={
              typeof route.icon === "string" ? (
                <Icon icon={route.icon} />
              ) : (
                <route.icon />
              )
            }
          >
            {route.label}
          </MenuItem>
        ))}
      </Menu>
    </ScrollWrapper>
  );
};

export default VerticalMenu;
