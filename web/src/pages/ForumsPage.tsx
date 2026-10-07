import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  ArrowUpIcon,
  BotIcon,
  Loader2Icon,
  MessageSquareIcon,
  PlusIcon,
  SquareIcon,
  UsersIcon,
} from "lucide-react";
import { useViewerId } from "@/hooks/useViewerId";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageResponse } from "@/components/ai-elements/message";
import { PermissionsModal } from "@/components/PermissionsModal";
import { fetchAgentCatalog, type AvailableAgent } from "@/hooks/useAvailableAgents";
import { useHosts, useHostModelOptions } from "@/hooks/useHosts";
import { forumRequest, listForums, type Forum, type ForumParticipantInput } from "@/lib/forumsApi";
import { Link, useLocation, useNavigate, useParams } from "@/lib/routing";

type SelectedParticipant = ForumParticipantInput & { key: string };

function HarnessModels({
  agent,
  hostId,
  selected,
  onChange,
}: {
  agent: AvailableAgent;
  hostId: string;
  selected: SelectedParticipant[];
  onChange: (next: SelectedParticipant[]) => void;
}) {
  const models = useHostModelOptions(hostId, agent.harness!, true, { poll: false });
  return (
    <fieldset className="min-w-0 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
      <legend className="px-2 text-sm font-semibold">{agent.display_name}</legend>
      {models.isPending && <p>Loading available models…</p>}
      {models.isError && (
        <p role="alert">
          Could not load models.{" "}
          <button type="button" onClick={() => void models.refetch()}>
            Retry
          </button>
        </p>
      )}
      {models.data?.map((model) => {
        const count = selected.filter(
          (p) => p.agent_id === agent.id && p.model === model.id,
        ).length;
        const entry = {
          agent_id: agent.id,
          harness: agent.harness!,
          model: model.id,
          key: crypto.randomUUID(),
        };
        return (
          <div
            key={model.id}
            className={cn(
              "my-1 flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors",
              count > 0 ? "bg-primary/5 ring-1 ring-primary/20" : "hover:bg-muted/50",
            )}
          >
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={count > 0}
                disabled={count === 0 && selected.length >= 32}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...selected, entry]
                      : selected.filter((p) => !(p.agent_id === agent.id && p.model === model.id)),
                  )
                }
              />
              {model.displayName || model.id}
            </label>
            {count > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange([...selected, entry])}
                disabled={selected.length >= 32}
              >
                Add another ({count})
              </Button>
            )}
          </div>
        );
      })}
      {models.data?.length === 0 && (
        <p className="text-muted-foreground">No ready models available.</p>
      )}
    </fieldset>
  );
}

