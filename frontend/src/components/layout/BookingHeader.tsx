import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BedDouble,
  Plane,
  Luggage,
  CarFront,
  Ticket,
  CarTaxiFront,
  UsersRound,
  CircleHelp,
  ChevronDown,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDemoTravellerStore } from "@/store/useDemoTravellerStore";
import { useAsync } from "@/lib/useAsync";
import { MOCK_STORAGE_KEY } from "@/services/mock/storageKey";
import { useTravellerStore } from "@/store/useTravellerStore";
const categories = [
  { label: "Flights", icon: Plane },
  { label: "Flight + Hotel", icon: Luggage },
  { label: "Car rental", icon: CarFront },
  { label: "Activities", icon: Ticket },
  { label: "Airport taxis", icon: CarTaxiFront },
];

export function BookingHeader() {
  const account = useTravellerStore(state => state.traveller);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [switcher, setSwitcher] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [reset, setReset] = useState(false);
  const [resetError, setResetError] = useState("");
  const actor = useDemoTravellerStore((s) => s.traveller_id);
  const setTraveller = useDemoTravellerStore((s) => s.setTraveller);
  const { data: travellers, error } = useAsync(
    () => import("@/services/groupMatchService").then(({ groupMatchService }) => groupMatchService.getTravellers()),
    "sample-travellers",
  );
  const current = travellers?.find((t) => t.traveller_id === actor);
  return (
    <header className="booking-header">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="page-container">
        <div className="header-top">
          <Link to="/" className="wordmark" translate="no">
            Booking<span>.com</span>
          </Link>
          <div className="header-actions">
            <button
              className="header-text currency-control"
              onClick={() =>
                setInfo(
                  "Prices are shown in INR. Currency conversion is outside this discovery demo.",
                )
              }
              aria-label="Currency: INR"
            >
              INR
            </button>
            <button
              className="flag-control"
              aria-label="Language: English, India"
              onClick={() =>
                setInfo("You are using the English (India) discovery demo.")
              }
            >
              <span aria-hidden="true">🇮🇳</span>
            </button>
            <button
              className="header-icon"
              aria-label="Help and demo information"
              onClick={() =>
                setInfo(
                  "Search sample groups, explore shared interests, and record a mock Interested request. Requests stay in this browser. Other booking categories are visual only.",
                )
              }
            >
              <CircleHelp size={23} />
            </button>
            {account ? <><Link to="/dashboard" className="header-profile"><span className="avatar small">{account.name.charAt(0)}</span><span>{account.name}</span></Link><Button variant="outline" className="header-button" onClick={() => { useTravellerStore.getState().logout(); navigate('/login'); }}>Logout</Button></> : <><Button variant="outline" className="header-button" asChild><Link to="/signup">Register</Link></Button><Button variant="outline" className="header-button" asChild><Link to="/login">Sign in</Link></Button></>}
          </div>
        </div>
        <nav aria-label="Booking categories" className="main-navigation">
          <NavLink
            end
            to="/"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <BedDouble size={20} aria-hidden="true" />
            Stays
          </NavLink>
          {categories.map(({ label, icon: Icon }) => (
            <button
              type="button"
              className="nav-item visual-tab"
              key={label}
              onClick={() =>
                setInfo(
                  `${label} is a visual navigation item in this prototype. Only Home and Group Match discovery are available.`,
                )
              }
            >
              <Icon size={20} aria-hidden="true" />
              {label}
            </button>
          ))}
          <NavLink
            to="/group-match"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <UsersRound size={20} aria-hidden="true" />
            Group Match<span className="new-label">New</span>
          </NavLink>
          {account ? (
            <NavLink
              to="/my-groups"
              className={({ isActive }) => `nav-item ${isActive || pathname.startsWith("/groups/") ? "active" : ""}`}
            >
              <Luggage size={20} aria-hidden="true" />
              My groups
            </NavLink>
          ) : null}
        </nav>
      </div>
      <div className="demo-strip" hidden={pathname === "/login" || pathname === "/signup" || pathname === "/dashboard" || pathname.startsWith("/group-match") || pathname.startsWith("/groups") || pathname === "/my-groups"}>
        <div className="page-container">
          <span>
            Group Travel Matcher{" "}
            <span className="demo-strip-extra">· Discovery demo</span>
          </span>
          <button aria-label="Switch sample traveller" onClick={() => setSwitcher(true)}>
            <span className="avatar tiny">
              {current?.name.charAt(0) || "?"}
            </span>
            <strong>Sample: {current?.name || "Choose a traveller"}</strong>
            <span className="switch-label">Switch traveller</span>
            <ChevronDown size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
      <Dialog
        open={switcher}
        onOpenChange={setSwitcher}
        title="Choose a sample traveller"
        description="Your selection is used for gender compatibility and the Interested state. Sample profiles and groups come from the official data pack."
      >
        {error ? <p role="alert">{error.message}</p> : null}
        <div className="switcher-list">
          {travellers?.map((t) => (
            <button
              key={t.traveller_id}
              className={`switcher-person ${t.traveller_id === actor ? "selected" : ""}`}
              onClick={() => {
                setTraveller(t.traveller_id);
                setSwitcher(false);
              }}
            >
              <span className="avatar">{t.name.charAt(0)}</span>
              <span>
                <strong>{t.name}</strong>
                <small>
                  {t.home_city} · {t.gender.toLowerCase()} · {t.age}
                </small>
              </span>
              {t.traveller_id === actor ? (
                <span className="tag blue">Selected</span>
              ) : null}
            </button>
          ))}
        </div>
        <p className="field-hint mt-4">
          Try Priya Shah with Kyoto, 10–15 April, ₹60,000, temples and street
          food.
        </p>
        <button
          className="text-link mt-4 text-sm"
          onClick={() => {
            setSwitcher(false);
            setReset(true);
          }}
        >
          Clear saved interest requests
        </button>
      </Dialog>
      <Dialog
        open={!!info}
        onOpenChange={() => setInfo(null)}
        title="About this demo"
      >
        <p>{info}</p>
        <Button className="mt-5" onClick={() => setInfo(null)}>
          Got it
        </Button>
      </Dialog>
      <Dialog
        open={reset}
        onOpenChange={setReset}
        title="Clear your demo requests?"
        description="This removes pending interest requests in this browser. It keeps your active sample traveller."
      >
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setReset(false)}>
            Keep requests
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              try {
                localStorage.removeItem(MOCK_STORAGE_KEY);
                window.location.reload();
              } catch {
                setResetError(
                  "Browser storage could not be cleared. Enable storage and try again.",
                );
              }
            }}
          >
            Clear requests
          </Button>
        </div>
        {resetError ? (
          <p role="alert" className="field-error mt-3">
            {resetError}
          </p>
        ) : null}
      </Dialog>
    </header>
  );
}
