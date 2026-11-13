import { lazy, Suspense, useEffect } from "react";
import {
  BrowserRouter,
  Link,
  Route,
  Navigate,
  Routes,
  useLocation,
  useParams,
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
const SignupPage = lazy(() => import("@/features/identity/SignupPage"));
const LoginPage = lazy(() => import("@/features/identity/LoginPage"));
const DashboardPage = lazy(() => import("@/features/identity/DashboardPage"));
const CreateGroupPage = lazy(() => import("@/features/groups/CreateGroupPage"));
const MyGroupsPage = lazy(() => import("@/features/groups/MyGroupsPage"));
const GroupPage = lazy(() => import("@/features/groups/GroupPage"));
const MyRequestsPage = lazy(() => import("@/features/groups/MyRequestsPage"));
const TravellerProfilePage = lazy(() => import("@/features/profile/TravellerProfilePage"));
const GroupChatPage = lazy(() => import("@/features/chat/GroupChatPage"));
const HotelDetailsPage = lazy(() => import("@/features/hotels/HotelDetailsPage"));
const CreditsPage = lazy(() => import("@/features/hotels/CreditsPage"));
function PageTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title =
      pathname === "/"
        ? "Find your next adventure | Booking.com demo"
        : pathname === "/groups/new"
          ? "Create a group trip | Group Travel Matcher"
          : pathname === "/my-groups"
            ? "My groups | Group Travel Matcher"
            : pathname === "/my-requests"
              ? "My requests | Group Travel Matcher"
            : /^\/groups\/[^/]+\/chat$/.test(pathname)
              ? "Team chat | Group Travel Matcher"
            : pathname.startsWith("/travellers/")
              ? "Traveller profile | Group Travel Matcher"
            : pathname === "/credits"
              ? "Photo credits | Group Travel Matcher"
            : /^\/groups\/[^/]+\/hotels\//.test(pathname)
              ? "Hotel | Group Travel Matcher"
            : pathname.startsWith("/groups/")
              ? "Group details | Group Travel Matcher"
              : "Group Match | Group Travel Matcher";
  }, [pathname]);
  return null;
}
/** Old mock details URL → the live Group Details page (M2). */
function LegacyGroupRedirect() {
  const { group_id = "" } = useParams();
  return <Navigate to={`/groups/${group_id}`} replace />;
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
            <Route path="/groups/new" element={<RequireTraveller><CreateGroupPage /></RequireTraveller>} />
            <Route path="/my-groups" element={<RequireTraveller><MyGroupsPage /></RequireTraveller>} />
            <Route path="/my-requests" element={<RequireTraveller><MyRequestsPage /></RequireTraveller>} />
            <Route path="/groups/:groupId" element={<GroupPage />} />
            <Route path="/groups/:groupId/chat" element={<RequireTraveller><GroupChatPage /></RequireTraveller>} />
            <Route path="/travellers/:travellerId" element={<TravellerProfilePage />} />
            <Route path="/groups/:groupId/hotels/:hotelId" element={<RequireTraveller><HotelDetailsPage /></RequireTraveller>} />
            <Route path="/credits" element={<CreditsPage />} />
            <Route path="/group-match" element={<RequireTraveller><GroupDiscoveryPage /></RequireTraveller>} />
            <Route path="/group-match/groups/:group_id" element={<LegacyGroupRedirect />} />
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