function NewForum() {
  const navigate = useNavigate();
  const hosts = useHosts();
  const agents = useQuery({ queryKey: ["forum-agent-catalog"], queryFn: fetchAgentCatalog });
  const [hostId, setHostId] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [selected, setSelected] = useState<SelectedParticipant[]>([]);
  const [maximum, setMaximum] = useState(100);
  const host = hosts.data?.find((h) => h.host_id === hostId);
  const ready =
    agents.data?.filter(
      (a) =>
        a.harness && host?.status === "online" && host.configured_harnesses?.[a.harness] === true,
    ) ?? [];
  const create = useMutation({
    mutationFn: () =>
      forumRequest<Forum>("", {
        host_id: hostId,
        workspace,
        participants: selected.map(({ agent_id, harness, model }) => ({
          agent_id,
          harness,
          model,
        })),
        max_responses: maximum,
      }),
    onSuccess: (forum) => navigate(`/forums/${forum.id}`),
  });
  return (
    <form
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      <Link
        to="/forums"
        className="flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Forums
      </Link>
      <header className="space-y-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UsersIcon className="size-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">New forum</h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          Bring a team of agents together to solve a problem. Choose your participants, give them a
          shared workspace, and guide the conversation.
        </p>
      </header>
      <section className="grid gap-5 rounded-xl border border-border/60 bg-card p-5 shadow-sm sm:grid-cols-2">
        <h2 className="text-sm font-semibold sm:col-span-2">Workspace &amp; discussion</h2>
        <label className="grid gap-2 text-sm font-medium">
          Host
          <select
            aria-label="Host"
            className="h-9 min-w-0 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            required
            value={hostId}
            onChange={(e) => {
              setHostId(e.target.value);
              setSelected([]);
            }}
          >
            <option value="">Select an online host</option>
            {hosts.data
              ?.filter((h) => h.status === "online")
              .map((h) => (
                <option key={h.host_id} value={h.host_id}>
                  {h.name}
                </option>
              ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Shared workspace
          <Input
            required
            value={workspace}
            onChange={(e) => setWorkspace(e.target.value)}
            placeholder="/path/to/project"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Maximum completed agent responses
          <Input
            type="number"
            min={1}
            max={10000}
            required
            value={maximum}
            onChange={(e) => setMaximum(Number(e.target.value))}
          />
          <span className="text-sm text-muted-foreground">
            Total across all participants. Failed or interrupted responses do not count.
          </span>
        </label>
      </section>
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Build your team</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select at least two participants. You can add the same model more than once.
          </p>
        </div>
        {(hosts.isError || agents.isError) && (
          <p role="alert">Could not load participants or hosts. Refresh to retry.</p>
        )}
        {hostId && ready.length === 0 && (
          <p>No configured, ready-to-run agents are available on this host.</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {ready.map((agent) => (
            <HarnessModels
              key={agent.id}
              agent={agent}
              hostId={hostId}
              selected={selected}
              onChange={setSelected}
            />
          ))}
        </div>
      </section>
      <section className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-5">
        <h2 className="text-sm font-semibold">Response order ({selected.length} participants)</h2>
        {selected.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Your selected agents will appear here in turn order.
          </p>
        )}
        <ol className="grid gap-2">
          {selected.map((p, index) => (
            <li
              key={p.key}
              className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2 text-sm shadow-xs"
            >
              <span>
                {index + 1}. {p.harness} / {p.model}
              </span>
              <Button
                variant="ghost"
                type="button"
                onClick={() => setSelected(selected.filter((_, i) => i !== index))}
              >
                Remove
              </Button>
            </li>
          ))}
        </ol>
      </section>
      {create.error && (
        <p role="alert" className="text-destructive">
          {create.error.message}
        </p>
      )}
      <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" role="status">
          {!host
            ? "Select an online host to get started."
            : !workspace.trim()
              ? "Enter the workspace your agents will share."
              : selected.length < 2
                ? "Add at least two participants to create your forum."
                : "Your team is ready. Post your first task after creating the forum."}
        </p>
        <Button
          type="submit"
          disabled={selected.length < 2 || !workspace.trim() || !host || create.isPending}
        >
          {create.isPending ? (
            <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" />
          ) : (
            <PlusIcon className="size-4" />
          )}
          {create.isPending ? "Creating…" : "Create forum"}
        </Button>
      </div>
    </form>
  );
}

const STATUS: Record<Forum["status"], string> = {
  blank: "Ready for your first question",
  running: "Discussing",
  paused: "Paused — waiting for agents to recover",
  stopped: "Stopped",
  limit: "Response limit reached",
};

function Discussion({ id }: { id: string }) {
  const cache = useQueryClient();
  const viewerId = useViewerId();
  const [name, setName] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["forum", id],
    queryFn: () => forumRequest<Forum>(`/${id}`),
    refetchInterval: 1500,
  });
  const [text, setText] = useState("");
  const [sharing, setSharing] = useState(false);
  const update = (forum: Forum) => cache.setQueryData(["forum", id], forum);
  const post = useMutation({
    mutationFn: (message: string) =>
      forumRequest<Forum>(`/${id}/messages`, {
        text: message,
        id: crypto.randomUUID(),
        display_name: displayName,
      }),
    onSuccess: (forum) => {
      update(forum);
      setText("");
    },
  });
  const stop = useMutation({
    mutationFn: () => forumRequest<Forum>(`/${id}/stop`, {}),
    onSuccess: update,
  });
  const forum = query.data;
  const savedName = forum?.posts.findLast(
    (p) => p.role === "user" && p.author === viewerId && p.display_name,
  )?.display_name;
  const displayName = (
    name ??
    savedName ??
    (viewerId && viewerId !== "local" ? viewerId : "")
  ).trim();
  if (query.isPending) return <p className="p-6">Loading forum…</p>;
  if (!forum)
    return (
      <p role="alert" className="p-6">
        {query.error?.message || "Forum unavailable"}
      </p>
    );
  const canEdit = forum.permission_level == null || forum.permission_level >= 2;
  const canManage = forum.permission_level == null || forum.permission_level >= 3;
  const active =
    forum.status === "running" && forum.active_index !== null
      ? forum.participants[forum.active_index]
      : null;
  const activity = active
    ? `${active.name} is thinking…`
    : forum.status === "running"
      ? "Preparing the next agent…"
      : forum.status === "paused"
        ? "Waiting for agents to reconnect…"
        : null;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b p-4">
        <Link
          to="/forums"
          aria-label="Back to forums"
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate font-semibold">{forum.title || "New forum"}</h1>
        <Button variant="outline" disabled={!canManage} onClick={() => setSharing(true)}>
          Share
        </Button>
        <Button
          variant="outline"
          onClick={() => stop.mutate()}
          disabled={!canEdit || !["running", "paused"].includes(forum.status) || stop.isPending}
        >
          <SquareIcon className="size-4" />
          Stop
        </Button>
      </header>
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 bg-muted/20 px-6 py-2 text-xs text-muted-foreground"
        role="status"
      >
        <span>{STATUS[forum.status]}</span>
        <span>
          {forum.completed} / {forum.max_responses} completed responses
        </span>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-border/50 px-6 py-3">
        {forum.participants.map((p, i) => (
          <Link
            key={p.session_id}
            to={`/c/${p.session_id}`}
            className={cn(
              "flex min-w-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors hover:bg-muted",
              active === p
                ? "border-primary/30 bg-primary/5 text-primary"
                : "border-border/60 text-muted-foreground",
            )}
            title="Open participant session for tools, files, and approvals"
          >
            <BotIcon className="size-3.5 shrink-0" />
            <span className="truncate">{p.name}</span>
            {active && forum.active_index === i
              ? " · Responding…"
              : p.error
                ? " · Unavailable, retrying"
                : ""}
          </Link>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" aria-label="Forum discussion">
        {!forum.posts.length && (
          <div className="mx-auto max-w-xl py-12 text-center">
            <MessageSquareIcon className="mx-auto mb-4 size-8" />
            <h2 className="text-lg font-medium">What should the agents work on?</h2>
            <p className="mt-2 text-muted-foreground">
              Post a question or programming task to begin. You can guide the discussion at any
              time.
            </p>
          </div>
        )}
        <div className="mx-auto grid max-w-3xl gap-6">
          {forum.posts.map((message) => (
            <article
              key={message.id}
              className={cn(
                "min-w-0 rounded-2xl p-5",
                message.role === "user" ? "border border-border/50 bg-muted/40" : "bg-card",
              )}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                    message.role === "user"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {message.role === "user" ? (
                    (
                      message.display_name ||
                      (message.author === "local" ? displayName || "You" : message.author)
                    )
                      .slice(0, 1)
                      .toUpperCase()
                  ) : (
                    <BotIcon className="size-4" />
                  )}
                </span>
                <strong className="break-all font-medium">
                  {message.display_name ||
                    (message.author === "local" ? displayName || "You" : message.author)}
                </strong>
                <span className="text-muted-foreground">
                  {new Date(message.created_at * 1000).toLocaleTimeString()}
                </span>
              </div>
              <MessageResponse>{message.text}</MessageResponse>
            </article>
          ))}
        </div>
      </div>
      {activity && (
        <div
          role="status"
          aria-live="polite"
          className="mx-auto flex w-full max-w-3xl items-center gap-3 px-5 py-3 text-sm text-muted-foreground"
        >
          <Loader2Icon className="size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none" />
          <span className="min-w-0 break-words">{activity}</span>
        </div>
      )}
      <form
        className="mx-auto w-full max-w-3xl px-4 pb-4 pt-2 sm:pb-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim() && displayName) post.mutate(text);
        }}
      >
        {(post.error || stop.error || query.error) && (
          <p role="alert" className="mb-2 text-destructive">
            {(post.error || stop.error || query.error)?.message}
          </p>
        )}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm focus-within:ring-2 focus-within:ring-ring/30">
          <label className="flex items-center gap-2 border-b border-border/50 px-4 py-2 text-xs text-muted-foreground">
            Your name
            <input
              aria-label="Your name"
              required
              maxLength={100}
              disabled={!canEdit}
              value={name ?? savedName ?? (viewerId && viewerId !== "local" ? viewerId : "")}
              onChange={(e) => setName(e.target.value)}
              placeholder="How should we address you?"
              className="min-w-0 flex-1 bg-transparent py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
          <label className="sr-only" htmlFor="forum-message">
            Message to the forum
          </label>
          <textarea
            id="forum-message"
            className="min-h-24 w-full resize-y bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
            disabled={!canEdit}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Post a task or guide the discussion…"
          />
          <div className="flex items-center justify-between gap-3 px-3 pb-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {["stopped", "limit"].includes(forum.status)
                ? "A new message restarts the loop with a fresh response allowance."
                : "Guidance reaches the next agent. Use Stop to interrupt immediately."}
            </p>
            <Button
              type="submit"
              disabled={!canEdit || !text.trim() || !displayName || post.isPending}
            >
              <ArrowUpIcon className="size-4" />
              {post.isPending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </form>
      <PermissionsModal
        sharePath={`/forums/${id}`}
        sessionId={id}
        workspace={forum.workspace}
        open={sharing}
        onOpenChange={setSharing}
      />
    </div>
  );
}

function ForumsContent() {
  const { forumId } = useParams();
  const location = useLocation();
  const creating = location.pathname.endsWith("/forums/new");
  const forums = useQuery({
    queryKey: ["forums"],
    queryFn: listForums,
    enabled: !forumId && !creating,
    refetchInterval: 10000,
  });
  if (creating)
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <NewForum />
      </div>
    );
  if (forumId) return <Discussion key={forumId} id={forumId} />;
  return (
    <main className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Forums</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Different perspectives. One shared goal.
            </p>
          </div>
          <Button asChild>
            <Link to="/forums/new">
              <PlusIcon className="size-4" />
              New forum
            </Link>
          </Button>
        </header>
        {forums.isPending && <p>Loading forums…</p>}
        {forums.error && (
          <p role="alert">
            {forums.error.message}{" "}
            <button type="button" onClick={() => void forums.refetch()}>
              Retry
            </button>
          </p>
        )}
        {forums.data?.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">
            No forums yet. Start one to work through a task with multiple agents.
          </p>
        )}
        <div className="grid gap-3">
          {forums.data?.map((forum) => (
            <Link
              key={forum.id}
              to={`/forums/${forum.id}`}
              className="group rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/30"
            >
              <h2 className="flex items-center gap-3 font-medium">
                <UsersIcon className="size-5 text-muted-foreground" />
                {forum.title || "New forum"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {forum.participants.length} agents · {STATUS[forum.status]} · {forum.completed}/
                {forum.max_responses} responses
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

export function ForumsPage() {
  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      style={{
        paddingTop: "calc(var(--omnigent-header-height) + var(--omnigent-inset-top))",
        paddingBottom: "var(--omnigent-inset-bottom)",
      }}
    >
      <ForumsContent />
    </div>
  );
}
