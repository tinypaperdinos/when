import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "../trpc";

export function useUpdateTaskMutation(onSuccess?: () => void) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.tasks.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.tasks.list.queryKey() });
        onSuccess?.();
      },
    }),
  );
}

export function useUpdateEventMutation(onSuccess?: () => void) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.events.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.events.list.queryKey() });
        onSuccess?.();
      },
    }),
  );
}
