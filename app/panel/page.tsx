import { notFound } from "next/navigation";
import { LocalGenerationPanel } from "@/components/local-generation-panel";
import { isLocalPanelEnabled } from "@/lib/utils/local-panel";

export const metadata = {
  title: "Panel generowania",
  robots: { index: false, follow: false },
};

export default function PanelPage() {
  if (!isLocalPanelEnabled()) {
    notFound();
  }

  return <LocalGenerationPanel />;
}
