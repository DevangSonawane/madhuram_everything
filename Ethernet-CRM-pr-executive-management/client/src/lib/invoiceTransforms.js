const isPlainObject = (value) => value != null && typeof value === "object" && !Array.isArray(value);

const toNumberOrZero = (value) => {
  if (value == null || value === "") return 0;
  const normalized = String(value).replace(/,/g, "").trim();
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
};

const toIsoDateOnly = (value) => {
  if (!value) return "";
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toISOString().slice(0, 10);
};

const unwrapInvoiceShape = (apiInvoice) => {
  const root = isPlainObject(apiInvoice) ? apiInvoice : {};
  const invoice = isPlainObject(root.invoice) ? root.invoice : root;
  const items = Array.isArray(root.items) ? root.items : Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
  return { root, invoice, items };
};

export const hiranandaniFormToApiPayload = (formData, projectId) => {
  const header = formData?.header || {};
  const totals = formData?.totals || {};
  const bankDeclaration = formData?.bankDeclaration || formData?.declaration || {};
  const items = Array.isArray(formData?.items) ? formData.items : [];

  return {
    project_id: Number(projectId) || projectId || 0,
    user_id: header.user_id ?? "",
    user_name: header.user_name ?? "",
    linked_mir_ids: Array.isArray(formData?.linked_mir_ids) ? formData.linked_mir_ids : [],
    linked_itr_ids: Array.isArray(formData?.linked_itr_ids) ? formData.linked_itr_ids : [],
    invoice: {
      invoiceNo: header.invoice_number || "",
      invoiceDate: toIsoDateOnly(header.invoice_date),
      reverseCharge: header.reverse_charge ?? "",
      state: header.supplier_state_name ?? header.state_name ?? "",
      stateCode: header.supplier_state_code ?? header.state_code ?? "",
      seller: {
        name: header.company_name || "",
        gstin: header.supplier_gstin || "",
        panNo: header.pan_number ?? header.pan_no ?? "",
      },
      complianceDetails: {
        pfNo: header.pf_number || "",
        esicNo: header.esic_number || "",
        ptrNo: header.ptr_number || "",
        mlwfNo: header.mlwf_number || "",
      },
      billToParty: {
        coAccountName: header.bill_to_name ?? "",
        address: header.bill_to_address ?? "",
        gstin: header.bill_to_gstin ?? "",
        state: header.bill_to_state ?? "",
        stateCode: header.bill_to_state_code ?? "",
      },
      shipToPartySite: {
        coAccountName: header.ship_to_name ?? "",
        gstin: header.ship_to_gstin ?? "",
        state: header.ship_to_state ?? "",
        stateCode: header.ship_to_state_code ?? "",
        buildingName: header.building_name ?? "",
      },
      referenceDetails: {
        raNo: header.ra_number ?? "",
        workDescription: header.work_description ?? "",
        woNo: header.work_order_number ?? "",
        woDate: toIsoDateOnly(header.work_order_date),
        serviceDateFrom: toIsoDateOnly(header.service_date_from),
        serviceDateTo: toIsoDateOnly(header.service_date_to),
      },
      lineItems: items.map((row, index) => {
        const safeRow = isPlainObject(row) ? row : {};
        return {
          sNo: Number(safeRow.sNo ?? safeRow.sn ?? safeRow.serial_number ?? index + 1) || index + 1,
          goodsServiceDescription:
            safeRow.goodsServiceDescription ?? safeRow.description ?? safeRow.goods_or_service_description ?? "",
          sacCode: safeRow.sacCode ?? safeRow.sac_code ?? "",
          valueOfSupply: toNumberOrZero(safeRow.valueOfSupply ?? safeRow.value_of_supply),
          discount: toNumberOrZero(safeRow.discount),
          taxableValue: toNumberOrZero(safeRow.taxableValue ?? safeRow.taxable_value),
          cgst: {
            rate: toNumberOrZero(safeRow.cgst?.rate ?? safeRow.cgst_rate),
            amount: toNumberOrZero(safeRow.cgst?.amount ?? safeRow.cgst_amount),
          },
          sgst: {
            rate: toNumberOrZero(safeRow.sgst?.rate ?? safeRow.sgst_rate),
            amount: toNumberOrZero(safeRow.sgst?.amount ?? safeRow.sgst_amount),
          },
          total: toNumberOrZero(safeRow.total ?? safeRow.line_total ?? safeRow.lineTotal),
        };
      }),
      totals: {
        totalValueOfSupply: toNumberOrZero(totals.total_value_of_supply),
        totalDiscount: toNumberOrZero(totals.total_discount),
        totalTaxableValue: toNumberOrZero(totals.total_taxable_value),
        totalCgstAmount: toNumberOrZero(totals.total_cgst_amount ?? totals.total_cgst),
        totalSgstAmount: toNumberOrZero(totals.total_sgst_amount ?? totals.total_sgst),
        totalAmount: toNumberOrZero(totals.total_amount),
      },
      summary: {
        totalInvoiceAmountInWords: totals.total_invoice_amount_in_words ?? totals.invoice_amount_words ?? "",
        totalAmountBeforeTax: toNumberOrZero(totals.total_amount_before_tax ?? totals.total_before_tax),
        addCgst: toNumberOrZero(totals.add_cgst ?? totals.total_cgst ?? totals.total_cgst_amount),
        addSgst: toNumberOrZero(totals.add_sgst ?? totals.total_sgst ?? totals.total_sgst_amount),
        roundOff: toNumberOrZero(totals.round_off),
        totalAmountAfterTax: toNumberOrZero(totals.total_amount_after_tax ?? totals.total_amount),
        gstOnReverseCharge: toNumberOrZero(totals.gst_on_reverse_charge),
        eAndOE: Boolean(totals.e_and_oe),
      },
      bankDetails: bankDeclaration.bank_details || bankDeclaration.bankDetails || "",
      authorisedSignatory: bankDeclaration.authorised_signatory || bankDeclaration.authorisedSignatory || "",
    },
  };
};

