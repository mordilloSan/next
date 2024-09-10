// MUI Imports
import Chip from "@mui/material/Chip";

// Component Imports
import { MenuItem as VerticalMenuItem } from "@/theme/styles/vertical";

// Generate a menu from the menu data array
export const GenerateVerticalMenu = ({ menuData }) => {
  // Hooks
  const renderMenuItems = (data) => {
    // Use the map method to iterate through the array of menu data
    return data.map((item, index) => {
      const menuItem = item;

      const { label, icon, prefix, suffix, ...rest } = menuItem;

      // Localize the href
      const href = rest.href;
      const Icon = icon ? <i className={icon} /> : null;
      const menuItemPrefix =
        prefix && prefix.label ? <Chip size="small" {...prefix} /> : prefix;
      const menuItemSuffix =
        suffix && suffix.label ? <Chip size="small" {...suffix} /> : suffix;

      return (
        <VerticalMenuItem
          key={index}
          prefix={menuItemPrefix}
          suffix={menuItemSuffix}
          {...rest}
          href={href}
          {...(Icon && { icon: Icon })}
        >
          {label}
        </VerticalMenuItem>
      );
    });
  };

  return <>{renderMenuItems(menuData)}</>;
};
