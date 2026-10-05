export type MillimetreCrmMapping = {
  zohoModule: string;
  millimetreEntity: "customer" | "project" | "quotation" | "purchase_order" | "contact";
  zohoIdField: string;
  millimetreIdField: string;
};

export const DEFAULT_ZOHO_MILLIMETRE_MAPPINGS: MillimetreCrmMapping[] = [
  { zohoModule: "Contacts", millimetreEntity: "contact", zohoIdField: "id", millimetreIdField: "zoho_contact_id" },
  { zohoModule: "Accounts", millimetreEntity: "customer", zohoIdField: "id", millimetreIdField: "zoho_account_id" },
  { zohoModule: "Deals", millimetreEntity: "project", zohoIdField: "id", millimetreIdField: "zoho_deal_id" },
  { zohoModule: "Quotes", millimetreEntity: "quotation", zohoIdField: "id", millimetreIdField: "zoho_quote_id" },
  { zohoModule: "Purchase_Orders", millimetreEntity: "purchase_order", zohoIdField: "id", millimetreIdField: "zoho_po_id" },
];
