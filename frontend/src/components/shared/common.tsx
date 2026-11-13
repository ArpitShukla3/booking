import { useEffect, useRef } from "react";
import type { ImgHTMLAttributes, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { AlertCircle, CheckCircle2, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { interestLabel } from "@/data/interestLabels";
export function PageContainer({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`page-container ${className}`}>{children}</div>;
}
export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
export function Photo({
  src,
  alt,
  className = "",
  fallback = "/images/kyoto.jpg",
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { fallback?: string }) {
  return (
    <img
      src={src}
      alt={alt}
      width={800}
      height={500}
      loading="lazy"
      className={`photo ${className}`}
      onError={(event) => {
        const image = event.currentTarget;
        if (!image.dataset.fallback) {
          image.dataset.fallback = "true";
          image.src = fallback;
        }
      }}
      {...props}
    />
  );
}
export function DemoNotice() {
  return (
    <div className="demo-notice">
      <AlertCircle size={17} aria-hidden="true" />
      <p>
        Discovery demo · Sample data only. Interest requests stay in this
        browser and are not sent to a group owner.
      </p>
    </div>
  );
}
export function LoadingState() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading matches">
      <div className="skeleton h-10 w-2/3" />
      <div className="skeleton h-48" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <UsersRound size={36} aria-hidden="true" />
      <h2>{title}</h2>
      <div className="text-muted-foreground">{children}</div>
      {action}
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle aria-hidden="true" />
      <h2>Something needs your attention</h2>
      <p>
        {error instanceof Error
          ? error.message
          : "Could not load this page. Please try again."}
      </p>
      {retry ? (
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
      ) : null}
      <Link className="text-link" to="/group-match">
        Return to Group Match
      </Link>
    </div>
  );
}
/** `highlight` marks shared interests (blue tag + screen-reader text). */
export function InterestTags({ values, highlight = [] }: { values: string[]; highlight?: string[] }) {
  return (
    <div className="tags">
      {values.map((i) => (
        <span className={highlight.includes(i) ? "tag blue" : "tag"} key={i}>
          {interestLabel(i)}
          {highlight.includes(i) ? <span className="sr-only"> (shared)</span> : null}
        </span>
      ))}
    </div>
  );
}
export function MatchExplanation({ reasons }: { reasons: string[] }) {
  return (
    <ul className="match-reasons">
      {reasons.map((r) => (
        <li key={r}>
          <CheckCircle2 size={14} aria-hidden="true" />
          {r}
        </li>
      ))}
    </ul>
  );
}
export function RouteFocus() {
  const { pathname } = useLocation();
  const previous = useRef(pathname);
  useEffect(() => {
    if (previous.current !== pathname) {
      window.scrollTo(0, 0);
      document.getElementById("main-content")?.focus();
      previous.current = pathname;
    }
  }, [pathname]);
  return null;
}
