// Component Imports
import Providers from "@/components/layout/vertical-menu/Providers";
import BlankLayout from "@/components/layout/core/BlankLayout";

const Layout = ({ children }) => {
  return (
    <Providers>
      <BlankLayout>{children}</BlankLayout>
    </Providers>
  );
};

export default Layout;
