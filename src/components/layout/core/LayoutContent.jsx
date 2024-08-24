"use client";

// Third-party Imports
import classnames from "classnames";

// Util Imports
import { verticalLayoutClasses } from "@/utils/layoutClasses";

// Styled Component Imports
import StyledMain from "@/theme/styles/StyledMain";

const LayoutContent = ({ children }) => {
  return (
    <StyledMain
      className={classnames(verticalLayoutClasses.content, "flex-auto")}
    >
      {children}
    </StyledMain>
  );
};

export default LayoutContent;
