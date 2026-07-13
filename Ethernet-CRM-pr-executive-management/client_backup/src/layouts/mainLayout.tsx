import React, { useState, useMemo } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Layout, Button, Input, Typography, Dropdown, message } from "antd";
import {
  MenuFoldOutlined,
  CloseOutlined,
  SettingOutlined,
  SearchOutlined,
  FundProjectionScreenOutlined,
  BarChartOutlined,
  WalletOutlined,
  FileTextOutlined,
  CompassOutlined,
  EnvironmentOutlined,
  UserOutlined,
  FolderOutlined,
  DownOutlined,
  RightOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext.tsx";

const { Title } = Typography;
const { Header, Sider, Content } = Layout;

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [openKeys, setOpenKeys] = useState(["lead-management"]);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const menuItems = [
    {
      key: "lead-management",
      icon: <FundProjectionScreenOutlined />,
      label: "Lead Management",
      children: [
        { key: "/activity", icon: <BarChartOutlined />, label: "Activity" },
        { key: "/expense-tracker", icon: <WalletOutlined />, label: "Expense Tracker" },
        { key: "/leads-master", icon: <FileTextOutlined />, label: "Leads Master" },
        { key: "/travel-tracker", icon: <CompassOutlined />, label: "Travel Tracker" },
        { key: "/field-survey", icon: <EnvironmentOutlined />, label: "Field Survey" },
        { key: "/executive-management", icon: <UserOutlined />, label: "Executive Management" },
        { key: "/assets-inventory", icon: <FolderOutlined />, label: "Assets Inventory" },
      ],
    },
  ];

  // Filter menu items based on search term
  const filteredMenu = useMemo(() => {
    if (!searchTerm) return menuItems;
    return menuItems
      .map((item) => {
        if (item.children) {
          const filteredChildren = item.children.filter((child) =>
            child.label.toLowerCase().includes(searchTerm.toLowerCase())
          );
          if (filteredChildren.length > 0 || item.label.toLowerCase().includes(searchTerm.toLowerCase())) {
            return { ...item, children: filteredChildren };
          }
        } else if (item.label.toLowerCase().includes(searchTerm.toLowerCase())) {
          return item;
        }
        return null;
      })
      .filter(Boolean);
  }, [searchTerm, menuItems]);

  const handleParentClick = (key) => {
    setOpenKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const currentPage = useMemo(() => {
    for (let item of menuItems) {
      if (item.children) {
        const child = item.children.find((c) => c.key === location.pathname);
        if (child) return child.label;
      } else if (`/${item.key}` === location.pathname) return item.label;
    }
    return "Activity";
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
      message.success('Logged out successfully');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      message.error('Failed to logout');
    }
  };

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={280}
        style={{
          background: "linear-gradient(180deg, #142857 0%, #0b1d46 100%)",
          color: "#fff",
        }}
      >
        {/* Header */}
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            color: "white",
            fontSize: 18,
            fontWeight: 600,
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {!collapsed && <span>Modules</span>}
          <Button
            type="text"
            icon={collapsed ? <MenuFoldOutlined /> : <CloseOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: 16,
              color: "white",
            }}
          />
        </div>

        {/* Search */}
        {!collapsed && (
          <div style={{ padding: "16px" }}>
            <Input
              placeholder="Search"
              prefix={<SearchOutlined style={{ color: "rgba(255,255,255,0.5)" }} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                borderRadius: 8,
                background: "rgba(255,255,255,0.1)",
                color: "white",
              }}
            />
          </div>
        )}

        {/* Menu */}
        <div style={{ padding: "0 12px", marginTop: 8 }}>
          {filteredMenu.map((item: any) => (
            <div key={item.key} style={{ marginBottom: 8 }}>
              {item.children ? (
                <>
                  {/* Parent item */}
                  <div
                    onClick={() => handleParentClick(item.key)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: openKeys.includes(item.key)
                        ? "linear-gradient(90deg, #3f62ff, #6699ff)"
                        : "rgba(255,255,255,0.05)",
                      padding: collapsed ? "10px 0" : "10px 14px",
                      borderRadius: 10,
                      cursor: "pointer",
                      transition: "all 0.3s",
                      color: "#fff",
                      fontWeight: 600,
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        justifyContent: collapsed ? "center" : "flex-start",
                        width: "100%",
                      }}
                    >
                      {item.icon}
                      {!collapsed && item.label}
                    </span>
                    {!collapsed &&
                      (openKeys.includes(item.key) ? (
                        <DownOutlined style={{ fontSize: 12 }} />
                      ) : (
                        <RightOutlined style={{ fontSize: 12 }} />
                      ))}
                  </div>

                  {/* Child items */}
                  {!collapsed &&
                    openKeys.includes(item.key) && (
                      <div style={{ marginTop: 6, marginLeft: 10 }}>
                        {item.children.map((child: any) => (
                          <div
                            key={child.key}
                            onClick={() => navigate(child.key)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "8px 14px",
                              borderRadius: 8,
                              color:
                                location.pathname === child.key
                                  ? "#03123B"
                                  : "rgba(255,255,255,0.85)",
                              background:
                                location.pathname === child.key
                                  ? "#d5e5ff"
                                  : "transparent",
                              fontWeight:
                                location.pathname === child.key ? 600 : 400,
                              cursor: "pointer",
                              transition: "all 0.3s",
                            }}
                          >
                            {child.icon}
                            {child.label}
                          </div>
                        ))}
                      </div>
                    )}
                </>
              ) : (
                <div
                  onClick={() => navigate(`/${item.key}`)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: collapsed ? "10px 0" : "10px 14px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.05)",
                    cursor: "pointer",
                    transition: "all 0.3s",
                    color: "#fff",
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      justifyContent: collapsed ? "center" : "flex-start",
                      width: "100%",
                    }}
                  >
                    {item.icon}
                    {!collapsed && item.label}
                  </span>
                  {!collapsed && <RightOutlined style={{ fontSize: 12 }} />}
                </div>
              )}
            </div>
          ))}
        </div>
      </Sider>

      {/* Main layout */}
      <Layout>
        <Header
          style={{
            background: "#fff",
            display: "flex",
            alignItems: "center",
            padding: "0 30px",
            justifyContent: "space-between",
            height: 80,
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}
        >
          <Title level={1} style={{ margin: 0, fontSize: 24 }}>
            {currentPage}
          </Title>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>
              Hi, {user?.name || 'User'}
            </h3>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
              <div
                style={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "#f5f5f5",
                  transition: "all 0.3s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#e8e8e8")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#f5f5f5")}
              >
                <UserOutlined style={{ fontSize: 20 }} />
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content
          style={{
            paddingLeft: 30,
            minHeight: 280,
            background: "#f8f9fb",
            borderRadius: 12,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
