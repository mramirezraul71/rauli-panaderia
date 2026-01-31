import { Navigate } from "react-router-dom";
import AccessControlWidget from "../components/AccessControlWidget";
import { useAuth } from "../context/AuthContext";

export default function AccessControl() {
  const { user } = useAuth();
  if (user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="rounded-2xl border border-slate-700/80 bg-slate-900/60 overflow-hidden">
        <AccessControlWidget />
      </div>
    </div>
  );
}
