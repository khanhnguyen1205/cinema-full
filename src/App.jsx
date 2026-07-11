import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./Styles/global.css";
import { AuthProvider } from "./Context/AuthContext";
import PrivateRoute from "./Components/PrivateRoute";
import Home from "./Pages/Home";
import Movies from "./Pages/Movies";
import Cinemas from "./Pages/Cinemas";
import CinemaDetail from "./Pages/CinemaDetail";
import MovieDetail from "./Pages/MovieDetail";
import SeatSelection from "./Pages/SeatSelection";
import MyTickets from "./Pages/MyTickets";
import Login from "./Pages/Login";
import Register from "./Pages/Register";
import AdminRoute from "./Components/AdminRoute";
import AdminLayout from "./Pages/Admin/AdminLayout";
import AdminOverview from "./Pages/Admin/AdminOverview";
import AdminMovies from "./Pages/Admin/AdminMovies";
import AdminRooms from "./Pages/Admin/AdminRooms";
import AdminShowtimes from "./Pages/Admin/AdminShowtimes";
import AdminBookings from "./Pages/Admin/AdminBookings";

function App() {
  return (
    <AuthProvider>
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
            <PrivateRoute><SeatSelection /></PrivateRoute>
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
    </AuthProvider>
  );
}

export default App;
