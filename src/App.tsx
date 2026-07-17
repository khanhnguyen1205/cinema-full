import { BrowserRouter, Routes, Route } from "react-router-dom";
import "styles/global.css";
import { AuthProvider, useAuth } from "context/AuthContext";
import PrivateRoute from "routes/PrivateRoute";
import Home from "pages/Home";
import Movies from "pages/Movies";
import Cinemas from "pages/Cinemas";
import CinemaDetail from "pages/CinemaDetail";
import MovieDetail from "pages/MovieDetail";
import BookingWizard from "pages/booking/BookingWizard";
import MyTickets from "pages/MyTickets";
import Login from "pages/Login";
import Register from "pages/Register";
import AdminRoute from "routes/AdminRoute";
import AdminLayout from "pages/admin/AdminLayout";
import AdminOverview from "pages/admin/AdminOverview";
import AdminMovies from "pages/admin/AdminMovies";
import AdminRooms from "pages/admin/AdminRooms";
import AdminShowtimes from "pages/admin/AdminShowtimes";
import AdminBookings from "pages/admin/AdminBookings";

function AppShell() {
  const { loading } = useAuth();
  // Cho tới khi kiểm tra xong phiên (cookie httpOnly) mới render — tránh nháy trạng thái
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div className="loading-spinner" />
      </div>
    );
  }
  return (
    <BrowserRouter>
      <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/cinemas" element={<Cinemas />} />
          <Route path="/cinema/:id" element={<CinemaDetail />} />
          <Route path="/movie/:id" element={<MovieDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/seats/:showtimeId" element={
            <PrivateRoute><BookingWizard /></PrivateRoute>
          } />
          <Route path="/tickets" element={
            <PrivateRoute><MyTickets /></PrivateRoute>
          } />
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index element={<AdminOverview />} />
            <Route path="movies" element={<AdminMovies />} />
            <Route path="rooms" element={<AdminRooms />} />
            <Route path="showtimes" element={<AdminShowtimes />} />
            <Route path="bookings" element={<AdminBookings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

export default App;
