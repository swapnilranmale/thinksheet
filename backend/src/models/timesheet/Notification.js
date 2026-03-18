import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    tenant_id: {
        type: String,
        required: true,
        index: true
    },
    recipient_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: [
            'timesheet_submitted',      // employee submitted → notify manager
            'timesheet_approved',       // manager approved → notify employee
            'timesheet_rejected',       // manager rejected → notify employee
            'project_submitted',        // manager submitted project → notify admin
            'correction_requested',     // employee requested correction → notify manager
            'timesheet_reverted',       // manager reverted timesheet → notify employee
            'project_reverted',         // admin reverted project → notify manager
        ],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    // Reference to the related timesheet
    timesheet_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmployeeTimesheet',
        default: null
    },
    // Extra context for navigation
    metadata: {
        employee_id: { type: mongoose.Schema.Types.ObjectId, default: null },
        employee_name: { type: String, default: null },
        project_id: { type: mongoose.Schema.Types.ObjectId, default: null },
        project_name: { type: String, default: null },
        month: { type: Number, default: null },
        year: { type: Number, default: null },
    },
    is_read: {
        type: Boolean,
        default: false
    },
    read_at: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Indexes for fast queries
notificationSchema.index({ tenant_id: 1, recipient_id: 1, is_read: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
