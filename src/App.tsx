import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import "styles/global.css";
import ErrorBoundary from "components/ErrorBoundary";
import { queryClient } from "queries/client";
import { AuthProvider, useAuth } from "context/AuthContext";
import PrivateRoute from "routes/PrivateRoute";
import { Spinner } from "components/ui";
import Home from "pages/Home";
import Movies from "pages/Movies";
import Cinemas from "pages/Cinemas";
import Search from "pages/Search";
import CinemaDetail from "pages/CinemaDetail";
import MovieDetail from "pages/MovieDetail";
import MyTickets from "pages/MyTickets";
import Login from "pages/Login";
import Register from "pages/Register";
import NotFound from "pages/NotFound";
import AdminRoute from "routes/AdminRoute";
import KitchenSink from "pages/dev/KitchenSink";
import PWAUpdatePrompt from "components/PWAUpdatePrompt";

// Hai khối này nạp muộn vì chúng kéo theo thư viện NẶNG mà phần lớn khách không
// bao giờ chạm tới:
//   • đặt vé  -> @stripe/stripe-js, và gói này còn tự chèn script js.stripe.com
//                ngay khi được import, nên nạp tĩnh là mọi trang công khai đều
//                dính cookie bên thứ ba và một lượt tải mạng thừa.
//   • admin   -> recharts (~200KB) mà chỉ tài khoản quản trị mới dùng.
// Lighthouse đo được 694 KiB JavaScript không dùng ở trang chủ trước khi tách.
const BookingWizard = lazy(() => import("pages/booking/BookingWizard"));
const AdminLayout = lazy(() => import("pages/admin/AdminLayout"));
const AdminOverview = lazy(() => import("pages/admin/AdminOverview"));
const AdminMovies = lazy(() => import("pages/admin/AdminMovies"));
const AdminRooms = lazy(() => import("pages/admin/AdminRooms"));
const AdminShowtimes = lazy(() => import("pages/admin/AdminShowtimes"));
const AdminBookings = lazy(() => import("pages/admin/AdminBookings"));
const AdminReviews = lazy(() => import("pages/admin/AdminReviews"));

// Màn chờ dùng chung: vừa cho splash kiểm tra phiên, vừa cho route nạp muộn —
// một kiểu loading duy nhất thay vì hai kiểu nháy khác nhau.
// Trước đây chỗ này render <div className="loading-spinner" /> mà class đó KHÔNG
// có CSS ở đâu cả: màn chờ là một ô rỗng vô hình, nên trang không vẽ gì cho tới
// khi phiên kiểm tra xong (Lighthouse báo NO_FCP).
function RouteFallback() {
  return (
    <div className="route-fallback">
      <Spinner />
    </div>
  );
}

function AppShell() {
  const { loading } = useAuth();
  // Cho tới khi kiểm tra xong phiên (cookie httpOnly) mới render — tránh nháy trạng thái
  if (loading) return <RouteFallback />;
  return (
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/cinemas" element={<Cinemas />} />
          <Route path="/search" element={<Search />} />
          <Route path="/cinema/:id" element={<CinemaDetail />} />
          <Route path="/movie/:id" element={<MovieDetail />} />
          {import.meta.env.DEV && (
            <Route path="/kitchen-sink" element={<KitchenSink />} />
          )}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/seats/:showtimeId"
            element={
              <PrivateRoute>
                <BookingWizard />
              </PrivateRoute>
            }
          />
          <Route
            path="/tickets"
            element={
              <PrivateRoute>
                <MyTickets />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<AdminOverview />} />
            <Route path="movies" element={<AdminMovies />} />
            <Route path="rooms" element={<AdminRooms />} />
            <Route path="showtimes" element={<AdminShowtimes />} />
            <Route path="bookings" element={<AdminBookings />} />
            <Route path="reviews" element={<AdminReviews />} />
          </Route>
          {/* Bắt-tất-cả. Thiếu nó thì đường dẫn lạ không khớp route nào và
              <Routes> dựng RỖNG — nền đen, không điều hướng, không lối ra. */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <PWAUpdatePrompt />
    </BrowserRouter>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
