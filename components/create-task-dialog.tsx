"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { createTask } from "@/app/actions/projects";
import { toast } from "sonner";

export function CreateTaskDialog({ 
  projectId, 
  userId, 
  onTaskCreated,
  bigTasks = [],
  fixedType,
  onOptimisticCreate
}: { 
  projectId: string; 
  userId: string; 
  onTaskCreated: () => void;
  bigTasks?: any[];
  fixedType?: 'big' | 'small';
  onOptimisticCreate?: (task: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [type, setType] = useState<"big" | "small">(fixedType || "small");
  
  // Default parent to the first big task if only one is provided (sidebar case)
  const defaultParentId = (fixedType === 'small' && bigTasks.length === 1) ? bigTasks[0].id : "none";
  const [parentId, setParentId] = useState<string>(defaultParentId);

  useEffect(() => {
    if (fixedType) setType(fixedType);
    if (fixedType === 'small' && bigTasks.length === 1) {
      setParentId(bigTasks[0].id);
    }
  }, [fixedType, bigTasks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    const newTask = {
      id: crypto.randomUUID(),
      project_id: projectId,
      title,
      description,
      priority,
      status: "To Do",
      type,
      parent_id: type === 'small' && parentId !== 'none' ? parentId : null,
      creator_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      subtask_count: 0,
      subtasks_done: 0,
      assignee_name: null
    };

    if (onOptimisticCreate) {
      onOptimisticCreate(newTask);
    }

    setLoading(true);
    setOpen(false); // Close early for smoothness
    
    const result = await createTask({ 
      project_id: projectId, 
      title, 
      description, 
      priority,
      creator_id: userId,
      type: type,
      parent_id: type === 'small' && parentId !== 'none' ? parentId : undefined
    });
    
    setLoading(false);

    if (result.success) {
      toast.success(`${type === 'big' ? 'Big' : 'Small'} task created!`);
      setTitle("");
      setDescription("");
      setPriority("Medium");
      onTaskCreated();
    } else {
      toast.error("Failed to create task");
      // Actually we'd need a roll-back here, but fetchData will fix it anyway.
      onTaskCreated(); 
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={fixedType === 'small' ? 'xs' : 'sm'} className="gap-2">
          <Plus className="w-4 h-4" />
          {fixedType === 'small' ? 'Add Subtask' : 'Add Big Task'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New {type === 'big' ? 'Big' : 'Small'} Task</DialogTitle>
            <DialogDescription>
              {type === 'big' ? 'Create a major project milestone or category.' : 'Add a specific actionable subtask.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {!fixedType && (
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Task Type</Label>
                  <Select value={type} onValueChange={(v: any) => setType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="big">Big Task</SelectItem>
                      <SelectItem value="small">Small Task</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {type === 'small' && (
                  <div className="grid gap-2">
                    <Label>Parent Big Task</Label>
                    <Select value={parentId} onValueChange={setParentId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (Independent)</SelectItem>
                        {bigTasks.map(bt => (
                          <SelectItem key={bt.id} value={bt.id}>{bt.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
            
            <div className="grid gap-2">
              <Label htmlFor="title">Task Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={type === 'big' ? "e.g. Frontend Development" : "e.g. Design Navbar"}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="t-description">Description</Label>
              <Textarea
                id="t-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Helpful details..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
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
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
