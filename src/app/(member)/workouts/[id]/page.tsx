import { notFound } from "next/navigation";
import { requireActiveMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadWorkouts } from "@/lib/workouts";
import { WorkoutDetail } from "./workout-detail";

export const metadata = { title: "Workout" };

export default async function WorkoutPage({ params }: PageProps<"/workouts/[id]">) {
  const me = await requireActiveMember();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [workout] = await loadWorkouts({ ids: [id] });
  if (!workout) notFound();

  const supabase = await createClient();
  const { data: mine } = await supabase
    .from("results")
    .select("id, section_id")
    .eq("member_id", me.id)
    .in(
      "section_id",
      workout.sections.map((s) => s.id),
    );

  return <WorkoutDetail workout={workout} loggedSectionIds={(mine ?? []).map((r) => r.section_id!).filter(Boolean)} />;
}
