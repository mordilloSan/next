"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {  logout as logoutService,  login as loginService,} from "../components/auth-provider/AuthService";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const cookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("connect.sid="));

    if (cookie) {
      setIsAuthenticated(true);
    }
  }, []);

  const login = async (username, password) => {
    const requestDetails = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
      credentials: "include",
    };

    try {
      await loginService(requestDetails);
      setIsAuthenticated(true);
      setError("");
      router.push("/home");
    } catch (error) {
      setError(error.message || "Login failed");
      setIsAuthenticated(false);
    }
  };

  const logout = async () => {
    try { 
      setIsAuthenticated(false);
      await logoutService();
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
