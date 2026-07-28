import { router, publicProcedure } from "../trpc";
import { db } from "../db";
import { TagService } from "../services/tag-service";

export const tagsRouter = router({
  list: publicProcedure.query(() => new TagService(db).list()),
});
