// Component Imports
import Providers from "@/components/layout/vertical-menu/Providers";
import BlankLayout from "@/components/layout/core/BlankLayout";
import NotFound from "@/app/[...not-found]/NotFound";

// Util Imports
import { getMode } from "@/utils/serverHelpers";

const NotFoundPage = () => {
  const mode = getMode();

  return (
    <Providers>
      <BlankLayout>
        <NotFound mode={mode} />
      </BlankLayout>
    </Providers>
  );
};

export default NotFoundPage;