export const hiranandaniApiToFormData = (apiInvoice) => {
  const { root, invoice: inv, items } = unwrapInvoiceShape(apiInvoice);
  const rootUserId = root.user_id ?? root.userId ?? "";
  const rootUserName = root.user_name ?? root.userName ?? "";

  const bankDeclaration = {
    bank_details: inv.bankDetails ?? inv.bank_details ?? "",
    authorised_signatory: inv.authorisedSignatory ?? inv.authorised_signatory ?? "",
  };

  return {
    header: {
      supplier_gstin: inv.seller?.gstin ?? inv.supplier_gstin ?? "",
      pan_number: inv.seller?.panNo ?? inv.pan_number ?? "",
      pf_number: inv.complianceDetails?.pfNo ?? inv.pf_number ?? "",
      esic_number: inv.complianceDetails?.esicNo ?? inv.esic_number ?? "",
      ptr_number: inv.complianceDetails?.ptrNo ?? inv.ptr_number ?? "",
      mlwf_number: inv.complianceDetails?.mlwfNo ?? inv.mlwf_number ?? "",
      invoice_number: inv.invoiceNo ?? inv.invoice_number ?? "",
      invoice_date: inv.invoiceDate ?? inv.invoice_date ?? "",
      reverse_charge: inv.reverseCharge ?? inv.reverse_charge ?? "",
      supplier_state_name: inv.state ?? inv.supplier_state_name ?? "",
      supplier_state_code: inv.stateCode ?? inv.supplier_state_code ?? "",

      bill_to_name: inv.billToParty?.coAccountName ?? inv.bill_to_name ?? "",
      bill_to_address: inv.billToParty?.address ?? inv.bill_to_address ?? "",
      bill_to_gstin: inv.billToParty?.gstin ?? inv.bill_to_gstin ?? "",
      bill_to_state: inv.billToParty?.state ?? inv.bill_to_state ?? "",
      bill_to_state_code: inv.billToParty?.stateCode ?? inv.bill_to_state_code ?? "",

      ship_to_name: inv.shipToPartySite?.coAccountName ?? inv.ship_to_name ?? "",
      ship_to_address: inv.ship_to_address ?? "",
      ship_to_gstin: inv.shipToPartySite?.gstin ?? inv.ship_to_gstin ?? "",
      ship_to_state: inv.shipToPartySite?.state ?? inv.ship_to_state ?? "",
      ship_to_state_code: inv.shipToPartySite?.stateCode ?? inv.ship_to_state_code ?? "",

      building_name: inv.shipToPartySite?.buildingName ?? inv.building_name ?? "",
      ra_number: inv.referenceDetails?.raNo ?? inv.ra_number ?? "",
      work_description: inv.referenceDetails?.workDescription ?? inv.work_description ?? "",
      work_order_number: inv.referenceDetails?.woNo ?? inv.work_order_number ?? "",
      work_order_date: inv.referenceDetails?.woDate ?? "",
      service_date_from: inv.referenceDetails?.serviceDateFrom ?? inv.service_date_from ?? "",
      service_date_to: inv.referenceDetails?.serviceDateTo ?? inv.service_date_to ?? "",

      user_id: inv.user_id ?? rootUserId ?? "",
      user_name: inv.user_name ?? rootUserName ?? "",
      company_name: inv.seller?.name ?? "",
    },
    totals: {
      total_value_of_supply: inv.totals?.totalValueOfSupply ?? "",
      total_discount: inv.totals?.totalDiscount ?? "",
      total_taxable_value: inv.totals?.totalTaxableValue ?? "",
      total_cgst_amount: inv.totals?.totalCgstAmount ?? "",
      total_sgst_amount: inv.totals?.totalSgstAmount ?? "",
      total_amount: inv.totals?.totalAmount ?? "",

      total_invoice_amount_in_words: inv.summary?.totalInvoiceAmountInWords ?? "",
      total_amount_before_tax: inv.summary?.totalAmountBeforeTax ?? "",
      add_cgst: inv.summary?.addCgst ?? "",
      add_sgst: inv.summary?.addSgst ?? "",
      round_off: inv.summary?.roundOff ?? "",
      total_amount_after_tax: inv.summary?.totalAmountAfterTax ?? "",
      gst_on_reverse_charge: inv.summary?.gstOnReverseCharge ?? "",
      e_and_oe: inv.summary?.eAndOE ?? false,
    },
    bankDeclaration,
    declaration: bankDeclaration,
    items: items.map((row) => {
      const safeRow = isPlainObject(row) ? row : {};
      return {
        serial_number: safeRow.sNo ?? safeRow.sn ?? safeRow.serial_number ?? "",
        sn: safeRow.sNo ?? safeRow.sn ?? safeRow.serial_number ?? "",
        description: safeRow.goodsServiceDescription ?? safeRow.description ?? safeRow.goods_or_service_description ?? "",
        goods_or_service_description:
          safeRow.goodsServiceDescription ?? safeRow.goods_or_service_description ?? safeRow.description ?? "",
        sac_code: safeRow.sacCode ?? safeRow.sac_code ?? "",
        value_of_supply: safeRow.valueOfSupply ?? safeRow.value_of_supply ?? "",
        discount: safeRow.discount ?? "",
        taxable_value: safeRow.taxableValue ?? safeRow.taxable_value ?? "",
        cgst_rate: safeRow.cgst?.rate ?? safeRow.cgst_rate ?? "",
        cgst_amount: safeRow.cgst?.amount ?? safeRow.cgst_amount ?? "",
        sgst_rate: safeRow.sgst?.rate ?? safeRow.sgst_rate ?? "",
        sgst_amount: safeRow.sgst?.amount ?? safeRow.sgst_amount ?? "",
        line_total: safeRow.total ?? safeRow.line_total ?? safeRow.totalAmount ?? "",
        total: safeRow.total ?? safeRow.line_total ?? "",
      };
    }),
  };
};

