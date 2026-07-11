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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
