import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { listNotificationsForUser } from "@/lib/graph/events";
import { errorResponse, requireActor } from "@/lib/api/helpers";
import { getDb, schema } from "@/lib/db";
import { userIdSchema } from "@/lib/validation";

const { notifications } = schema;

export async function GET(request: Request) {
  const role = requireActor(request, ["user"]);
  if (role instanceof NextResponse) return role;

  try {
    const url = new URL(request.url);
    const userId = userIdSchema.parse(url.searchParams.get("userId"));
    const data = await listNotificationsForUser(userId);
    return NextResponse.json({ notifications: data });
  } catch (error) {
    return errorResponse(error, error instanceof z.ZodError ? 400 : 500);
  }
}

const patchSchema = z.object({
  ids: z.array(z.uuid()).optional(),
  markAllRead: z.boolean().optional(),
  userId: userIdSchema.optional(),
});

export async function PATCH(request: Request) {
  const role = requireActor(request, ["user"]);
  if (role instanceof NextResponse) return role;

  try {
    const body = patchSchema.parse(await request.json());
    const db = getDb();

    if (body.markAllRead && body.userId) {
      await db
        .update(notifications)
        .set({ read: true })
        .where(eq(notifications.user_id, body.userId));
      return NextResponse.json({ ok: true });
    }

    if (body.ids?.length) {
      await db
        .update(notifications)
        .set({ read: true })
        .where(inArray(notifications.id, body.ids));
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  } catch (error) {
    return errorResponse(error, error instanceof z.ZodError ? 400 : 500);
  }
}
