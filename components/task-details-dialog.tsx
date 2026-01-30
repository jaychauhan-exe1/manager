"use client";

import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  getTaskWithDependencies, 
  updateTask, 
  addTaskDependency, 
  removeTaskDependency,
  assignTask
} from "@/app/actions/projects";
import { toast } from "sonner";
import { 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  User, 
  Link as LinkIcon, 
  X 
} from "lucide-react";

export function TaskDetailsDialog({ 
  taskId, 
  isOpen, 
  onClose, 
  allTasks, 
  members,
  onUpdate 
}: { 
  taskId: string; 
  isOpen: boolean; 
  onClose: () => void; 
  allTasks: any[];
  members: any[];
  onUpdate: () => void;
}) {
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchTask = async () => {
    setLoading(true);
    const data = await getTaskWithDependencies(taskId);
    setTask(data);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen && taskId) {
      fetchTask();
    }
  }, [isOpen, taskId]);

  const handleUpdate = async (field: string, value: any) => {
    const result = await updateTask(taskId, { [field]: value });
    if (result.success) {
      fetchTask();
      onUpdate();
    }
  };

  const handleAssign = async (userId: string) => {
    const result = await assignTask(taskId, userId === 'none' ? null : userId);
    if (result.success) {
      fetchTask();
      onUpdate();
    }
  };

  const handleAddDependency = async (blockedById: string) => {
    if (blockedById === 'none') return;
    const result = await addTaskDependency(taskId, blockedById);
    if (result.success) {
      toast.success("Dependency added");
      fetchTask();
      onUpdate();
    }
  };

  const handleRemoveDependency = async (blockedById: string) => {
    const result = await removeTaskDependency(taskId, blockedById);
    if (result.success) {
      fetchTask();
      onUpdate();
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        {loading ? (
          <div className="py-20 text-center">
            <DialogHeader>
               <DialogTitle className="sr-only">Loading Task Details</DialogTitle>
            </DialogHeader>
            Loading task details...
          </div>
        ) : task ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  task.type === 'big' ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20' : 'bg-primary/10 text-primary border border-primary/20'
                }`}>
                  {task.type} Task
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  task.status === 'Done' ? 'bg-green-500/10 text-green-500' :
                  task.status === 'In Progress' ? 'bg-blue-500/10 text-blue-500' :
                  task.status === 'Break' ? 'bg-orange-500/10 text-orange-500' :
                  task.status === 'Blocked' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
                }`}>
                  {task.status}
                </span>
              </div>
              <div className="mt-2">
                <Input 
                  defaultValue={task.title}
                  onBlur={(e) => handleUpdate('title', e.target.value)}
                  className="text-2xl font-bold bg-transparent border-none p-0 focus-visible:ring-0 focus-visible:bg-muted/10 transition-colors"
                />
              </div>
            </DialogHeader>

            <div className="grid gap-6 py-4">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Description</Label>
                <Textarea 
                  defaultValue={task.description} 
                  onBlur={(e) => handleUpdate('description', e.target.value)}
                  placeholder="Add a more detailed description..."
                  className="bg-muted/30 border-none resize-none focus-visible:ring-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-muted-foreground">Assignee</Label>
                  <Select defaultValue={task.assignee_id || 'none'} onValueChange={handleAssign}>
                    <SelectTrigger className="bg-muted/30 border-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {members.map(m => (
                        <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label className="text-muted-foreground">Priority</Label>
                  <Select defaultValue={task.priority} onValueChange={(v) => handleUpdate('priority', v)}>
                    <SelectTrigger className="bg-muted/30 border-none">
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
                <Label className="text-muted-foreground">Deadline</Label>
                <Input 
                  type="date" 
                  defaultValue={task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : ''}
                  onChange={(e) => handleUpdate('deadline', e.target.value)}
                  className="bg-muted/30 border-none focus-visible:ring-1"
                />
              </div>

              <div className="space-y-4 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-destructive" /> Blocked By
                  </Label>
                  <Select onValueChange={handleAddDependency}>
                    <SelectTrigger className="w-[200px] h-8 text-xs bg-muted/30 border-none">
                      <SelectValue placeholder="Add dependency..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allTasks.filter(t => t.id !== task.id).map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {task.blocked_by_tasks?.map((t: any) => (
                    <div key={t.id} className="flex items-center gap-2 bg-destructive/10 text-destructive text-[11px] font-medium px-2 py-1 rounded-md border border-destructive/20">
                      <span>{t.title}</span>
                      <button onClick={() => handleRemoveDependency(t.id)}>
                        <X className="w-3 h-3 hover:text-foreground" />
                      </button>
                    </div>
                  ))}
                  {(!task.blocked_by_tasks || task.blocked_by_tasks.length === 0) && (
                    <span className="text-xs text-muted-foreground italic">No blockers defined.</span>
                  )}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-border/50">
                <Label className="text-sm font-bold flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-primary" /> This task is Blocking
                </Label>
                <div className="flex flex-wrap gap-2">
                  {task.blocking_tasks?.map((t: any) => (
                    <div key={t.id} className="bg-primary/10 text-primary text-[11px] font-medium px-2 py-1 rounded-md border border-primary/20">
                      {t.title}
                    </div>
                  ))}
                  {(!task.blocking_tasks || task.blocking_tasks.length === 0) && (
                    <span className="text-xs text-muted-foreground italic">Not blocking any other tasks.</span>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
