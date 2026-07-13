import React, { useState, useEffect } from "react";
import { Button, Checkbox, Typography, Space, message, Pagination } from "antd";
import { apiClient } from "../utils/apiClient.ts";

const { Title, Text } = Typography;

const ExpenseTable = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });

  // Fetch expenses from API
  const fetchExpenses = async (page = 1, limit = 10) => {
    setLoading(true);
    try {
      const result = await apiClient("GET", `/api/v1/leads/expense?page=${page}&limit=${limit}`);
      setData(
        result.expenses.map((expense) => ({
          key: expense.id.toString(),
          title: expense.category,
          date: new Date(expense.date).toLocaleDateString('en-GB'),
          executive: typeof JSON.parse(expense.user) == "string" ? JSON.parse(JSON.parse(expense.user))?.name : JSON.parse(expense.user)?.name ?? "NA",
          amount: expense.amount,
          status: expense.status || "Pending",
          selected: false,
        }))
      );
      setPagination({
        page: result?.pagination?.page || page,
        limit: result?.pagination?.limit || limit,
        total: result?.pagination?.total || 0,
      });
    } catch (err) {
      message.error(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchExpenses(pagination.page, pagination.limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Select all pending expenses
  const handleSelectAll = () => {
    const newData = data.map((item) =>
      item.status === "Pending" ? { ...item, selected: true } : item
    );
    setData(newData);
  };

  // Clear all selections
  const handleClearSelection = () => {
    const newData = data.map((item) => ({ ...item, selected: false }));
    setData(newData);
  };

  // Approve selected expenses (API calls for each)
  const handleApproveSelected = async () => {
    const selectedItems = data.filter((d) => d.selected && d.status === "Pending");
    if (selectedItems.length === 0) {
      message.warning("No pending expenses selected!");
      return;
    }

    try {
      for (const expense of selectedItems) {
        await apiClient("POST", `/api/v1/leads/expense/approve/${expense.key}`, { status: "Approved" });
      }

      message.success(`Approved ${selectedItems.length} expense(s)!`);
      fetchExpenses(pagination.page, pagination.limit);
    } catch (err) {
      message.error(err.message);
    }
  };

  // Approve all pending expenses on current page
  const handleApproveAll = async () => {
    const pendingItems = data.filter((d) => d.status === "Pending");
    if (pendingItems.length === 0) {
      message.info("All expenses on this page are already approved!");
      return;
    }

    try {
      for (const expense of pendingItems) {
        await apiClient("POST", `/api/v1/leads/expense/approve/${expense.key}`, { status: "Approved" });
      }

      message.success(`Approved ${pendingItems.length} expense(s) on this page!`);
      fetchExpenses(pagination.page, pagination.limit);
    } catch (err) {
      message.error(err.message);
    }
  };

  // Approve a single expense
  const handleApprove = async (key: any) => {
    try {
      await apiClient("POST", `/api/v1/leads/expense/approve/${key}`, { status: "Approved" });
      message.success("Expense approved!");
      fetchExpenses(pagination.page, pagination.limit);
    } catch (err) {
      message.error(err.message);
    }
  };

  // Reject a single expense
  const handleReject = async (key: any) => {
    try {
      await apiClient("POST", `/api/v1/leads/expense/approve/${key}`, { status: "Rejected" });
      message.success("Expense rejected!");
      fetchExpenses(pagination.page, pagination.limit);
    } catch (err) {
      message.error(err.message);
    }
  };

  // Toggle individual checkbox
  const handleCheckboxChange = (key: string, checked: boolean) => {
    const newData = data.map((item) =>
      item.key === key ? { ...item, selected: checked } : item
    );
    setData(newData);
  };

  // Calculate total amount and approved count for current page
  const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);
  const approvedCount = data.filter((item) => item.status === "Approved").length;

  // Handle pagination change
  const handlePaginationChange = (page: number, pageSize: number) => {
    setPagination({ page, limit: pageSize, total: pagination.total });
    fetchExpenses(page, pageSize);
  };

  return (
    <div style={{ padding: "20px", backgroundColor: "#f5f5f5", minHeight: "100vh" }}>
      {/* Header with buttons */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <Title level={3} style={{ margin: 0 }}>All Expenses</Title>
        <Space size="middle">
          <Button
            style={{
              borderRadius: 30,
              padding: "8px 24px",
              height: "auto",
              border: "1px solid #d9d9d9",
              backgroundColor: "white",
            }}
            onClick={handleSelectAll}
          >
            Select All
          </Button>
          <Button
            style={{
              borderRadius: 30,
              padding: "8px 24px",
              height: "auto",
              border: "1px solid #d9d9d9",
              backgroundColor: "white",
            }}
            onClick={handleClearSelection}
          >
            Clear Selection
          </Button>
          <Button
            type="primary"
            style={{
              borderRadius: 30,
              padding: "8px 24px",
              height: "auto",
              backgroundColor: "#5B7FFF",
              border: "none",
            }}
            onClick={handleApproveSelected}
          >
            Approve Selected
          </Button>
          <Button
            style={{
              borderRadius: 30,
              padding: "8px 24px",
              height: "auto",
              border: "1px solid #d9d9d9",
              backgroundColor: "white",
            }}
            onClick={handleApproveAll}
          >
            Approve all Expenses
          </Button>
        </Space>
      </div>

      {/* Summary Section */}
      <Space style={{ marginBottom: "20px" }} size="large">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            paddingRight: "30px",
            borderRight: "1px solid #d9d9d9",
          }}
        >
          <Text style={{ color: "#7B7B7B", fontSize: 14 }}>Total Amount</Text>
          <Text strong style={{ fontSize: 18 }}>₹{totalAmount.toFixed(2)}</Text>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Text style={{ color: "#7B7B7B", fontSize: 14 }}>Approved Expenses</Text>
          <Text strong style={{ fontSize: 18 }}>{approvedCount}</Text>
        </div>
      </Space>

      {/* Table */}
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        {/* Table Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "60px 2fr 2fr 1fr 1fr 1fr",
            backgroundColor: "#7CB3FF",
            color: "white",
            padding: "16px 20px",
            fontWeight: 500,
            fontSize: 16,
          }}
        >
          <div></div>
          <div>Title</div>
          <div>Executive</div>
          <div>Amount</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {/* Table Body */}
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center" }}>Loading...</div>
        ) : data.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center" }}>No expenses found</div>
        ) : (
          data.map((record, index) => (
            <div
              key={record.key}
              style={{
                display: "grid",
                gridTemplateColumns: "60px 2fr 2fr 1fr 1fr 1fr",
                padding: "20px",
                borderBottom: index < data.length - 1 ? "1px solid #f0f0f0" : "none",
                alignItems: "center",
                backgroundColor: record.selected && record.status === "Pending" ? "#E8F4FF" : record.status === "Rejected" ? "#fff1f0" : "white",
              }}
            >
              {/* Checkbox */}
              <div>
                <Checkbox
                  checked={record.selected}
                  disabled={record.status === "Approved" || record.status === "Rejected"}
                  onChange={(e) => handleCheckboxChange(record.key, e.target.checked)}
                  style={{
                    transform: "scale(1.3)",
                  }}
                />
              </div>

              {/* Title and Date */}
              <div>
                <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 4 }}>
                  {record.title}
                </div>
                <div style={{ color: "#8c8c8c", fontSize: 13 }}>
                  {record.date}
                </div>
              </div>

              {/* Executive */}
              <div style={{ fontSize: 15 }}>{record.executive}</div>

              {/* Amount */}
              <div style={{ fontSize: 15, fontWeight: 500 }}>₹{record.amount}</div>

              {/* Status */}
              <div>
                <Text
                  style={{
                    color: record.status === "Approved" ? "#52c41a" : record.status === "Rejected" ? "#ff4d4f" : "#fa8c16",
                    fontWeight: 500,
                    fontSize: 15,
                  }}
                >
                  {record.status}
                </Text>
              </div>

              {/* Actions */}
              <div>
                <Space size="small">
                  <Button
                    type="default"
                    disabled={record.status === "Approved" || record.status === "Rejected"}
                    onClick={() => handleApprove(record.key)}
                    style={{
                      backgroundColor: record.status === "Approved" || record.status === "Rejected" ? "#f5f5f5" : "#e8e8e8",
                      border: "none",
                      color: record.status === "Approved" || record.status === "Rejected" ? "#bfbfbf" : "#595959",
                      fontWeight: 500,
                      cursor: record.status === "Approved" || record.status === "Rejected" ? "not-allowed" : "pointer",
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    type="default"
                    disabled={record.status === "Approved" || record.status === "Rejected"}
                    onClick={() => handleReject(record.key)}
                    style={{
                      backgroundColor: record.status === "Approved" || record.status === "Rejected" ? "#f5f5f5" : "#ffebe8",
                      border: "none",
                      color: record.status === "Approved" || record.status === "Rejected" ? "#bfbfbf" : "#ff4d4f",
                      fontWeight: 500,
                      cursor: record.status === "Approved" || record.status === "Rejected" ? "not-allowed" : "pointer",
                    }}
                  >
                    Reject
                  </Button>
                </Space>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {!loading && data.length > 0 && (
        <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
          <Pagination
            current={pagination.page}
            pageSize={pagination.limit}
            total={pagination.total}
            onChange={handlePaginationChange}
            onShowSizeChange={handlePaginationChange}
            showSizeChanger
            pageSizeOptions={["10", "20", "50", "100"]}
            showTotal={(total, range) => `${range[0]}-${range[1]} of ${total} items`}
          />
        </div>
      )}
    </div>
  );
};

export default ExpenseTable;
