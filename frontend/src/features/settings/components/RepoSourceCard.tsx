import GitHubConnect from "../../../components/SupplyChain/GitHubConnect";
import type { GitHubUser } from "../../../types";

interface Props {
  onConnect: (user: GitHubUser) => void;
  onDisconnect: () => void;
  user: GitHubUser | null;
}

export default function RepoSourceCard({ onConnect, onDisconnect, user }: Props) {
  return (
    <div className="card">
      <h3
        style={{
          fontSize: 16,
          fontWeight: 500,
          color: "var(--md-on-surface)",
          marginBottom: 16,
        }}
      >
        GitHub Connection
      </h3>
      <GitHubConnect user={user} onConnect={onConnect} onDisconnect={onDisconnect} />
    </div>
  );
}
