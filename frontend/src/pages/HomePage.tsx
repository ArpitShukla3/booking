import { Link } from "react-router-dom";
import {
  WalletCards,
  MessageSquareHeart,
  Globe2,
  Headset,
  UsersRound,
  ArrowRight,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PageContainer,
  Photo,
  SectionHeading,
} from "@/components/shared/common";
import { SearchBar } from "@/components/shared/SearchBar";

export function HeroBanner() {
  return (
    <section className="home-hero">
      <PageContainer>
        <div className="hero-copy">
          <p className="hero-intro">Big plans. Brilliant little escapes.</p>
          <h1>
            Your next great stay,
            <br />
            for a little less.
          </h1>
          <p>
            Find your kind of place.
            <br className="mobile-break" /> Make room for more memories.
          </p>
          <Button asChild size="lg">
            <Link to="/group-match">Find travel companions</Link>
          </Button>
          <span className="hero-fine">
            11.11 travel inspiration · A hackathon demo
          </span>
        </div>
        <div className="hero-art">
          <Photo
            src="/images/kyoto.jpg"
            alt="Traditional Kyoto streets with a pagoda at sunset"
            loading="eager"
            fetchPriority="high"
          />
          <div className="sale-stamp">
            <strong>11.11</strong>
            <span>
              A good day to
              <br />
              plan a getaway.
            </span>
          </div>
          <span className="hero-location">Kyoto, Japan</span>
        </div>
      </PageContainer>
    </section>
  );
}
export function WhyBookingCards() {
  return (
    <section className="section-block">
      <SectionHeading title="Why Booking.com?" />
      <div className="why-grid">
        {[
          {
            icon: WalletCards,
            title: "Book now, pay at the property",
            text: "Flexibility that gives your travel plans a little breathing room.",
          },
          {
            icon: MessageSquareHeart,
            title: "Reviews from fellow travellers",
            text: "A little insight from people who have been there before.",
          },
          {
            icon: Globe2,
            title: "Properties around the world",
            text: "From a quiet Kyoto lane to the bright lights of Dubai.",
          },
          {
            icon: Headset,
            title: "Support along the way",
            text: "The reassurance of a helping hand when plans change.",
          },
        ].map(({ icon: Icon, title, text }) => (
          <div className="why-card" key={title}>
            <span className="why-icon">
              <Icon size={30} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>
      <p className="section-note">
        Brand-inspired promotional content. Booking and customer support are not
        available in this prototype.
      </p>
    </section>
  );
}
export function TravelCompanionsSection() {
  return (
    <section className="companions-section">
      <div className="companions-copy">
        <span className="feature-label">
          <UsersRound size={18} aria-hidden="true" />
          Introducing Group Match
        </span>
        <h2>
          Find travel companions.
          <br />
          Make more of every journey.
        </h2>
        <p>
          Same destination. Shared interests. Discover a group that’s going your
          way.
        </p>
        <ul>
          <li>
            <Check size={16} aria-hidden="true" />
            Match your dates and budget
          </li>
          <li>
            <Check size={16} aria-hidden="true" />
            Connect over the things you love
          </li>
        </ul>
        <Button asChild size="lg">
          <Link to="/group-match">
            Find your travel people <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
      <div className="companions-photo">
        <Photo
          src="/images/osaka.jpg"
          alt="Osaka’s lively streets and canal, a destination to discover together"
        />
        <div className="companions-caption">
          <span className="avatar small">S</span>
          <span className="avatar small">P</span>
          <span>
            Your next chapter.
            <br />
            <strong>Better together.</strong>
          </span>
        </div>
      </div>
    </section>
  );
}
export default function HomePage() {
  return (
    <>
      <HeroBanner />
      <PageContainer>
        <div className="home-search-wrap">
          <SearchBar />
        </div>
        <WhyBookingCards />
        <TravelCompanionsSection />
      </PageContainer>
    </>
  );
}
