import { useQuery } from "@tanstack/react-query";
import { streamlineApi } from "@/lib/api";

/**
 * Fetch Resource Master data from Streamline (think-book) backend.
 * Endpoint: GET /api/invoicing/resources
 *
 * Usage:
 *   const { data: resources, isLoading } = useResources();
 */
export function useResources(params?: { limit?: number; search?: string; project_id?: string }) {
  const query = new URLSearchParams();
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  if (params?.search) query.set("search", params.search);
  if (params?.project_id) query.set("project_id", params.project_id);
  const qs = query.toString() ? `?${query.toString()}` : "";

  return useQuery({
    queryKey: ["streamline-resources", params],
    queryFn: () =>
      streamlineApi.get(`/invoicing/resources${qs}`).then((r) => r.data),
  });
}
