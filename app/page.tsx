import { CommandCenterProvider } from "@/lib/context/CommandCenterContext";
import { CommandCenterShell } from "@/components/command-center/CommandCenterShell";

export default function Home() {
  return (
    <CommandCenterProvider>
      <CommandCenterShell />
    </CommandCenterProvider>
  );
}
