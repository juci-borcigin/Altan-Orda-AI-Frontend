"use client";

import { useParams } from "next/navigation";
import { CourseLearnView } from "@/components/course-maker/CourseLearnView";

export default function CourseLearnPage() {
  const { courseId } = useParams<{ courseId: string }>();
  return <CourseLearnView courseId={courseId} variant="admin" />;
}
