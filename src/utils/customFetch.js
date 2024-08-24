import { useAuth } from "@/contexts/AuthContext";

export function useAuthenticatedFetch() {
  const { logout } = useAuth();

  const customFetch = async (url) => {
    if (!url) {
      throw new Error("URL is required");
    }

    try {
      const response = await fetch(url);

      if (response.status === 401) {
        console.log("Unauthorized - Redirecting...");
        logout();
        return null; // Return null to avoid processing the response further
      }

      if (!response.ok) {
        // Handle other errors
        const errorData = await response.json();
        throw new Error(errorData.message || "Fetch error");
      }

      // If response is OK, return the parsed JSON
      return await response.json();
    } catch (error) {
      console.error("Fetch error:", error);
      throw error; // Re-throw error to be handled by calling functions if necessary
    }
  };

  return customFetch;
}
