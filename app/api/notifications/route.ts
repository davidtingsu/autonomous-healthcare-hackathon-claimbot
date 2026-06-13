import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireActor } from "@/lib/api/helpers";
import { createSupabaseServerClient } from "@/lib/supabase/client";

export async function GET(request: Request) {
  const role = requireActor(request, ["user"]);
  if (role instanceof NextResponse) return role;

  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ notifications: data ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}

const patchSchema = z.object({
  ids: z.array(z.string().uuid()).optional(),
  markAllRead: z.boolean().optional(),
  userId: z.string().uuid().optional(),
});

export async function PATCH(request: Request) {
  const role = requireActor(request, ["user"]);
  if (role instanceof NextResponse) return role;

  try {
    const body = patchSchema.parse(await request.json());
    const supabase = createSupabaseServerClient();

    if (body.markAllRead && body.userId) {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", body.userId);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (body.ids?.length) {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .in("id", body.ids);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  } catch (error) {
    return errorResponse(error, error instanceof z.ZodError ? 400 : 500);
  }
}
