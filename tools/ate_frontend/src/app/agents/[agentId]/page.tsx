import { AuthGate } from "@/components/auth/AuthGate";
import { AgentDetailView } from "@/components/agents/AgentDetailView";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  return (
    <AuthGate>
      <AgentDetailView agentId={agentId} />
    </AuthGate>
  );
}
