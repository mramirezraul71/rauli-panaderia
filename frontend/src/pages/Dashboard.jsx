import AccessControlWidget from "../components/AccessControlWidget";
import RauliAssistant from "../components/RauliAssistant/RauliAssistant";

export default function Dashboard() {
  return (
    <div className="grid gap-6 lg:grid-rows-[minmax(0,70%)_minmax(0,30%)] lg:h-[calc(100vh-10rem)]">
      <div className="min-h-[520px]">
        <RauliAssistant />
      </div>
      <div className="min-h-[280px]">
        <AccessControlWidget />
      </div>
    </div>
  );
}