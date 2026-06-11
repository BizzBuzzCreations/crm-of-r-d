const mongoose = require('mongoose');

const LineItemSchema = new mongoose.Schema({
  description: { type: String, default: '' },
  quantity:    { type: Number, default: 1 },
  rate:        { type: Number, default: 0 },
  amount:      { type: Number, default: 0 },
}, { _id: false });

const InvoiceVersionSchema = new mongoose.Schema({
  snapshot: { type: mongoose.Schema.Types.Mixed },
  savedAt:  { type: Date, default: Date.now },
  savedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: false });

const InvoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: Number, unique: true },
  clientId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  title:         { type: String, default: '' },
  status:        {
    type: String,
    enum: ['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'],
    default: 'draft',
  },
  issueDate:     { type: String, default: '' },
  dueDate:       { type: String, default: '' },
  lineItems:     [LineItemSchema],
  subtotal:      { type: Number, default: 0 },
  taxRate:       { type: Number, default: 0 },
  taxAmount:     { type: Number, default: 0 },
  discount:      { type: Number, default: 0 },
  total:         { type: Number, default: 0 },
  paidAmount:    { type: Number, default: 0 },
  balanceDue:    { type: Number, default: 0 },
  currency:      { type: String, default: 'INR' },
  notes:         { type: String, default: '' },
  terms:         { type: String, default: '' },
  versions:      [InvoiceVersionSchema],
  createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sentAt:        { type: Date, default: null },
  // reminder tracking — prevents duplicate daily sends
  lastReminderSentAt: { type: Date, default: null },
  isDeleted:     { type: Boolean, default: false },
}, { timestamps: true });

// Auto-increment invoice number starting at 1001
InvoiceSchema.pre('save', async function (next) {
  if (this.isNew) {
    const Counter = mongoose.model('Counter');
    const counter = await Counter.findOneAndUpdate(
      { id: 'invoiceNumber' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.invoiceNumber = 1000 + counter.seq;
  }
  next();
});

const PaymentSchema = new mongoose.Schema({
  invoiceId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
  amount:         { type: Number, required: true },
  paymentDate:    { type: String, default: '' },
  method:         {
    type: String,
    enum: ['bank_transfer', 'upi', 'cheque', 'cash', 'card', 'other'],
    default: 'bank_transfer',
  },
  reference:      { type: String, default: '' },
  notes:          { type: String, default: '' },
  attachmentUrl:  { type: String, default: '' },
  attachmentName: { type: String, default: '' },
  recordedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Recompute invoice paidAmount + status after any payment change
async function syncInvoiceAfterPayment(invoiceId) {
  const Invoice = mongoose.model('Invoice');
  const Payment = mongoose.model('Payment');
  const payments = await Payment.find({ invoiceId }).lean();
  const paidAmount = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return;
  invoice.paidAmount = paidAmount;
  invoice.balanceDue = Math.max(0, invoice.total - paidAmount);
  if (paidAmount <= 0) {
    invoice.status = invoice.sentAt ? 'sent' : 'draft';
  } else if (paidAmount >= invoice.total) {
    invoice.status = 'paid';
  } else {
    invoice.status = 'partially_paid';
  }
  await invoice.save();
}

PaymentSchema.post('save', async function () {
  await syncInvoiceAfterPayment(this.invoiceId);
});

PaymentSchema.post('findOneAndDelete', async function (doc) {
  if (doc) await syncInvoiceAfterPayment(doc.invoiceId);
});

const Invoice = mongoose.model('Invoice', InvoiceSchema);
const Payment = mongoose.model('Payment', PaymentSchema);

module.exports = { Invoice, Payment };
