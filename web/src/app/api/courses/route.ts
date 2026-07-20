import { NextResponse } from "next/server";
import { createCourse, listCourses } from "@/lib/course-maker/course-db";
import type { CourseParams } from "@/lib/course-maker/course-master-schema";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  const supa = getSupabaseAdmin();
  if (!supa) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  try {
    const courses = await listCourses(supa);
    return NextResponse.json({ courses });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const supa = getSupabaseAdmin();
  if (!supa) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  let body: { params?: CourseParams; title?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const p = body.params;
  if (!p?.theme?.trim()) {
    return NextResponse.json({ error: "params.theme is required" }, { status: 400 });
  }
  try {
    const course = await createCourse(supa, p, body.title);
    return NextResponse.json({ course });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
