import React, { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta?.env?.VITE_API_BASE || "https://pg-booking-backend-448h.onrender.com/api";
const DEPOSIT_FIXED = 1000;
const PLATFORM_FIXED = 299;

function money(n) {
  const num = Number(n || 0);
  return `₹${num}`;
}

function formatDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(dateStr, days) {
  const dt = new Date(dateStr);
  dt.setDate(dt.getDate() + days);
  return formatDate(dt.toISOString());
}

function Badge({ children }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
      }}
    >
      {children}
    </span>
  );
}

function Button({ children, onClick, variant = "primary", disabled, type }) {
  const styles =
    variant === "primary"
      ? {
          background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.10)",
        }
      : variant === "danger"
      ? {
          background: "rgba(239,68,68,0.12)",
          color: "#fecaca",
          border: "1px solid rgba(239,68,68,0.35)",
        }
      : {
          background: "rgba(255,255,255,0.06)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.12)",
        };

  return (
    <button
      type={type || "button"}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 14px",
        borderRadius: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        fontWeight: 700,
        letterSpacing: 0.2,
        ...styles,
      }}
    >
      {children}
    </button>
  );
}

function Input({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12, opacity: 0.75 }}>{label}</div>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "12px 12px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.05)",
          color: "white",
          outline: "none",
        }}
      />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12, opacity: 0.75 }}>{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "12px 12px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.05)",
          color: "white",
          outline: "none",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ color: "black" }}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Card({ children }) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.12)",
        background:
          "radial-gradient(1200px 400px at 20% 0%, rgba(37,99,235,0.18), transparent), rgba(255,255,255,0.04)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
      }}
    >
      {children}
    </div>
  );
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const body = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = isJson ? body?.error || JSON.stringify(body) : body;
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return body;
}