export const lodhaFormToApiPayload = (formData, projectId) => {
  const header = formData?.header || {};
  const billingShipping = formData?.billingShipping || {};
  const projectWork = formData?.projectWork || {};
  const totals = formData?.totals || {};
  const bankDeclaration = formData?.bankDeclaration || {};
  const items = Array.isArray(formData?.items) ? formData.items : [];

  return {
    project_id: Number(projectId) || projectId || 0,
    user_id: header.user_id ?? "",
    user_name: header.user_name ?? "",
    invoice: {
      invoiceNo: header.invoice_number || "",
      invoiceDate: toIsoDateOnly(header.invoice_date),
      gstin: header.supplier_gstin || "",
      website: header.company_website || "",
      buyer: {
        name: billingShipping.buyer_name ?? "",
        address: billingShipping.buyer_address ?? "",
        stateName: billingShipping.buyer_state_name ?? "",
        stateCode: billingShipping.buyer_state_code ?? "",
        gstin: billingShipping.buyer_gstin ?? "",
      },
      receiverDetails: {
        name: billingShipping.receiver_name ?? "",
        address: billingShipping.receiver_address ?? "",
        placeOfSupply: billingShipping.place_of_supply ?? "",
      },
      workOrderDetails: {
        woNo: projectWork.work_order_number ?? "",
        woDate: toIsoDateOnly(projectWork.work_order_date ?? ""),
        plantName: projectWork.plant_name ?? "",
        billNo: projectWork.bill_no ?? "",
      },
      linkedMirIds: Array.isArray(formData?.linked_mir_ids) ? formData.linked_mir_ids : [],
      linkedItrIds: Array.isArray(formData?.linked_itr_ids) ? formData.linked_itr_ids : [],
      lineItems: items.map((row, index) => {
        const safeRow = isPlainObject(row) ? row : {};
        return {
          sn: Number(safeRow.sn ?? safeRow.serial_number ?? index + 1) || index + 1,
          descriptionOfServiceGoods: safeRow.description ?? safeRow.goods_or_service_description ?? "",
          sacHsnCode: safeRow.sac_code ?? "",
          uom: safeRow.uom ?? "",
          qty: toNumberOrZero(safeRow.qty),
          rate: toNumberOrZero(safeRow.rate),
          totalValueOfGoods: toNumberOrZero(safeRow.total_value_of_goods ?? safeRow.value_of_supply),
          discountIf: toNumberOrZero(safeRow.discount_if ?? safeRow.discount),
          taxableValue: toNumberOrZero(safeRow.taxable_value),
          cgst: {
            rate: toNumberOrZero(safeRow.cgst_rate),
            amount: toNumberOrZero(safeRow.cgst_amount),
          },
          sgst: {
            rate: toNumberOrZero(safeRow.sgst_rate),
            amount: toNumberOrZero(safeRow.sgst_amount),
          },
          igst: {
            rate: toNumberOrZero(safeRow.igst_rate),
            amount: toNumberOrZero(safeRow.igst_amount),
          },
          cess: {
            rate: toNumberOrZero(safeRow.cess_rate),
            amount: toNumberOrZero(safeRow.cess_amount),
          },
          line_total: toNumberOrZero(safeRow.line_total ?? safeRow.total ?? safeRow.lineTotal),
        };
      }),
      totals: {
        totalTaxableValue: toNumberOrZero(totals.total_taxable_value),
        totalCgstAmount: toNumberOrZero(totals.total_cgst),
        totalSgstAmount: toNumberOrZero(totals.total_sgst),
        totalIgstAmount: toNumberOrZero(totals.total_igst),
        totalCessAmount: toNumberOrZero(totals.total_cess),
        totalInvoiceValueFigure: toNumberOrZero(totals.total_invoice_value ?? totals.total_value),
        totalInvoiceValueWords: totals.total_invoice_value_words ?? totals.total_invoice_value_in_words ?? "",
      },
      declaration: bankDeclaration.declaration ?? "",
      electronicReferenceNumber: bankDeclaration.electronic_ref_number ?? "",
      authorisedSignatory: bankDeclaration.authorised_signatory ?? "",
    },
  };
};

