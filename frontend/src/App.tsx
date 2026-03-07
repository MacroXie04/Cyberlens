import { useState } from "react";
import DashboardLayout from "./components/Layout/DashboardLayout";
import LiveMonitorPage from "./pages/LiveMonitorPage";
import SupplyChainPage from "./pages/SupplyChainPage";

type Tab = "monitor" | "supply-chain";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("monitor");

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === "monitor" ? <LiveMonitorPage /> : <SupplyChainPage />}
    </DashboardLayout>
  );
}

export default App;
