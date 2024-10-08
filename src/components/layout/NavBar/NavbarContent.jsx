"use client";
// Third-party Imports
import classnames from "classnames";
import { usePathname } from "next/navigation";
// Component Imports
import NavToggle from "./NavToggle";
import SettingsDropdown from "./SettingsDropdown";
import Breadcrumbs from "@/components/layout/NavBar/BreadCrumbs";
import PowerDropdown from "./PowerDropdown";
// Util Imports
import { verticalLayoutClasses } from "@/utils/layoutClasses";

const NavbarContent = () => {
  const route = usePathname().split("/").slice(1);

  return (
    <div
      className={classnames(
        verticalLayoutClasses.navbarContent,
        "flex items-center justify-between gap-4 is-full",
      )}
    >
      <div className="flex items-center gap-4">
        <NavToggle />
        <Breadcrumbs title={route[route.length - 1]} route={route} />
      </div>
      <div className="flex items-center gap-x-2">
        <SettingsDropdown />
        <PowerDropdown />
      </div>
    </div>
  );
};

export default NavbarContent;
