import { useEffect, useState } from "react";
import {
  subscribeToBackendHealth,
  getBackendHealth,
} from "@/lib/apiHealth";

export function useApiHealth() {
  const [backends, setBackends] = useState(getBackendHealth);

  useEffect(() => subscribeToBackendHealth(setBackends), []);

  return backends;
}