export const lodhaApiToFormData = (apiInvoice) => {
  const { root, invoice: inv, items } = unwrapInvoiceShape(apiInvoice);
  const rootUserId = root.user_id ?? root.userId ?? "";
  const rootUserName = root.user_name ?? root.userName ?? "";

  return {
    header: {
      company_name: inv.company_name ?? "",
      company_address: inv.company_address ?? "",
      company_phone: inv.company_phone ?? inv.company_contact_number ?? "",
      company_email: inv.company_email ?? "",
      company_website: inv.website ?? inv.company_website ?? "",
      invoice_number: inv.invoiceNo ?? inv.invoice_number ?? "",
      invoice_date: inv.invoiceDate ?? inv.invoice_date ?? "",
      supplier_gstin: inv.gstin ?? inv.supplier_gstin ?? "",
      user_id: inv.user_id ?? rootUserId ?? "",
      user_name: inv.user_name ?? rootUserName ?? "",
    },
    billingShipping: {
      buyer_name: inv.buyer?.name ?? inv.buyer_name ?? "",
      buyer_address: inv.buyer?.address ?? inv.buyer_address ?? "",
      buyer_state_name: inv.buyer?.stateName ?? inv.buyer_state_name ?? "",
      buyer_state_code: inv.buyer?.stateCode ?? inv.buyer_state_code ?? "",
      buyer_gstin: inv.buyer?.gstin ?? inv.buyer_gstin ?? "",
      receiver_name: inv.receiverDetails?.name ?? inv.receiver_name ?? "",
      receiver_address: inv.receiverDetails?.address ?? inv.receiver_address ?? "",
      place_of_supply: inv.receiverDetails?.placeOfSupply ?? inv.place_of_supply ?? "",
    },
    projectWork: {
      work_order_number: inv.workOrderDetails?.woNo ?? inv.work_order_number ?? "",
      work_order_date: inv.workOrderDetails?.woDate ?? "",
      plant_name: inv.workOrderDetails?.plantName ?? inv.plant_name ?? "",
      bill_no: inv.workOrderDetails?.billNo ?? inv.bill_no ?? "",
    },
    totals: {
      total_taxable_value: inv.totals?.totalTaxableValue ?? inv.total_taxable_value ?? "",
      total_cgst: inv.totals?.totalCgstAmount ?? inv.total_cgst ?? "",
      total_sgst: inv.totals?.totalSgstAmount ?? inv.total_sgst ?? "",
      total_igst: inv.totals?.totalIgstAmount ?? inv.total_igst ?? "",
      total_cess: inv.totals?.totalCessAmount ?? inv.total_cess ?? "",
      total_value: inv.total_value ?? "",
      total_invoice_value: inv.totals?.totalInvoiceValueFigure ?? inv.total_invoice_value ?? "",
      total_invoice_value_words: inv.totals?.totalInvoiceValueWords ?? inv.total_invoice_value_words ?? "",
      total_invoice_value_in_words: inv.totals?.totalInvoiceValueWords ?? inv.total_invoice_value_words ?? "",
    },
    bankDeclaration: {
      declaration: inv.declaration ?? "",
      electronic_ref_number: inv.electronicReferenceNumber ?? inv.electronic_ref_number ?? "",
      electronic_ref_date: inv.electronic_ref_date ?? "",
      authorised_signatory: inv.authorisedSignatory ?? inv.authorised_signatory ?? "",
    },
    linked_mir_ids: Array.isArray(inv.linkedMirIds ?? inv.linked_mir_ids) ? (inv.linkedMirIds ?? inv.linked_mir_ids) : [],
    linked_itr_ids: Array.isArray(inv.linkedItrIds ?? inv.linked_itr_ids) ? (inv.linkedItrIds ?? inv.linked_itr_ids) : [],
    items: items.map((row) => {
      const safeRow = isPlainObject(row) ? row : {};
      return {
        serial_number: safeRow.sn ?? "",
        sn: safeRow.sn ?? "",
        description: safeRow.descriptionOfServiceGoods ?? safeRow.description ?? "",
        goods_or_service_description: safeRow.descriptionOfServiceGoods ?? safeRow.description ?? "",
        sac_code: safeRow.sacHsnCode ?? safeRow.sac_code ?? "",
        uom: safeRow.uom ?? "",
        qty: safeRow.qty ?? "",
        rate: safeRow.rate ?? "",
        total_value_of_goods: safeRow.totalValueOfGoods ?? safeRow.value_of_supply ?? "",
        discount_if: safeRow.discountIf ?? safeRow.discount ?? "",
        value_of_supply: safeRow.totalValueOfGoods ?? safeRow.value_of_supply ?? "",
        discount: safeRow.discountIf ?? safeRow.discount ?? "",
        taxable_value: safeRow.taxableValue ?? safeRow.taxable_value ?? "",
        cgst_rate: safeRow.cgst?.rate ?? safeRow.cgst_rate ?? "",
        cgst_amount: safeRow.cgst?.amount ?? safeRow.cgst_amount ?? "",
        sgst_rate: safeRow.sgst?.rate ?? safeRow.sgst_rate ?? "",
        sgst_amount: safeRow.sgst?.amount ?? safeRow.sgst_amount ?? "",
        igst_rate: safeRow.igst?.rate ?? safeRow.igst_rate ?? "",
        igst_amount: safeRow.igst?.amount ?? safeRow.igst_amount ?? "",
        cess_rate: safeRow.cess?.rate ?? safeRow.cess_rate ?? "",
        cess_amount: safeRow.cess?.amount ?? safeRow.cess_amount ?? "",
        line_total: safeRow.line_total ?? safeRow.total ?? safeRow.lineTotal ?? "",
      };
    }),
  };
};
