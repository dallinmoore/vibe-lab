import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/board.tsx"),
  route("issues/:id", "routes/issue.tsx"),
] satisfies RouteConfig;
