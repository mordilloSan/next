// MUI Imports
import Button from "@mui/material/Button";

// Layout Imports
import LayoutWrapper from "@/components/layout/core/LayoutWrapper";
import VerticalLayout from "@/components/layout/core/VerticalLayout";

// Component Imports
import Providers from "@/components/layout/vertical-menu/Providers";
import Navigation from "@/components/layout/vertical-menu/Navigation";
import Navbar from "@/components/layout/NavBar/Navbar";
import ScrollToTop from "@/components/scroll-to-top";
import Customizer from "@/components/customizer";

export default function Layout({ children }) {
  return (
    <Providers>
      <LayoutWrapper
        verticalLayout={
          <VerticalLayout navigation={<Navigation />} navbar={<Navbar />}>
            {children}
          </VerticalLayout>
        }
      />
      <Customizer />
      <ScrollToTop className="mui-fixed">
        <Button
          variant="contained"
          className="is-10 bs-10 rounded-full p-0 min-is-0 flex items-center justify-center"
        >
          <i className="ri-arrow-up-line" />
        </Button>
      </ScrollToTop>
    </Providers>
  );
}
