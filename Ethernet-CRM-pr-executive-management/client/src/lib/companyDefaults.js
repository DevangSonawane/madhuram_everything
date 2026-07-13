export const COMMON_COMPANY_HEADER = {
  company_name: "Madhuram Enterprises",
  company_address:
    "SHOP NO - S/2, FLOOR NO 2,X TH CENTRAL MAL, MAHAVIR NAGAR, KANDIVALIWEST. MUMBAI -400 067. MAHARASHTRA",
  company_phone: "+919819408257",
  company_contact_number: "+919819408257",
  company_email: "manish.plumbing@gmail.com",
  company_website: "www.madhuramrealtors.com",
};

export const withCommonCompanyHeader = (header) => ({
  ...(header || {}),
  ...COMMON_COMPANY_HEADER,
});
