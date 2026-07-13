import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Typography, Button, Spin, message, Image, Tag, Divider, Space, Select, Input, Tooltip, Modal } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined, CopyOutlined, MailOutlined, MessageOutlined, ZoomInOutlined } from '@ant-design/icons';
import { apiClient } from '../utils/apiClient.ts';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface KycData {
  id: number;
  lead_id: number;
  unique_id: string;
  id_type?: string;
  id_number?: string;
  id_document?: string;
  address_proof_type?: string;
  address_proof_number?: string;
  address_proof_document?: string;
  signature?: string;
  terms_accepted: boolean;
  submitted_at?: string;
  lead?: {
    id: number;
    unique_id: string;
    name: string;
    phone_number: string;
    address: string;
  };
  customerDetails?: {
    first_name: string;
    last_name?: string;
    email?: string;
  };
}

const KycDetailsPage = () => {
  const { uniqueId } = useParams<{ uniqueId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [kycData, setKycData] = useState<KycData | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'correct' | 'incorrect'>('pending');
  const [verificationRemark, setVerificationRemark] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('');
  const [paymentLink, setPaymentLink] = useState<string>('');
  const [showPaymentLinkModal, setShowPaymentLinkModal] = useState(false);
  const [showIncorrectModal, setShowIncorrectModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => {
    if (uniqueId) {
      fetchKycDetails();
    }
  }, [uniqueId]);

  const fetchKycDetails = async () => {
    setLoading(true);
    try {
      const response = await apiClient(
        "GET",
        `/api/v1/leads/customer-details/${uniqueId}`
      );

      if (response.success && response.data) {
        const customerDetails = response.data;
        const kycRecord = customerDetails.lead?.kyc;
        
        // Map the response to KYC data structure
        const mappedData: KycData = {
          id: kycRecord?.id || 0,
          lead_id: customerDetails.lead_id,
          unique_id: customerDetails.lead?.unique_id || uniqueId || '',
          id_type: kycRecord?.id_type || undefined,
          id_number: kycRecord?.id_number || undefined,
          id_document: kycRecord?.id_document || undefined,
          address_proof_type: kycRecord?.address_proof_type || undefined,
          address_proof_number: kycRecord?.address_proof_number || undefined,
          address_proof_document: kycRecord?.address_proof_document || undefined,
          signature: kycRecord?.signature || undefined,
          terms_accepted: kycRecord?.terms_accepted || false,
          submitted_at: kycRecord?.created_at || kycRecord?.updated_at || undefined,
          lead: customerDetails.lead ? {
            id: customerDetails.lead.id,
            unique_id: customerDetails.lead.unique_id,
            name: customerDetails.lead.name,
            phone_number: customerDetails.lead.phone_number,
            address: customerDetails.lead.address,
          } : undefined,
          customerDetails: {
            first_name: customerDetails.first_name,
            last_name: customerDetails.last_name,
            email: customerDetails.email,
          },
        };
        setKycData(mappedData);
      } else {
        message.error('KYC details not found');
      }
    } catch (error: any) {
      console.error("Error fetching KYC details", error);
      message.error(error?.message || "Failed to load KYC details");
    } finally {
      setLoading(false);
    }
  };

  const isBase64Image = (data: string) => {
    if (!data) return false;
    return data.startsWith('data:image/') || data.startsWith('/9j/') || data.startsWith('iVBORw0KGgo');
  };

  const isImageFile = (url: string) => {
    if (!url) return false;
    if (isBase64Image(url)) return true;
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    return imageExtensions.some(ext => url.toLowerCase().includes(ext));
  };

  const isPdfFile = (url: string) => {
    if (!url) return false;
    if (url.startsWith('data:application/pdf')) return true;
    return url.toLowerCase().includes('.pdf');
  };

  const handleImageClick = (imageSrc: string) => {
    setPreviewImage(imageSrc);
    setPreviewVisible(true);
  };

  const handleVerification = (status: 'correct' | 'incorrect') => {
    if (status === 'incorrect') {
      setShowIncorrectModal(true);
    } else {
      setVerificationStatus('correct');
      setVerificationRemark('');
    }
  };

  const handleConfirmIncorrect = () => {
    if (!verificationRemark.trim()) {
      message.warning('Please provide a reason');
      return;
    }
    setVerificationStatus('incorrect');
    setShowIncorrectModal(false);
  };

  const handleCancelIncorrect = () => {
    setShowIncorrectModal(false);
    setVerificationRemark('');
  };

  const handlePaymentModeChange = (value: string) => {
    setPaymentMode(value);
    if (value === 'online') {
      setPaymentLink('');
    }
  };

  const handleCreatePaymentLink = () => {
    if (!uniqueId) return;
    const link = `/customer/payment/${uniqueId}`;
    setPaymentLink(link);
    setShowPaymentLinkModal(true);
  };

  const handleCopyPaymentLink = () => {
    if (paymentLink) {
      navigator.clipboard.writeText(`${window.location.origin}${paymentLink}`);
      message.success('Payment link copied to clipboard');
    }
  };

  const handleSendPaymentLinkViaSMS = () => {
    if (!paymentLink || !kycData?.lead?.phone_number) return;
    message.info(`Sending payment link via SMS to ${kycData.lead.phone_number}`);
    // TODO: Implement SMS sending
  };

  const handleSendPaymentLinkViaEmail = () => {
    if (!paymentLink || !kycData?.customerDetails?.email) return;
    message.info(`Sending payment link via Email to ${kycData.customerDetails.email}`);
    // TODO: Implement Email sending
  };

  const handleSubmitVerification = async () => {
    if (verificationStatus === 'pending') {
      message.warning('Please verify the KYC first');
      return;
    }

    if (verificationStatus === 'incorrect') {
      if (!verificationRemark.trim()) {
        message.warning('Please provide a reason for marking as incorrect');
        return;
      }
      // TODO: Implement API call to mark KYC as incorrect
      message.info('KYC marked as incorrect');
      return;
    }

    if (verificationStatus === 'correct') {
      if (!paymentMode) {
        message.warning('Please select a payment mode');
        return;
      }

      setSubmitting(true);
      try {
        // TODO: Implement API call to update status to PAYMENT_PENDING
        // await apiClient("PATCH", `/api/v1/leads/${uniqueId}/status`, { 
        //   status: 'PENDING_PAYMENT',
        //   payment_mode: paymentMode 
        // });
        
        message.success('KYC verified and status updated to Payment Pending');
        
        if (paymentMode === 'online') {
          handleCreatePaymentLink();
        }
      } catch (error: any) {
        console.error("Error updating status", error);
        message.error(error?.message || "Failed to update status");
      } finally {
        setSubmitting(false);
      }
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!kycData) {
    return (
      <div style={{ padding: '20px' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: '20px' }}>
          Back
        </Button>
        <Card>
          <Typography.Text>KYC details not found</Typography.Text>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
      <Button 
        icon={<ArrowLeftOutlined />} 
        onClick={() => navigate(-1)} 
        style={{ marginBottom: '20px' }}
      >
        Back
      </Button>

      <Title level={2} style={{ marginBottom: '24px', textAlign: 'center' }}>
        KYC Details
      </Title>

      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* Customer Information */}
        <Card title="Customer Information" style={{ marginBottom: '16px' }}>
          <Descriptions column={2} bordered>
            <Descriptions.Item label="Lead ID">
              <Text code>{kycData.unique_id}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Name">
              {kycData.customerDetails?.first_name} {kycData.customerDetails?.last_name}
            </Descriptions.Item>
            <Descriptions.Item label="Phone Number">
              {kycData.lead?.phone_number}
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              {kycData.customerDetails?.email || 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Address" span={2}>
              {kycData.lead?.address}
            </Descriptions.Item>
            <Descriptions.Item label="Submitted At">
              {kycData.submitted_at 
                ? new Date(kycData.submitted_at).toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Terms Accepted">
              <Tag color={kycData.terms_accepted ? 'green' : 'red'}>
                {kycData.terms_accepted ? 'Yes' : 'No'}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* ID Proof Details */}
        <Card title="ID Proof Details" style={{ marginBottom: '16px' }}>
          <Descriptions column={1} bordered>
            <Descriptions.Item label="ID Type">
              {kycData.id_type || 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="ID Number">
              {kycData.id_number || 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="ID Document">
              {kycData.id_document ? (
                <div>
                  {isImageFile(kycData.id_document) ? (
                    <div style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}>
                      <img
                        src={kycData.id_document}
                        alt="ID Document"
                        style={{
                          width: '150px',
                          height: '150px',
                          objectFit: 'cover',
                          borderRadius: '4px',
                          border: '1px solid #d9d9d9',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}
                        onClick={() => handleImageClick(kycData.id_document!)}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          backgroundColor: 'rgba(0,0,0,0.5)',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          color: 'white',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <ZoomInOutlined /> Click to expand
                      </div>
                    </div>
                  ) : isPdfFile(kycData.id_document) ? (
                    <Button 
                      type="link" 
                      href={kycData.id_document} 
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View PDF Document
                    </Button>
                  ) : (
                    <Text>{kycData.id_document}</Text>
                  )}
                </div>
              ) : (
                'N/A'
              )}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Address Proof Details */}
        <Card title="Address Proof Details" style={{ marginBottom: '16px' }}>
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Address Proof Type">
              {kycData.address_proof_type || 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Address Proof Number">
              {kycData.address_proof_number || 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Address Proof Document">
              {kycData.address_proof_document ? (
                <div>
                  {isImageFile(kycData.address_proof_document) ? (
                    <div style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}>
                      <img
                        src={kycData.address_proof_document}
                        alt="Address Proof Document"
                        style={{
                          width: '150px',
                          height: '150px',
                          objectFit: 'cover',
                          borderRadius: '4px',
                          border: '1px solid #d9d9d9',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}
                        onClick={() => handleImageClick(kycData.address_proof_document!)}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          backgroundColor: 'rgba(0,0,0,0.5)',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          color: 'white',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <ZoomInOutlined /> Click to expand
                      </div>
                    </div>
                  ) : isPdfFile(kycData.address_proof_document) ? (
                    <Button 
                      type="link" 
                      href={kycData.address_proof_document} 
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View PDF Document
                    </Button>
                  ) : (
                    <Text>{kycData.address_proof_document}</Text>
                  )}
                </div>
              ) : (
                'N/A'
              )}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Signature */}
        <Card title="Signature" style={{ marginBottom: '16px' }}>
          {kycData.signature ? (
            <div>
              {isImageFile(kycData.signature) ? (
                <div style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}>
                  <img
                    src={kycData.signature}
                    alt="Signature"
                    style={{
                      width: '200px',
                      height: '100px',
                      objectFit: 'contain',
                      borderRadius: '4px',
                      border: '1px solid #d9d9d9',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      backgroundColor: '#fff'
                    }}
                    onClick={() => handleImageClick(kycData.signature!)}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      color: 'white',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <ZoomInOutlined /> Click to expand
                  </div>
                </div>
              ) : (
                <Text>{kycData.signature}</Text>
              )}
            </div>
          ) : (
            <Text type="secondary">No signature provided</Text>
          )}
        </Card>

        {/* Verification Section */}
        <Card title="KYC Verification" style={{ marginBottom: '16px' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <Text strong style={{ marginRight: '16px' }}>Verification Status:</Text>
              <Space>
                <Tooltip title={verificationStatus === 'incorrect' ? verificationRemark : 'Mark KYC as correct'}>
                  <Button
                    type={verificationStatus === 'correct' ? 'primary' : 'default'}
                    icon={<CheckCircleOutlined />}
                    onClick={() => handleVerification('correct')}
                    style={{
                      color: verificationStatus === 'correct' ? '#fff' : '#52c41a',
                      borderColor: verificationStatus === 'correct' ? '#52c41a' : undefined,
                    }}
                  >
                    Correct
                  </Button>
                </Tooltip>
                <Tooltip title={verificationStatus === 'incorrect' ? verificationRemark : 'Mark KYC as incorrect'}>
                  <Button
                    type={verificationStatus === 'incorrect' ? 'primary' : 'default'}
                    danger={verificationStatus !== 'incorrect'}
                    icon={<CloseCircleOutlined />}
                    onClick={() => handleVerification('incorrect')}
                    style={{
                      color: verificationStatus === 'incorrect' ? '#fff' : '#ff4d4f',
                      borderColor: verificationStatus === 'incorrect' ? '#ff4d4f' : undefined,
                    }}
                  >
                    Incorrect
                  </Button>
                </Tooltip>
                {verificationStatus !== 'pending' && (
                  <Tag color={verificationStatus === 'correct' ? 'green' : 'red'}>
                    {verificationStatus === 'correct' ? 'Verified as Correct' : 'Marked as Incorrect'}
                  </Tag>
                )}
              </Space>
            </div>

            {verificationStatus === 'correct' && (
              <div>
                <Text strong style={{ display: 'block', marginBottom: '8px' }}>Payment Mode:</Text>
                <Select
                  value={paymentMode}
                  onChange={handlePaymentModeChange}
                  placeholder="Select Payment Mode"
                  style={{ width: '100%', maxWidth: '300px' }}
                >
                  <Select.Option value="online">Online</Select.Option>
                  <Select.Option value="bank_transfer">Bank Transfer</Select.Option>
                  <Select.Option value="cash">Cash</Select.Option>
                  <Select.Option value="cheque">Cheque</Select.Option>
                </Select>

                {paymentMode === 'online' && (
                  <div style={{ marginTop: '16px' }}>
                    <Button
                      type="primary"
                      onClick={handleCreatePaymentLink}
                    >
                      Create Payment Link
                    </Button>
                  </div>
                )}

                <div style={{ marginTop: '16px' }}>
                  <Button
                    type="primary"
                    size="large"
                    onClick={handleSubmitVerification}
                    loading={submitting}
                  >
                    Submit Verification
                  </Button>
                </div>
              </div>
            )}

            {verificationStatus === 'incorrect' && verificationRemark && (
              <div>
                <Text strong>Reason:</Text>
                <div style={{ marginTop: '8px', padding: '12px', backgroundColor: '#fff2f0', borderRadius: '4px' }}>
                  <Text>{verificationRemark}</Text>
                </div>
                <div style={{ marginTop: '16px' }}>
                  <Button
                    type="primary"
                    size="large"
                    onClick={handleSubmitVerification}
                    loading={submitting}
                  >
                    Submit Verification
                  </Button>
                </div>
              </div>
            )}
          </Space>
        </Card>
      </div>

      {/* Payment Link Modal */}
      <Modal
        title="Payment Link"
        open={showPaymentLinkModal}
        onCancel={() => setShowPaymentLinkModal(false)}
        footer={null}
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong style={{ display: 'block', marginBottom: '8px' }}>Payment Link:</Text>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                value={paymentLink ? `${window.location.origin}${paymentLink}` : ''}
                readOnly
                style={{ flex: 1 }}
              />
              <Button
                icon={<CopyOutlined />}
                onClick={handleCopyPaymentLink}
              >
                Copy
              </Button>
            </Space.Compact>
          </div>

          <Space style={{ width: '100%' }} size="middle">
            <Button
              icon={<MessageOutlined />}
              onClick={handleSendPaymentLinkViaSMS}
              style={{ flex: 1 }}
            >
              Send via SMS
            </Button>
            <Button
              icon={<MailOutlined />}
              onClick={handleSendPaymentLinkViaEmail}
              style={{ flex: 1 }}
            >
              Send via Email
            </Button>
          </Space>

          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f0f2f5', borderRadius: '4px' }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Manual Link: <Text code>{paymentLink}</Text>
            </Text>
          </div>
        </Space>
      </Modal>

      {/* Incorrect Verification Modal */}
      <Modal
        title="KYC Verification - Incorrect"
        open={showIncorrectModal}
        onOk={handleConfirmIncorrect}
        onCancel={handleCancelIncorrect}
        okText="Confirm"
        cancelText="Cancel"
        width={500}
      >
        <div>
          <Text>Please provide a reason for marking KYC as incorrect:</Text>
          <TextArea
            rows={4}
            placeholder="Enter reason..."
            style={{ marginTop: '12px' }}
            value={verificationRemark}
            onChange={(e) => setVerificationRemark(e.target.value)}
          />
        </div>
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        open={previewVisible}
        footer={null}
        onCancel={() => setPreviewVisible(false)}
        width="90%"
        style={{ top: 20 }}
        centered
      >
        {previewImage && (
          <img
            src={previewImage}
            alt="Preview"
            style={{
              width: '100%',
              height: 'auto',
              maxHeight: '80vh',
              objectFit: 'contain',
              borderRadius: '4px'
            }}
          />
        )}
      </Modal>
    </div>
  );
};

export default KycDetailsPage;

