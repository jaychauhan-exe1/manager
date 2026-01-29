"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/src/lib/auth-client";
import { useParams, useRouter } from "next/navigation";
import { getProjectById, getTasks, updateTaskStatus } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  AlertCircle
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

const STATUS_COLUMNS = ["To Do", "In Progress", "Done"];

export default function ProjectPage() {
  const { id } = useParams();
  const { data: session, isPending: authPending } = authClient.useSession();
  const router = useRouter();
  
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (session?.user?.id && id) {
      const proj = await getProjectById(id as string, session.user.id);
      if (!proj) {
        toast.error("Project not found or access denied");
        router.push("/dashboard");
        return;
      }
      setProject(proj);
      const t = await getTasks(id as string);
      setTasks(t);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authPending && !session) {
      router.push("/login");
    }
  }, [session, authPending, router]);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session, id]);

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    const result = await updateTaskStatus(taskId, newStatus);
    if (result.success) {
      toast.success(`Task moved to ${newStatus}`);
      fetchData();
    } else {
      toast.error("Failed to update task");
    }
  };

  if (loading || authPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-2xl font-bold text-primary">Loading project...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster position="top-right" richColors theme="dark" />
      
      {/* Sidebar / Nav */}
      <nav className="border-b border-border bg-card/30 sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-2 hover:bg-muted rounded-md transition-colors">
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </Link>
            <div className="h-4 w-px bg-border mx-2" />
            <h1 className="font-bold text-lg">{project.name}</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-full">
              <Settings className="w-5 h-5 text-muted-foreground" />
            </Button>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground border-2 border-card">
              {session?.user?.name?.[0]}
            </div>
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
              <span className="text-xs text-muted-foreground">• Created {new Date(project.created_at).toLocaleDateString()}</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight mb-2">{project.name}</h2>
            <p className="text-muted-foreground max-w-2xl">{project.description || "Project details and tasks."}</p>
          </div>
          
          <div className="flex items-center gap-3">
            <CreateTaskDialog projectId={id as string} userId={session?.user?.id as string} onTaskCreated={fetchData} />
          </div>
        </header>

        <Tabs defaultValue="board" className="w-full">
          <div className="flex items-center justify-between mb-6 border-b border-border pb-1">
            <TabsList className="bg-transparent h-auto p-0 gap-6">
              <TabsTrigger value="board" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 pb-2 flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" /> Board
              </TabsTrigger>
              <TabsTrigger value="list" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 pb-2 flex items-center gap-2">
                <List className="w-4 h-4" /> List
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="board" className="mt-0 outline-none">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {STATUS_COLUMNS.map((column) => (
                <div key={column} className="flex flex-col gap-4">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      {column}
                      <span className="bg-muted px-1.5 py-0.5 rounded-sm text-[10px] font-bold text-muted-foreground">
                        {tasks.filter(t => t.status === column).length}
                      </span>
                    </h3>
                  </div>
                  
                  <div className="flex flex-col gap-3 min-h-[500px] p-2 rounded-xl bg-card/20 border border-border/50 border-dashed">
                    {tasks.filter(t => t.status === column).map((task) => (
                      <Card key={task.id} className="hover:border-primary/30 transition-shadow">
                        <CardHeader className="p-4 space-y-2">
                          <div className="flex justify-between items-start">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              task.priority === 'High' || task.priority === 'Urgent' ? 'bg-destructive/10 text-destructive' :
                              task.priority === 'Medium' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                            }`}>
                              {task.priority}
                            </span>
                            <div className="flex items-center gap-1">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full">
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
                                      onClick={() => handleStatusChange(task.id, s)}
                                    >
                                      {s}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                          <CardTitle className="text-sm font-semibold">{task.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
                            {task.description || "No description."}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              <span className="text-[10px]">{new Date(task.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold border border-border">
                              {task.assignee_name?.[0] || 'U'}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="list" className="mt-0 outline-none">
            <Card className="border-border">
              <div className="p-0 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Task Name</th>
                      <th className="px-6 py-4">Priority</th>
                      <th className="px-6 py-4">Assignee</th>
                      <th className="px-6 py-4 text-right">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-foreground">
                    {tasks.map((task) => (
                      <tr key={task.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            task.status === 'Done' ? 'bg-green-500/10 text-green-500' :
                            task.status === 'In Progress' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                          }`}>
                            {task.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-medium">{task.title}</td>
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
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold border border-border">
                              {task.assignee_name?.[0] || 'U'}
                            </div>
                            <span>{task.assignee_name || 'Unassigned'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-muted-foreground">
                          {new Date(task.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {tasks.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                          No tasks found in this project.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
