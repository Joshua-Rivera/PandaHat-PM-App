import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NotificationList } from "@/components/notifications/NotificationList";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { ApiError } from "@/lib/api/client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

function withQueryClient(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const page = (items: unknown[]) => new Response(JSON.stringify({ items, next_cursor: null }), { status: 200 });

afterEach(() => vi.unstubAllGlobals());

describe("EmptyState", () => {
  it("renders the title, guidance and call to action", () => {
    render(<EmptyState title="No projects yet" description="Create your first project." action={<button>Create project</button>} />);
    expect(screen.getByText("No projects yet")).toBeInTheDocument();
    expect(screen.getByText("Create your first project.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create project" })).toBeInTheDocument();
  });
});

describe("ErrorState", () => {
  it("explains a server error and offers a retry", async () => {
    const onRetry = vi.fn();
    render(<ErrorState title="Couldn't load notifications" error={new ApiError(500, "boom")} onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("The server returned an error while loading this data.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe("NotificationList", () => {
  it("shows a skeleton, then the empty state, never a bare 'Loading…'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page([])));
    withQueryClient(<NotificationList status="all" pageSize={10} paginate={false} />);
    expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
    expect(await screen.findByText("No notifications yet")).toBeInTheDocument();
  });

  it("recovers from a 500: error state → Try again → data", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "Internal Server Error" }), { status: 500 }))
      .mockResolvedValueOnce(
        page([
          {
            notification_id: 1,
            event_type: "TASK_ASSIGNED",
            priority: "NORMAL",
            title: "New task: Analyze SimSwap results",
            body: "Watermark Robustness",
            resource_type: "task",
            resource_id: "t1",
            action_path: "/projects/p1/tasks/t1",
            actor_user_id: null,
            created_at: new Date().toISOString(),
            read_at: null,
            is_read: false,
          },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);
    withQueryClient(<NotificationList status="all" pageSize={10} paginate={false} />);

    expect(await screen.findByText("Couldn't load notifications")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByText("New task: Analyze SimSwap results")).toBeInTheDocument());
  });

  it("shows the caught-up message for an empty unread filter", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page([])));
    withQueryClient(<NotificationList status="unread" pageSize={10} paginate={false} />);
    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
  });
});
