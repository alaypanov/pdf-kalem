/**
 * The invoice as plain data. Layout code (document.ts + components/) never
 * hardcodes content — swap this object (or load it from an API/CSV/DB) and
 * the same codebase renders a different invoice.
 */

export interface InvoiceParty {
  name: string;
  address: string;
  email: string;
}

export interface LineItem {
  description: string;
  quantity: string;
  rate: string;
  amount: string;
}

export interface InvoiceData {
  /** Brand chip in the header. */
  brand: string;
  title: string;
  subtitle: string;
  /** The "Invoice summary" card. */
  summary: {
    number: string;
    issueDate: string;
    dueDate: string;
  };
  from: InvoiceParty;
  billTo: InvoiceParty;
  /** The project bar under the parties row. */
  details: {
    project: string;
    terms: string;
    currency: string;
  };
  lineItems: LineItem[];
  notes: {
    message: string;
    terms: string;
  };
  totals: {
    subtotal: string;
    tax: string;
    total: string;
    balanceDue: string;
  };
  footer: {
    left: string;
    right: string;
  };
}

export const invoice: InvoiceData = {
  brand: 'ACME STUDIO',
  title: 'INVOICE',
  subtitle: 'Project delivery and implementation support.',
  summary: {
    number: 'INV-2026-014',
    issueDate: 'May 31, 2026',
    dueDate: 'June 14, 2026',
  },
  from: {
    name: 'Acme Studio LLC',
    address: '201 Market Street, San Francisco, CA 94105',
    email: 'billing@acmestudio.dev',
  },
  billTo: {
    name: 'Northwind Labs — Attn: Finance Team',
    address: '88 King Street, Toronto, ON M5V 1L7',
    email: 'accounts@northwindlabs.com',
  },
  details: {
    project: 'Website refresh and launch',
    terms: 'Net 14',
    currency: 'USD',
  },
  lineItems: [
    { description: 'Frontend implementation support', quantity: '12', rate: '$85.00', amount: '$1,020.00' },
    { description: 'Design system audit', quantity: '4', rate: '$120.00', amount: '$480.00' },
    { description: 'Performance optimization', quantity: '8', rate: '$120.00', amount: '$960.00' },
  ],
  notes: {
    message:
      'Thank you for your business. Please include the invoice number with your payment reference.',
    terms: 'Bank transfer preferred. Payment is due within 14 days of receipt.',
  },
  totals: {
    subtotal: '$2,460.00',
    tax: '$196.80',
    total: '$2,656.80',
    balanceDue: '$2,656.80',
  },
  footer: {
    left: 'Paid via bank transfer to ACME STUDIO LLC',
    right: 'Thank you',
  },
};