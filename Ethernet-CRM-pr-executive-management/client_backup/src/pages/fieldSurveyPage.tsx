import React, { useEffect, useMemo, useState } from 'react';
import { Card, Button, Tabs, Row, Col, Typography, message, Table, Pagination } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { Bar, Pie } from 'react-chartjs-2';
import { CSVLink } from "react-csv";
import ExcelJS from "exceljs";
import FileSaver from "file-saver";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { apiClient } from '../utils/apiClient.ts';
import SurveyMap from '../components/SurveyMap';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const { Text } = Typography;

const FieldSurveyDashboard = () => {
  const [summaryData, setSummaryData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mapLoading, setMapLoading] = useState(true);
  const [data, setData] = useState<any[]>([]); // Paginated table data
  const [allData, setAllData] = useState<any[]>([]); // All data for export
  const [surveyLocations, setSurveyLocations] = useState<any[]>([]);
  const fetchSurveySummary = async () => {
    try {
      const response = await apiClient("GET", `/api/v1/leads/survey/summary`);
      setSummaryData(response);
    } catch (error) {
      console.error('Error fetching summary:', error);
      message.error('Failed to load survey summary');
    } finally {
      setLoading(false);
    }
  };

  const fetchSurveyLocations = async () => {
    try {
      setMapLoading(true);
      const result = await apiClient("GET", `/api/v1/leads/survey?page=1&limit=5000`);
      setSurveyLocations(result?.survey || []);
      
      // Also set all data for export purposes
      const formattedAllData = (result?.survey || []).map((survey: any) => ({
        key: survey.id.toString(),
        title: survey.feedback || "--",
        date: new Date(survey.createdAt).toLocaleDateString(),
        rating: survey.serviceRating || "--",
        heardFrom: survey.heardFrom || "--",
        contactNumber: survey.contactNumber || "--",
        likedFeatures: survey.likedFeatures || "--"
      }));
      setAllData(formattedAllData);
    } catch (error: any) {
      message.error(error?.message || "Unable to load survey locations");
    } finally {
      setMapLoading(false);
    }
  };

  useEffect(() => {
    fetchSurveySummary();
    fetchSurveyLocations();
  }, []);

  // Default fallback values to avoid crashes
  const totalResponses = summaryData?.totalResponses || 0;
  const ratings = summaryData?.ratings || {};
  const heardFrom = summaryData?.heardFrom || {};
  const topPayoutUsers = summaryData?.topPayoutUsers || [];

  const satisfactionData = {
    labels: ['Excellent', 'Good', 'Average', 'Poor'],
    datasets: [
      {
        data: [
          ratings['Excellent'] || 0,
          ratings['Good'] || 0,
          ratings['Average'] || 0,
          ratings['Poor'] || 0,
        ],
        label: "Satisfaction",
        backgroundColor: ['#0EA5E9', '#7DD3FC', '#9CA3AF', '#6B21A8'],
        borderWidth: 0,
      },
    ],
  };

  const satisfactionOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle' as const,
          padding: 15,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  const recommendData = {
    // labels:  [],
    labels: Object.keys(summaryData?.likedFeaturesCount || {}) || [],
    datasets: [
      {
        label: "Feature",
        // data: [],
        data: Object.keys(summaryData?.likedFeaturesCount || {})?.map(elem => summaryData?.likedFeaturesCount?.[elem] || 0) || [],
        backgroundColor: ['#0EA5E9', '#7DD3FC', '#9CA3AF'],
        borderWidth: 0,
      },
    ],
  };
  const [pagination, setPagination] = useState({ page: 1, limit: 5, total: 0 });
  const recommendOptions: any = {
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
      }
    }
  };

  const acquisitionLabels = Object.keys(heardFrom);
  const acquisitionValues = Object.values(heardFrom);

  const acquisitionData = {
    labels: acquisitionLabels,
    datasets: [
      {
        label: "Acquisition Channel",
        data: acquisitionValues,
        backgroundColor: ['#0EA5E9', '#7DD3FC', '#9CA3AF', '#6B21A8'],
        borderWidth: 0,
      },
    ],
  };

  const acquisitionOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle' as const,
          padding: 15,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  const columns = [
    {
      title: "Feedback",
      dataIndex: "title",
      render: (text) => (
        <Text strong>{text}</Text>
      ),
    },
    {
      title: "Created At",
      dataIndex: "date",
      key: "date",
    },
    {
      title: "Rating",
      dataIndex: "rating",
    },
    {
      title: "Source",
      dataIndex: "heardFrom",
    },
    {
      title: "Contact Number",
      dataIndex: "contactNumber",
    },
    {
      title: "Liked features",
      dataIndex: "likedFeatures",
      key: "likedFeatures",
      render: (likedFeatures: any) => {
        // Parse the JSON string to array
        let featuresArray: string[] = [];
        
        if (likedFeatures) {
          try {
            if (typeof likedFeatures === 'string') {
              featuresArray = JSON.parse(likedFeatures);
            } else if (Array.isArray(likedFeatures)) {
              featuresArray = likedFeatures;
            }
          } catch (error) {
            console.error('Error parsing liked features:', error);
            return <span>{likedFeatures}</span>;
          }
        }

        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {featuresArray && featuresArray.length > 0 ? (
              featuresArray.map((feature: string, index: number) => (
                <span
                  key={index}
                  style={{
                    backgroundColor: '#e5e7eb',
                    padding: '6px 16px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    display: 'inline-block',
                  }}
                >
                  {feature}
                </span>
              ))
            ) : (
              <span>--</span>
            )}
          </div>
        );
      },
    },

  ];
  // Fetch expenses from API
  const fetchExpenses = async (page = 1, limit = 5) => {
    setLoading(true);
    try {
      const result = await apiClient("GET", `/api/v1/leads/survey?page=${page}&limit=${limit}`);
      setData(result.survey.map((survey: any) => ({
        key: survey.id.toString(),
        title: survey.feedback || "--", // adjust if needed
        date: new Date(survey.createdAt).toLocaleDateString(),
        rating: survey.serviceRating || "--",
        heardFrom: survey.heardFrom || "--",
        contactNumber: survey.contactNumber || "--",
        likedFeatures: survey.likedFeatures || "--s"
      })));
      setPagination({
        page: result?.pagination.page || 1,
        limit: result?.pagination.limit || 10,
        total: result?.pagination.total || result?.length,
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

  const mapPoints = useMemo(
    () =>
      (surveyLocations || [])
        .map((item: any) => ({
          id: item.id,
          latitude: item.latitude,
          longitude: item.longitude,
          label: item.feedback || item.heardFrom || null,
        })),
    [surveyLocations]
  );
  const tabItems = [
    {
      key: '1',
      label: 'Charts',
      children: <div style={{ width: "100%" }}>
        {/* Charts */}
        <Row gutter={16} style={{ marginBottom: '24px', width: "100%" }}>
          <Col style={{ width: "50%" }}>
            <Card title="Satisfaction" style={{ border: "0.5px solid rgb(155, 155, 155)" }} loading={loading}>
              <div style={{ height: '350px' }}>
                <Bar data={satisfactionData} options={satisfactionOptions} />
              </div>
            </Card>
          </Col>

          <Col style={{ width: "50%" }}>
            <Card title="Feature" style={{ border: "0.5px solid rgb(155, 155, 155)" }}>
              <div style={{ height: '350px', position: 'relative' }}>
                <Pie data={recommendData} options={recommendOptions} />
                {/* Custom overlays */}
                {/* <div className="overlay" style={{ top: '50%', left: '70%' }}>
                <div>Yes</div>
                <div>50%</div>
              </div>
              <div className="overlay" style={{ top: '70%', left: '25%' }}>
                <div>No</div>
                <div>33.3%</div>
              </div>
              <div className="overlay" style={{ top: '20%', left: '50%' }}>
                <div>Neutral</div>
                <div>16.7%</div>
              </div> */}
              </div>
            </Card>
          </Col>
        </Row>

        {/* Acquisition Channel */}
        <Row style={{ width: "100%" }}>
          <Col style={{ border: "0.5px solid rgb(155, 155, 155)", width: "98%" }}>
            <Card title="Acquisition Channel" loading={loading}>
              <div style={{ height: '350px' }}>
                <Bar data={acquisitionData} options={acquisitionOptions} />
              </div>
            </Card>
          </Col>
        </Row>

        {/* Style tag examples */}
        <style>
          {`
          .tag {
            background-color: #e5e7eb;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            display: inline-block;
            white-space: nowrap;
          }

          .overlay {
            position: absolute;
            transform: translate(-50%, -50%);
            text-align: center;
            font-size: 13px;
            color: #666;
          }
          .overlay div:last-child {
            font-weight: 600;
            font-size: 16px;
          }

          /* Table Styling */
          .ant-table-thead > tr > th {
            background-color: #60a5fa !important;
            color: white !important;
            font-weight: 500 !important;
            font-size: 16px !important;
            border: none !important;
            padding: 16px !important;
          }

          .ant-table-tbody > tr > td {
            font-size: 15px !important;
            padding: 16px !important;
            border-bottom: 1px solid #f0f0f0 !important;
          }

          .ant-table-tbody > tr:hover > td {
            background-color: #f9fafb !important;
          }

          .table-row-light > td {
            background-color: #ffffff !important;
          }
        `}
        </style>
      </div>

    },
    {
      key: '2',
      label: 'Table',
      children: <div style={{ backgroundColor: "white", padding: 0, borderRadius: "10px", overflow: 'hidden' }}>
        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={false}
          style={{
            borderRadius: '10px',
          }}
          rowClassName={(record, index) => 
            index % 2 === 0 ? '' : 'table-row-light'
          }
        />
        <Pagination
          current={pagination.page}
          pageSize={pagination.limit}
          total={pagination.total}
          onChange={(page, pageSize) => {
            setPagination({ page, limit: pageSize, total: pagination.total });
            fetchExpenses(page, pageSize);
          }}
          showSizeChanger
          pageSizeOptions={["5", "10", "20"]}
          style={{ marginTop: 16, marginBottom: 16, textAlign: "right", paddingRight: 16 }}
        />
      </div>
    },
    {
      key: '3',
      label: 'Map',
      children: (
        <SurveyMap loading={mapLoading} locations={mapPoints} height={650} />
      ),
    },
  ];

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("My Sheet");
    // Add header
    sheet.columns = [
      { header: "Feedback", key: "title", width: 10 },
      { header: "Rating", key: "rating" },
      { header: "Source", key: "heardFrom" },
      { header: "Contact Number", key: "contactNumber" },
      { header: "Liked Features", key: "likedFeatures" },
    ];
    const dt = (typeof allData == "object" && Array.isArray(allData) ? allData : [])
    dt?.forEach((row) => sheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();
    FileSaver.saveAs(new Blob([buffer]), "exported-data.xlsx");
  };



  return (
    <div style={{ backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '28px', fontWeight: '600', marginBottom: '24px' }}>Overview</h1>

      {/* Top Cards */}
      <Row gutter={16} >
        <Col xs={24} sm={24} md={8} lg={8} xl={7}>
          <Card style={{ border: "0.5px solid rgb(155, 155, 155)", marginBottom: '16px' }} loading={loading}>
            <Text style={{ fontSize: '14px', color: 'black', fontWeight: "600" }}>Responses</Text>
            <div style={{ fontSize: '13px', color: '#999' }}>
              Total Collected
            </div>
            <div style={{ fontSize: '25px', fontWeight: '600', marginTop: '8px' }}>{totalResponses}</div>
          </Card>
        </Col>

        <Col xs={24} sm={24} md={8} lg={8} xl={8}>
          <Card style={{ border: "0.5px solid rgb(155, 155, 155)", marginBottom: '16px' }} loading={loading}>
            <Text style={{ fontSize: '14px', color: 'black', fontWeight: "600" }}>Executive</Text>
            <div style={{ marginBottom: '12px', fontSize: '13px', color: '#999' }}>
              With Payouts
            </div>
            <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: '8px' }}>
              {topPayoutUsers.length > 0 ? (
                topPayoutUsers.slice(0, 3).map((user) => (
                  <span 
                    key={user.userId} 
                    className="tag"
                    style={{
                      backgroundColor: '#e5e7eb',
                      padding: '4px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      display: 'inline-block',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {user.name}: ₹{user.payout.toFixed(2)}
                  </span>
                ))
              ) : (
                <Text type="secondary" style={{ fontSize: '12px' }}>No data available</Text>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={24} md={8} lg={8} xl={8}>
          <Card style={{ border: "0.5px solid rgb(155, 155, 155)", marginBottom: '16px' }}>
            <Text style={{ fontSize: '14px', color: '#666' }}>Export</Text>
            <div style={{ marginBottom: '12px', fontSize: '13px', color: '#999' }}>
              Download datasets
            </div>
            <div style={{ display: "flex", flexWrap: "wrap" }}>
              <CSVLink
                data={typeof allData == "object" && Array.isArray(allData) ? allData : []}
                headers={[
                  { label: "Feedback", key: "title" },
                  { label: "Rating", key: "rating" },
                  { label: "Source", key: "heardFrom" },
                  { label: "Contact Number", key: "contactNumber" },
                  { label: "Liked Features", key: "likedFeatures" },
                ]}
                filename="survey-feedback.csv"
              >
                <Button size="small" type="primary" icon={<DownloadOutlined />} style={{ marginRight: '8px', padding:"15px"}}>
                  Download CSV
                </Button>
              </CSVLink>

              <Button
                size="small"
                type="primary"
                onClick={exportToExcel}
                icon={<DownloadOutlined />}
                style={{ backgroundColor: '#10b981', borderColor: '#10b981' , padding:"15px"}}
              >
                Download Excel
              </Button>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
      <Tabs defaultActiveKey="1" items={tabItems} style={{ margin: '16px' }} />
    </div >
  );
};

export default FieldSurveyDashboard;


