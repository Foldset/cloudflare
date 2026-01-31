import { Hono } from "hono";
import { paymentHandler } from "./payment/handler";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.all("*", (c) => paymentHandler(c));

export default app;
