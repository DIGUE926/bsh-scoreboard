export function isU20League(slug: string) {
  return slug === "suble";
}

export default function U20Badge({ slug }: { slug: string }) {
  if (!isU20League(slug)) return null;
  return (
    <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-bsh-gold bg-bsh-gold/10 border border-bsh-gold/30 rounded px-1 py-0.5 leading-none">
      U20
    </span>
  );
}
