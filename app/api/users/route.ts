import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/client";

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("first_name");
    if (error) throw error;
    return NextResponse.json({ users: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
