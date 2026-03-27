import { getActiveTournament } from "~/server/utils/tournament";

export default defineEventHandler(async (_event) => {
  return await getActiveTournament();
});
