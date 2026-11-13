import { lazy, Suspense, useEffect } from "react";
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { BookingHeader } from "@/components/layout/BookingHeader";
import { Footer } from "@/components/layout/Footer";
import {
  EmptyState,
  LoadingState,
  PageContainer,
  RouteFocus,
} from "@/components/shared/common";
import { SessionLifecycle, RequireTraveller, HomeSessionRedirect } from "@/features/identity/session";
import HomePage from "@/pages/HomePage";
const GroupDiscoveryPage = lazy(
  () => import("@/features/group-match/GroupDiscoveryPage"),
);
const GroupDetailsPage = lazy(
  () => import("@/features/group-match/GroupDetailsPage"),
);
const SignupPage = lazy(() => import("@/features/identity/SignupPage"));
const LoginPage = lazy(() => import("@/features/identity/LoginPage"));
const DashboardPage = lazy(() => import("@/features/identity/DashboardPage"));
function PageTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title =
      pathname === "/"
        ? "Find your next adventure | Booking.com demo"
        : "Group Match | Group Travel Matcher";
  }, [pathname]);
  return null;
}
export default function App() {
  return (
    <BrowserRouter>
      <SessionLifecycle /><PageTitle />
      <RouteFocus />
      <BookingHeader />
      <main id="main-content" tabIndex={-1}>
        <Suspense
          fallback={
            <PageContainer className="page-content">
              <LoadingState />
            </PageContainer>
          }
        >
          <Routes>
            <Route path="/" element={<HomeSessionRedirect><HomePage /></HomeSessionRedirect>} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<RequireTraveller><DashboardPage /></RequireTraveller>} />
            <Route path="/group-match" element={<GroupDiscoveryPage />} />
            <Route
              path="/group-match/groups/:group_id"
              element={<GroupDetailsPage />}
            />
            <Route
              path="*"
              element={
                <PageContainer className="page-content">
                  <EmptyState
                    title="This page has taken a different route"
                    action={
                      <Link className="text-link" to="/group-match">
                        Explore Group Match
                      </Link>
                    }
                  >
                    <p>
                      Only Home and Group Match discovery are available in this
                      demo.
                    </p>
                  </EmptyState>
                </PageContainer>
              }
            />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </BrowserRouter>
  );
}
