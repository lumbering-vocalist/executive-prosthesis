import { httpRouter } from "convex/server";
import { auth } from "./auth";

// Only Convex Auth's routes (JWKS + OAuth callbacks) exist before T6's
// capture endpoint.
const http = httpRouter();
auth.addHttpRoutes(http);
export default http;
