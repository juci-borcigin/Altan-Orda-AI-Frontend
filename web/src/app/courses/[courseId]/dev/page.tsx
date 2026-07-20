import { redirect } from "next/navigation";

type Props = { params: Promise<{ courseId: string }> };

/** 旧 Dev 画面 → 講座管理画面に統合 */
export default async function CourseDevRedirect({ params }: Props) {
  const { courseId } = await params;
  redirect(`/courses/${courseId}`);
}
