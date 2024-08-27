// AuthService.js

export const logout = async () => {
  try {
    const response = await fetch("/api/logout", {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to logout from the server");
    }

    console.log("Server Logout success");
  } catch (error) {
    console.error("Error during logout:", error);
    throw error;
  } finally {
    document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie =
      "connect.sid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  }
};

export const login = async (requestDetails) => {
  try {
    const response = await fetch(
      "/api/login",
      requestDetails,
    );

    if (response.ok) {
      const token = await response.text();

      if (token) {
        document.cookie = `token=${token}; path=/; Secure, SameSite=Lax`;

        return token;
      } else {
        throw new Error("Token not received");
      }
    } else {
      const errorText = await response.text();

      throw new Error(errorText);
    }
  } catch (error) {
    console.error("Error during login:", error);
    throw error;
  }
};
