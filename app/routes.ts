import {
  index,
  layout,
  prefix,
  route,
  type RouteConfig,
} from "@react-router/dev/routes";

export default [
  layout("routes/site-layout.tsx", [
    index("routes/home.tsx"),
    route("guides", "routes/guides.tsx"),
    route("guides/:slug", "routes/guide-detail.tsx"),
    route("search", "routes/search.tsx"),
    route("rules", "routes/rules.tsx"),
    route("setup", "routes/setup.tsx"),
    route("login", "routes/login.tsx"),
    route("register", "routes/register.tsx"),
    route("logout", "routes/logout.tsx"),
    ...prefix("dashboard", [
      index("routes/dashboard.tsx"),
      route("guides/new", "routes/draft-new.tsx"),
      route("guides/:entryId/edit", "routes/draft-edit.tsx"),
      route("guides/:entryId/submit", "routes/draft-submit.tsx"),
    ]),
    ...prefix("admin", [
      route("reviews", "routes/admin-reviews.tsx"),
      route("reviews/:revisionId", "routes/admin-review-detail.tsx"),
      route("categories", "routes/admin-categories.tsx"),
      route("invites", "routes/admin-invites.tsx"),
      route("users", "routes/admin-users.tsx"),
      route("registration", "routes/admin-registration.tsx"),
    ]),
  ]),
  route("api/health", "routes/api-health.ts"),
  route("api/submissions/:entryId/status", "routes/api-submission-status.ts"),
] satisfies RouteConfig;
