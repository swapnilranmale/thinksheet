import mongoose from 'mongoose';

const projectSubmissionSchema = new mongoose.Schema({
    tenant_id: {
        type: String,
        required: true,
        index: true
    },
    project_id: {
        type: String,
        required: true
    },
    project_name: { type: String, default: '' },
    project_code: { type: String, default: '' },
    client_id: { type: String, default: null },
    client_name: { type: String, default: '' },
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
        enum: ['submitted', 'acknowledged'],
        default: 'submitted'
    },
    submitted_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    submitted_at: {
        type: Date,
        default: null
    },
    acknowledged_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    acknowledged_at: {
        type: Date,
        default: null
    },
    total_employees: { type: Number, default: 0 },
    total_billable_hours: { type: Number, default: 0 },
}, {
    timestamps: true
});

// One submission per project per month/year per tenant
projectSubmissionSchema.index(
    { project_id: 1, month: 1, year: 1, tenant_id: 1 },
    { unique: true }
);

export default mongoose.model('ProjectSubmission', projectSubmissionSchema);
