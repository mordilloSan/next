// Third-party Imports
import "react-perfect-scrollbar/dist/css/styles.css";

// Style Imports
import "@/app/globals.css";

// Generated Icon CSS Imports
import "@assets/iconify-icons/generated-icons.css";

import QueryProvider from "@/components/query";

import { AuthProvider } from "@/contexts/AuthContext";

export const metadata = {
  title: "LSMT - Linux Server Management Tool",
  description: "Linux Server Management Tool - made with Materio",
};

const RootLayout = ({ children }) => {
  return (
    <html id="__next" lang="en">
      <body className="flex is-full min-bs-full flex-auto flex-col">
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
};

export default RootLayout;
