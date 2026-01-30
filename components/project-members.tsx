"use client";

import { useState, useEffect } from "react";
import { getProjectMembers, inviteUser } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { UserPlus, Mail, Shield, User } from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

export function ProjectMembers({ projectId }: { projectId: string }) {
  const [members, setMembers] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Member");
  const [loading, setLoading] = useState(false);

  const fetchMembers = async () => {
    const data = await getProjectMembers(projectId);
    setMembers(data);
  };

  useEffect(() => {
    fetchMembers();
  }, [projectId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    const result = await inviteUser(projectId, email, role);
    setLoading(false);

    if (result.success) {
      toast.success(`Invitation sent to ${email}`);
      setEmail("");
    } else {
      toast.error("Failed to send invitation");
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="md:col-span-2 space-y-4">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <User className="w-5 h-5 text-primary" /> Current Members
        </h3>
        <div className="grid gap-3">
          {members.map((member) => (
            <Card key={member.user_id} className="overflow-hidden border-border/50 bg-card/50">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold border border-primary/30">
                    {member.name?.[0] || 'U'}
                  </div>
                  <div>
                    <div className="font-semibold">{member.name}</div>
                    <div className="text-xs text-muted-foreground">{member.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    member.role === 'Admin' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-muted text-muted-foreground'
                  }`}>
                    {member.role}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-primary" /> Invite Member
        </h3>
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Add someone to your team</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-xs">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="email"
                    type="email" 
                    placeholder="colleague@example.com" 
                    className="pl-10 bg-background"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role" className="text-xs">Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Member">Member</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full gap-2" disabled={loading}>
                {loading ? "Sending..." : (
                  <>
                    <UserPlus className="w-4 h-4" /> Send Invitation
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
