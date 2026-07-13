import React, { useEffect, useState } from 'react';
import "./executiveManagement.css";
import { Typography, Input, Select, Checkbox, Col, Row, Button, message, Table, Popconfirm, Alert } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons';
import type { GetProp } from 'antd';
import { apiClient } from "../utils/apiClient.ts";

const { Title, Text } = Typography;

interface Role {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
}

interface Module {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
}

interface UserRecord {
  id: number;
  name: string;
  email: string;
  Role: { id: number; name: string };
  Modules: { id: number; name: string }[];
}

const ExecutiveManagement = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedRole, setSelectedRole] = useState<number | null>(null);
  const [selectedModules, setSelectedModules] = useState<number[]>([]);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    username: "",
    password: "",
    email: ""
  });

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<UserRecord[]>([]);
  const [isFormExpanded, setIsFormExpanded] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ✅ Fetch Roles
  const fetchRoles = async () => {
    try {
      const response = await apiClient("GET", `/api/v1/role/`);
      setRoles(response);
    } catch (error) {
      console.error("Error fetching roles", error);
      message.error("Failed to load access levels");
    }
  };

  // ✅ Fetch Modules
  const fetchModules = async () => {
    try {
      const response = await apiClient("GET", "/api/v1/module/");
      setModules(response);
    } catch (error) {
      console.error("Error fetching modules", error);
      message.error("Failed to load modules");
    }
  };

  // ✅ Fetch Users
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await apiClient("GET", "/api/v1/leads/em/users");
      setData(res || []);
    } catch (error) {
      console.error("Error fetching users", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
    fetchModules();
    fetchUsers();
  }, []);

  const handleChangeRole = (value: number) => {
    setSelectedRole(value);
  };

  const handleModuleChange: GetProp<typeof Checkbox.Group, 'onChange'> = (checkedValues) => {
    setSelectedModules(checkedValues as number[]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // ✅ Save or Update
  const handleSave = async (e: React.MouseEvent<HTMLElement>) => {
   e.preventDefault();
   
   // Clear previous errors
   setFieldErrors({});
   
    if (!formData.name.trim()) 
      return message.warning("Name is required");
  if (!formData.email.trim())
     return message.warning("Username is required");
  if (!formData.password || formData.password.length < 6) 
  return message.warning("Password must be at least 6 characters");
  if (!selectedRole) 
  return message.warning("Please select an Access level");
  
    try {
      const payload = {
        ...formData,
        roleId: selectedRole,
        moduleIds: selectedModules
      };

      if (editingUserId) {
        // ✏️ PUT Update
        await apiClient("PUT", `/api/v1/leads/em/users/${editingUserId}`, payload);
        message.success("User updated successfully");
      } else {
        // 🆕 POST Create
        const res = await apiClient("POST", "/api/v1/leads/em/users", payload);
        if (res?.id) message.success("User created successfully");
      }

      resetForm();
      fetchUsers();
    } catch (error: any) {
      console.error("Error saving executive", error);
      
      // Handle API validation errors
      if (error?.errors && Array.isArray(error.errors)) {
        const newFieldErrors: Record<string, string> = {};
        error.errors.forEach((err: { field: string; message: string }) => {
          newFieldErrors[err.field] = err.message;
        });
        setFieldErrors(newFieldErrors);
        message.error(error.message || "Validation failed. Please check the form.");
      } else {
        message.error(error?.message || "Failed to save");
      }
    }
  };

  // 🧹 Reset Form after Save/Edit
  const resetForm = () => {
    setFormData({ name: "", username: "", password: "", email: "" });
    setSelectedRole(null);
    setSelectedModules([]);
    setEditingUserId(null);
    setIsFormExpanded(false);
    setFieldErrors({});
  };

  // ✏️ Handle Edit
  const handleEdit = (record: UserRecord) => {
    setFormData({
      name: record.name,
      username: record.email.split("@")[0], // assuming username is part of email
      password: "",
      email: record.email
    });
    setSelectedRole(record.Role?.id || null);
    setSelectedModules(record.Modules.map(m => m.id));
    setEditingUserId(record.id);
    setIsFormExpanded(true);
    window.scrollTo(0, 0);
  };

  // 🗑️ Handle Delete
  const handleDelete = async (id: number) => {
    try {
      await apiClient("DELETE", `/api/v1/leads/em/users/${id}`);
      message.success("User deleted successfully");
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user", error);
      message.error("Failed to delete user");
    }
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
    },
    {
      title: "Email",
      dataIndex: "email",
    },
    {
      title: "Access",
      dataIndex: "Role",
      render: (role: any) => (
        <Text strong style={{ padding: "5px", borderRadius: "5px", backgroundColor: "rgba(225, 225, 225, 1)", fontSize: "11px" }}>
          {role?.name}
        </Text>
      ),
    },
    {
      title: "Modules",
      dataIndex: "Modules",
      render: (module: any[]) => (
        <div style={{ display: "flex", flexWrap: "wrap", width: "100px" }}>
          {module?.map(elm => (
            <Text key={elm.id} strong style={{ padding: "5px", marginRight: "4px", marginBottom: "5px", borderRadius: "5px", backgroundColor: "rgba(225, 225, 225, 1)", fontSize: "10px" }}>
              {elm.name}
            </Text>
          ))}
        </div>
      ),
    },
    {
      title: "Action",
      render: (_: any, record: UserRecord) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            type="text"
            size="middle"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            style={{ color: '#666' }}
          />
          <Popconfirm
            title="Are you sure to delete this user?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button 
              type="text" 
              size="middle"
              icon={<DeleteOutlined />}
              style={{ color: '#ff4d4f' }}
            />
          </Popconfirm>
        </div>
      ),
    },
  ];


  return (
    <div className='parent'>
      <div className='button-div'>
        <Button className="custom-add-executive-btn" icon={<PlusOutlined />} onClick={() => setIsFormExpanded(true)}>
          Add Executive
        </Button>
      </div>
      {isFormExpanded && (
      <div className='container'>
        <div className="form-header">
          <div>
            <Title level={4} style={{ margin: 0 }}>{editingUserId ? "Edit Profile" : "Create Profile"}</Title>
            <Text type="secondary">Insert name, select access, assign modules and set credentials.</Text>
          </div>
          <Button 
            type="text" 
            icon={<CloseOutlined />} 
            onClick={resetForm}
            style={{ fontSize: '16px' }}
          />
        </div>

        <div className="EM-container">
          <div className="form-row">
            <div className="form-group">
              <label>Name</label>
              <Input
                placeholder=""
                className="Input-EM"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                status={fieldErrors.name ? "error" : ""}
              />
              {fieldErrors.name && (
                <Text type="danger" style={{ fontSize: '12px', display: 'block', marginTop: '4px' }}>
                  {fieldErrors.name}
                </Text>
              )}
            </div>

            <div className="form-group">
              <label>Access level</label>
              <Select
                className="Input-EM select-input"
                placeholder="Executive Access"
                onChange={handleChangeRole}
                value={selectedRole || undefined}
                size="large"
                options={roles.map(role => ({
                  value: role.id, 
                  label: role.name
                }))}
                status={fieldErrors.roleId ? "error" : ""}
              />
              {fieldErrors.roleId && (
                <Text type="danger" style={{ fontSize: '12px', display: 'block', marginTop: '4px' }}>
                  {fieldErrors.roleId}
                </Text>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Username</label>
              <Input
                placeholder=""
                className="Input-EM"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                status={fieldErrors.email ? "error" : ""}
              />
              {fieldErrors.email && (
                <Text type="danger" style={{ fontSize: '12px', display: 'block', marginTop: '4px' }}>
                  {fieldErrors.email}
                </Text>
              )}
            </div>
            <div className="form-group">
              <label>Password</label>
              <Input.Password
                placeholder=""
                className="Input-EM"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                status={fieldErrors.password ? "error" : ""}
              />
              {fieldErrors.password && (
                <Text type="danger" style={{ fontSize: '12px', display: 'block', marginTop: '4px' }}>
                  {fieldErrors.password}
                </Text>
              )}
            </div>
          </div>
        </div>

        <div className="module-access">
          <Title level={5} style={{ marginBottom: '4px' }}>Module Access</Title>
          <Text type="secondary">Insert name, select access, assign modules and set credentials.</Text>
          <Checkbox.Group style={{ width: '100%' }} value={selectedModules} onChange={handleModuleChange}>
            <Row style={{ padding: "10px 0" }} gutter={[16, 16]}>
              {modules.map(module => (
                <Col className='chip' span={8} key={module.id}>
                  <Checkbox value={module.id}>{module.name}</Checkbox>
                </Col>
              ))}
            </Row>
          </Checkbox.Group>
        </div>

        <div className='save-button'>
          <Button className='add-save-button' type="primary" onClick={(e) => {
            handleSave(e);
          }}>
            {editingUserId ? "Update" : "Save"}
          </Button>
        </div>
      </div>
      )}
      <Table
        style={{ margin: 10, backgroundColor: "white", borderRadius: "8px", overflow: "hidden" }}
        columns={columns}
        dataSource={data}
        rowKey="id"
        bordered
        loading={loading}
        pagination={false}
        className="executive-table"
      />
    </div>
  );
};
export default ExecutiveManagement;



