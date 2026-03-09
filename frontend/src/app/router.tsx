import { Navigate, Route, Routes } from "react-router-dom";

import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import DashboardShell from "./DashboardShell";
import { useAuthSession } from "./useAuthSession";

function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--md-surface)",
        color: "var(--md-on-surface-variant)",
        fontSize: 14,
      }}
    >
      Loading...
    </div>
  );
}

export default function AppRouter() {
  const { authLoading, authUser, handleAuth, handleLogout } = useAuthSession();

  if (authLoading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={authUser ? <Navigate to="/" replace /> : <LoginPage onAuth={handleAuth} />}
      />
      <Route
        path="/register"
        element={authUser ? <Navigate to="/" replace /> : <RegisterPage onAuth={handleAuth} />}
      />
      <Route
        path="/*"
        element={
          authUser ? (
            <DashboardShell authUser={authUser} onLogout={handleLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}
