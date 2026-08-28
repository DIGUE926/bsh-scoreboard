"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function QuickStartButton({
  gameId,
  gameType = "regular",
  disabled = false,
}: {
  gameId: string;
  gameType?: "regular" | "playoff";
  disabled?: boolean;
}) {
  const router = useRouter();
  const table = gameType === "regular" ? "games" : "playoff_games";
  const path = `/match/${gameId}/live`;

  async function start(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    const supabase = createClient();
    await supabase.from(table).update({ status: "live" }).eq("id", gameId);
    router.push(path);
  }

  if (disabled) {
    return (
      <button
        disabled
        title="Scoreboard Live désactivé"
        className="relative z-10 text-xs bg-white/10 text-white/30 font-bold rounded px-2 py-1 cursor-not-allowed"
      >
        ● Live off
      </button>
    );
  }

  return (
    <button
      onClick={start}
      className="relative z-10 text-xs bg-red-600 text-white font-bold rounded px-2 py-1 hover:bg-red-500"
    >
      ● Démarrer
    </button>
  );
}
