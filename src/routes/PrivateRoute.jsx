import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "context/AuthContext";

export default function PrivateRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    // Save the page they were trying to visit
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
