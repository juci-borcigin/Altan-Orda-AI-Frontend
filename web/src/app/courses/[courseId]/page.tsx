"use client";

import { useParams } from "next/navigation";
import { CourseAdminView } from "@/components/course-maker/CourseAdminView";

export default function CourseAdminPage() {
  const { courseId } = useParams<{ courseId: string }>();
  return <CourseAdminView courseId={courseId} />;
}
