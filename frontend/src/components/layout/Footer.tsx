import { Link } from "react-router-dom";
export function Footer() {
  return (
    <footer className="footer">
      <div className="page-container">
        <div className="footer-top">
          <Link to="/" className="footer-logo" translate="no">
            Booking.com
          </Link>
          <p>A great trip starts with good company.</p>
          <Link to="/group-match">Explore Group Match</Link>
        </div>
        <div className="footer-bottom">
          <p>
            Independent hackathon prototype inspired by Booking.com.
            <br />
            No affiliation, payments or actual reservations.
          </p>
          <a href="/images/CREDITS.md" target="_blank" rel="noreferrer">
            Photo credits
          </a>
          <p>Group Travel Matcher · 2026</p>
        </div>
      </div>
    </footer>
  );
}
