import { Skel } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-md space-y-5 p-6">
      <div className="space-y-2">
        <Skel w="70%" h={22} />
        <Skel w="90%" h={13} />
      </div>
      <div className="space-y-3">
        <Skel w="100%" h={40} radius="var(--radius)" />
        <Skel w="100%" h={40} radius="var(--radius)" />
        <Skel w={140} h={40} radius="var(--radius)" />
      </div>
    </div>
  );
}
