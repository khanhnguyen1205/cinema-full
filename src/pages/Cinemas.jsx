import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCities, getCinemas } from "services/api";
import Navbar from "components/Navbar";
import Footer from "components/Footer";
import "./Cinemas.css";

export default function Cinemas() {
  const [cities, setCities] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [cityId, setCityId] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    getCities().then(setCities);
    getCinemas().then(setCinemas);
  }, []);

  const cityName = (id) => cities.find((c) => c.id === id)?.name || "";
  const visible = useMemo(
    () =>
      cityId === "all" ? cinemas : cinemas.filter((c) => c.cityId === cityId),
    [cinemas, cityId],
  );

  return (
    <div className="page cinemas-page">
      <Navbar />
      <section className="cinemas-section">
        <div className="section-label">Hệ thống rạp</div>
        <h1 className="cinemas-title">Rạp chiếu phim</h1>

        <div className="cinemas-cities">
          <button
            className={`genre-chip ${cityId === "all" ? "active" : ""}`}
            onClick={() => setCityId("all")}
          >
            Tất cả
          </button>
          {cities.map((c) => (
            <button
              key={c.id}
              className={`genre-chip ${cityId === c.id ? "active" : ""}`}
              onClick={() => setCityId(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="cinemas-empty">Không có rạp nào</div>
        ) : (
          <div className="cinemas-grid">
            {visible.map((c) => (
              <div
                key={c.id}
                className="cinema-card"
                onClick={() => navigate(`/cinema/${c.id}`)}
              >
                <div className="cinema-card-badge">{cityName(c.cityId)}</div>
                <h3 className="cinema-card-name">{c.name}</h3>
                <p className="cinema-card-addr">{c.address}</p>
                <span className="cinema-card-link">Xem lịch chiếu →</span>
              </div>
            ))}
          </div>
        )}
      </section>
      <Footer />
    </div>
  );
}
