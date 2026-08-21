import { useNavigate } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CircleCheck,
  FolderKanban,
  ListTodo,
  Plus,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import CreateProjectModal from "@/components/shared/modals/create-project-modal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import icons from "@/constants/project-icons";
import type { WorkspaceOverview as WorkspaceOverviewData } from "@/fetchers/project/get-workspace-overview";
import useGetWorkspaceOverview from "@/hooks/queries/project/use-get-workspace-overview";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatDateShort, formatRelativeTime } from "@/lib/format";

const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
] as const;

function Metric({
  label,
  value,
  detail,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof ListTodo;
  tone?: "default" | "warning" | "success";
}) {
  const toneClass = {
    default: "text-muted-foreground",
    warning: "text-warning-foreground",
    success: "text-success-foreground",
  }[tone];

  return (
    <div className="min-w-0 border-b border-border/70 px-4 py-4 first:sm:border-l-0 sm:border-b-0 sm:border-l sm:px-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="truncate text-sm">{label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-2xl font-medium tabular-nums tracking-tight">
          {value}
        </span>
        <span className={`truncate text-xs ${toneClass}`}>{detail}</span>
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 pb-8 pt-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 overflow-hidden rounded-2xl border bg-card sm:grid-cols-4">
        {["projects", "open", "overdue", "completion"].map((metric) => (
          <div
            key={metric}
            className="space-y-3 border-b border-border/70 p-4 sm:border-b-0 sm:border-l sm:p-5 first:sm:border-l-0"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.8fr)]">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}

function StatusDonut({
  data,
  t,
}: {
  data: WorkspaceOverviewData["statusBreakdown"];
  t: (key: string) => string;
}) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const labels = {
    completed: t("workspace:overview.status.completed"),
    inProgress: t("workspace:overview.status.inProgress"),
    planned: t("workspace:overview.status.planned"),
  };

  return (
    <div className="flex items-center gap-6">
      <div className="relative size-36 shrink-0">
        <svg
          viewBox="0 0 100 100"
          className="size-full -rotate-90"
          role="img"
          aria-label={t("workspace:overview.status.chartLabel")}
        >
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="var(--muted)"
            strokeWidth="10"
          />
          {data.map((item, index) => {
            const length = total > 0 ? (item.count / total) * circumference : 0;
            const circle = (
              <circle
                key={item.key}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={chartColors[index]}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                strokeWidth="10"
              />
            );
            offset += length;
            return circle;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-xl font-medium tabular-nums">
            {total}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {t("workspace:overview.metrics.tasks")}
          </span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        {data.map((item, index) => (
          <div
            key={item.key}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: chartColors[index] }}
              />
              <span className="truncate">{labels[item.key]}</span>
            </div>
            <span className="font-mono tabular-nums text-muted-foreground">
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreationTrend({
  data,
  t,
}: {
  data: WorkspaceOverviewData["taskCreationTrend"];
  t: (key: string) => string;
}) {
  const max = Math.max(...data.map((item) => item.count), 1);
  const points = data
    .map((item, index) => {
      const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100;
      const y = 92 - (item.count / max) * 72;
      return `${x},${y}`;
    })
    .join(" ");

  if (!data.length) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {t("workspace:overview.emptyTrend")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative h-44 w-full">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="size-full overflow-visible"
          role="img"
          aria-label={t("workspace:overview.trendChartLabel")}
        >
          {[20, 44, 68, 92].map((y) => (
            <line
              key={y}
              x1="0"
              x2="100"
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeDasharray="1 3"
            />
          ))}
          <polyline
            points={points}
            fill="none"
            stroke="var(--chart-1)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
          />
          {data.map((item, index) => {
            const x =
              data.length === 1 ? 50 : (index / (data.length - 1)) * 100;
            const y = 92 - (item.count / max) * 72;
            return (
              <circle
                key={item.weekStart.toString()}
                cx={x}
                cy={y}
                r="2.5"
                fill="var(--card)"
                stroke="var(--chart-1)"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
      </div>
      <div className="flex justify-between gap-2 text-[11px] text-muted-foreground">
        {data.map((item) => (
          <span key={item.weekStart.toString()}>
            {formatDateShort(item.weekStart)}
          </span>
        ))}
      </div>
    </div>
  );
}

function WorkspaceOverview() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: workspace } = useActiveWorkspace();
  const {
    data: overview,
    isLoading,
    isError,
  } = useGetWorkspaceOverview({
    workspaceId: workspace?.id || "",
  });
  const { canCreateProjects } = useWorkspacePermission();
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);

  const workloadMax = useMemo(
    () =>
      Math.max(
        ...(overview?.assigneeWorkload.map((person) => person.totalTasks) ??
          []),
        1,
      ),
    [overview?.assigneeWorkload],
  );

  if (!workspace || isLoading) {
    return (
      <>
        <PageTitle title={t("workspace:overview.pageTitle")} />
        <WorkspaceLayout title={t("workspace:overview.pageTitle")}>
          <OverviewSkeleton />
        </WorkspaceLayout>
      </>
    );
  }

  if (isError || !overview) {
    return (
      <>
        <PageTitle title={t("workspace:overview.pageTitle")} />
        <WorkspaceLayout title={t("workspace:overview.pageTitle")}>
          <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-3 px-6 text-center">
            <AlertTriangle className="size-8 text-destructive" />
            <h1 className="text-lg font-semibold">
              {t("workspace:overview.errorTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("workspace:overview.errorDescription")}
            </p>
          </div>
        </WorkspaceLayout>
      </>
    );
  }

  const handleProjectClick = (projectId: string) => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
      params: { workspaceId: workspace.id, projectId },
    });
  };

  const handleTaskClick = (
    task: WorkspaceOverviewData["upcomingTasks"][number],
  ) => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
      params: {
        workspaceId: workspace.id,
        projectId: task.projectId,
        taskId: task.id,
      },
    });
  };

  return (
    <>
      <PageTitle title={t("workspace:overview.pageTitle")} />
      <WorkspaceLayout
        title={t("workspace:overview.pageTitle")}
        headerActions={
          canCreateProjects() ? (
            <Button
              variant="outline"
              size="xs"
              onClick={() => setIsCreateProjectOpen(true)}
            >
              <Plus />
              {t("workspace:projects.createProject")}
            </Button>
          ) : null
        }
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 pb-8 pt-4 sm:px-6 lg:px-8">
          <section
            className="grid grid-cols-2 overflow-hidden rounded-2xl border bg-card sm:grid-cols-4"
            aria-label={t("workspace:overview.summaryLabel")}
          >
            <Metric
              label={t("workspace:overview.metrics.projects")}
              value={overview.summary.projectCount}
              detail={t("workspace:overview.metrics.active")}
              icon={FolderKanban}
            />
            <Metric
              label={t("workspace:overview.metrics.openTasks")}
              value={
                overview.summary.totalTasks - overview.summary.completedTasks
              }
              detail={`${overview.summary.totalTasks} ${t("workspace:overview.metrics.total")}`}
              icon={ListTodo}
            />
            <Metric
              label={t("workspace:overview.metrics.overdue")}
              value={overview.summary.overdueTasks}
              detail={t("workspace:overview.metrics.needsAttention")}
              icon={AlertTriangle}
              tone="warning"
            />
            <Metric
              label={t("workspace:overview.metrics.completion")}
              value={`${overview.summary.completionPercentage}%`}
              detail={`${overview.summary.completedTasks} ${t("workspace:overview.metrics.completed")}`}
              icon={CircleCheck}
              tone="success"
            />
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.8fr)]">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {t("workspace:overview.sections.taskFlow")}
                </CardTitle>
                <CardDescription>
                  {t("workspace:overview.sections.taskFlowDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <CreationTrend data={overview.taskCreationTrend} t={t} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {t("workspace:overview.sections.status")}
                </CardTitle>
                <CardDescription>
                  {t("workspace:overview.sections.statusDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <StatusDonut data={overview.statusBreakdown} t={t} />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {t("workspace:overview.sections.projectProgress")}
                </CardTitle>
                <CardDescription>
                  {t("workspace:overview.sections.projectProgressDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                {overview.projectProgress.length ? (
                  overview.projectProgress.map((project) => {
                    const Icon = project.icon
                      ? icons[project.icon as keyof typeof icons] ||
                        FolderKanban
                      : FolderKanban;
                    return (
                      <button
                        key={project.id}
                        type="button"
                        className="group flex w-full flex-col gap-2 text-left"
                        onClick={() => handleProjectClick(project.id)}
                      >
                        <span className="flex items-center justify-between gap-3 text-sm">
                          <span className="flex min-w-0 items-center gap-2 font-medium">
                            <Icon className="size-4 shrink-0 text-muted-foreground" />
                            <span className="truncate">{project.name}</span>
                          </span>
                          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                            {project.completionPercentage}%
                          </span>
                        </span>
                        <span className="h-2 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-primary transition-[width] duration-300 ease-out group-hover:bg-primary/80"
                            style={{
                              width: `${project.completionPercentage}%`,
                            }}
                          />
                        </span>
                        <span className="flex justify-between text-[11px] text-muted-foreground">
                          <span>
                            {project.completedTasks} / {project.totalTasks}{" "}
                            {t("workspace:overview.metrics.completed")}
                          </span>
                          {project.overdueTasks > 0 ? (
                            <span className="text-warning-foreground">
                              {project.overdueTasks}{" "}
                              {t(
                                "workspace:overview.metrics.overdue",
                              ).toLowerCase()}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t("workspace:overview.emptyProjects")}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {t("workspace:overview.sections.workload")}
                </CardTitle>
                <CardDescription>
                  {t("workspace:overview.sections.workloadDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                {overview.assigneeWorkload.length ? (
                  overview.assigneeWorkload.slice(0, 6).map((person) => {
                    const width = (person.totalTasks / workloadMax) * 100;
                    return (
                      <div
                        key={person.id || "unassigned"}
                        className="space-y-2"
                      >
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-medium">
                              {person.name === "Unassigned" ? (
                                <Users className="size-3.5" />
                              ) : (
                                person.name.slice(0, 1).toUpperCase()
                              )}
                            </span>
                            <span className="truncate">{person.name}</span>
                          </span>
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            {person.openTasks}{" "}
                            {t("workspace:overview.metrics.open")}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-[var(--chart-2)]"
                            style={{
                              width: `${Math.max(width, person.totalTasks ? 3 : 0)}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t("workspace:overview.emptyWorkload")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {t("workspace:overview.sections.upcoming")}
                </CardTitle>
                <CardDescription>
                  {t("workspace:overview.sections.upcomingDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {overview.upcomingTasks.length ? (
                  <div className="divide-y divide-border/70">
                    {overview.upcomingTasks.map((task) => {
                      const overdue =
                        task.dueDate && new Date(task.dueDate) < new Date();
                      return (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => handleTaskClick(task)}
                          className="group flex w-full items-center gap-3 py-3 text-left first:pt-0 last:pb-0"
                        >
                          <span
                            className={`size-2 shrink-0 rounded-full ${
                              overdue
                                ? "bg-destructive"
                                : task.priority === "urgent" ||
                                    task.priority === "high"
                                  ? "bg-warning"
                                  : "bg-muted-foreground/40"
                            }`}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {task.title}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                              {task.projectName}
                              {task.assigneeName
                                ? ` · ${task.assigneeName}`
                                : ""}
                            </span>
                          </span>
                          <span
                            className={`shrink-0 text-xs ${
                              overdue
                                ? "font-medium text-destructive"
                                : "text-muted-foreground"
                            }`}
                          >
                            {task.dueDate
                              ? formatDateShort(task.dueDate)
                              : t("workspace:overview.noDueDate")}
                          </span>
                          <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t("workspace:overview.emptyUpcoming")}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {t("workspace:overview.sections.activity")}
                </CardTitle>
                <CardDescription>
                  {t("workspace:overview.sections.activityDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {overview.recentActivity.length ? (
                  <div className="space-y-3">
                    {overview.recentActivity.map((item) => (
                      <div key={item.id} className="flex gap-3">
                        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted">
                          <Activity className="size-3.5 text-muted-foreground" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm">
                            <span className="font-medium">
                              {item.userName || t("common:people.someone")}
                            </span>{" "}
                            <span className="text-muted-foreground">
                              {item.type.replaceAll("_", " ")}
                            </span>
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.taskTitle} ·{" "}
                            {formatRelativeTime(item.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t("workspace:overview.emptyActivity")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </WorkspaceLayout>
      <CreateProjectModal
        open={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
      />
    </>
  );
}

export default WorkspaceOverview;
