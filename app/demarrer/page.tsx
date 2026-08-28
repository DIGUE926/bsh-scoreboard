import Link from "next/link";
import DemarrerMatchForm from "./DemarrerMatchForm";
import { isLiveScoringEnabled } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function DemarrerMatchPage() {
  if (!(await isLiveScoringEnabled())) {
    return (
      <div>
        <div className="border border-red-500/40 bg-red-500/10 rounded-lg p-6 text-center">
          <p className="text-red-300 font-semibold mb-2">
            Scoreboard Live temporairement désactivé
          </p>
          <p className="text-sm text-white/50 mb-4">
            Impossible de démarrer un match en direct pendant la maintenance.
          </p>
          <Link href="/nouveau-match" className="text-bsh-gold hover:underline text-sm">
            Créer un match programmé à la place →
          </Link>
        </div>
      </div>
    );
  }

  return <DemarrerMatchForm />;
}
