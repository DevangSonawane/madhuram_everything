import React, { useState, useEffect } from 'react';
import { 
  Users as UsersIcon, 
  Search, 
  Plus, 
  RefreshCcw,
  SlidersHorizontal,
  X,
  MoreVertical,
  Phone,
  Mail,
  Edit
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/ui/data-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/useAuth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { hasFunctionAccess } from "@/lib/accessControl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppLoader } from "@/components/ui/loader";

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [projectOptions, setProjectOptions] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const { toast } = useToast();

  const isAdmin = user?.role === 'admin';
  const canManageUsersByRole = isAdmin;
  const canManageUsers = canManageUsersByRole && hasFunctionAccess(user, 'settings.user_management');

  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    phone_number: "",
    role: "labour",
    project: [], // For signup
    password: "", // For signup
    project_list: [], // For update
    check_in_time: "",
    check_out_time: "",
  });

  useEffect(() => {
    if (canManageUsers) {
      fetchUsers();
      fetchProjectOptions();
    } else {
      setLoading(false);
    }
  }, [canManageUsers]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const result = await api.getUsers();
      if (result.success && Array.isArray(result.data)) {
        setUsers(result.data);
      } else if (result.success) {
        // Handle case where data might be wrapped
        console.warn("Users API returned non-array data:", result.data);
        setUsers([]); 
      } else {
        toast({
          variant: "destructive",
          title: "Error fetching users",
          description: result.error
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load users"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (value) => {
    setFormData(prev => ({
      ...prev,
      role: value,
      check_in_time: value === 'labour' ? prev.check_in_time : "",
      check_out_time: value === 'labour' ? prev.check_out_time : "",
    }));
  };

  const normalizeTime = (value) => {
    if (!value) return "";
    if (/^\d{2}:\d{2}:\d{2}$/.test(value)) return value;
    if (/^\d{2}:\d{2}$/.test(value)) return `${value}:00`;
    return value;
  };

  const normalizeProjectAssignments = (value) => {
    if (Array.isArray(value)) {
      return value.map((item) => String(item)).filter(Boolean);
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item)).filter(Boolean);
        }
      } catch {
        return value
          .split(',')
          .map((item) => String(item).trim())
          .filter(Boolean);
      }
    }
    return [];
  };

  const fetchProjectOptions = async () => {
    setLoadingProjects(true);
    try {
      const result = await api.getProjects();
      if (!result.success || !Array.isArray(result.data)) {
        setProjectOptions([]);
        return;
      }

      const options = result.data
        .map((project) => {
          const id = project.project_id ?? project.id ?? project.project_name ?? project.name;
          const name = project.project_name || project.name || `Project ${id}`;
          if (id == null) return null;
          return { id: String(id), name };
        })
        .filter(Boolean);

      setProjectOptions(options);
    } catch (error) {
      setProjectOptions([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleProjectToggle = (projectId) => {
    setFormData((prev) => {
      const current = normalizeProjectAssignments(
        (Array.isArray(prev.project_list) && prev.project_list.length > 0) ? prev.project_list : prev.project
      );
      const next = new Set(current);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      const nextList = Array.from(next);
      return {
        ...prev,
        project: nextList,
        project_list: nextList
      };
    });
  };

  const clearProjectAssignments = () => {
    setFormData((prev) => ({
      ...prev,
      project: [],
      project_list: []
    }));
  };

  const resetForm = () => {
    setFormData({
      name: "",
      username: "",
      email: "",
      phone_number: "",
      role: "labour",
      project: [],
      password: "",
      project_list: [],
      check_in_time: "",
      check_out_time: "",
    });
  };

  const handleAddUser = async () => {
    if (savingUser) return;
    setSavingUser(true);
    try {
      if (formData.role === 'labour') {
        const checkIn = normalizeTime(formData.check_in_time);
        const checkOut = normalizeTime(formData.check_out_time);
        if (!checkIn || !checkOut) {
          toast({
            variant: "destructive",
            title: "Missing labour timings",
            description: "Please add check-in and check-out times.",
          });
          return;
        }
      }
      // Prepare data for signup
      const selectedProjects = normalizeProjectAssignments(
        (Array.isArray(formData.project) && formData.project.length > 0) ? formData.project : formData.project_list
      );
      const signupData = {
        name: formData.name,
        username: formData.username || formData.name,
        email: formData.email,
        phone_number: formData.phone_number,
        role: formData.role,
        project_id: 0,
        project: selectedProjects,
        password: formData.password,
        check_in_time: formData.role === 'labour' ? normalizeTime(formData.check_in_time) : undefined,
        check_out_time: formData.role === 'labour' ? normalizeTime(formData.check_out_time) : undefined,
      };

      const result = await api.createUser(signupData);
      
      if (result.success) {
        toast({
          title: "User created",
          description: `${formData.name} has been added successfully.`
        });
        setIsAddOpen(false);
        resetForm();
        fetchUsers();
      } else {
        toast({
          variant: "destructive",
          title: "Error creating user",
          description: result.error
        });
      }
    } catch (_error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create user"
      });
    }
    finally {
      setSavingUser(false);
    }
  };

  const handleEditClick = (user) => {
    const resolvedUsername = (user.username || user.name || '').trim();
    setSelectedUser(user);
    const assignedProjects = normalizeProjectAssignments(
      user.project_list ?? user.project ?? user.project_id ?? user.projects
    );
    setFormData({
      name: user.name,
      username: resolvedUsername,
      email: user.email,
      phone_number: user.phone_number,
      role: user.role,
      project: assignedProjects,
      project_list: assignedProjects
    });
    setIsEditOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    if (savingUser) return;
    setSavingUser(true);

    try {
      const normalizedUsername = (formData.username || formData.name || '').trim();
      if (!normalizedUsername) {
        toast({
          variant: "destructive",
          title: "Username is required",
          description: "Please enter a username before saving."
        });
        return;
      }
      const selectedProjects = normalizeProjectAssignments(
        (Array.isArray(formData.project_list) && formData.project_list.length > 0) ? formData.project_list : formData.project
      );
      const updateData = {
        username: normalizedUsername,
        email: formData.email,
        phone_number: formData.phone_number,
        role: formData.role,
        project_list: selectedProjects,
        project: selectedProjects
      };

      const userId = selectedUser.user_id ?? selectedUser.id ?? selectedUser.userId;
      const result = await api.updateUser(userId, updateData);

      if (result.success) {
        toast({
          title: "User updated",
          description: "User details updated successfully."
        });
        setIsEditOpen(false);
        setSelectedUser(null);
        resetForm();
        fetchUsers();
      } else {
        toast({
          variant: "destructive",
          title: "Error updating user",
          description: result.error
        });
      }
    } catch (_error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update user"
      });
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (confirm(`Are you sure you want to delete ${user.name}?`)) {
      try {
        const result = await api.deleteUser(user.user_id);
        if (result.success) {
          toast({
            title: "User deleted",
            description: "User has been removed."
          });
          fetchUsers();
        } else {
          toast({
            variant: "destructive",
            title: "Error deleting user",
            description: result.error
          });
        }
      } catch (_error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to delete user"
        });
      }
    }
  };

  const filteredUsers = users
    .filter((item) => {
      if (roleFilter === "all") return true;
      return String(item.role || "").toLowerCase() === String(roleFilter).toLowerCase();
    })
    .filter((item) => {
      const q = searchTerm.trim().toLowerCase();
      if (!q) return true;
      return (
        String(item.name || "").toLowerCase().includes(q) ||
        String(item.username || "").toLowerCase().includes(q) ||
        String(item.email || "").toLowerCase().includes(q) ||
        String(item.role || "").toLowerCase().includes(q)
      );
    });

  const totalUsers = users.length;
  const totalAdmins = users.filter((u) => u.role === "admin").length;
  const totalOperationalManagers = users.filter((u) => u.role === "operational_manager").length;
  const totalPoOfficers = users.filter((u) => u.role === "po_officer").length;
  const totalLabours = users.filter((u) => u.role === "labour").length;

  const clearFilters = () => {
    setSearchTerm("");
    setRoleFilter("all");
  };

  const columns = [
    {
      accessorKey: "name",
      header: "User",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={`https://ui-avatars.com/api/?name=${row.original.name}`} />
            <AvatarFallback>{row.original.name?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            <span className="text-xs text-muted-foreground">{row.original.username}</span>
          </div>
        </div>
      )
    },
    {
      accessorKey: "email",
      header: "Contact",
      cell: ({ row }) => (
        <div className="flex flex-col text-sm">
          <div className="flex items-center gap-2">
            <Mail className="h-3 w-3 text-muted-foreground" />
            {row.original.email}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Phone className="h-3 w-3 text-muted-foreground" />
            {row.original.phone_number}
          </div>
        </div>
      )
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => (
        <Badge variant={row.original.role === 'admin' ? 'default' : 'secondary'}>
          {row.original.role}
        </Badge>
      )
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const user = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleEditClick(user)}>
                <Edit className="mr-2 h-4 w-4" /> Edit Details
              </DropdownMenuItem>
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteUser(user)}>
                    Delete User
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (!canManageUsers) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You do not have permission to access this page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-gradient-to-br from-primary/5 via-background to-background p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <UsersIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
              <p className="text-muted-foreground mt-1">Create, edit, and maintain user accounts and project assignments.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading || savingUser}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={resetForm} disabled={savingUser}>
                  <Plus className="mr-2 h-4 w-4" /> Add User
                </Button>
              </DialogTrigger>
          <DialogContent className="sm:max-w-[780px]">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account with specific role access.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input id="name" name="name" value={formData.name} onChange={handleInputChange} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="username" className="text-right">Username</Label>
                <Input id="username" name="username" value={formData.username} onChange={handleInputChange} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">Email</Label>
                <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phone" className="text-right">Phone</Label>
                <Input id="phone" name="phone_number" value={formData.phone_number} onChange={handleInputChange} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="password" className="text-right">Password</Label>
                <Input id="password" name="password" type="password" value={formData.password} onChange={handleInputChange} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="role" className="text-right">Role</Label>
                <Select value={formData.role} onValueChange={handleRoleChange}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="operational_manager">Operational Manager</SelectItem>
                    <SelectItem value="po_officer">PO Officer</SelectItem>
                    <SelectItem value="labour">Labour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.role === 'labour' && (
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label className="text-right pt-2">Timings</Label>
                  <div className="col-span-3">
                    <Tabs defaultValue="check_in" className="w-full">
                      <TabsList className="w-full">
                        <TabsTrigger value="check_in" className="flex-1">Check In</TabsTrigger>
                        <TabsTrigger value="check_out" className="flex-1">Check Out</TabsTrigger>
                      </TabsList>
                      <TabsContent value="check_in">
                        <Input
                          id="check-in-time"
                          name="check_in_time"
                          type="time"
                          step="60"
                          value={formData.check_in_time}
                          onChange={handleInputChange}
                          className="h-10"
                        />
                      </TabsContent>
                      <TabsContent value="check_out">
                        <Input
                          id="check-out-time"
                          name="check_out_time"
                          type="time"
                          step="60"
                          value={formData.check_out_time}
                          onChange={handleInputChange}
                          className="h-10"
                        />
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">Projects</Label>
                <div className="col-span-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="add-project-none"
                      checked={normalizeProjectAssignments(formData.project).length === 0}
                      onCheckedChange={(checked) => {
                        if (checked) clearProjectAssignments();
                      }}
                    />
                    <Label htmlFor="add-project-none" className="text-sm font-normal">
                      No project
                    </Label>
                  </div>
                <div className="rounded-md border p-2">
                  {projectOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {loadingProjects ? "Loading projects..." : "No projects available"}
                    </p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {projectOptions.map((projectOption) => {
                        const selected = normalizeProjectAssignments(formData.project).includes(projectOption.id);
                        return (
                          <div key={projectOption.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`add-project-${projectOption.id}`}
                              checked={selected}
                              onCheckedChange={() => handleProjectToggle(projectOption.id)}
                            />
                            <Label htmlFor={`add-project-${projectOption.id}`} className="text-sm font-normal">
                              {projectOption.name}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleAddUser} disabled={savingUser}>
                {savingUser ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total users</p>
            <p className="text-3xl font-semibold mt-2 leading-none">{totalUsers}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Admins</p>
            <p className="text-3xl font-semibold mt-2 leading-none">{totalAdmins}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Operational managers</p>
            <p className="text-3xl font-semibold mt-2 leading-none">{totalOperationalManagers}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">PO officers</p>
            <p className="text-3xl font-semibold mt-2 leading-none">{totalPoOfficers}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Labours</p>
            <p className="text-3xl font-semibold mt-2 leading-none">{totalLabours}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, username, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-10 w-full md:w-[200px]">
              <SlidersHorizontal className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Filter role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="operational_manager">Operational Manager</SelectItem>
              <SelectItem value="po_officer">PO Officer</SelectItem>
              <SelectItem value="labour">Labour</SelectItem>
            </SelectContent>
          </Select>
          {(searchTerm.trim() || roleFilter !== "all") ? (
            <Button variant="outline" size="sm" className="h-10" onClick={clearFilters}>
              <X className="mr-2 h-4 w-4" />
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
        <CardHeader className="border-b bg-muted/20 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">System Users</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{filteredUsers.length}</Badge>
              <span>results</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <AppLoader label="Loading users..." />
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-lg font-medium">No users found</p>
              <p className="text-sm text-muted-foreground mt-1">Try clearing filters or add a new user.</p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  <X className="mr-2 h-4 w-4" />
                  Clear filters
                </Button>
                <Button size="sm" onClick={() => setIsAddOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Add user
                </Button>
              </div>
            </div>
          ) : (
            <DataTable columns={columns} data={filteredUsers} />
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user details and permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-username" className="text-right">Username</Label>
              <Input id="edit-username" name="username" value={formData.username} onChange={handleInputChange} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-email" className="text-right">Email</Label>
              <Input id="edit-email" name="email" type="email" value={formData.email} onChange={handleInputChange} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-phone" className="text-right">Phone</Label>
              <Input id="edit-phone" name="phone_number" value={formData.phone_number} onChange={handleInputChange} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-role" className="text-right">Role</Label>
              <Select value={formData.role} onValueChange={handleRoleChange}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="operational_manager">Operational Manager</SelectItem>
                  <SelectItem value="po_officer">PO Officer</SelectItem>
                  <SelectItem value="labour">Labour</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right pt-2">Projects</Label>
              <div className="col-span-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-project-none"
                    checked={normalizeProjectAssignments(formData.project_list).length === 0}
                    onCheckedChange={(checked) => {
                      if (checked) clearProjectAssignments();
                    }}
                  />
                  <Label htmlFor="edit-project-none" className="text-sm font-normal">
                    No project
                  </Label>
                </div>
                <div className="rounded-md border p-2">
                  {projectOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {loadingProjects ? "Loading projects..." : "No projects available"}
                    </p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {projectOptions.map((projectOption) => {
                        const selected = normalizeProjectAssignments(formData.project_list).includes(projectOption.id);
                        return (
                          <div key={projectOption.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`edit-project-${projectOption.id}`}
                              checked={selected}
                              onCheckedChange={() => handleProjectToggle(projectOption.id)}
                            />
                            <Label htmlFor={`edit-project-${projectOption.id}`} className="text-sm font-normal">
                              {projectOption.name}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleUpdateUser} disabled={savingUser}>
              {savingUser ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
