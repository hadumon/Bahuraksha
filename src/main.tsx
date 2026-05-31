import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installGlobalHandlers } from "@/lib/logger";

installGlobalHandlers();

createRoot(document.getElementById("root")!).render(<App />);
