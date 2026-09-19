import SharedFlagImg from "../../../shared/components/FlagImg";
import quebecFlag from "../../assets/flags/ca-qc.svg";

/**
 * Jurisdictions with a distinctive flag that flagcdn has no coverage for at
 * all - Canadian provinces are entirely absent from flagcdn (confirmed: every
 * ca-* subdivision 404s, not just some), so without this every province would
 * silently show Canada's flag regardless of the province asked for. Bundled
 * locally rather than pulled from another CDN, since the point is not
 * depending on a coverage gap in the first place. Add more entries here as
 * they come up rather than chasing a third-party flag source with better
 * coverage. This app's own addition to the shared `FlagImg` shell - the
 * asset stays local since no sibling app has subnational jurisdictions.
 */
const LOCAL_FLAGS: Record<string, string> = {
  "CA-QC": quebecFlag,
};

export default function FlagImg({ code, size }: { code: string; size?: number }) {
  return <SharedFlagImg code={code} size={size} localFlags={LOCAL_FLAGS} />;
}
