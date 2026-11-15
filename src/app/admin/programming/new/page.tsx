import EditWorkoutPage from "../[id]/page";

export const metadata = { title: "New workout" };

export default function NewWorkoutPage({ searchParams }: PageProps<"/admin/programming/new">) {
  return <EditWorkoutPage params={Promise.resolve({ id: "new" })} searchParams={searchParams} />;
}
