import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./accetsInventory.css";
import { Input, Select, Space, Button, Table, Modal, message, Spin, Form, InputNumber } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import {
  FilterOutlined,
  DeleteOutlined,
  EditOutlined,
  SearchOutlined,
  CloseOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { apiClient } from "../utils/apiClient";

interface StockCardProps {
  title: string;
  totalIn: number;
  totalOut: number;
  balance: number;
  status: string;
}

const StockCard: React.FC<StockCardProps> = ({ title, totalIn, totalOut, balance, status }) => {
  const isLow = status.toLowerCase().includes("low");

  return (
    <div className={`card ${isLow ? "low-stock" : "healthy"}`}>
      <div className="card-header">
        <h3>{title}</h3>
        <span className={`status ${isLow ? "alert" : "ok"}`}>
          {isLow ? "⚠ Low stock" : "Healthy"}
        </span>
      </div>
      <div className="card-body">
        <div className="data-row">
          <p className="label">Total In</p>
          <p className="value">{totalIn}</p>
        </div>
        <div className="data-row">
          <p className="label">Total Out</p>
          <p className="value">{totalOut}</p>
        </div>
        <div className="data-row">
          <p className="label">Balance</p>
          <p className="value">{balance}</p>
        </div>
      </div>
    </div>
  );
};

interface Asset {
  asset_id: string;
  asset_type: string;
  company: string;
  total_in: number;
  total_out: number;
  balance: number;
  threshold: number;
}

interface Company {
  company_id: string;
  company_code: string;
  company_name: string;
}

interface AssetTypeItem {
  asset_type_id: string;
  type_name: string;
  type_code: string;
}

interface DashboardAssetType {
  assetType: string;
  totalIn: number;
  totalOut: number;
  balance: number;
  status: string;
}

type FiltersState = {
  search: string;
  assetType?: string;
  company?: string;
};

interface AddStockFormValues {
  company: string;
  assetType: string;
  quantity: number;
  threshold?: number;
}

const normalizeAssetTypeValue = (value: string) => value?.trim().toLowerCase() || "";

const titleizeAssetTypeValue = (value: string) =>
  normalizeAssetTypeValue(value).replace(/\b\w/g, (char) => char.toUpperCase());

const DEFAULT_PAGE_SIZE = 50;

const AssetsInventory: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [tableLoading, setTableLoading] = useState(false);

  const [assetCards, setAssetCards] = useState<DashboardAssetType[]>([]);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [assetTypes, setAssetTypes] = useState<AssetTypeItem[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [assetTypesLoading, setAssetTypesLoading] = useState(false);

  const [filters, setFilters] = useState<FiltersState>({ search: "" });

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
  });

  const resetToFirstPage = useCallback(() => {
    setPagination((prev) => ({
      ...prev,
      current: 1,
    }));
  }, []);

  const [submitting, setSubmitting] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editForm, setEditForm] = useState({
    company: "",
    assetType: "",
    threshold: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const assetTypeOptions = useMemo(
    () =>
      assetTypes.map((type) => ({
        label: titleizeAssetTypeValue(type.type_name),
        value: type.type_name,
      })),
    [assetTypes]
  );

  const companyOptions = useMemo(
    () =>
      companies.map((company) => ({
        label: `${company.company_code} - ${company.company_name}`,
        value: company.company_code,
      })),
    [companies]
  );

  const fetchAssets = useCallback(
    async (page?: number, pageSize?: number) => {
      const currentPage = page ?? 1;
      const currentLimit = pageSize ?? DEFAULT_PAGE_SIZE;

      setTableLoading(true);
      try {
        const response = await apiClient(
          "GET",
          "/api/v1/inventory/assets",
          {},
          {
            params: {
              search: filters.search || undefined,
              assetType: filters.assetType || undefined,
              company: filters.company || undefined,
              page: currentPage,
              limit: currentLimit,
            },
          }
        );

        if (!response?.success) {
          throw new Error(response?.message || "Failed to load assets");
        }

        const responseData = response.data || {};

        const assetsList = (responseData.assets || []).map((asset: any) => ({
          asset_id: asset.asset_id,
          asset_type: asset.asset_type,
          company: asset.company,
          total_in: asset.total_in,
          total_out: asset.total_out,
          balance: asset.balance,
          threshold: asset.threshold,
        }));

        setAssets(assetsList);

        const cardsData = Array.isArray(responseData.assetsByType)
          ? responseData.assetsByType
              .map((item: any) => ({
                assetType: titleizeAssetTypeValue(item.assetType || item.asset_type || "Unknown"),
                totalIn: Number(item.totalIn) || 0,
                totalOut: Number(item.totalOut) || 0,
                balance: Number(item.balance) || 0,
                status: item.status || "Healthy",
              }))
              .sort((a: DashboardAssetType, b: DashboardAssetType) =>
                a.assetType.localeCompare(b.assetType)
              )
          : [];

        setAssetCards(cardsData);

        const totalItems =
          responseData.pagination?.totalItems ??
          responseData.summary?.totalAssets ??
          assetsList.length;

        setPagination({
          current: responseData.pagination?.currentPage ?? currentPage,
          pageSize: responseData.pagination?.itemsPerPage ?? currentLimit,
          total: totalItems,
        });
      } catch (error: any) {
        console.error("Failed to load assets:", error);
        message.error(error?.message || "Failed to load assets");
      } finally {
        setTableLoading(false);
      }
    },
    [filters]
  );

  const handleTableChange = (paginationConfig: TablePaginationConfig) => {
    setPagination((prev) => ({
      ...prev,
      current: paginationConfig.current ?? prev.current,
      pageSize: paginationConfig.pageSize ?? prev.pageSize,
    }));
  };

  useEffect(() => {
    fetchAssets(pagination.current, pagination.pageSize);
  }, [fetchAssets, pagination.current, pagination.pageSize]);

  const fetchMetadata = useCallback(async () => {
    setCompaniesLoading(true);
    setAssetTypesLoading(true);
    try {
      const [companiesResponse, assetTypesResponse] = await Promise.all([
        apiClient("GET", "/api/v1/inventory/companies"),
        apiClient("GET", "/api/v1/inventory/asset-types"),
      ]);

      if (companiesResponse?.success) {
        setCompanies(companiesResponse.data || []);
      } else {
        throw new Error(companiesResponse?.message || "Failed to load companies");
      }

      if (assetTypesResponse?.success) {
        setAssetTypes(assetTypesResponse.data || []);
      } else {
        throw new Error(assetTypesResponse?.message || "Failed to load asset types");
      }
    } catch (error: any) {
      console.error("Failed to load metadata:", error);
      message.error(error?.message || "Failed to load dropdown data");
    } finally {
      setCompaniesLoading(false);
      setAssetTypesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  const reloadInventoryData = useCallback(async () => {
    await fetchAssets(pagination.current, pagination.pageSize);
  }, [fetchAssets, pagination.current, pagination.pageSize]);

  const [addStockForm] = Form.useForm<AddStockFormValues>();

  const handleAddStock = async (values: AddStockFormValues) => {
    const { company, assetType, quantity, threshold } = values;

    if (!company || !assetType || quantity === undefined || quantity === null) {
      message.warning("Company, asset type, and quantity are required.");
      return;
    }

    if (quantity <= 0) {
      message.warning("Batch quantity must be a positive number.");
      return;
    }

    if (typeof threshold === "number" && threshold < 0) {
      message.warning("Threshold must be zero or greater.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        company,
        assetType,
        batchQty: quantity,
      };

      if (typeof threshold === "number") {
        payload.threshold = threshold;
      }

      const response = await apiClient("POST", "/api/v1/inventory/add-stock", payload);

      if (!response?.success) {
        throw new Error(response?.message || "Failed to add stock");
      }

      message.success(response?.message || "Stock added successfully");
      addStockForm.resetFields();
      await reloadInventoryData();
    } catch (error: any) {
      console.error("Failed to add stock:", error);
      message.error(error?.message || "Failed to add stock");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (record: Asset) => {
    Modal.confirm({
      title: "Delete asset?",
      content: `This will delete ${record.asset_type} for ${record.company}.`,
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        setDeletingId(record.asset_id);
        try {
          const response = await apiClient("DELETE", `/api/v1/inventory/assets/${record.asset_id}`);
          if (!response?.success) {
            throw new Error(response?.message || "Failed to delete asset");
          }
          message.success(response?.message || "Asset deleted successfully");
          await reloadInventoryData();
        } catch (error: any) {
          console.error("Failed to delete asset:", error);
          message.error(error?.message || "Failed to delete asset");
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const handleEdit = (record: Asset) => {
    setEditingAsset(record);
    const matchedAssetType =
      assetTypeOptions.find(
        (option) =>
          normalizeAssetTypeValue(option.value) ===
          normalizeAssetTypeValue(record.asset_type)
      )?.value || record.asset_type;
    setEditForm({
      company: record.company,
      assetType: matchedAssetType,
      threshold: record.threshold?.toString() ?? "",
    });
    setIsEditModalOpen(true);
  };

  const handleEditFormChange = (name: string, value: string) => {
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveEdit = async () => {
    if (!editingAsset) return;

    const payload: Record<string, any> = {};
    if (editForm.company) {
      payload.company = editForm.company;
    }
    if (editForm.assetType) {
      payload.assetType = editForm.assetType;
    }
    if (editForm.threshold !== "") {
      const parsedThreshold = Number(editForm.threshold);
      if (Number.isNaN(parsedThreshold) || parsedThreshold < 0) {
        message.warning("Threshold must be zero or greater.");
        return;
      }
      payload.threshold = parsedThreshold;
    }

    if (Object.keys(payload).length === 0) {
      message.info("Nothing to update.");
      return;
    }

    setSavingEdit(true);
    try {
      const response = await apiClient(
        "PUT",
        `/api/v1/inventory/assets/${editingAsset.asset_id}`,
        payload
      );

      if (!response?.success) {
        throw new Error(response?.message || "Failed to update asset");
      }

      message.success(response?.message || "Asset updated successfully");
      setIsEditModalOpen(false);
      setEditingAsset(null);
      setEditForm({ company: "", assetType: "", threshold: "" });
      await reloadInventoryData();
    } catch (error: any) {
      console.error("Failed to update asset:", error);
      message.error(error?.message || "Failed to update asset");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditModalOpen(false);
    setEditingAsset(null);
    setEditForm({ company: "", assetType: "", threshold: "" });
  };

  const handleResetFilters = () => {
    setFilters({ search: "", assetType: undefined, company: undefined });
    resetToFirstPage();
  };

  const columns: ColumnsType<Asset> = [
    {
      title: "Asset Type",
      dataIndex: "asset_type",
      key: "asset_type",
      render: (value: string) => titleizeAssetTypeValue(value),
    },
    {
      title: "Company",
      dataIndex: "company",
      key: "company",
    },
    {
      title: "Total In",
      dataIndex: "total_in",
      key: "total_in",
    },
    {
      title: "Total Out",
      dataIndex: "total_out",
      key: "total_out",
    },
    {
      title: "Balance",
      dataIndex: "balance",
      key: "balance",
      render: (value, record) => (
        <span className={record.balance <= record.threshold ? "low-balance" : ""}>{value}</span>
      ),
    },
    {
      title: "Threshold",
      dataIndex: "threshold",
      key: "threshold",
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            type="text"
            style={{ color: "#1890ff" }}
            onClick={() => handleEdit(record)}
          />
          <Button
            icon={<DeleteOutlined />}
            type="text"
            danger
            loading={deletingId === record.asset_id}
            onClick={() => handleDelete(record)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div className="parent">
      <div className="asset-inputs">
        <Space size="middle" wrap style={{ width: "100%" }}>
          <Input
            placeholder="Search assets"
            prefix={<SearchOutlined />}
            style={{ width: 260 }}
            allowClear
            value={filters.search}
            onChange={(e) => {
              setFilters((prev) => ({ ...prev, search: e.target.value }));
              resetToFirstPage();
            }}
          />
          <Select
            placeholder="All Assets"
            allowClear
            style={{ width: 180 }}
            value={filters.assetType}
            onChange={(value) => {
              setFilters((prev) => ({ ...prev, assetType: value || undefined }));
              resetToFirstPage();
            }}
            options={assetTypeOptions}
            loading={assetTypesLoading}
            showSearch
            optionFilterProp="label"
          />
          <Select
            placeholder="All Companies"
            allowClear
            style={{ width: 200 }}
            value={filters.company}
            onChange={(value) => {
              setFilters((prev) => ({ ...prev, company: value || undefined }));
              resetToFirstPage();
            }}
            options={companyOptions}
            loading={companiesLoading}
            showSearch
            optionFilterProp="label"
          />
          <Button onClick={handleResetFilters} icon={<FilterOutlined />} className="reset-btn">
            Reset
          </Button>
        </Space>
      </div>

    { assetCards.length > 0 &&  <div className="boxes">
        {tableLoading && assets.length === 0 ? (
          <div style={{ width: "100%", display: "flex", justifyContent: "center", padding: 32 }}>
            <Spin />
          </div>
        ) : assetCards.length > 0 ? (
          assetCards.map((item) => (
            <StockCard
              key={item.assetType}
              title={item.assetType}
              totalIn={item.totalIn}
              totalOut={item.totalOut}
              balance={item.balance}
              status={item.status}
            />
          ))
        ) : (
       <></>
        )}
      </div>
}
      <div className="inventory-container">
        <div className="add-stock">
          <h4>Add Stock</h4>
          <Form
            form={addStockForm}
            layout="vertical"
            className="form-container"
            requiredMark={false}
            onFinish={handleAddStock}
          >
            <div className="form-grid">
              <Form.Item
                label="Company"
                name="company"
                rules={[{ required: true, message: "Please select a company" }]}
              >
                <Select
                  placeholder="Select company"
                  allowClear
                  options={companyOptions}
                  loading={companiesLoading}
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>

              <Form.Item
                label="Asset Type"
                name="assetType"
                rules={[{ required: true, message: "Please select an asset type" }]}
              >
                <Select
                  placeholder="Select asset type"
                  allowClear
                  options={assetTypeOptions}
                  loading={assetTypesLoading}
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>

              <Form.Item
                label="Batch Quantity"
                name="quantity"
                rules={[
                  { required: true, message: "Enter batch quantity" },
                  {
                    type: "number",
                    min: 1,
                    message: "Batch quantity must be at least 1",
                  },
                ]}
              >
                <InputNumber
                  min={1}
                  placeholder="e.g. 100"
                  style={{ width: "100%" }}
                  controls={false}
                />
              </Form.Item>

              <Form.Item
                label="Threshold"
                name="threshold"
                rules={[
                  {
                    type: "number",
                    min: 0,
                    message: "Threshold must be zero or greater",
                  },
                ]}
              >
                <InputNumber
                  min={0}
                  placeholder="e.g. 10"
                  style={{ width: "100%" }}
                  controls={false}
                />
              </Form.Item>
            </div>
            <div className="form-actions">
              <Button
                className="submit-btn"
                type="primary"
                htmlType="submit"
                loading={submitting}
                icon={<PlusOutlined />}
              >
                Add Stock
              </Button>
            </div>
          </Form>
        </div>

        <div className="assets-inventory-container">
          <h4 className="inventory-title">Assets Inventory</h4>

          <Table
            columns={columns}
            dataSource={assets}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50", "100"],
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
            }}
            rowKey="asset_id"
            className="assets-table"
            loading={tableLoading}
            onChange={handleTableChange}
          />
        </div>
      </div>

      <Modal
        title="Edit Asset"
        open={isEditModalOpen}
        onCancel={handleCancelEdit}
        footer={null}
        closeIcon={<CloseOutlined />}
        width={400}
        destroyOnClose
      >
        <div style={{ marginTop: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Company</label>
            <Select
              placeholder="Select company"
              style={{ width: "100%" }}
              value={editForm.company || undefined}
              onChange={(value) => handleEditFormChange("company", value || "")}
              options={companyOptions}
              loading={companiesLoading}
              allowClear
              showSearch
              optionFilterProp="label"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Asset Type</label>
            <Select
              placeholder="Select asset type"
              style={{ width: "100%" }}
              value={editForm.assetType || undefined}
              onChange={(value) => handleEditFormChange("assetType", value || "")}
              options={assetTypeOptions}
              loading={assetTypesLoading}
              allowClear
              showSearch
              optionFilterProp="label"
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
              Low-stock Threshold
            </label>
            <Input
              type="number"
              placeholder="e.g. 30"
              value={editForm.threshold}
              onChange={(e) => handleEditFormChange("threshold", e.target.value)}
              min={0}
            />
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <Button onClick={handleCancelEdit}>Cancel</Button>
            <Button type="primary" onClick={handleSaveEdit} loading={savingEdit}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AssetsInventory;