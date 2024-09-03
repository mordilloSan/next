import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const activeControllers = new Set(); // Track active controllers

export function useAuthenticatedFetch() {
  const { logout } = useAuth();

  const customFetch = async (url) => {
    if (!url) {
      throw new Error("URL is required");
    }

    const controller = new AbortController();
    const { signal } = controller;
    activeControllers.add(controller);

    try {
      const response = await fetch(url, { signal }); // Pass the signal to the fetch request
      if (response.status === 401) {
        console.log("Unauthorized - Redirecting...");
        logout();
        cancelAllRequests();
        return null;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Fetch error");
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log("Fetch aborted");
        // You can handle the abort situation specifically here if needed
      } else {
        console.error("Fetch error:", error);
        toast.error(error.message || "An error occurred while fetching data.");
        throw error;
      }
    } finally {
      // Remove this controller from the set once the request completes
      activeControllers.delete(controller);
    }
  };

  // Function to cancel all ongoing requests
  const cancelAllRequests = () => {
    activeControllers.forEach(controller => controller.abort());
    activeControllers.clear(); // Clear all controllers after aborting
  };

  return customFetch;
}

export function useAuthenticatedPost() {
  const { logout } = useAuth();

  const customPost = async (url, body = {}) => {
    if (!url) {
      throw new Error("URL is required");
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const responseData = await response.json();

      if (response.status === 401) {
        console.log("Unauthorized - Redirecting...");
        logout();
        return null;
      }

      if (!response.ok) {
        throw new Error(responseData.error || "An unexpected error occurred.");
      }

      toast.success(responseData.message || "Success");
      return responseData;
    } catch (error) {
      console.error("An error has occurred.", error);
      toast.error(error.message || "An error has occurred.");
      throw error;
    }
  };

  return customPost;
}

export function useAuthenticatedDelete() {
  const { logout } = useAuth();

  const customDelete = async (url) => {
    if (!url) {
      throw new Error("URL is required");
    }

    try {
      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const responseData = await response.json();

      if (response.status === 401) {
        console.log("Unauthorized - Redirecting...");
        logout();
        return null;
      }

      if (!response.ok) {
        throw new Error(responseData.error || 'An unexpected error occurred.');
      }

      toast.success(responseData.message || `Success`);
    } catch (error) {
      console.error(`An error has occurred.`, error);
      toast.error(error.message || `An error has occurred.`);
      throw error;
    }
  };

  return customDelete;
}
