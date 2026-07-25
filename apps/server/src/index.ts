import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers/app-router";

const app = express();

app.use("/trpc", createExpressMiddleware({ router: appRouter }));

const port = process.env.PORT ?? 3001;

app.listen(port, () => {
  console.log(`server listening on http://localhost:${port}`);
});
