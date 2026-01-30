"use client";

import { useEffect, useState, useCallback } from "react";
import { authClient } from "@/src/lib/auth-client";
import { useParams, useRouter } from "next/navigation";
import { getProjectById, getTasks, updateTaskStatus, getProjectMembers } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  LayoutDashboard,
  List,
  Plus,
  Settings,
  MoreVertical,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  ChevronDown,
  ChevronRight,
  GripVertical
} from "lucide-react";
import Link from "next/link";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import { Toaster, toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectMembers } from "@/components/project-members";
import { TaskDetailsDialog } from "@/components/task-details-dialog";
import { Progress } from "@/components/ui/progress";

const STATUS_COLUMNS = ["To Do", "In Progress", "Done", "Blocked"];

export default function ProjectPage() {
  const { id } = useParams();
  const { data: session, isPending: authPending } = authClient.useSession();
  const router = useRouter();
  
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (session?.user?.id && id) {
      const proj = await getProjectById(id as string, session.user.id);
      if (!proj) {
        toast.error("Project not found or access denied");
        router.push("/dashboard");
        return;
      }
      setProject(proj);
      const [t, m] = await Promise.all([
        getTasks(id as string),
        getProjectMembers(id as string)
      ]);
      setTasks(t);
      setMembers(m);
      setLoading(false);
    }
  }, [id, session, router]);

  useEffect(() => {
    if (!authPending && !session) {
      router.push("/login");
    }
  }, [session, authPending, router]);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session, id, fetchData]);

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    const result = await updateTaskStatus(taskId, newStatus);
    if (result.success) {
      toast.success(`Moved to ${newStatus}`);
      fetchData();
    } else {
      toast.error("Failed to update status");
    }
  };

  const onDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId);
  };

  const onDrop = async (e: React.DragEvent, status: string) => {
    const taskId = e.dataTransfer.getData("taskId");
    handleStatusChange(taskId, status);
  };

  if (loading || authPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-2xl font-bold text-primary">Loading project...</div>
      </div>
    );
  }

  const bigTasks = tasks.filter(t => t.type === 'big');
  const standaloneSmallTasks = tasks.filter(t => t.type === 'small' && !t.parent_id);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster position="top-right" richColors theme="dark" />
      
      <nav className="border-b border-border bg-card/30 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-screen-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-2 hover:bg-muted rounded-md transition-colors">
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </Link>
            <div className="h-4 w-px bg-border mx-2" />
            <h1 className="font-bold text-lg">{project.name}</h1>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="flex -space-x-2 mr-4">
              {members.slice(0, 3).map((m, i) => (
                <div key={m.user_id} className="w-8 h-8 rounded-full border-2 border-background bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary" title={m.name}>
                  {m.name?.[0]}
                </div>
              ))}
              {members.length > 3 && (
                <div className="w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                  +{members.length - 3}
                </div>
              )}
            </div>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Settings className="w-5 h-5 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-screen-2xl mx-auto p-4 md:p-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
               <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                {project.status}
              </span>
              <span className="text-xs text-muted-foreground">• {members.length} members</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight mb-2">{project.name}</h2>
            <p className="text-muted-foreground max-w-2xl">{project.description || "No description provided."}</p>
          </div>
          
          <div className="flex items-center gap-3">
            <CreateTaskDialog 
              projectId={id as string} 
              userId={session?.user?.id as string} 
              onTaskCreated={fetchData} 
              bigTasks={bigTasks}
            />
          </div>
        </header>

        <Tabs defaultValue="board" className="w-full">
          <div className="flex items-center justify-between mb-6 border-b border-border pb-1">
            <TabsList className="bg-transparent h-auto p-0 gap-8">
              <TabsTrigger value="board" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 pb-3 flex items-center gap-2 text-sm">
                <LayoutDashboard className="w-4 h-4" /> Board
              </TabsTrigger>
              <TabsTrigger value="list" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 pb-3 flex items-center gap-2 text-sm">
                <List className="w-4 h-4" /> List
              </TabsTrigger>
              <TabsTrigger value="members" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 pb-3 flex items-center gap-2 text-sm">
                <Users className="w-4 h-4" /> Members
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="board" className="mt-0 outline-none">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {STATUS_COLUMNS.map((column) => (
                <div 
                  key={column} 
                  className="flex flex-col gap-4"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onDrop(e, column)}
                >
                  <div className="flex items-center justify-between px-1">
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground/70 flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        column === 'Done' ? 'bg-green-500' : 
                        column === 'In Progress' ? 'bg-blue-500' : 
                        column === 'Blocked' ? 'bg-destructive' : 'bg-muted-foreground/30'
                      }`} />
                      {column}
                      <span className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-[10px] font-bold text-muted-foreground">
                        {tasks.filter(t => t.status === column).length}
                      </span>
                    </h3>
                  </div>
                  
                  <div className="flex flex-col gap-4 min-h-[600px] p-2 rounded-xl bg-card/10 border border-border/20 border-dashed">
                    {tasks.filter(t => t.status === column).map((task) => (
                      <TaskItem 
                        key={task.id} 
                        task={task} 
                        subtasks={tasks.filter(st => st.parent_id === task.id)}
                        onDragStart={onDragStart}
                        onClick={() => {
                          setSelectedTask(task.id);
                          setIsDetailsOpen(true);
                        }}
                        onStatusChange={handleStatusChange}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="list" className="mt-0 outline-none">
            <Card className="border-border shadow-2xl bg-card/30 backdrop-blur-sm">
              <div className="p-0 overflow-hidden">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-muted/30 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Title</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Priority</th>
                      <th className="px-6 py-4">Assignee</th>
                      <th className="px-6 py-4 text-right">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 text-foreground">
                    {tasks.map((task) => (
                      <tr key={task.id} className="hover:bg-primary/5 transition-colors cursor-pointer group" onClick={() => {
                        setSelectedTask(task.id);
                        setIsDetailsOpen(true);
                      }}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {task.type === 'big' ? (
                              <ChevronRight className="w-4 h-4 text-primary" />
                            ) : (
                              <div className="w-4" />
                            )}
                            <span className="font-bold">{task.title}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            task.status === 'Done' ? 'bg-green-500/10 text-green-500' :
                            task.status === 'In Progress' ? 'bg-primary/10 text-primary' : 
                            task.status === 'Blocked' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
                          }`}>
                            {task.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                           <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              task.type === 'big' ? 'bg-purple-500/10 text-purple-500' : 'bg-muted text-muted-foreground'
                           }`}>
                             {task.type}
                           </span>
                        </td>
                        <td className="px-6 py-4">
                           <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              task.priority === 'High' || task.priority === 'Urgent' ? 'bg-destructive/10 text-destructive' :
                              task.priority === 'Medium' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                            }`}>
                              {task.priority}
                            </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold border border-primary/30">
                              {task.assignee_name?.[0] || '?'}
                            </div>
                            <span>{task.assignee_name || 'Unassigned'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-muted-foreground text-xs">
                          {new Date(task.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="members" className="mt-0 outline-none">
            <ProjectMembers projectId={id as string} />
          </TabsContent>
        </Tabs>
      </main>

      <TaskDetailsDialog 
        taskId={selectedTask as string} 
        isOpen={isDetailsOpen} 
        onClose={() => setIsDetailsOpen(false)} 
        allTasks={tasks}
        members={members}
        onUpdate={fetchData}
      />
    </div>
  );
}

function TaskItem({ task, subtasks, onDragStart, onClick, onStatusChange }: any) {
  const progress = task.subtask_count > 0 ? (task.subtasks_done / task.subtask_count) * 100 : 0;

  return (
    <Card 
      className={`group hover:border-primary/50 transition-all cursor-grab active:cursor-grabbing border-border ${
        task.type === 'big' ? 'border-l-4 border-l-primary shadow-lg ring-1 ring-primary/5' : 'bg-card/40'
      }`}
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={onClick}
    >
      <CardHeader className="p-4 space-y-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <GripVertical className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
              task.priority === 'High' || task.priority === 'Urgent' ? 'bg-destructive/10 text-destructive' :
              task.priority === 'Medium' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {task.priority}
            </span>
            {task.type === 'big' && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-purple-500/10 text-purple-500 border border-purple-500/20">
                Big Task
              </span>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Move to...</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STATUS_COLUMNS.map(s => (
                <DropdownMenuItem 
                  key={s} 
                  disabled={s === task.status}
                  onClick={() => onStatusChange(task.id, s)}
                >
                  {s}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CardTitle className="text-sm font-bold leading-tight group-hover:text-primary transition-colors">{task.title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {task.description && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3">
            {task.description}
          </p>
        )}
        
        {task.type === 'big' && task.subtask_count > 0 && (
          <div className="space-y-1.5 mb-4">
            <div className="flex justify-between text-[10px] font-medium">
              <span className="text-muted-foreground">Progress</span>
              <span className="text-primary">{task.subtasks_done}/{task.subtask_count} subtasks</span>
            </div>
            <Progress value={progress} className="h-1 bg-muted" />
          </div>
        )}

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span className="text-[9px]">{new Date(task.created_at).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2">
             <div className="flex items-center gap-1">
              <Users className="w-3 h-3 text-muted-foreground" />
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-black text-primary border border-primary/20">
                {task.assignee_name?.[0] || '?'}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
