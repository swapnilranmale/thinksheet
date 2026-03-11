import mongoose from 'mongoose';

const timesheetEntrySchema = new mongoose.Schema({
    date: { type: Date, required: true },
    status: {
        type: String,
        enum: ['Working', 'On leave', 'Holiday', 'Extra Working'],
        default: 'Working'
    },
    tasks: { type: [String], default: [] },
    worked_hours: { type: Number, min: 0, max: 24, default: 0 },
    billable_hours: { type: Number, min: 0, max: 24, default: 0 },
    completed_task: { type: Boolean, default: false },
    completed_task_description: { type: String, default: '' },
    unplanned_task: { type: Boolean, default: false },
    actual_hours: { type: Number, min: 0, max: 24, default: 0 },
    comments: { type: String, default: '' }
}, { _id: true });

const timesheetSchema = new mongoose.Schema({
    tenant_id: {
        type: String,
        required: true,
        index: true
    },
    employee_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    month: {
        type: Number,
        required: true,
        min: 1,
        max: 12
    },
    year: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['draft', 'submitted'],
        default: 'draft'
    },
    entries: [timesheetEntrySchema],
    submitted_at: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// One timesheet per employee per month/year per tenant
timesheetSchema.index(
    { user_id: 1, month: 1, year: 1, tenant_id: 1 },
    { unique: true }
);
timesheetSchema.index({ tenant_id: 1, employee_id: 1 });
timesheetSchema.index({ tenant_id: 1, status: 1 });

export default mongoose.model('EmployeeTimesheet', timesheetSchema);