async function fetchJsonTry(urls, options) {
  let lastErr = null;
  for (const u of urls) {
    try {
      return await fetchJson(u, options);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Request failed");
}

export default function App() {
  // ---------- AUTH ----------
  const [customer, setCustomer] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("pg_customer") || "null");
    } catch {
      return null;
    }
  });
  const [loginName, setLoginName] = useState(customer?.name || "");
  const [loginPhone, setLoginPhone] = useState(customer?.phone || "");
  const [loginGender, setLoginGender] = useState(customer?.gender || "boy");
  const [loginMsg, setLoginMsg] = useState("");

  const customerUserId = customer?.id ? Number(customer.id) : null;

  async function loginCustomer(e) {
    e?.preventDefault?.();
    setLoginMsg("");
    setError("");
    try {
      const out = await fetchJson(`${API_BASE}/auth/customer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: loginName, phone: loginPhone, gender: loginGender }),
      });
      const user = out?.data?.user;
      if (!user?.id) throw new Error("Login failed");
      setCustomer(user);
      localStorage.setItem("pg_customer", JSON.stringify(user));
      setLoginMsg(`✅ Logged in as ${user.name} (ID: ${user.id})`);

      // auto go to search
      setView("list");
      setTimeout(loadPgs, 0);
    } catch (e2) {
      setLoginMsg(`❌ ${e2.message}`);
    }
  }

  function logout() {
    localStorage.removeItem("pg_customer");
    setCustomer(null);
    setLoginName("");
    setLoginPhone("");
    setLoginGender("boy");
    setLoginMsg("✅ Logged out");
    setView("list");
  }

  // ---------- UI ----------
  const [view, setView] = useState("list"); // list | details | payment | mybookings
  const [error, setError] = useState("");

  // ---------- PG LIST ----------
  const [pgs, setPgs] = useState([]);
  const [loading, setLoading] = useState(false);

  async function loadPgs() {
    setError("");
    setLoading(true);
    try {
      const out = await fetchJson(`${API_BASE}/pgs`);
      const data = out?.data || out || [];
      setPgs(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ---------- DETAILS ----------
  const [selectedPgId, setSelectedPgId] = useState(null);
  const [pgDetails, setPgDetails] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  async function openDetails(pgId) {
    setError("");
    setSelectedPgId(pgId);
    setView("details");
    setBookMsg("");
    setSelectedRoomId(null);
    setPgDetails(null);
    setRooms([]);
    setDetailLoading(true);
    try {
      const out = await fetchJson(`${API_BASE}/pgs/${pgId}`);
      const data = out?.data || null;

      if (data?.pg) {
        setPgDetails(data.pg);
        setRooms(data.rooms || []);
      } else {
        setPgDetails(data);
        setRooms(out?.rooms || data?.rooms || []);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setDetailLoading(false);
    }
  }

  // ---------- BOOKING ----------
  const [bookingType, setBookingType] = useState("fixed");
  const [bedsBooked, setBedsBooked] = useState("1");
  const today = formatDate(new Date().toISOString());
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDays(today, 7));
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [bookMsg, setBookMsg] = useState("");

  // ---------- PAYMENT (UPI + screenshot) ----------
  const [paymentBookingId, setPaymentBookingId] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [paymentFile, setPaymentFile] = useState(null);
  const [paymentMsg, setPaymentMsg] = useState("");
  const [paymentUploading, setPaymentUploading] = useState(false);

  // ✅ UPI input (to avoid "customerUpi required")
  const [customerUpi, setCustomerUpi] = useState("");

  const canBook = useMemo(() => {
    if (!selectedRoomId) return false;
    if (!customerUserId) return false;
    if (!Number(bedsBooked) || Number(bedsBooked) < 1) return false;
    if (!startDate) return false;
    if (bookingType === "fixed" && !endDate) return false;
    if (!String(customerUpi || "").trim()) return false;
    return true;
  }, [selectedRoomId, customerUserId, bedsBooked, startDate, endDate, bookingType, customerUpi]);

  async function createBooking() {
    setBookMsg("");
    setError("");
    try {
      if (!customerUserId) throw new Error("Please login first");
      if (!String(customerUpi || "").trim()) throw new Error("customerUpi required");

      // ✅ send dual keys to match any backend version
      const payload = {
        user_id: Number(customerUserId),
        customerUserId: Number(customerUserId),

        pg_id: Number(selectedPgId),
        pgId: Number(selectedPgId),

        room_id: Number(selectedRoomId),
        roomId: Number(selectedRoomId),

        booking_type: bookingType,
        bookingType: bookingType,

        beds_booked: Number(bedsBooked),
        bedsBooked: Number(bedsBooked),

        start_date: startDate,
        startDate: startDate,

        end_date: bookingType === "fixed" ? endDate : null,
        endDate: bookingType === "fixed" ? endDate : null,

        customer_upi: String(customerUpi).trim(),
        customerUpi: String(customerUpi).trim(),
      };

      const out = await fetchJson(`${API_BASE}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const bookingId = out?.data?.id || out?.data?.booking?.id;
      setBookMsg(`✅ Booking created! Booking ID: ${bookingId}`);

      // ✅ go to payment screen (customer must pay & upload screenshot)
      if (bookingId) {
        setPaymentBookingId(Number(bookingId));
        setPaymentData(out?.data || null);
        setPaymentFile(null);
        setPaymentMsg("");
        setView("payment");
      }
    } catch (e) {
      setBookMsg(`❌ ${e.message}`);
    }
  }

  async function uploadPaymentScreenshot() {
    setPaymentMsg("");
    setError("");
    setPaymentUploading(true);
    try {
      const bid = Number(paymentBookingId);
      if (!bid) throw new Error("bookingId invalid");
      if (!paymentFile) throw new Error("Please select screenshot file");

      const fd = new FormData();
      fd.append("file", paymentFile);

      const urls = [`${API_BASE}/bookings/${bid}/payment-screenshot`, `${API_BASE}/customer/bookings/${bid}/payment-screenshot`];

      await fetchJsonTry(urls, { method: "POST", body: fd });
      setPaymentMsg("✅ Payment screenshot uploaded. Waiting for owner confirmation.");

      // After upload, show in My Bookings
      setView("mybookings");
      await loadMyBookings();
    } catch (e) {
      setPaymentMsg(`❌ ${e.message}`);
    } finally {
      setPaymentUploading(false);
    }
  }

  // ---------- MY BOOKINGS ----------
  const [myBookings, setMyBookings] = useState([]);
  const [myLoading, setMyLoading] = useState(false);
  const [myMsg, setMyMsg] = useState("");

  async function loadMyBookings() {
    setMyMsg("");
    setError("");
    setMyLoading(true);
    try {
      if (!customerUserId) throw new Error("Please login first");

      const uid = Number(customerUserId);
      if (!Number.isFinite(uid)) throw new Error("Invalid customer id");

      // backend route can be different in different versions
      const urls = [
        `${API_BASE}/customer/bookings/${uid}`,
        `${API_BASE}/customer/bookings?user_id=${uid}`,
        `${API_BASE}/bookings/customer/${uid}`,
        `${API_BASE}/bookings?user_id=${uid}`,
      ];

      const out = await fetchJsonTry(urls);
      setMyBookings(out?.data || out || []);
    } catch (e) {
      setMyMsg(`❌ ${e.message}`);
    } finally {
      setMyLoading(false);
    }
  }

  async function cancelBooking(bookingId) {
    setMyMsg("");
    setError("");
    try {
      if (!customerUserId) throw new Error("Please login first");
      const out = await fetchJson(`${API_BASE}/customer/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: Number(customerUserId) }),
      });
      setMyMsg(`✅ Cancelled booking #${out?.data?.id}`);
      await loadMyBookings();
    } catch (e) {
      setMyMsg(`❌ ${e.message}`);
    }
  }

  useEffect(() => {
    loadPgs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bgStyle = {
    minHeight: "100vh",
    color: "white",
    background:
      "radial-gradient(900px 450px at 15% 0%, rgba(37,99,235,0.22), transparent 60%), radial-gradient(900px 450px at 85% 20%, rgba(59,130,246,0.16), transparent 60%), #060A12",
    padding: 18,
  };

  const shellStyle = { maxWidth: 1100, margin: "0 auto" };

  return (
    <div style={bgStyle}>
      <div style={shellStyle}>
        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>PG Customer Panel</div>
            <div style={{ opacity: 0.8, marginTop: 6 }}>
              Jaipur only • Deposit <b>₹1000</b> • Platform <b>₹299</b>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Button variant={view === "list" ? "primary" : "secondary"} onClick={() => setView("list")}>
              Search PGs
            </Button>
            <Button
              variant={view === "mybookings" ? "primary" : "secondary"}
              onClick={() => {
                setView("mybookings");
                loadMyBookings();
              }}
            >
              My Bookings
            </Button>
            <Button variant="secondary" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>

        {/* LOGIN */}
        {!customerUserId ? (
          <div style={{ marginTop: 14 }}>
            <Card>
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 18, fontWeight: 900 }}>Login</div>
                <form onSubmit={loginCustomer} style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <Input label="Name" value={loginName} onChange={setLoginName} placeholder="e.g. Ram" />
                  <Input label="Phone" value={loginPhone} onChange={setLoginPhone} placeholder="e.g. 9999999999" />
                  <Select
                    label="Gender"
                    value={loginGender}
                    onChange={setLoginGender}
                    options={[
                      { label: "boy", value: "boy" },
                      { label: "girl", value: "girl" },
                    ]}
                  />
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                    <Button type="submit">Login</Button>
                  </div>
                </form>

                {loginMsg ? (
                  <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" }}>
                    {loginMsg}
                  </div>
                ) : null}
              </div>
            </Card>
          </div>
        ) : (
          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Badge>
              Logged in: <b>{customer?.name}</b>
            </Badge>
            <Badge>
              ID: <b>{customerUserId}</b>
            </Badge>
            <Badge>
              Gender: <b>{customer?.gender}</b>
            </Badge>
          </div>
        )}

        {error ? (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" }}>
            ❌ {error}
          </div>
        ) : null}

        {/* LIST */}
        {view === "list" && (
          <div style={{ marginTop: 16 }}>
            <Card>
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>Search PGs</div>
                  <Button variant="secondary" onClick={loadPgs} disabled={loading}>
                    {loading ? "Loading..." : "Refresh"}
                  </Button>
                </div>

                <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                  {pgs.map((p) => {
                    const imgs = Array.isArray(p.image_urls) ? p.image_urls : [];
                    const cover = imgs[0] ? `${API_BASE.replace("/api", "")}${imgs[0]}` : null;
                    return (
                      <div
                        key={p.id}
                        style={{
                          borderRadius: 18,
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: "rgba(255,255,255,0.03)",
                          overflow: "hidden",
                          cursor: "pointer",
                        }}
                        onClick={() => openDetails(p.id)}
                      >
                        <div style={{ height: 150, background: "rgba(255,255,255,0.05)" }}>
                          {cover ? (
                            <img src={cover} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.65 }}>
                              No Image
                            </div>
                          )}
                        </div>
                        <div style={{ padding: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                            <div style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.2 }}>{p.name}</div>
                            <Badge>{p.pg_type}</Badge>
                          </div>
                          <div style={{ marginTop: 8, opacity: 0.85, fontSize: 13 }}>{p.address}</div>
                          <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <Badge>{p.area}</Badge>
                            <span style={{ fontSize: 12, opacity: 0.7 }}>{imgs.length} photos</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {pgs.length === 0 && !loading ? <div style={{ marginTop: 18, opacity: 0.75 }}>No PG found.</div> : null}
              </div>
            </Card>
          </div>
        )}

        {/* DETAILS VIEW */}
        {view === "details" && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <Button variant="secondary" onClick={() => setView("list")}>
                ← Back
              </Button>
              <Button variant="secondary" onClick={() => selectedPgId && openDetails(selectedPgId)} disabled={detailLoading}>
                {detailLoading ? "Refreshing..." : "Refresh"}
              </Button>
            </div>

            <Card>
              <div style={{ padding: 16 }}>
                {detailLoading ? (
                  <div style={{ opacity: 0.8 }}>Loading PG details...</div>
                ) : pgDetails ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 900 }}>{pgDetails.name}</div>
                        <div style={{ marginTop: 6, opacity: 0.8 }}>{pgDetails.address}</div>
                        <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <Badge>{pgDetails.pg_type}</Badge>
                          <Badge>{pgDetails.area}</Badge>
                        </div>
                      </div>

                      <div style={{ minWidth: 320, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <Select
                          label="Booking type"
                          value={bookingType}
                          onChange={setBookingType}
                          options={[
                            { label: "Fixed (dates)", value: "fixed" },
                            { label: "Unlimited (open)", value: "unlimited" },
                          ]}
                        />
                        <Input label="Beds" value={bedsBooked} onChange={setBedsBooked} type="number" placeholder="1" />
                        <Input label="Start date" value={startDate} onChange={setStartDate} type="date" />
                        <Input label="End date" value={endDate} onChange={setEndDate} type="date" />
                      </div>
                    </div>

                    {/* ✅ Customer UPI */}
                    <div style={{ marginTop: 14 }}>
                      <Input label="Customer UPI ID (required for booking)" value={customerUpi} onChange={setCustomerUpi} placeholder="e.g. ram@upi" />
                    </div>

                    {/* Photos */}
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontWeight: 900, marginBottom: 8 }}>Photos</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10 }}>
                        {(Array.isArray(pgDetails.image_urls) ? pgDetails.image_urls : []).map((u, idx) => {
                          const img = u ? `${API_BASE.replace("/api", "")}${u}` : null;
                          return (
                            <div
                              key={idx}
                              style={{
                                borderRadius: 14,
                                border: "1px solid rgba(255,255,255,0.10)",
                                background: "rgba(255,255,255,0.04)",
                                overflow: "hidden",
                                height: 90,
                              }}
                            >
                              {img ? <img src={img} alt={`img-${idx}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                            </div>
                          );
                        })}
                      </div>
                      {(Array.isArray(pgDetails.image_urls) ? pgDetails.image_urls : []).length === 0 ? (
                        <div style={{ marginTop: 10, opacity: 0.75 }}>No images saved for this PG.</div>
                      ) : null}
                    </div>

                    {/* Rooms */}
                    <div style={{ marginTop: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 900 }}>Rooms</div>
                        <Badge>Select a room to book</Badge>
                      </div>

                      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                        {(rooms || []).map((r) => {
                          const isSelected = Number(selectedRoomId) === Number(r.id);
                          const rent = Number(r.rent_monthly || r.rent || 0);
                          const total = rent + DEPOSIT_FIXED + PLATFORM_FIXED;

                          return (
                            <div
                              key={r.id}
                              style={{
                                borderRadius: 18,
                                border: isSelected ? "1px solid rgba(37,99,235,0.65)" : "1px solid rgba(255,255,255,0.10)",
                                background: isSelected ? "rgba(37,99,235,0.10)" : "rgba(255,255,255,0.03)",
                                padding: 14,
                                cursor: "pointer",
                              }}
                              onClick={() => setSelectedRoomId(String(r.id))}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ fontWeight: 900, fontSize: 15 }}>{r.room_type}</div>
                                <Badge>{Number(r.available_beds ?? 0)} beds</Badge>
                              </div>

                              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
                                <div style={{ opacity: 0.85 }}>
                                  Rent: <b>{money(rent)}</b>
                                </div>
                                <div style={{ opacity: 0.85 }}>
                                  Deposit: <b>{money(DEPOSIT_FIXED)}</b>
                                </div>
                                <div style={{ opacity: 0.85 }}>
                                  Platform: <b>{money(PLATFORM_FIXED)}</b>
                                </div>
                                <div style={{ opacity: 0.85 }}>
                                  Total: <b>{money(total)}</b>
                                </div>
                              </div>

                              <div style={{ marginTop: 12 }}>
                                <Button variant={isSelected ? "primary" : "secondary"} onClick={() => setSelectedRoomId(String(r.id))}>
                                  {isSelected ? "Selected" : "Select"}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {(rooms || []).length === 0 ? <div style={{ marginTop: 10, opacity: 0.75 }}>No rooms found.</div> : null}
                    </div>

                    {/* Book */}
                    <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{ opacity: 0.85, fontSize: 13 }}>
                        <div>
                          Customer: <b>{customer?.name || "-"}</b> (ID: <b>{customerUserId || "-"}</b>)
                        </div>
                        <div>
                          Selected Room: <b>{selectedRoomId || "-"}</b>
                        </div>
                        <div>
                          Type: <b>{bookingType}</b> • Beds: <b>{bedsBooked}</b>
                        </div>
                        <div>
                          Customer UPI: <b>{customerUpi || "-"}</b>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <Button onClick={createBooking} disabled={!canBook}>
                          Book Now
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setBookMsg("");
                            setSelectedRoomId(null);
                          }}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>

                    {bookMsg ? (
                      <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" }}>
                        {bookMsg}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div style={{ opacity: 0.75 }}>No details.</div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* PAYMENT */}
        {view === "payment" && (
          <div style={{ marginTop: 16 }}>
            <Card>
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>Payment</div>
                    <div style={{ opacity: 0.8, marginTop: 6 }}>
                      Booking ID: <b>{paymentBookingId || "-"}</b>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <Button variant="secondary" onClick={() => setView("details")}>
                      Back
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setView("mybookings");
                        loadMyBookings();
                      }}
                    >
                      My Bookings
                    </Button>
                  </div>
                </div>

                <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)", padding: 14 }}>
                    <div style={{ fontWeight: 900 }}>Pay to Owner UPI</div>
                    <div style={{ marginTop: 10, fontSize: 14, opacity: 0.9 }}>
                      UPI ID: <b>{paymentData?.payment?.ownerUpi || paymentData?.booking?.owner_upi || "(Owner UPI not set)"}</b>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>{paymentData?.payment?.note || "Pay using any UPI app and upload screenshot."}</div>
                    <div style={{ marginTop: 12, fontSize: 13, opacity: 0.9 }}>
                      Amount: <b>{money(paymentData?.booking?.total_amount ?? paymentData?.total_amount)}</b>
                    </div>
                  </div>

                  <div style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)", padding: 14 }}>
                    <div style={{ fontWeight: 900 }}>Upload Payment Screenshot</div>
                    <div style={{ marginTop: 10 }}>
                      <input type="file" accept="image/*" onChange={(e) => setPaymentFile(e.target.files?.[0] || null)} style={{ width: "100%" }} />
                    </div>
                    <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
                      <Button onClick={uploadPaymentScreenshot} disabled={paymentUploading}>
                        {paymentUploading ? "Uploading..." : "Submit Screenshot"}
                      </Button>
                      <Button variant="secondary" onClick={() => setPaymentFile(null)} disabled={paymentUploading}>
                        Clear
                      </Button>
                    </div>
                    {paymentMsg ? (
                      <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" }}>
                        {paymentMsg}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* MY BOOKINGS */}
        {view === "mybookings" && (
          <div style={{ marginTop: 16 }}>
            <Card>
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>My Bookings</div>
                    <div style={{ opacity: 0.8, marginTop: 6 }}>
                      Customer: <b>{customer?.name || "-"}</b>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <Button onClick={loadMyBookings} disabled={myLoading}>
                      {myLoading ? "Loading..." : "Refresh"}
                    </Button>
                    <Button variant="secondary" onClick={() => setView("list")}>
                      Back
                    </Button>
                  </div>
                </div>

                {myMsg ? (
                  <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" }}>
                    {myMsg}
                  </div>
                ) : null}

                <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  {myBookings.map((b) => (
                    <div
                      key={b.id}
                      style={{
                        borderRadius: 18,
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: "rgba(255,255,255,0.03)",
                        padding: 14,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                        <div style={{ fontWeight: 900 }}>Booking #{b.id}</div>
                        <Badge>{b.status}</Badge>
                      </div>

                      <div style={{ marginTop: 8, opacity: 0.85, fontSize: 13 }}>
                        PG: <b>{b.pg_name || "-"}</b> • Room: <b>{b.room_type || "-"}</b>
                      </div>

                      <div style={{ marginTop: 8, opacity: 0.85, fontSize: 13 }}>
                        Dates: <b>{formatDate(b.start_date)}</b> → <b>{b.end_date ? formatDate(b.end_date) : "Unlimited"}</b>
                      </div>

                      <div style={{ marginTop: 10, fontSize: 13 }}>
                        Total: <b>{money(b.total_amount)}</b>
                      </div>

                      <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                        <Button
                          onClick={() => {
                            setPaymentBookingId(Number(b.id));
                            setPaymentData({ booking: b, payment: { ownerUpi: b.owner_upi, note: "Pay using any UPI app and upload screenshot." } });
                            setPaymentFile(null);
                            setPaymentMsg("");
                            setView("payment");
                          }}
                          disabled={String(b.status) !== "pending" || ["submitted", "verified"].includes(String(b.payment_status || "").toLowerCase())}
                        >
                          Pay Now
                        </Button>
                        <Button variant="danger" onClick={() => cancelBooking(b.id)} disabled={b.status !== "pending"}>
                          Cancel
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            if (b.pg_id) openDetails(b.pg_id);
                          }}
                        >
                          View PG
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {myBookings.length === 0 && !myLoading ? <div style={{ marginTop: 14, opacity: 0.75 }}>No bookings yet.</div> : null}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}