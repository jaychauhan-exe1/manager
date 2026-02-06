"use client";

import { useEffect, useState, useCallback } from "react";
import { authClient } from "@/src/lib/auth-client";
import { useParams, useRouter } from "next/navigation";
import { getProjectById, getTasks, updateTaskStatus, getProjectMembers, updateTaskPosition, initDatabase, deleteTask, startTaskTimer, stopTaskTimer, updateTask, assignTask } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  GripVertical,
  Pencil
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const STATUS_COLUMNS = ["To Do", "In Progress", "Blocked", "Done"];

export default function ProjectPage() {
  const { id } = useParams();
  const { data: session, isPending: authPending } = authClient.useSession();
  const router = useRouter();
  
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [expandedSubtaskId, setExpandedSubtaskId] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

  useEffect(() => {
    setIsEditingTitle(false);
    setEditingSubtaskId(null);
    setExpandedSubtaskId(null);
  }, [selectedTaskId]);

  useEffect(() => {
    const handleGlobalDragEnd = () => {
      setDraggingTaskId(null);
      setDragOverTaskId(null);
    };
    window.addEventListener('dragend', handleGlobalDragEnd);
    return () => window.removeEventListener('dragend', handleGlobalDragEnd);
  }, []);

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
    if (session && id) {
      fetchData();
    }
  }, [session, id, fetchData]);

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    const previousTasks = [...tasks];
    let parentId: string | null = null;
    let timeDelta = 0;

    // 1. Optimistically update the task itself and calculate time delta
    const updatedTasks = tasks.map(t => {
      if (t.id === taskId) {
        parentId = t.parent_id;
        let timer_status = t.timer_status;
        let timer_started_at = t.timer_started_at;
        let total_time_spent = Number(t.total_time_spent || 0);

        if (t.timer_status === 'working' && t.timer_started_at) {
          timeDelta = Math.floor((new Date().getTime() - new Date(t.timer_started_at).getTime()) / 1000);
          total_time_spent += Math.max(0, timeDelta);
        }

        if (newStatus === 'In Progress') {
          timer_status = 'working';
          timer_started_at = new Date().toISOString();
        } else {
          timer_status = 'idle';
          timer_started_at = null;
        }

        return { ...t, status: newStatus, timer_status, timer_started_at, total_time_spent };
      }
      return t;
    });

    // 2. Optimistically update the parent task's total time and status
    const finalTasks = updatedTasks.map(t => {
      if (parentId && t.id === parentId) {
        const subtasks = updatedTasks.filter(st => st.parent_id === parentId);
        const allDone = subtasks.every(st => st.status === 'Done');
        const anyInProgress = subtasks.some(st => ['In Progress', 'Blocked'].includes(st.status));
        const someDone = subtasks.some(st => st.status === 'Done');

        let pStatus = 'To Do';
        if (allDone) pStatus = 'Done';
        else if (anyInProgress || someDone) pStatus = 'In Progress';

        return { 
          ...t, 
          status: pStatus, 
          total_time_spent: Number(t.total_time_spent || 0) + Math.max(0, timeDelta)
        };
      }
      return t;
    });

    setTasks(finalTasks);

    const result = await updateTaskStatus(taskId, newStatus);
    if (!result.success) {
      toast.error("Failed to update status");
      setTasks(previousTasks);
    }
  };

  const handleTaskUpdate = async (taskId: string, data: any) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...data } : t));
    const result = await updateTask(taskId, data);
    if (!result.success) {
      toast.error("Failed to update task");
      fetchData(); // Rollback
    }
  };

  const handleAssignTask = async (taskId: string, userId: string | null) => {
    const result = await assignTask(taskId, userId === 'none' ? null : userId);
    if (result.success) {
      fetchData();
    } else {
      toast.error("Failed to assign task");
    }
  };

  const handleOptimisticCreate = (newTask: any) => {
    setTasks(prev => [...prev, newTask]);
    // If it's a big task being created in a specific column, it might need to know which one?
    // Actually our dialog defaults to "To Do".
  };

  const onDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggingTaskId(taskId);
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.effectAllowed = "move";
    
    // Set a blank drag image to avoid the default ghosting if we're doing custom visuals
    // But since the user wants the "whole task to be draggable", we'll just use the default
    // and style the source element.
  };

  const onDragEnd = (e: React.DragEvent) => {
    setDraggingTaskId(null);
  };

   const onDropOnColumn = async (e: React.DragEvent, status: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    setDragOverTaskId(null);
    if (isMoving) return;

    const taskId = e.dataTransfer.getData("taskId");
    if (taskId) {
      const taskToMove = tasks.find(x => x.id === taskId);
      if (!taskToMove || taskToMove.status === status) return;

      setIsMoving(true);
      const columnTasks = tasks
        .filter(t => t.status === status && t.type === 'big')
        .sort((a, b) => Number(b.position) - Number(a.position)); // DESC
      
      let newPosition;
      if (columnTasks.length > 0) {
        newPosition = Number(columnTasks[columnTasks.length - 1].position) - 10;
      } else {
        const weights: Record<string, number> = { 'Urgent': 4000, 'High': 3000, 'Medium': 2000, 'Low': 1000 };
        newPosition = weights[taskToMove.priority || 'Medium'] || 2000;
      }

      setDraggingTaskId(null);
      
      // Optimistic update for task and its subtasks
      setTasks(current => current.map(t => {
        if (t.id === taskId) return { ...t, position: newPosition, status: status };
        if (t.parent_id === taskId) return { ...t, status: status }; // Sync subtasks
        return t;
      }));
      
      try {
        const result = await updateTaskPosition(taskId, newPosition, status);
        if (!result.success) throw new Error("Update failure");
      } catch (err) {
        toast.error("Failed to move task");
        fetchData(); // Rollback
      } finally {
        setIsMoving(false);
      }
    }
  };

   const onDropOnTask = async (e: React.DragEvent, targetTaskId: string, targetStatus: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(null);
    if (isMoving) return;
    
    const sourceTaskId = e.dataTransfer.getData("taskId");
    if (!sourceTaskId || sourceTaskId === targetTaskId) return;

    const sourceTask = tasks.find(t => t.id === sourceTaskId);
    const targetTask = tasks.find(t => t.id === targetTaskId);
    if (!sourceTask || !targetTask) return;

    setIsMoving(true);
    const columnTasks = tasks
      .filter(t => t.status === targetStatus && t.type === 'big')
      .sort((a, b) => Number(b.position) - Number(a.position)); // DESC

    const targetIndex = columnTasks.findIndex(t => t.id === targetTaskId);
    const aboveTask = columnTasks[targetIndex - 1];

    let newPosition;
    if (aboveTask) {
      newPosition = (Number(targetTask.position) + Number(aboveTask.position)) / 2;
    } else {
      newPosition = Number(targetTask.position) + 10;
    }

    setDraggingTaskId(null);
    
    // Optimistic update for task and its subtasks
    setTasks(current => current.map(t => {
      if (t.id === sourceTaskId) return { ...t, position: newPosition, status: targetStatus };
      if (t.parent_id === sourceTaskId) return { ...t, status: targetStatus }; // Sync subtasks
      return t;
    }));

    try {
      const result = await updateTaskPosition(sourceTaskId, newPosition, targetStatus);
      if (!result.success) throw new Error("Update failure");
    } catch (err) {
      toast.error("Failed to reorder task");
      fetchData(); // Rollback
    } finally {
      setIsMoving(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (confirm("Are you sure you want to delete this task?")) {
      const result = await deleteTask(taskId);
      if (result.success) {
        toast.success("Task deleted");
        if (selectedTaskId === taskId) {
          setIsSidebarOpen(false);
          setSelectedTaskId(null);
        }
        fetchData();
      } else {
        toast.error("Failed to delete task");
      }
    }
  };

  const handleTimerAction = async (taskId: string, action: 'start' | 'stop' | 'break') => {
    // Local optimistic update for timer
    setTasks(current => current.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          timer_status: action === 'start' ? 'working' : action === 'break' ? 'break' : 'idle',
          timer_started_at: action === 'stop' ? null : new Date().toISOString()
        };
      }
      return t;
    }));

    if (action === 'stop' || action === 'break') {
      await stopTaskTimer(taskId);
      if (action === 'break') {
        await startTaskTimer(taskId, 'break');
      }
    } else {
      await startTaskTimer(taskId, 'working');
    }
  };

  if (loading || authPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-2xl font-bold text-primary">Loading project...</div>
      </div>
    );
  }

  const bigTasks = tasks.filter(t => t.type === 'big');
  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  const selectedTaskSubtasks = tasks.filter(t => t.parent_id === selectedTaskId);

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
              onOptimisticCreate={handleOptimisticCreate}
              fixedType="big"
            />
          </div>
        </header>

        <Tabs defaultValue="board" className="w-full">
          <div className="flex items-center justify-between mb-6 border-b border-border pb-1">
            <TabsList className="bg-transparent h-auto p-0 gap-8">
              <TabsTrigger value="board" className="data-[state=active]:bg-transparent data-[state=active]:rounded-full data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 pb-3 flex items-center gap-2 text-sm">
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
                  className={`flex flex-col gap-4 p-3 rounded-2xl transition-all duration-300 min-h-[700px] border-2 ${
                    dragOverColumn === column 
                      ? 'bg-primary/5 border-primary/30 border-dashed scale-[1.01]' 
                      : 'bg-muted/10 border-transparent'
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverColumn !== column) setDragOverColumn(column);
                  }}
                  onDragLeave={() => {
                    setDragOverColumn(null);
                  }}
                  onDrop={(e) => {
                    onDropOnColumn(e, column);
                  }}
                >
                  <div className="flex items-center justify-between px-1">
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground/70 flex items-center gap-2">
                       <div className={`w-2 h-2 rounded-full ${
                        column === 'Done' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 
                        column === 'In Progress' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]' : 
                        column === 'Break' ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]' :
                        column === 'Blocked' ? 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.4)]' : 'bg-muted-foreground/30'
                      }`} />
                      {column}
                      <span className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-[10px] font-bold text-muted-foreground">
                        {bigTasks.filter(t => t.status === column).length}
                      </span>
                    </h3>
                  </div>
                  
                   <div className="flex flex-col gap-4 min-h-[600px] relative">
                    {bigTasks
                      .filter(t => t.status === column)
                      .sort((a, b) => Number(b.position) - Number(a.position))
                      .map((task) => (
                      <div 
                        key={task.id} 
                        className="relative group/taskwrapper"
                        onDragLeave={(e) => {
                          // Only clear if we're actually leaving the wrapper, not entering a child
                          const rect = e.currentTarget.getBoundingClientRect();
                          if (e.clientX <= rect.left || e.clientX >= rect.right || e.clientY <= rect.top || e.clientY >= rect.bottom) {
                            setDragOverTaskId(null);
                          }
                        }}
                      >
                        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${dragOverTaskId === task.id && draggingTaskId !== task.id ? 'h-20 opacity-100 mb-4' : 'h-0 opacity-0 mb-0'}`}>
                          <div className="mx-2 h-full border-2 border-dashed border-primary/30 rounded-2xl bg-primary/5 flex items-center justify-center">
                            <div className="w-full h-0.5 bg-primary/20 rounded-full mx-12 opacity-30" />
                          </div>
                        </div>
                        <TaskItem 
                          task={task} 
                          subtasks={tasks.filter(st => st.parent_id === task.id)}
                          onDragStart={onDragStart}
                          onDragEnd={() => {
                            setDraggingTaskId(null);
                            setDragOverTaskId(null);
                          }}
                          onDragOver={() => {
                            if (draggingTaskId !== task.id) setDragOverTaskId(task.id);
                          }}
                          onDrop={(e: any) => {
                            setDragOverTaskId(null);
                            onDropOnTask(e, task.id, column);
                          }}
                          onClick={() => {
                            setSelectedTaskId(task.id);
                            setIsSidebarOpen(true);
                          }}
                          onOpenDetails={() => {
                            setSelectedTaskId(task.id);
                            setIsDetailsOpen(true);
                          }}
                          onDelete={() => handleDeleteTask(task.id)}
                          onStatusChange={handleStatusChange}
                          isDragging={draggingTaskId === task.id}
                          onMove={async (dir: 'up' | 'down') => {
                             const colTasks = bigTasks.filter(t => t.status === column).sort((a, b) => Number(b.position) - Number(a.position));
                             const idx = colTasks.findIndex(t => t.id === task.id);
                             let newPos;
                             if (dir === 'up' && idx > 0) {
                               const above = colTasks[idx - 1];
                               const aboveAbove = colTasks[idx - 2];
                               newPos = aboveAbove ? (Number(above.position) + Number(aboveAbove.position)) / 2 : Number(above.position) + 10;
                             } else if (dir === 'down' && idx < colTasks.length - 1) {
                               const below = colTasks[idx + 1];
                               const belowBelow = colTasks[idx + 2];
                               newPos = belowBelow ? (Number(below.position) + Number(belowBelow.position)) / 2 : Number(below.position) - 10;
                             }
                             if (newPos) {
                               setTasks(prev => prev.map(t => t.id === task.id ? { ...t, position: newPos } : t));
                               await updateTaskPosition(task.id, newPos);
                             }
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="list" className="mt-0 outline-none">
            <div className="space-y-6">
              {bigTasks.map(bt => (
                <Card key={bt.id} className="border-border shadow-md bg-card/20 overflow-hidden">
                  <div className="p-4 bg-muted/30 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${bt.status === 'Done' ? 'bg-green-500' : 'bg-primary'}`} />
                      <h4 className="font-bold text-sm tracking-tight">{bt.title}</h4>
                      <span className="text-[10px] text-muted-foreground uppercase">{bt.status}</span>
                    </div>
                    {bt.deadline && (
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(bt.deadline).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-muted/10 text-muted-foreground uppercase text-[9px] font-bold tracking-wider">
                        <tr>
                          <th className="px-6 py-3">Subtask</th>
                          <th className="px-6 py-3">Status</th>
                          <th className="px-6 py-3">Priority</th>
                          <th className="px-6 py-3">Time</th>
                          <th className="px-6 py-3">Deadline</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {tasks.filter(st => st.parent_id === bt.id).map(st => (
                          <tr key={st.id} className="hover:bg-primary/5 transition-colors cursor-pointer" onClick={() => {
                            setSelectedTaskId(bt.id);
                            setIsSidebarOpen(true);
                          }}>
                            <td className="px-6 py-3 font-medium">{st.title}</td>
                            <td className="px-6 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                                st.status === 'Done' ? 'bg-green-500/10 text-green-500' : 'bg-primary/10 text-primary'
                              }`}>{st.status}</span>
                            </td>
                            <td className="px-6 py-3">{st.priority}</td>
                            <td className="px-6 py-3 text-muted-foreground font-mono">
                              {Math.floor(st.total_time_spent / 3600)}h {Math.floor((st.total_time_spent % 3600) / 60)}m
                            </td>
                            <td className="px-6 py-3 text-muted-foreground">
                              {st.deadline ? new Date(st.deadline).toLocaleDateString() : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ))}
              {tasks.filter(t => t.type === 'small' && !t.parent_id).length > 0 && (
                <div className="pt-8">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Uncategorized Tasks</h3>
                   <Card className="border-border shadow-md bg-card/20 overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-muted/10 text-muted-foreground uppercase text-[9px] font-bold tracking-wider">
                        <tr>
                          <th className="px-6 py-3">Task</th>
                          <th className="px-6 py-3">Status</th>
                          <th className="px-6 py-3">Priority</th>
                          <th className="px-6 py-3">Deadline</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {tasks.filter(t => t.type === 'small' && !t.parent_id).map(st => (
                          <tr key={st.id} className="hover:bg-primary/5 transition-colors cursor-pointer" onClick={() => {
                            setSelectedTaskId(st.id);
                            setIsDetailsOpen(true);
                          }}>
                            <td className="px-6 py-3 font-medium">{st.title}</td>
                            <td className="px-6 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                                st.status === 'Done' ? 'bg-green-500/10 text-green-500' : 'bg-primary/10 text-primary'
                              }`}>{st.status}</span>
                            </td>
                            <td className="px-6 py-3">{st.priority}</td>
                            <td className="px-6 py-3 text-muted-foreground">
                              {st.deadline ? new Date(st.deadline).toLocaleDateString() : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="members" className="mt-0 outline-none">
            <ProjectMembers projectId={id as string} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Big Task Sidebar */}
      <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <SheetContent className="sm:max-w-[550px] w-full p-0 overflow-hidden flex flex-col border-l border-border/10 bg-card/95 backdrop-blur-3xl">
          {selectedTask && (
            <>
              <div className="p-8 pb-4">
                <SheetHeader className="space-y-6">
                  <SheetTitle className="sr-only">Edit Task: {selectedTask.title}</SheetTitle>
                  
                  <div className="space-y-4">
                    <div className="grid gap-2">
                       <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400/80">
                        Task Title
                      </Label>
                      <div className="flex items-center gap-3 group">
                        <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 shrink-0">
                          <LayoutDashboard className="w-5 h-5" />
                        </div>
                        {isEditingTitle ? (
                          <Input 
                            autoFocus
                            defaultValue={selectedTask.title}
                            onBlur={(e) => {
                              handleTaskUpdate(selectedTask.id, { title: e.target.value });
                              setIsEditingTitle(false);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleTaskUpdate(selectedTask.id, { title: e.currentTarget.value });
                                setIsEditingTitle(false);
                              }
                            }}
                            className="text-2xl font-black tracking-tight bg-muted/20 border-border/50 px-3 h-10 focus-visible:ring-1 rounded-xl"
                          />
                        ) : (
                          <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-black tracking-tight">{selectedTask.title}</h2>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-full bg-muted/30 opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/20 hover:text-primary"
                              onClick={() => setIsEditingTitle(true)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                          Status
                        </Label>
                        <Select defaultValue={selectedTask.status} onValueChange={(v) => handleStatusChange(selectedTask.id, v)}>
                          <SelectTrigger className="h-10 bg-muted/20 border-border/30 rounded-xl px-4">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_COLUMNS.map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                          Priority
                        </Label>
                        <Select defaultValue={selectedTask.priority} onValueChange={(v) => handleTaskUpdate(selectedTask.id, { priority: v })}>
                          <SelectTrigger className="h-10 bg-muted/20 border-border/30 rounded-xl px-4">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Low">Low</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="High">High</SelectItem>
                            <SelectItem value="Urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                        Assignee
                      </Label>
                      <Select defaultValue={selectedTask.assignee_id || 'none'} onValueChange={(v) => handleAssignTask(selectedTask.id, v)}>
                        <SelectTrigger className="h-12 bg-muted/20 border-border/30 rounded-xl px-4">
                          <div className="flex items-center gap-3">
                            {selectedTask.assignee_id && selectedTask.assignee_id !== 'none' && (
                              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                                {selectedTask.assignee_name?.[0] || '?'}
                              </div>
                            )}
                            <div className="text-sm font-bold truncate">
                              <SelectValue placeholder="Unassigned" />
                            </div>
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {members.map(m => (
                            <SelectItem key={m.user_id} value={m.user_id}>
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold">
                                  {m.name?.[0]}
                                </div>
                                {m.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2 pt-2 border-t border-border/10 mt-4">
                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                        Description
                      </Label>
                      <Textarea 
                        defaultValue={selectedTask.description}
                        onBlur={(e) => handleTaskUpdate(selectedTask.id, { description: e.target.value })}
                        placeholder="Describe what needs to be achieved in this phase..."
                        className="text-muted-foreground text-sm leading-relaxed bg-muted/10 border-none p-3 rounded-xl resize-none focus-visible:ring-1 focus-visible:ring-primary/20 min-h-[80px]"
                      />
                    </div>
                  </div>
                </SheetHeader>
              </div>

              <div className="flex-1 overflow-y-auto px-8 py-4 space-y-10 custom-scrollbar">
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-border/50 pb-4">
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/50 flex items-center gap-2">
                       Subtasks
                      <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px]">{selectedTaskSubtasks.length}</span>
                    </h4>
                    <CreateTaskDialog 
                      projectId={id as string} 
                      userId={session?.user?.id as string} 
                      onTaskCreated={fetchData} 
                      onOptimisticCreate={handleOptimisticCreate}
                      fixedType="small"
                      bigTasks={[selectedTask]}
                    />
                  </div>

                  <div className="space-y-4">
                    {selectedTaskSubtasks.map(st => (
                      <div key={st.id} className="group flex flex-col p-4 rounded-2xl border border-border/30 bg-card/30 hover:bg-primary/5 hover:border-primary/30 transition-all duration-300 cursor-pointer" onClick={() => setExpandedSubtaskId(expandedSubtaskId === st.id ? null : st.id)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(st.id, st.status === 'Done' ? 'To Do' : 'Done');
                              }}
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                                st.status === 'Done' ? 'bg-green-500 border-green-500 text-white scale-110 shadow-lg shadow-green-500/20' : 'border-muted-foreground/20 hover:border-primary/50'
                              }`}
                            >
                              {st.status === 'Done' && <CheckCircle2 className="w-3.5 h-3.5" />}
                            </button>
                            <div className="flex flex-col flex-1">
                              {editingSubtaskId === st.id ? (
                                <Input 
                                  autoFocus
                                  defaultValue={st.title}
                                  onClick={(e) => e.stopPropagation()}
                                  onBlur={(e) => {
                                    handleTaskUpdate(st.id, { title: e.target.value });
                                    setEditingSubtaskId(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleTaskUpdate(st.id, { title: e.currentTarget.value });
                                      setEditingSubtaskId(null);
                                    }
                                  }}
                                  className={`text-sm font-bold bg-muted/20 border-border/50 px-2 h-8 rounded-lg focus-visible:ring-1`}
                                />
                              ) : (
                                <div className="flex items-center gap-2 group/title">
                                  <div className={`text-sm font-bold transition-all ${st.status === 'Done' ? 'line-through text-muted-foreground/50' : 'text-foreground'}`}>
                                    {st.title}
                                  </div>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 rounded-full opacity-0 group-hover/title:opacity-100 transition-all hover:bg-primary/20 hover:text-primary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingSubtaskId(st.id);
                                    }}
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                              
                              <div className="flex items-center gap-3 mt-1.5">
                                 <span className={`text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground uppercase border border-border/50`}>
                                   {st.status}
                                 </span>
                                 <span className={`text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded bg-primary/5 text-primary uppercase border border-primary/20`}>
                                   {st.priority}
                                 </span>
                                 {st.deadline && (
                                   <span className="text-[9px] text-destructive/80 font-bold flex items-center gap-1">
                                     <Clock className="w-3 h-3" /> {new Date(st.deadline).toLocaleDateString()}
                                   </span>
                                 )}
                                 <div onClick={(e) => e.stopPropagation()}>
                                   <TimerDisplay task={st} onAction={(a: 'start' | 'stop' | 'break') => handleTimerAction(st.id, a)} />
                                 </div>
                              </div>
                            </div>
                          </div>

                          <div onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-all">
                                  <MoreVertical className="h-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                                 {STATUS_COLUMNS.map(s => (
                                  <DropdownMenuItem 
                                    key={s} 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStatusChange(st.id, s);
                                    }} 
                                    className="gap-2"
                                  >
                                    <div className={`w-2 h-2 rounded-full ${
                                      s === 'Done' ? 'bg-green-500' : s === 'In Progress' ? 'bg-blue-500' : s === 'Break' ? 'bg-orange-500' : s === 'Blocked' ? 'bg-destructive' : 'bg-muted-foreground/30'
                                    }`} />
                                    {s}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive gap-2" onClick={() => handleDeleteTask(st.id)}>
                                  <AlertCircle className="w-4 h-4" /> Delete Subtask
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {expandedSubtaskId === st.id && (
                          <div className="mt-4 pt-4 border-t border-border/10 animate-in fade-in slide-in-from-top-1 duration-200" onClick={(e) => e.stopPropagation()}>
                            <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">
                              Task Description
                            </Label>
                            <Textarea 
                              defaultValue={st.description}
                              onBlur={(e) => handleTaskUpdate(st.id, { description: e.target.value })}
                              placeholder="What exactly needs to be done?"
                              className="text-xs leading-relaxed bg-muted/20 border-none p-3 rounded-xl resize-none focus-visible:ring-1 focus-visible:ring-primary/20 min-h-[60px]"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                    {selectedTaskSubtasks.length === 0 && (
                      <div className="py-12 text-center border-2 border-dashed border-border/20 rounded-3xl bg-muted/5">
                        <div className="w-12 h-12 rounded-full bg-muted/10 flex items-center justify-center mx-auto mb-4">
                          <Plus className="w-6 h-6 text-muted-foreground/40" />
                        </div>
                        <p className="text-sm font-bold text-muted-foreground/60">No subtasks yet</p>
                        <p className="text-xs text-muted-foreground/40 mt-1">Break this milestone into smaller tasks.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-8 border-t border-border/50">
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-6 px-1">Metrics & Timeline</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-muted/20 border border-border/30">
                        <Label className="text-[10px] text-muted-foreground font-black uppercase tracking-widest flex items-center gap-2 mb-2">
                          <Calendar className="w-3.5 h-3.5 text-primary shrink-0" /> Started
                        </Label>
                        <div className="text-sm font-bold">{new Date(selectedTask.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="p-4 rounded-2xl bg-muted/20 border border-border/30">
                        <Label className="text-[10px] text-muted-foreground font-black uppercase tracking-widest flex items-center gap-2 mb-2">
                          <Clock className="w-3.5 h-3.5 text-primary shrink-0" /> Effort
                        </Label>
                        <div className="text-sm font-bold">
                           {Math.floor(selectedTask.total_time_spent / 3600)}h {Math.floor((selectedTask.total_time_spent % 3600) / 60)}m
                        </div>
                      </div>
                    </div>
                </div>
              </div>

              <div className="p-8 border-t border-border/10">
                <div className="flex items-center gap-3">
                  <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setIsSidebarOpen(false)}>Close</Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="destructive" className="h-12 w-12 rounded-xl p-0">
                        <MoreVertical className="w-5 h-5 rotate-90" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl shadow-2xl border-border/50 bg-card/95 backdrop-blur-xl">
                      <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Big Task Actions</DropdownMenuLabel>
                      <DropdownMenuItem 
                        className="rounded-xl h-10 font-bold gap-3"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedTask.id);
                          toast.success("Task ID copied to clipboard");
                        }}
                      >
                         <List className="w-4 h-4 text-primary" /> Copy Task ID
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-2 bg-border/20" />
                      <DropdownMenuItem 
                        className="rounded-xl h-10 font-bold gap-3 text-destructive focus:bg-destructive/10 focus:text-destructive"
                        onClick={() => handleDeleteTask(selectedTask.id)}
                      >
                        <AlertCircle className="w-4 h-4" /> Delete Big Task
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {selectedTaskId && (
        <TaskDetailsDialog 
          taskId={selectedTaskId as string} 
          isOpen={isDetailsOpen} 
          onClose={() => setIsDetailsOpen(false)} 
          allTasks={tasks}
          members={members}
          onUpdate={fetchData}
        />
      )}
    </div>
  );
}

 function TaskItem({ task, subtasks, onDragStart, onDragEnd, onDragOver, onDrop, onStatusChange, onDelete, onClick, onOpenDetails, isDragging, onMove }: any) {
  const progress = task.subtask_count > 0 ? (task.subtasks_done / task.subtask_count) * 100 : 0;

  return (
    <Card 
      className={`group hover:border-primary/50 transition-all duration-300 cursor-grab active:cursor-grabbing border-border shadow-md overflow-hidden ${
        isDragging ? 'opacity-40 scale-[0.98] border-primary border-dashed' : 'hover:shadow-xl hover:shadow-primary/5'
      } border-l-4 ${task.status === 'Done' ? 'border-l-green-500 bg-green-500/5' : 'border-l-primary bg-card/60'} backdrop-blur-sm relative`}
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDrop={onDrop}
      onClick={onClick}
    >
      {isDragging && (
        <div className="absolute inset-0 bg-primary/5" />
      )}
      <CardHeader className="p-5 space-y-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2.5">
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors" />
            <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
              task.priority === 'High' || task.priority === 'Urgent' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
              task.priority === 'Medium' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted text-muted-foreground border border-border'
            }`}>
              {task.priority}
            </span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider bg-purple-500/10 text-purple-500 border border-purple-500/20 shadow-sm shadow-purple-500/10">
              Big Task
            </span>
          </div>
          <DropdownMenu onClick={(e) => e.stopPropagation()}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-muted/50 transition-colors" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Task Configuration</DropdownMenuLabel>
              <DropdownMenuItem onClick={onOpenDetails} className="gap-2">
                <Settings className="w-4 h-4" /> Edit Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {STATUS_COLUMNS.map(s => (
                <DropdownMenuItem 
                  key={s} 
                  disabled={s === task.status}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(task.id, s);
                  }}
                  className="gap-2"
                >
                   <div className={`w-2 h-2 rounded-full ${
                    s === 'Done' ? 'bg-green-500' : s === 'In Progress' ? 'bg-blue-500' : s === 'Break' ? 'bg-orange-500' : s === 'Blocked' ? 'bg-destructive' : 'bg-muted-foreground/30'
                  }`} />
                  Move to {s}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CardTitle className="text-base font-black leading-tight group-hover:text-primary transition-colors tracking-tight">{task.title}</CardTitle>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
              <span className="text-muted-foreground/60">Execution Progress</span>
              <span className="text-primary">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className={`h-1.5 ${task.status === 'Done' ? 'bg-green-500/20' : 'bg-muted/30'}`} indicatorClassName={task.status === 'Done' ? 'bg-green-500' : ''} />
          </div>

          <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-black tabular-nums">
                {Math.floor(task.total_time_spent / 3600)}h {Math.floor((task.total_time_spent % 3600) / 60)}m
              </span>
            </div>
            <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-50">Total Work</span>
          </div>

          {subtasks.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-border/20">
               {subtasks.slice(0, 3).map((st: any) => (
                 <div key={st.id} className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground/80 group/st">
                   {st.status === 'Done' ? (
                     <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                   ) : (
                     <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 group-hover/st:bg-primary transition-colors" />
                   )}
                   <span className={`truncate ${st.status === 'Done' ? 'line-through opacity-40' : ''}`}>{st.title}</span>
                 </div>
               ))}
               {subtasks.length > 3 && (
                 <div className="text-[10px] text-primary/70 font-black uppercase tracking-widest pl-5 mt-2">
                   +{subtasks.length - 3} Additional units
                 </div>
               )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/30">
          <div className="flex items-center gap-2 text-muted-foreground/60">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold">{new Date(task.created_at).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 hidden sm:block">Assignee</span>
              <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary border border-primary/20 shadow-sm">
                {task.assignee_name?.[0] || '?'}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
function TimerDisplay({ task, onAction }: { task: any, onAction: (action: 'start' | 'stop' | 'break') => void }) {
  const [seconds, setSeconds] = useState(0);
  
  useEffect(() => {
    if (task.timer_status === 'idle' || !task.timer_started_at) {
      setSeconds(Number(task.total_time_spent || 0));
      return;
    }

    const start = new Date(task.timer_started_at).getTime();
    const baseSeconds = Number(task.total_time_spent || 0);

    const update = () => {
      const now = new Date().getTime();
      const diff = Math.floor((now - start) / 1000);
      // Ensure we don't show negative time if clocks are slightly out of sync
      setSeconds(baseSeconds + Math.max(0, diff));
    };

    update(); // Run immediately
    const interval = setInterval(update, 1000);
    
    return () => clearInterval(interval);
  }, [task.id, task.timer_status, task.timer_started_at, task.total_time_spent]);

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return (
    <div className="flex items-center gap-2 bg-muted/50 px-2 py-0.5 rounded-full border border-border/50">
      <span className="text-[9px] font-mono text-primary tabular-nums">
        {h > 0 && `${h}:`}{m.toString().padStart(2, '0')}:{s.toString().padStart(2, '0')}
      </span>
      <div className="flex gap-1">
        {task.timer_status === 'idle' ? (
          <button onClick={() => onAction('start')} className="text-primary hover:scale-110 transition-transform"><Plus className="w-2.5 h-2.5 rotate-45" /></button>
        ) : (
          <button onClick={() => onAction('stop')} className="text-destructive hover:scale-110 transition-transform"><AlertCircle className="w-2.5 h-2.5" /></button>
        )}
      </div>
    </div>
  );
}
